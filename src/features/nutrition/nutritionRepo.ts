/**
 * Accès base de la nutrition : catalogue (base + aliments perso), saisies, favoris, repas types.
 */
import { aliments } from '../../data/alimentsData';
import { db } from '../../db/db';
import type { CustomFood, DayKey, FoodEntry, FoodSource, MealId, MealTemplate, Nutrients, NutritionSettings } from '../../db/models';
import { scale, tupleToNutrients, type Searchable } from '../../engine/nutrition';
import { addDays } from '../../lib/dates';
import { uuid } from '../../lib/id';

// ---------------------------------------------------------------------------
// Catalogue unifié
// ---------------------------------------------------------------------------

export interface CatalogFood extends Searchable {
  key: string; // « base:id » ou « perso:id »
  source: FoodSource;
  categorie: string;
  pour100g: Nutrients;
  portions: { label: string; grams: number }[];
  custom: boolean;
}

export const CATEGORY_LABELS = Object.fromEntries(aliments.categories.map((c) => [c.id, c.label]));

const BASE_FOODS: CatalogFood[] = aliments.aliments.map((a) => ({
  key: `base:${a.id}`,
  source: { type: 'base', id: a.id },
  nom: a.nom,
  mots: a.mots,
  categorie: a.cat,
  catLabel: CATEGORY_LABELS[a.cat] ?? a.cat,
  pour100g: tupleToNutrients(a.pour100g),
  portions: a.portions.map(([label, grams]) => ({ label, grams })),
  custom: false,
}));

export function buildCatalog(custom: CustomFood[]): CatalogFood[] {
  const mine = custom
    .filter((c) => !c.archived)
    .map<CatalogFood>((c) => ({
      key: `perso:${c.id}`,
      source: { type: 'perso', id: c.id },
      nom: c.nom,
      mots: [],
      categorie: c.categorie,
      catLabel: CATEGORY_LABELS[c.categorie] ?? c.categorie,
      pour100g: c.pour100g,
      portions: c.portions,
      custom: true,
    }));
  return [...mine, ...BASE_FOODS];
}

export const sourceKey = (s: FoodSource): string | null => (s.type === 'base' || s.type === 'perso' ? `${s.type}:${s.id}` : null);

// ---------------------------------------------------------------------------
// Quantité → saisie
// ---------------------------------------------------------------------------

export type Quantity = { mode: 'grams'; grams: number } | { mode: 'portion'; label: string; grams: number; count: number };

export const quantityGrams = (q: Quantity) => (q.mode === 'grams' ? q.grams : q.grams * q.count);

export function entryValues(food: CatalogFood, q: Quantity): Pick<FoodEntry, 'grams' | 'portion' | 'kcal' | 'prot' | 'gluc' | 'lip'> {
  const grams = quantityGrams(q);
  return {
    ...scale(food.pour100g, grams),
    grams: Math.round(grams),
    portion: q.mode === 'portion' ? { label: q.label, grams: q.grams, count: q.count } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Saisies
// ---------------------------------------------------------------------------

export async function addEntry(e: Omit<FoodEntry, 'id' | 'createdAt'>): Promise<void> {
  await db.foodEntries.add({ ...e, id: uuid(), createdAt: Date.now() });
}

export async function updateEntry(id: string, patch: Partial<FoodEntry>): Promise<void> {
  await db.foodEntries.update(id, patch);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.foodEntries.delete(id);
}

/** Copie les saisies d'un jour (ou d'un seul repas) vers un autre jour. Renvoie le nombre d'éléments copiés. */
export async function copyEntries(fromDay: DayKey, toDay: DayKey, meal?: MealId): Promise<number> {
  const source = meal
    ? await db.foodEntries.where('[day+meal]').equals([fromDay, meal]).toArray()
    : await db.foodEntries.where('day').equals(fromDay).toArray();
  const now = Date.now();
  await db.foodEntries.bulkAdd(source.sort((a, b) => a.createdAt - b.createdAt).map((e, i) => ({ ...e, id: uuid(), day: toDay, createdAt: now + i })));
  return source.length;
}

export const previousDay = (day: DayKey) => addDays(day, -1);

// ---------------------------------------------------------------------------
// Récents, favoris, aliments perso, repas types
// ---------------------------------------------------------------------------

/** Aliments saisis récemment (30 jours), du plus récent au plus ancien, sans doublon. */
export async function recentKeys(limit = 30): Promise<string[]> {
  const recent = await db.foodEntries.orderBy('createdAt').reverse().limit(300).toArray();
  const keys: string[] = [];
  for (const e of recent) {
    const k = sourceKey(e.source);
    if (k && !keys.includes(k)) keys.push(k);
    if (keys.length >= limit) break;
  }
  return keys;
}

export async function toggleFavorite(key: string): Promise<void> {
  if (await db.foodFavorites.get(key)) await db.foodFavorites.delete(key);
  else await db.foodFavorites.add({ key, createdAt: Date.now() });
}

export async function saveCustomFood(food: Omit<CustomFood, 'id' | 'createdAt'> & { id?: string }): Promise<string> {
  const id = food.id ?? uuid();
  await db.customFoods.put({ ...food, id, createdAt: Date.now() });
  return id;
}

/** Un aliment perso n'est jamais effacé (les saisies passées y font référence) : il est archivé. */
export async function archiveCustomFood(id: string): Promise<void> {
  await db.customFoods.update(id, { archived: true });
  await db.foodFavorites.delete(`perso:${id}`);
}

export async function saveMealTemplate(nom: string, entries: FoodEntry[]): Promise<void> {
  const template: MealTemplate = {
    id: uuid(),
    nom,
    createdAt: Date.now(),
    items: entries.map(({ source, nom: n, grams, portion, kcal, prot, gluc, lip }) => ({ source, nom: n, grams, portion, kcal, prot, gluc, lip })),
  };
  await db.mealTemplates.add(template);
}

export async function addTemplate(template: MealTemplate, day: DayKey, meal: MealId): Promise<void> {
  const now = Date.now();
  await db.foodEntries.bulkAdd(template.items.map((it, i) => ({ ...it, id: uuid(), day, meal, createdAt: now + i })));
}

export async function deleteMealTemplate(id: string): Promise<void> {
  await db.mealTemplates.delete(id);
}

export async function updateNutritionSettings(patch: Partial<NutritionSettings>): Promise<void> {
  const profile = await db.profile.get('me');
  if (!profile?.nutrition) return;
  await db.profile.update('me', { nutrition: { ...profile.nutrition, ...patch }, updatedAt: Date.now() });
}
