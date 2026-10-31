/**
 * R1 (partie « cible de la séance ») — PROGRAMME.md §7.
 *
 * On repart des répétitions de la dernière exposition comparable (même variante, même charge)
 * et on vise +1 rep sur la première série encore sous le haut de la fourchette.
 * Le changement de variante ou de charge quand le haut est atteint relève de progression.ts (étape 5).
 */
export function targetRepsFromLast(
  sets: number,
  [min, max]: [number, number],
  lastReps: number[],
  increment: number,
): number[] {
  if (lastReps.length === 0) return Array.from({ length: sets }, () => min);

  const fallback = lastReps[lastReps.length - 1] ?? min;
  const targets = Array.from({ length: sets }, (_, i) => clamp(lastReps[i] ?? fallback, min, max));
  const first = targets.findIndex((r) => r < max);
  if (first >= 0) targets[first] = Math.min(max, (targets[first] ?? min) + increment);
  return targets;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Arrondi au palier le plus proche (charges). */
export function roundToStep(v: number, step: number): number {
  return Math.round(v / step) * step;
}
