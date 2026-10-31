/**
 * R6 — Forme du jour (PROGRAMME.md §7).
 */
import type { Programme } from '../data/programmeSchema';
import type { Readiness } from '../db/models';

/** Valeurs pré-remplies : une journée « normale » ne déclenche aucun ajustement. */
export const DEFAULT_READINESS: Readiness = {
  sleep: 4,
  energy: 4,
  soreness: 2,
  anklePain: 0,
  mmaHardWithin24h: false,
};

/** Sommeil + Énergie + (6 − Courbatures), de 3 à 15. */
export function readinessScore(r: Readiness): number {
  return r.sleep + r.energy + (6 - r.soreness);
}

export function isLowReadiness(r: Readiness, p: Programme): boolean {
  return readinessScore(r) <= p.rules.R6.lowScoreMax;
}
