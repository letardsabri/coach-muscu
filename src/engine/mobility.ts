/**
 * Étirements et mobilité : déroulé guidé, adaptation cheville, PNF, progression du temps de maintien,
 * suivi hebdomadaire et jours recommandés. Fonctions pures, testées.
 *
 * Principes appliqués (étape 3) :
 * - statique 30–60 s, 2–3 passages ; progression par le temps de maintien (+15 s par niveau, max 60 s) ;
 * - PNF optionnel (étirer → contracter → relâcher et approfondir) sur adducteurs et ischios ;
 * - jamais de long statique avant un effort explosif : la routine « express » est dynamique ;
 * - 3 à 5 séances par semaine, recommandées, jamais obligatoires.
 */
import type { MobiliteData, MobilityExercise, Routine } from '../data/mobiliteData';
import type { DayKey, MmaSession, MobilityFeeling, MobilitySession, MobilitySettings } from '../db/models';
import { addDays, diffDays } from '../lib/dates';
import type { CalendarDay } from './schedule';

export function defaultMobilitySettings(): MobilitySettings {
  return { pnf: false, holdLevel: 0, easyStreak: 0 };
}

// ---------------------------------------------------------------------------
// Déroulé guidé
// ---------------------------------------------------------------------------

export type StepPhase = 'hold' | 'stretch' | 'contract' | 'relax';

export interface TimelineStep {
  kind: 'prep' | 'work';
  sec: number;
  exercise: MobilityExercise;
  /** « gauche » / « droite » pour les exercices unilatéraux. */
  side?: 'gauche' | 'droite';
  phase?: StepPhase;
  set: number;
  sets: number;
  /** Texte court affiché en grand. */
  label: string;
}

export interface Timeline {
  steps: TimelineStep[];
  totalSec: number;
  /** Nombre de positions (hors préparation), pour le suivi. */
  positions: number;
  /** Exercices remplacés à cause du mode cheville. */
  replaced: { from: string; to: string }[];
}

export function holdSeconds(base: number, ex: MobilityExercise, level: number, data: MobiliteData): number {
  if (ex.type !== 'statique') return base;
  return Math.min(data.settings.maxHoldSec, base + level * data.settings.levelStepSec);
}

export function resolveExercise(id: string, data: MobiliteData, ankleMode: boolean): MobilityExercise {
  const ex = data.exercices.find((e) => e.id === id)!;
  if (ankleMode && ex.cheville === 'forte' && ex.remplacement) return data.exercices.find((e) => e.id === ex.remplacement)!;
  return ex;
}

export function buildTimeline(routine: Routine, data: MobiliteData, opts: { ankleMode: boolean; settings: MobilitySettings }): Timeline {
  const { prepSec, pnf } = data.settings;
  const steps: TimelineStep[] = [];
  const replaced: Timeline['replaced'] = [];
  let positions = 0;

  for (const el of routine.elements) {
    const ex = resolveExercise(el.exercice, data, opts.ankleMode);
    if (ex.id !== el.exercice) replaced.push({ from: el.exercice, to: ex.id });
    const sides: (TimelineStep['side'] | undefined)[] = ex.cotes ? ['gauche', 'droite'] : [undefined];
    const usePnf = opts.settings.pnf && ex.pnf;

    for (let set = 1; set <= el.passages; set++) {
      for (const side of sides) {
        const firstOfExercise = set === 1 && side === sides[0];
        steps.push({
          kind: 'prep',
          sec: prepSec,
          exercise: ex,
          side,
          set,
          sets: el.passages,
          label: firstOfExercise ? 'Mets-toi en place' : side === 'droite' ? 'Changez de côté' : 'Relâche, on recommence',
        });
        positions++;
        if (usePnf) {
          steps.push({ kind: 'work', sec: pnf.stretchSec, exercise: ex, side, set, sets: el.passages, phase: 'stretch', label: 'Étire' });
          steps.push({ kind: 'work', sec: pnf.contractSec, exercise: ex, side, set, sets: el.passages, phase: 'contract', label: 'Contracte (pousse contre le sol)' });
          steps.push({ kind: 'work', sec: pnf.relaxSec, exercise: ex, side, set, sets: el.passages, phase: 'relax', label: 'Relâche et va plus loin' });
        } else {
          const sec = holdSeconds(el.secondes, ex, opts.settings.holdLevel, data);
          steps.push({ kind: 'work', sec, exercise: ex, side, set, sets: el.passages, phase: 'hold', label: ex.type === 'statique' ? 'Tiens la position' : 'En mouvement' });
        }
      }
    }
  }
  return { steps, totalSec: steps.reduce((n, s) => n + s.sec, 0), positions, replaced };
}

/** Position dans le déroulé pour un temps écoulé (pauses exclues). null = routine terminée. */
export function positionAt(timeline: Timeline, elapsedSec: number): { index: number; remaining: number } | null {
  let t = 0;
  for (const [index, s] of timeline.steps.entries()) {
    if (elapsedSec < t + s.sec) return { index, remaining: t + s.sec - elapsedSec };
    t += s.sec;
  }
  return null;
}

/** Temps écoulé au début d'une étape (pour « passer » ou « revenir »). */
export function startOfStep(timeline: Timeline, index: number): number {
  return timeline.steps.slice(0, Math.max(0, index)).reduce((n, s) => n + s.sec, 0);
}

/** Nombre de positions commencées pour un temps écoulé (suivi). */
export function positionsReached(timeline: Timeline, elapsedSec: number): number {
  const pos = positionAt(timeline, elapsedSec);
  const until = pos ? pos.index : timeline.steps.length;
  return timeline.steps.slice(0, until).filter((s) => s.kind === 'work' && (s.phase === 'hold' || s.phase === 'relax')).length;
}

// ---------------------------------------------------------------------------
// Progression du temps de maintien
// ---------------------------------------------------------------------------

/**
 * « Facile » N fois de suite → niveau +1 ; « difficile » → niveau −1 ; « correct » remet la série à zéro.
 */
export function nextSettings(s: MobilitySettings, feeling: MobilityFeeling, data: MobiliteData): { settings: MobilitySettings; change: -1 | 0 | 1 } {
  if (feeling === 'difficile') {
    return { settings: { ...s, holdLevel: Math.max(0, s.holdLevel - 1), easyStreak: 0 }, change: s.holdLevel > 0 ? -1 : 0 };
  }
  if (feeling === 'correct') return { settings: { ...s, easyStreak: 0 }, change: 0 };
  const streak = s.easyStreak + 1;
  if (streak >= data.settings.easyToLevelUp && s.holdLevel < data.settings.maxLevel) {
    return { settings: { ...s, holdLevel: s.holdLevel + 1, easyStreak: 0 }, change: 1 };
  }
  return { settings: { ...s, easyStreak: streak }, change: 0 };
}

// ---------------------------------------------------------------------------
// Suivi
// ---------------------------------------------------------------------------

/** Une séance compte si au moins la moitié du temps prévu a été faite. */
export const counts = (s: MobilitySession) => s.durationSec >= s.plannedSec * 0.5;

export function weekStats(sessions: MobilitySession[], monday: DayKey) {
  const inWeek = sessions.filter((s) => counts(s) && diffDays(s.day, monday) >= 0 && diffDays(s.day, monday) < 7);
  return { sessions: inWeek.length, minutes: Math.round(inWeek.reduce((n, s) => n + s.durationSec, 0) / 60) };
}

/**
 * Série de régularité : semaines consécutives avec au moins `min` séances. La semaine en cours
 * compte si elle est déjà atteinte ; sinon la série court jusqu'à la semaine précédente.
 */
export function regularityStreak(sessions: MobilitySession[], currentMonday: DayKey, min: number): number {
  let streak = 0;
  let monday = currentMonday;
  if (weekStats(sessions, monday).sessions < min) monday = addDays(monday, -7);
  while (weekStats(sessions, monday).sessions >= min) {
    streak++;
    monday = addDays(monday, -7);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Jours recommandés (calendrier)
// ---------------------------------------------------------------------------

/**
 * Pour une semaine : récupération haut du corps les jours de séance, puis souplesse hanches et
 * complète sur les premiers jours de repos, sans dépasser le maximum hebdomadaire.
 * Un jour de MMA intense sans séance : rien de long (l'express reste disponible).
 */
export function recommendedRoutines(week: CalendarDay[], mma: MmaSession[], data: MobiliteData): Map<DayKey, string> {
  const max = data.settings.weeklyTarget.max;
  const out = new Map<DayKey, string>();
  const intense = new Set(mma.filter((m) => m.kind === 'intense').map((m) => m.day));
  const isTraining = (d: CalendarDay) => d.done.some((s) => s.type === 'A' || s.type === 'B' || s.type === 'F') || d.planned !== undefined;

  for (const d of week) if (isTraining(d) && out.size < max) out.set(d.day, 'recup_haut');
  const restOrder = ['hanches', 'complete'];
  let i = 0;
  for (const d of week) {
    if (out.size >= max || i >= restOrder.length) break;
    if (isTraining(d) || intense.has(d.day)) continue;
    out.set(d.day, restOrder[i++]!);
  }
  return out;
}
