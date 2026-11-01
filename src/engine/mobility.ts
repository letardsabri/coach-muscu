/**
 * Souplesse MMA / Muay Thaï : déroulé guidé (temps, répétitions, cycles PNF), adaptation cheville,
 * progression (maintien, répétitions, charge), suivi hebdomadaire et jours recommandés. Fonctions pures, testées.
 *
 * Principes appliqués :
 * - séances indépendantes : préparation articulaire → étirements de développement → renforcement en amplitude ;
 * - maintiens 45 → 60 → 75 → 90 s, PNF (contracter 6 s, relâcher et gagner de l'amplitude 25 s, 3 cycles) ;
 * - jamais juste avant une séance de muscu ou de MMA : jours sans entraînement en priorité, sinon le soir ;
 * - 3 à 4 séances par semaine, recommandées, jamais obligatoires.
 */
import type { Seance, SeanceElement, SoupleExercise, SouplesseData } from '../data/souplesseData';
import type { DayKey, MmaSession, MobilityFeeling, MobilitySession, MobilitySettings } from '../db/models';
import { addDays, diffDays } from '../lib/dates';
import type { CalendarDay } from './schedule';

export function defaultMobilitySettings(): MobilitySettings {
  return { pnf: false, holdLevel: 0, easyStreak: 0 };
}

// ---------------------------------------------------------------------------
// Déroulé guidé
// ---------------------------------------------------------------------------

export type StepPhase = 'hold' | 'reps' | 'settle' | 'contract' | 'relax';

export interface TimelineStep {
  kind: 'prep' | 'work';
  sec: number;
  exercise: SoupleExercise;
  bloc: string;
  /** « gauche » / « droite » pour les exercices unilatéraux. */
  side?: 'gauche' | 'droite';
  phase?: StepPhase;
  set: number;
  sets: number;
  /** Cycles PNF. */
  cycle?: number;
  cycles?: number;
  /** Répétitions guidées au tempo. */
  reps?: number;
  tempo?: number;
  /** Charge proposée (étirement chargé). */
  loadKg?: number;
  /** Dernière étape d'une position (suivi des positions faites). */
  last?: boolean;
  /** Texte court affiché en grand. */
  label: string;
}

export interface Timeline {
  steps: TimelineStep[];
  totalSec: number;
  /** Nombre de positions (exercice × côté × passage), pour le suivi. */
  positions: number;
  /** Exercices remplacés à cause du mode cheville. */
  replaced: { from: string; to: string }[];
}

const levelOf = (s: MobilitySettings, data: SouplesseData) => Math.max(0, Math.min(data.settings.maxLevel, s.holdLevel));

export function holdSeconds(el: SeanceElement, level: number, data: SouplesseData): number {
  const base = el.secondes ?? data.settings.hold.baseSec;
  if (!el.progressif) return base;
  const { stepSec, maxSec } = data.settings.hold;
  return Math.min(maxSec, base + level * stepSec);
}

export const repsFor = (el: SeanceElement, level: number, data: SouplesseData) => (el.reps ?? 0) + level * data.settings.repsParNiveau;

export function loadFor(ex: SoupleExercise, level: number, data: SouplesseData): number | undefined {
  if (!ex.charge) return undefined;
  const list = ex.chargesKg ?? data.settings.chargesKg;
  return list[Math.min(level, list.length - 1)];
}

export function resolveExercise(id: string, data: SouplesseData, ankleMode: boolean): SoupleExercise {
  const ex = data.exercices.find((e) => e.id === id)!;
  if (ankleMode && ex.cheville === 'forte' && ex.remplacement) return data.exercices.find((e) => e.id === ex.remplacement)!;
  return ex;
}

export function buildTimeline(seance: Seance, data: SouplesseData, opts: { ankleMode: boolean; settings: MobilitySettings }): Timeline {
  const { prepSec, pnf } = data.settings;
  const level = levelOf(opts.settings, data);
  const steps: TimelineStep[] = [];
  const replaced: Timeline['replaced'] = [];
  let positions = 0;

  for (const el of seance.elements) {
    const ex = resolveExercise(el.exercice, data, opts.ankleMode);
    if (ex.id !== el.exercice) replaced.push({ from: el.exercice, to: ex.id });
    const sides: (TimelineStep['side'] | undefined)[] = ex.cotes ? ['gauche', 'droite'] : [undefined];
    const loadKg = loadFor(ex, level, data);
    const common = { exercise: ex, bloc: el.bloc, sets: el.passages, loadKg };

    for (let set = 1; set <= el.passages; set++) {
      for (const side of sides) {
        const firstOfExercise = set === 1 && side === sides[0];
        const label = firstOfExercise ? 'Mets-toi en place' : side === 'droite' ? 'Changez de côté' : 'Relâche, on recommence';
        steps.push({ ...common, kind: 'prep', sec: prepSec, side, set, label });
        positions++;
        const work: TimelineStep[] = [];
        if (el.mode === 'pnf') {
          if (pnf.settleSec > 0) work.push({ ...common, kind: 'work', sec: pnf.settleSec, side, set, phase: 'settle', label: 'Installe-toi dans l’étirement' });
          for (let cycle = 1; cycle <= pnf.cycles; cycle++) {
            const c = { ...common, kind: 'work' as const, side, set, cycle, cycles: pnf.cycles };
            work.push({ ...c, sec: pnf.contractSec, phase: 'contract', label: 'Contracte' });
            work.push({ ...c, sec: pnf.relaxSec, phase: 'relax', label: 'Relâche et gagne de l’amplitude' });
          }
        } else if (el.mode === 'reps') {
          const reps = repsFor(el, level, data);
          work.push({ ...common, kind: 'work', sec: reps * el.tempo!, side, set, phase: 'reps', reps, tempo: el.tempo, label: `${reps} répétitions lentes` });
        } else {
          work.push({ ...common, kind: 'work', sec: holdSeconds(el, level, data), side, set, phase: 'hold', label: el.bloc === 'preparation' ? 'En mouvement, sans forcer' : 'Tiens la position' });
        }
        work[work.length - 1]!.last = true;
        steps.push(...work);
      }
    }
  }
  return { steps, totalSec: steps.reduce((n, s) => n + s.sec, 0), positions, replaced };
}

/** Position dans le déroulé pour un temps écoulé (pauses exclues). null = séance terminée. */
export function positionAt(timeline: Timeline, elapsedSec: number): { index: number; remaining: number } | null {
  let t = 0;
  for (const [index, s] of timeline.steps.entries()) {
    if (elapsedSec < t + s.sec) return { index, remaining: t + s.sec - elapsedSec };
    t += s.sec;
  }
  return null;
}

/** Temps écoulé au début d'une étape (pour « passer », « revenir » ou « fini »). */
export function startOfStep(timeline: Timeline, index: number): number {
  return timeline.steps.slice(0, Math.max(0, index)).reduce((n, s) => n + s.sec, 0);
}

/** Nombre de positions terminées pour un temps écoulé (suivi). */
export function positionsReached(timeline: Timeline, elapsedSec: number): number {
  const pos = positionAt(timeline, elapsedSec);
  const until = pos ? pos.index : timeline.steps.length;
  return timeline.steps.slice(0, until).filter((s) => s.last).length;
}

/** Répétition en cours (1-based) dans une étape au tempo. */
export function currentRep(step: TimelineStep, remaining: number): number {
  if (!step.reps || !step.tempo) return 0;
  return Math.min(step.reps, Math.floor((step.sec - remaining) / step.tempo) + 1);
}

// ---------------------------------------------------------------------------
// Progression : maintiens, répétitions, charge
// ---------------------------------------------------------------------------

/**
 * « Facile » N fois de suite → niveau +1 ; « difficile » → niveau −1 ; « correct » remet la série à zéro.
 * Le niveau fait monter ensemble les maintiens (+15 s), les répétitions (+1) et la charge proposée.
 */
export function nextSettings(s: MobilitySettings, feeling: MobilityFeeling, data: SouplesseData): { settings: MobilitySettings; change: -1 | 0 | 1 } {
  const level = levelOf(s, data);
  if (feeling === 'difficile') {
    return { settings: { ...s, holdLevel: Math.max(0, level - 1), easyStreak: 0 }, change: level > 0 ? -1 : 0 };
  }
  if (feeling === 'correct') return { settings: { ...s, holdLevel: level, easyStreak: 0 }, change: 0 };
  const streak = s.easyStreak + 1;
  if (streak >= data.settings.easyToLevelUp && level < data.settings.maxLevel) {
    return { settings: { ...s, holdLevel: level + 1, easyStreak: 0 }, change: 1 };
  }
  return { settings: { ...s, holdLevel: level, easyStreak: streak }, change: 0 };
}

/** Résumé lisible du niveau (écran Souplesse). */
export function levelSummary(s: MobilitySettings, data: SouplesseData) {
  const level = levelOf(s, data);
  const { baseSec, stepSec, maxSec } = data.settings.hold;
  return {
    level,
    maxLevel: data.settings.maxLevel,
    holdSec: Math.min(maxSec, baseSec + level * stepSec),
    extraReps: level * data.settings.repsParNiveau,
    loadKg: data.settings.chargesKg[Math.min(level, data.settings.chargesKg.length - 1)]!,
  };
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

export interface StretchReco {
  seance: string;
  /** Jour d'entraînement : à faire le soir, à distance de la séance. */
  evening: boolean;
}

/** Choisit k éléments régulièrement espacés dans une liste triée. */
function spread<T>(list: T[], k: number): T[] {
  if (k >= list.length) return list;
  return Array.from({ length: k }, (_, i) => list[Math.floor((i * list.length) / k + list.length / (2 * k))]!);
}

/**
 * Pour une semaine : jusqu'à `max` séances, d'abord sur les jours sans muscu ni MMA (régulièrement
 * espacés). S'il y en a moins que `min`, on complète avec des jours de muscu, « le soir » ; jamais un
 * jour de MMA intense. Ordre : hanches & adducteurs, kicks & teeps, dos & grappling, complète.
 */
export function recommendedRoutines(week: CalendarDay[], mma: MmaSession[], data: SouplesseData): Map<DayKey, StretchReco> {
  const { min, max } = data.settings.weeklyTarget;
  const mmaDays = new Map<DayKey, MmaSession['kind'][]>();
  for (const m of mma) mmaDays.set(m.day, [...(mmaDays.get(m.day) ?? []), m.kind]);
  const isStrength = (d: CalendarDay) => d.done.some((s) => s.type === 'A' || s.type === 'B' || s.type === 'F') || d.planned !== undefined;

  const free = week.filter((d) => !isStrength(d) && !mmaDays.has(d.day));
  const chosen: { day: DayKey; evening: boolean }[] = spread(free, max).map((d) => ({ day: d.day, evening: false }));
  if (chosen.length < min) {
    const evenings = week.filter((d) => !free.includes(d) && !(mmaDays.get(d.day) ?? []).includes('intense'));
    for (const d of spread(evenings, min - chosen.length)) chosen.push({ day: d.day, evening: true });
  }
  chosen.sort((a, b) => diffDays(a.day, b.day));

  const order = data.seances.map((s) => s.id);
  const out = new Map<DayKey, StretchReco>();
  chosen.forEach((c, i) => out.set(c.day, { seance: order[i % order.length]!, evening: c.evening }));
  return out;
}
