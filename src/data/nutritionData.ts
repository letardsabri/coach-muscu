/**
 * Réglages du suivi nutritionnel (nutrition.json), validés au chargement.
 * La base d'aliments est dans alimentsData.ts (chargée seulement avec l'onglet Nutrition).
 */
import { z } from 'zod';
import nutritionRaw from './nutrition.json';

const id = z.string().regex(/^[a-z0-9_]+$/);
const nonNeg = z.number().nonnegative();
const nutritionSchema = z.object({
  version: z.number().int(),
  meals: z.array(z.object({ id, label: z.string() })).length(4),
  activityLevels: z.array(z.object({ id, label: z.string(), hint: z.string(), factor: z.number().min(1).max(2.5) })).min(1),
  defaults: z.object({
    activity: id,
    deficitKcal: z.number().min(0).max(1500),
    proteinGPerKgGoal: z.number().min(0.8).max(3.5),
    fatGPerKgMin: z.number().min(0.3).max(1.5),
    sportBonus: z.boolean(),
  }),
  sportBonusKcal: z.object({ strength: nonNeg, mma_technique: nonNeg, mma_intense: nonNeg }),
  limits: z.object({ maxDeficitPct: z.number().min(0).max(50), minKcal: z.number().positive(), deficitChoices: z.array(nonNeg) }),
  quickGrams: z.array(z.number().positive()),
  hydration: z.object({
    baseMl: z.number().min(500).max(6000),
    strengthBonusMl: nonNeg,
    mmaTechniqueBonusMl: nonNeg,
    mmaIntenseBonusMl: nonNeg,
    quickMl: z.array(z.number().positive()).min(1),
    customStepMl: z.number().positive(),
  }),
});

export type NutritionConfig = z.infer<typeof nutritionSchema>;

export function parseNutritionConfig(input: unknown): NutritionConfig {
  const data = nutritionSchema.parse(input);
  if (!data.activityLevels.some((l) => l.id === data.defaults.activity)) {
    throw new Error(`nutrition.json : niveau d'activité par défaut inconnu « ${data.defaults.activity} »`);
  }
  return data;
}

export const nutritionConfig = parseNutritionConfig(nutritionRaw);
