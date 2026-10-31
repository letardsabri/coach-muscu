/**
 * Composition corporelle (PROGRAMME.md §12).
 * Le poids du jour varie de ±1 kg avec l'eau et le sel : on raisonne sur la moyenne glissante de 7 jours.
 */
import type { Programme } from '../data/programmeSchema';
import type { DayKey } from '../db/models';
import { diffDays } from '../lib/dates';

export interface Point {
  day: DayKey;
  value: number;
}

/** Moyenne des mesures des 7 derniers jours (jour inclus), pour chaque jour mesuré. Entrée triée par jour. */
export function rollingAverage(points: Point[], windowDays = 7): Point[] {
  return points.map((p) => {
    const win = points.filter((q) => {
      const d = diffDays(p.day, q.day);
      return d >= 0 && d < windowDays;
    });
    return { day: p.day, value: win.reduce((s, q) => s + q.value, 0) / win.length };
  });
}

export interface WeightTrend {
  /** Moyenne 7 j la plus récente. */
  current: number;
  /** Variation hebdomadaire en % du poids, sur ~4 semaines (négatif = perte). */
  weeklyPct?: number;
  message?: { tone: 'ok' | 'warn'; text: string };
}

export function weightTrend(points: Point[], p: Programme, goalKg: number): WeightTrend | undefined {
  const avg = rollingAverage(points);
  const last = avg[avg.length - 1];
  if (!last) return undefined;

  // Point de comparaison : la moyenne la plus proche de 28 jours plus tôt (au moins 14 jours d'écart).
  const ref = [...avg].reverse().find((q) => diffDays(last.day, q.day) >= 28) ?? avg.find((q) => diffDays(last.day, q.day) >= 14);
  if (!ref) return { current: last.value };

  const weeks = diffDays(last.day, ref.day) / 7;
  const weeklyPct = ((last.value - ref.value) / ref.value / weeks) * 100;
  const [minLoss, maxLoss] = p.body.lossRatePctPerWeek;
  const loss = -weeklyPct;

  let message: WeightTrend['message'];
  if (last.value <= goalKg) message = { tone: 'ok', text: 'Objectif de poids atteint.' };
  else if (loss > p.body.fastLossAlertPctPerWeek)
    message = { tone: 'warn', text: `Perte de ${loss.toFixed(1)} %/sem : trop rapide, risque de perdre du muscle. Remonte un peu les calories.` };
  else if (loss > maxLoss) message = { tone: 'warn', text: `Perte de ${loss.toFixed(1)} %/sem : un peu au-dessus de la zone conseillée (${minLoss}–${maxLoss} %).` };
  else if (loss >= minLoss) message = { tone: 'ok', text: `Perte de ${loss.toFixed(1)} %/sem : dans la zone conseillée.` };
  else if (loss > 0) message = { tone: 'ok', text: `Perte lente (${loss.toFixed(1)} %/sem). Si le tour de taille baisse aussi, c'est une recomposition.` };
  else message = { tone: 'warn', text: 'Poids stable ou en hausse sur 4 semaines. Vérifie le tour de taille avant de conclure.' };

  return { current: last.value, weeklyPct, message };
}
