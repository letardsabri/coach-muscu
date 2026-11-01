/**
 * Intégrations matérielles du mode entraînement : écran allumé, son, horloge.
 */
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Écran allumé (Screen Wake Lock API, iOS ≥ 16.4)
// ---------------------------------------------------------------------------

/** Garde l'écran allumé tant que `enabled`. iOS libère le verrou en arrière-plan : on le reprend au retour. */
export function useWakeLock(enabled: boolean): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        setActive(true);
        sentinel.addEventListener('release', () => setActive(false));
      } catch {
        setActive(false);
      }
    };
    const onVisibility = () => void acquire();

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
    };
  }, [enabled]);

  return active;
}

// ---------------------------------------------------------------------------
// Sons (Web Audio) et cohabitation avec la musique
// ---------------------------------------------------------------------------
//
// Safari ≥ 16.4 expose `navigator.audioSession.type`, qui choisit la catégorie audio iOS :
// - « playback » : comme un lecteur de musique → COUPE Spotify / Apple Music (ancien comportement, bug) ;
// - « transient » : son court qui BAISSE brièvement la musique puis la laisse reprendre ;
// - « ambient » : se mélange à la musique sans la toucher.
// « transient » et « ambient » respectent le bouton silencieux de l'iPhone ; seul « playback » sonne en
// mode silencieux. D'où le réglage « Mode du son » : mélanger (défaut) ou toujours audible.
//
// Le contexte audio reste actif en « ambient » (sans effet sur la musique) ; on passe en « transient »
// (ou « playback ») seulement le temps du bip, puis on revient en « ambient ». On ne suspend pas le
// contexte : iOS n'autorise pas toujours sa reprise sans un tap de l'utilisateur.
// Repli : sans audioSession (iOS < 16.4), Web Audio se comporte comme « ambient ».

export type SoundMode = 'mix' | 'loud';

let ctx: AudioContext | null = null;
let suspendTimer: number | undefined;
const prefs = { volume: 0.8, mode: 'mix' as SoundMode };

/** Réglages du son (profil) : volume 0–1 et mode. */
export function setSoundPrefs(p: { volume?: number; mode?: SoundMode }): void {
  if (p.volume !== undefined) prefs.volume = Math.min(1, Math.max(0.05, p.volume));
  if (p.mode) prefs.mode = p.mode;
}

type SessionNavigator = Navigator & { audioSession?: { type: string } };

function setSessionType(type: 'ambient' | 'transient' | 'playback'): void {
  try {
    const nav = navigator as SessionNavigator;
    if (nav.audioSession) nav.audioSession.type = type;
  } catch {
    // API absente ou refusée : comportement par défaut de Web Audio.
  }
}

/** Disponibilité de l'API Audio Session (affichée dans les réglages). */
export const audioSessionSupported = () => typeof navigator !== 'undefined' && 'audioSession' in navigator;

/**
 * À appeler dans un geste utilisateur (tap) : iOS n'autorise le son qu'après une interaction.
 * En « ambient » pour ne pas interrompre la musique, puis suspendu jusqu'au prochain bip.
 */
export function unlockAudio(): void {
  try {
    setSessionType('ambient');
    ctx ??= new AudioContext();
    void ctx.resume().then(() => {
      if (!ctx) return;
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, 22_050);
      source.connect(ctx.destination);
      source.start(0);
      releaseSoon(300);
    });
  } catch {
    // Pas de son disponible : l'alerte visuelle reste.
  }
}

function releaseSoon(ms: number): void {
  window.clearTimeout(suspendTimer);
  suspendTimer = window.setTimeout(() => setSessionType('ambient'), ms); // rend la main à la musique
}

/** Joue une suite de notes [fréquence, début en s, durée en s] avec la catégorie audio choisie. */
function play(notes: [number, number, number][]): void {
  if (!ctx) return;
  setSessionType(prefs.mode === 'loud' ? 'playback' : 'transient');
  const c = ctx;
  void c.resume().then(() => {
    const t0 = c.currentTime + 0.03;
    const peak = 0.6 * prefs.volume;
    for (const [freq, at, dur] of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = t0 + at;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    const end = Math.max(...notes.map(([, at, dur]) => at + dur));
    releaseSoon(end * 1000 + 400);
  });
}

/** Fin de repos : trois bips courts, le dernier plus aigu. */
export function playRestEnd(): void {
  play([
    [880, 0, 0.2],
    [880, 0.28, 0.2],
    [1320, 0.56, 0.22],
  ]);
}

/** Un bip court (changement de position en mode guidé). `high` = fin de routine. */
export function playTick(high = false): void {
  play([[high ? 1320 : 990, 0, 0.25]]);
}

// ---------------------------------------------------------------------------
// Horloge
// ---------------------------------------------------------------------------

/**
 * Heure courante rafraîchie régulièrement. Le minuteur de repos ne compte jamais lui-même :
 * il compare `restEndsAt` à cette heure, donc il est juste même après un verrouillage d'écran.
 */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}
