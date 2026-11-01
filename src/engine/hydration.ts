/**
 * Hydratation : objectif quotidien d'eau bue, majoré les jours d'entraînement. Fonctions pures, testées.
 */
import type { NutritionConfig } from '../data/nutritionData';
import type { HydrationSettings, WaterEntry } from '../db/models';
import type { DaySport } from './nutrition';

export function defaultHydrationSettings(cfg: NutritionConfig): HydrationSettings {
  const { baseMl, strengthBonusMl, mmaTechniqueBonusMl, mmaIntenseBonusMl } = cfg.hydration;
  return { baseMl, strengthBonusMl, mmaTechniqueBonusMl, mmaIntenseBonusMl };
}

export interface WaterGoal {
  ml: number;
  bonusMl: number;
  /** Explication courte : « 2,5 L + 0,5 L (séance) ». */
  detail: string;
}

const liters = (ml: number) => `${(ml / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} L`;

export function waterGoal(s: HydrationSettings, sport: DaySport): WaterGoal {
  const parts: string[] = [];
  let bonus = 0;
  if (sport.strength && s.strengthBonusMl) {
    bonus += s.strengthBonusMl;
    parts.push(`+ ${liters(s.strengthBonusMl)} (séance)`);
  }
  const mma = sport.mma === 'intense' ? s.mmaIntenseBonusMl : sport.mma === 'technique' ? s.mmaTechniqueBonusMl : 0;
  if (mma) {
    bonus += mma;
    parts.push(`+ ${liters(mma)} (MMA ${sport.mma})`);
  }
  return { ml: s.baseMl + bonus, bonusMl: bonus, detail: [liters(s.baseMl), ...parts].join(' ') };
}

export function waterByDay(entries: WaterEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.day, (map.get(e.day) ?? 0) + e.ml);
  return map;
}

/** Dernière saisie d'un jour (pour « annuler la dernière saisie »). */
export function lastEntryOfDay(entries: WaterEntry[], day: string): WaterEntry | undefined {
  return entries.filter((e) => e.day === day).sort((a, b) => b.createdAt - a.createdAt)[0];
}

export { liters };
