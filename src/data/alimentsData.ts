/**
 * Base d'aliments (aliments.json), validée au chargement. Chargée uniquement avec l'onglet Nutrition.
 */
import { z } from 'zod';
import alimentsRaw from './aliments.json';

const id = z.string().regex(/^[a-z0-9_]+$/);
const nonNeg = z.number().nonnegative();

const alimentsSchema = z.object({
  version: z.number().int(),
  categories: z.array(z.object({ id, label: z.string() })).min(1),
  aliments: z
    .array(
      z.object({
        id,
        nom: z.string().min(1),
        cat: id,
        mots: z.array(z.string()).default([]),
        pour100g: z.tuple([nonNeg, nonNeg, nonNeg, nonNeg]),
        portions: z.array(z.tuple([z.string().min(1), z.number().positive()])).min(1),
      }),
    )
    .min(1),
});

export type AlimentsData = z.infer<typeof alimentsSchema>;

export function parseAliments(input: unknown): AlimentsData {
  const data = alimentsSchema.parse(input);
  const cats = new Set(data.categories.map((c) => c.id));
  const ids = new Set<string>();
  for (const a of data.aliments) {
    if (!cats.has(a.cat)) throw new Error(`aliments.json : catégorie inconnue « ${a.cat} » pour ${a.id}`);
    if (ids.has(a.id)) throw new Error(`aliments.json : identifiant en double « ${a.id} »`);
    ids.add(a.id);
  }
  return data;
}

export const aliments = parseAliments(alimentsRaw);
