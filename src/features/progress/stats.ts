/**
 * Statistiques dérivées de l'historique, pour le tableau de bord et les graphiques.
 * Le volume de données d'un pratiquant (quelques milliers de séries par an) se calcule en mémoire.
 */
import type { Programme } from '../../data/programmeSchema';
import type { BodyMetric, Session, SetLog } from '../../db/models';
import type { Point } from '../../engine/body';
import { exposureIndex } from '../../engine/performance';
import { weekStart } from '../../engine/schedule';
import { addDays, dayKey, diffDays } from '../../lib/dates';

export interface ExposurePoint {
  day: string;
  sessionId: string;
  /** Indice R5 (e1RM en kg, ou reps × coef. pour les exercices sans charge). */
  index: number;
  bestReps: number;
  totalReps: number;
  loadKg: number;
  variantId: string;
  bodyweightKg: number;
}

/** Historique d'un exercice, une entrée par séance terminée où il a été fait. */
export function exerciseHistory(
  p: Programme,
  sessions: Session[],
  sets: SetLog[],
  exerciseId: string,
  fallbackBodyweight: number,
): ExposurePoint[] {
  const bySession = groupBy(sets, (s) => s.sessionId);
  const points: ExposurePoint[] = [];
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const own = bySession.get(s.id) ?? [];
    s.plan.forEach((pe, i) => {
      if (pe.exerciseId !== exerciseId) return;
      const exSets = own.filter((x) => x.exerciseIndex === i);
      if (exSets.length === 0) return;
      points.push({
        day: s.day,
        sessionId: s.id,
        index: exposureIndex(p, s, own, i, fallbackBodyweight),
        bestReps: Math.max(...exSets.map((x) => x.reps)),
        totalReps: exSets.reduce((n, x) => n + x.reps, 0),
        loadKg: exSets[exSets.length - 1]!.loadKg,
        variantId: exSets[exSets.length - 1]!.variantId,
        bodyweightKg: s.bodyweightKg ?? fallbackBodyweight,
      });
    });
  }
  return points.sort((a, b) => a.day.localeCompare(b.day));
}

/** Regroupement des muscles du programme en groupes affichés. */
export const MUSCLE_GROUPS: Record<string, string> = {
  dos: 'Dos',
  haut_du_dos: 'Dos',
  pectoraux: 'Pectoraux',
  deltoide_lat: 'Épaules',
  deltoide_post: 'Épaules',
  deltoide_ant: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Jambes',
  fessiers: 'Jambes',
  ischios: 'Jambes',
  abdominaux: 'Abdos',
  obliques: 'Abdos',
};

export const GROUP_ORDER = ['Dos', 'Pectoraux', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Abdos'];

/**
 * Séries hebdomadaires par groupe : 1 pour le muscle principal de l'exercice (premier listé),
 * 0,5 pour les muscles secondaires d'un autre groupe — convention courante du « volume effectif ».
 */
export function weeklyVolume(p: Programme, sets: SetLog[], fromWeek: string, weeks: number) {
  const result = Array.from({ length: weeks }, (_, i) => ({
    week: addDays(fromWeek, i * 7),
    groups: Object.fromEntries(GROUP_ORDER.map((g) => [g, 0])) as Record<string, number>,
  }));
  for (const s of sets) {
    const wk = weekStart(dayKey(new Date(s.completedAt)));
    const slot = result[Math.floor(diffDays(wk, fromWeek) / 7)];
    const muscles = p.exercises[s.exerciseId]?.muscles;
    if (!slot || !muscles) continue;
    const primary = MUSCLE_GROUPS[muscles[0]!];
    if (primary) slot.groups[primary]! += 1;
    const secondary = new Set(muscles.slice(1).map((m) => MUSCLE_GROUPS[m]).filter((g): g is string => !!g && g !== primary));
    for (const g of secondary) slot.groups[g]! += 0.5;
  }
  return result;
}

/** Série de poids triée par jour (une valeur par jour : la dernière saisie). */
export function weightPoints(metrics: BodyMetric[]): Point[] {
  return metricPoints(metrics, (m) => m.weightKg);
}

export function metricPoints(metrics: BodyMetric[], pick: (m: BodyMetric) => number | undefined): Point[] {
  const byDay = new Map<string, number>();
  for (const m of [...metrics].sort((a, b) => a.createdAt - b.createdAt)) {
    const v = pick(m);
    if (v !== undefined) byDay.set(m.day, v);
  }
  return [...byDay.entries()].map(([day, value]) => ({ day, value })).sort((a, b) => a.day.localeCompare(b.day));
}

export function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = map.get(k);
    if (list) list.push(it);
    else map.set(k, [it]);
  }
  return map;
}

/** « 2 nov. » */
export function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
