/**
 * Cycles de 6 semaines : 5 semaines de progression + 1 semaine de deload (PROGRAMME.md §5, §8).
 */
import type { Programme } from '../data/programmeSchema';
import type { DayKey, ProgramState } from '../db/models';
import { addDays, diffDays } from '../lib/dates';

export interface CycleInfo {
  /** Semaine 1 à cycle.weeks. */
  weekInCycle: number;
  isDeload: boolean;
  /** Deload anticipé (R4) plutôt que planifié. */
  forcedDeload: boolean;
}

export function cycleInfo(state: ProgramState, today: DayKey, p: Programme): CycleInfo {
  const elapsed = Math.max(0, diffDays(today, state.cycleStartedOn));
  const weekInCycle = Math.min(p.cycle.weeks, Math.floor(elapsed / 7) + 1);
  const forcedDeload =
    state.forcedDeloadFrom !== undefined &&
    diffDays(today, state.forcedDeloadFrom) >= 0 &&
    diffDays(today, state.forcedDeloadFrom) < 7;
  return { weekInCycle, isDeload: forcedDeload || weekInCycle === p.cycle.deloadWeek, forcedDeload };
}

/**
 * Fait avancer le cycle si sa durée est écoulée, ou si un deload anticipé est terminé
 * (R4 : le deload anticipé remet le compteur à zéro). Renvoie le même objet si rien ne change.
 */
export function rollCycle(state: ProgramState, today: DayKey, p: Programme): ProgramState {
  let next = state;

  if (next.forcedDeloadFrom !== undefined && diffDays(today, next.forcedDeloadFrom) >= 7) {
    next = {
      ...next,
      cycleIndex: next.cycleIndex + 1,
      cycleStartedOn: addDays(next.forcedDeloadFrom, 7),
      forcedDeloadFrom: undefined,
    };
    next = alternateBlock(next, p);
  }

  const cycleDays = p.cycle.weeks * 7;
  while (diffDays(today, next.cycleStartedOn) >= cycleDays) {
    next = { ...next, cycleIndex: next.cycleIndex + 1, cycleStartedOn: addDays(next.cycleStartedOn, cycleDays) };
    next = alternateBlock(next, p);
  }
  return next;
}

/** Phase 3 : les blocs Force et Hypertrophie alternent à chaque nouveau cycle (§5). Sans effet ailleurs. */
function alternateBlock(state: ProgramState, p: Programme): ProgramState {
  const blocks = p.phases[state.phase - 1]?.blocks ?? [];
  if (blocks.length < 2) return state;
  const i = blocks.findIndex((b) => b.id === state.blockId);
  return { ...state, blockId: blocks[(i + 1) % blocks.length]!.id };
}
