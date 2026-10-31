import type { Adjustment, Feeling, LoadInput, PlannedExercise } from '../db/models';

export const kg = (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;

export function formatLoad(input: LoadInput, loadKg: number): string {
  if (input === 'weighted') return `+${kg(loadKg)}`;
  if (input === 'dumbbell') return kg(loadKg);
  return '';
}

export const formatRange = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

/** Unité affichée après un nombre : « reps », « s » ou « s/côté ». */
export function unitLabel(pe: Pick<PlannedExercise, 'unit' | 'perSide'>, n?: number): string {
  if (pe.unit === 'sec') return pe.perSide ? 's/côté' : 's';
  return n === 1 ? 'rep' : 'reps';
}

/** « 4 × 3–6 · 8 kg », « 2 × 20–45 s/côté » */
export function formatDose(pe: PlannedExercise): string {
  const load = formatLoad(pe.loadInput, pe.loadKg);
  const unit = pe.unit === 'sec' ? ` ${unitLabel(pe)}` : '';
  return `${pe.sets} × ${formatRange(pe.reps)}${unit}${load ? ` · ${load}` : ''}`;
}

export const FEELINGS: { value: Feeling; label: string; rir: string }[] = [
  { value: 'facile', label: 'Facile', rir: 'RIR 3+' },
  { value: 'correct', label: 'Correct', rir: 'RIR 2' },
  { value: 'dur', label: 'Dur', rir: 'RIR 1' },
  { value: 'limite', label: 'Limite', rir: 'RIR 0' },
];

export const ADJUSTMENT_LABELS: Record<Adjustment, string> = {
  deload: 'Deload',
  reduced_readiness: 'Allégée · forme',
  reduced_mma: 'Allégée · MMA',
  reduced_comeback: 'Allégée · reprise',
  ankle_mode: 'Mode cheville',
  cluster: 'Clusters',
  mma_week: 'Semaine MMA',
};

export const RULE_LABELS: Record<string, string> = {
  R1: 'Progression',
  R2: 'Ajustement',
  R3: 'Stagnation',
  R4: 'Décharge',
  R5: 'Performance',
  R6: 'Forme du jour',
  R7: 'Phase',
  R8: 'Reprise',
};

export const SESSION_LABELS = { A: 'Tirage', B: 'Poussée', F: 'Full body', MIN: 'Minimale', TEST: 'Tests' } as const;
