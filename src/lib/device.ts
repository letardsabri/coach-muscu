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
// Son de fin de repos (Web Audio)
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

/**
 * À appeler dans un geste utilisateur (tap) : iOS n'autorise le son qu'après une interaction.
 * `audioSession.type = 'playback'` (Safari ≥ 16.4) permet de sonner même en mode silencieux.
 */
export function unlockAudio(): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
    ctx ??= new AudioContext();
    if (ctx.state !== 'running') void ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22_050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Pas de son disponible : l'alerte visuelle reste.
  }
}

/** Trois bips courts, le dernier plus aigu. */
export function playRestEnd(): void {
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  [880, 880, 1320].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    const t = t0 + i * 0.28;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
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

/** Un bip court (changement de position en mode étirement guidé). `high` = fin de routine. */
export function playTick(high = false): void {
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  const t = ctx.currentTime + 0.02;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = high ? 1320 : 990;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.27);
}
