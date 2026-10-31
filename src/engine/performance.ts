/**
 * R5 — Indice de performance (PROGRAMME.md §7).
 *
 * Une seule formule pour comparer des séances différentes (variante, lest, poids du corps) :
 *   charge effective = poids de corps × fraction × coef. variante + lest   (exercices au poids du corps)
 *                    = haltère × coef. variante                            (haltères)
 *   e1RM = charge effective × (1 + (reps + RIR) / diviseur)               (Epley corrigé par le RIR)
 * Pour les exercices sans charge (gainage, pont), l'indice est reps × coef. variante.
 */
import type { Programme } from '../data/programmeSchema';
import type { Feeling, Session, SetLog } from '../db/models';

export function effectiveLoad(p: Programme, exerciseId: string, variantId: string, bodyweightKg: number, loadKg: number): number {
  const ex = p.exercises[exerciseId];
  if (!ex) return 0;
  const coef = ex.variants.find((v) => v.id === variantId)?.coef ?? 1;
  if (ex.loadType === 'bodyweight') return bodyweightKg * ex.bodyweightFactor * coef + loadKg;
  if (ex.loadType === 'dumbbell') return loadKg * coef;
  return coef;
}

export function e1rm(load: number, reps: number, rir: number, divisor: number): number {
  return load * (1 + (reps + rir) / divisor);
}

export function feelingRir(p: Programme, feeling: Feeling | undefined): number {
  return feeling ? p.feelings[feeling] : p.feelings.correct;
}

/**
 * Indice d'une exposition : meilleure série de la séance pour cet exercice.
 * Le RIR est celui du ressenti de l'exercice (faute de mieux, « Correct » = 2) : sous-estime un peu les
 * premières séries, mais de façon constante, ce qui compte pour une courbe.
 */
export function exposureIndex(p: Programme, session: Session, sets: SetLog[], exerciseIndex: number, fallbackBodyweight: number): number {
  const pe = session.plan[exerciseIndex];
  const ex = pe && p.exercises[pe.exerciseId];
  if (!pe || !ex) return 0;
  const own = sets.filter((s) => s.exerciseIndex === exerciseIndex && s.reps > 0);
  if (own.length === 0) return 0;
  const bw = session.bodyweightKg ?? fallbackBodyweight;
  const rir = feelingRir(p, session.results[exerciseIndex]?.feeling);

  if (ex.loadType === 'reps') {
    return Math.max(...own.map((s) => s.reps * effectiveLoad(p, pe.exerciseId, s.variantId, bw, s.loadKg)));
  }
  return Math.max(...own.map((s) => e1rm(effectiveLoad(p, pe.exerciseId, s.variantId, bw, s.loadKg), s.reps, rir, p.rules.R5.epleyDivisor)));
}
