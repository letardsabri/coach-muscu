/**
 * Ordre d'exécution d'une séance.
 *
 * Les exercices d'un même groupe (superset) s'enchaînent série par série :
 *   3a-1 → 3b-1 → repos → 3a-2 → 3b-2 → repos …
 * Le repos d'un tour de superset est celui du dernier exercice du groupe.
 *
 * La position courante n'est jamais stockée : c'est la première étape sans série enregistrée
 * (et dont l'exercice n'a pas été passé). Reprendre une séance interrompue est donc exact.
 */
import type { PlannedExercise } from '../db/models';

export interface Step {
  exerciseIndex: number;
  setIndex: number;
  /** Repos après cette série ; 0 = enchaîner (superset) ou fin de séance. */
  restAfterSec: number;
}

export const stepKey = (exerciseIndex: number, setIndex: number) => `${exerciseIndex}:${setIndex}`;

export function buildSequence(plan: PlannedExercise[]): Step[] {
  const steps: Step[] = [];
  let i = 0;
  while (i < plan.length) {
    const group = plan[i]!.group;
    let end = i + 1;
    if (group !== undefined) {
      while (end < plan.length && plan[end]!.group === group) end++;
    }
    const members = plan.slice(i, end).map((pe, k) => ({ pe, index: i + k }));
    const rounds = Math.max(...members.map((m) => m.pe.sets));

    for (let r = 0; r < rounds; r++) {
      const inRound = members.filter((m) => r < m.pe.sets);
      inRound.forEach((m, k) => {
        const lastOfRound = k === inRound.length - 1;
        steps.push({ exerciseIndex: m.index, setIndex: r, restAfterSec: lastOfRound ? m.pe.restSec : 0 });
      });
    }
    i = end;
  }
  const last = steps[steps.length - 1];
  if (last) last.restAfterSec = 0;
  return steps;
}

export function nextStep(steps: Step[], done: Set<string>, skipped: Set<number>): Step | undefined {
  return steps.find((s) => !skipped.has(s.exerciseIndex) && !done.has(stepKey(s.exerciseIndex, s.setIndex)));
}

/** Étape suivant `current` (pour l'aperçu « Ensuite » pendant le repos). */
export function stepAfter(steps: Step[], current: Step, done: Set<string>, skipped: Set<number>): Step | undefined {
  const from = steps.indexOf(current);
  return steps
    .slice(from + 1)
    .find((s) => !skipped.has(s.exerciseIndex) && !done.has(stepKey(s.exerciseIndex, s.setIndex)));
}
