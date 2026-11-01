/**
 * Nutrition : objectifs, conversions, recherche, totaux. Fonctions pures, testées.
 *
 * Objectif calorique (expliqué dans l'app) :
 *   1. Métabolisme de base (Mifflin-St Jeor) : 10 × poids + 6,25 × taille − 5 × âge + 5 (homme) / − 161 (femme)
 *   2. × niveau d'activité hors sport → dépense d'un jour de repos
 *   3. + bonus sport du jour (séance, MMA) si activé
 *   4. − déficit (plafonné à un % de la dépense, et jamais sous un minimum)
 * Protéines = g/kg × poids objectif. Lipides = minimum g/kg × poids actuel. Glucides = le reste.
 */
import type { NutritionConfig } from '../data/nutritionData';
import type { FoodEntry, Nutrients, NutritionSettings } from '../db/models';

export const ZERO: Nutrients = { kcal: 0, prot: 0, gluc: 0, lip: 0 };

export function defaultNutritionSettings(cfg: NutritionConfig): NutritionSettings {
  return { sex: null, ...cfg.defaults, manual: null };
}

export function bmr(sex: 'homme' | 'femme', weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'homme' ? 5 : -161);
}

export interface DaySport {
  strength: boolean;
  mma: 'technique' | 'intense' | null;
}

export interface Targets extends Nutrients {
  /** Dépense estimée du jour (sans déficit). */
  maintenance: number;
  bmr: number;
  sportBonus: number;
  deficit: number;
  /** Lignes d'explication du calcul, dans l'ordre. */
  steps: string[];
  /** Valeurs remplacées par un objectif manuel. */
  manualKeys: (keyof Nutrients)[];
}

const r = (v: number) => Math.round(v);
const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function dailyTargets(args: {
  cfg: NutritionConfig;
  settings: NutritionSettings;
  weightKg: number;
  goalWeightKg: number;
  heightCm: number;
  age: number;
  sport: DaySport;
}): Targets | null {
  const { cfg, settings: s } = args;
  const manual = s.manual ?? {};
  const manualKeys = (Object.keys(manual) as (keyof Nutrients)[]).filter((k) => typeof manual[k] === 'number');

  // Sans sexe renseigné, pas de calcul possible (sauf objectifs entièrement manuels).
  if (!s.sex) {
    if (manual.kcal === undefined) return null;
  }

  const base = s.sex ? bmr(s.sex, args.weightKg, args.heightCm, args.age) : 0;
  const level = cfg.activityLevels.find((l) => l.id === s.activity) ?? cfg.activityLevels[0]!;
  const rest = base * level.factor;
  const bonus = s.sportBonus
    ? (args.sport.strength ? cfg.sportBonusKcal.strength : 0) +
      (args.sport.mma === 'intense' ? cfg.sportBonusKcal.mma_intense : args.sport.mma === 'technique' ? cfg.sportBonusKcal.mma_technique : 0)
    : 0;
  const maintenance = rest + bonus;
  const deficit = Math.min(s.deficitKcal, (maintenance * cfg.limits.maxDeficitPct) / 100);
  const computedKcal = Math.max(cfg.limits.minKcal, maintenance - deficit);

  const kcal = manual.kcal ?? computedKcal;
  const prot = manual.prot ?? s.proteinGPerKgGoal * args.goalWeightKg;
  const lip = manual.lip ?? s.fatGPerKgMin * args.weightKg;
  const gluc = manual.gluc ?? Math.max(0, (kcal - 4 * prot - 9 * lip) / 4);

  const steps = s.sex
    ? [
        `Métabolisme de base (Mifflin-St Jeor, ${s.sex}) : 10 × ${fr(args.weightKg)} kg + 6,25 × ${args.heightCm} cm − 5 × ${args.age} ans ${
          s.sex === 'homme' ? '+ 5' : '− 161'
        } = ${r(base)} kcal`,
        `× ${level.factor.toLocaleString('fr-FR')} (${level.label.toLowerCase()}, hors sport) = ${r(rest)} kcal`,
        ...(bonus > 0 ? [`+ ${bonus} kcal d'entraînement aujourd'hui = ${r(maintenance)} kcal de dépense estimée`] : []),
        `− ${r(deficit)} kcal de déficit = ${r(computedKcal)} kcal${manual.kcal !== undefined ? ' (remplacé par ton objectif manuel)' : ''}`,
        `Protéines : ${s.proteinGPerKgGoal.toLocaleString('fr-FR')} g × ${args.goalWeightKg} kg (poids objectif) = ${r(prot)} g`,
        `Lipides : au moins ${s.fatGPerKgMin.toLocaleString('fr-FR')} g × ${fr(args.weightKg)} kg = ${r(lip)} g`,
        `Glucides : le reste des calories = ${r(gluc)} g`,
      ]
    : ['Objectifs fixés à la main (renseigne le sexe pour le calcul automatique).'];

  return {
    kcal: r(kcal),
    prot: r(prot),
    gluc: r(gluc),
    lip: r(lip),
    maintenance: r(maintenance),
    bmr: r(base),
    sportBonus: bonus,
    deficit: r(deficit),
    steps,
    manualKeys,
  };
}

/** Âge au 1er juillet de l'année en cours (on ne connaît que l'année de naissance). */
export function ageFrom(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

// ---------------------------------------------------------------------------
// Quantités et valeurs
// ---------------------------------------------------------------------------

export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: Math.round(per100.kcal * f),
    prot: round1(per100.prot * f),
    gluc: round1(per100.gluc * f),
    lip: round1(per100.lip * f),
  };
}

export const round1 = (v: number) => Math.round(v * 10) / 10;

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, prot: round1(a.prot + b.prot), gluc: round1(a.gluc + b.gluc), lip: round1(a.lip + b.lip) }),
    { ...ZERO },
  );
}

export const tupleToNutrients = ([kcal, prot, gluc, lip]: [number, number, number, number]): Nutrients => ({ kcal, prot, gluc, lip });

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

export interface Searchable {
  key: string;
  nom: string;
  mots: string[];
  catLabel: string;
}

/**
 * Tous les mots tapés doivent apparaître (début de mot) dans le nom, les mots-clés ou la catégorie.
 * Classement : mot du nom, puis mots-clés, puis simple inclusion ; les aliments récents passent devant à
 * pertinence égale, puis l'ordre du fichier (la version la plus courante y est listée en premier).
 */
export function searchFoods<T extends Searchable>(query: string, items: T[], recentKeys: string[] = []): T[] {
  const q = normalize(query);
  if (!q) return items;
  const tokens = q.split(' ');
  const recent = new Map(recentKeys.map((k, i) => [k, i]));

  const scored: { item: T; score: number; index: number }[] = [];
  for (const [index, item] of items.entries()) {
    const name = normalize(item.nom);
    const nameWords = name.split(' ');
    const extra = normalize([...item.mots, item.catLabel].join(' ')).split(' ');
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      if (nameWords.some((w) => w.startsWith(t))) score += 0;
      else if (extra.some((w) => w.startsWith(t))) score += 3;
      else if (name.includes(t)) score += 4;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const rank = recent.get(item.key);
    if (rank !== undefined) score -= 1 + 1 / (rank + 1);
    scored.push({ item, score, index });
  }
  // À pertinence égale : l'ordre du fichier aliments.json, où la version courante est listée en premier
  // (« Pâtes cuites » avant « Pâtes crues » et « Pâtes carbonara »). Réglable sans toucher au code.
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((s) => s.item);
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

export function totalsByDay(entries: FoodEntry[]): Map<string, Nutrients> {
  const map = new Map<string, Nutrients>();
  for (const e of entries) map.set(e.day, sum([map.get(e.day) ?? ZERO, e]));
  return map;
}

/**
 * Moyenne sur les jours **saisis** uniquement : un jour sans aucune saisie n'est pas compté comme 0 kcal
 * (oubli de saisie ≠ jeûne), sinon les moyennes seraient faussement basses.
 */
export function averageOfLoggedDays(totals: Nutrients[]): Nutrients | null {
  if (totals.length === 0) return null;
  const s = totals.reduce((a, b) => ({ kcal: a.kcal + b.kcal, prot: a.prot + b.prot, gluc: a.gluc + b.gluc, lip: a.lip + b.lip }), { ...ZERO });
  const n = totals.length;
  return { kcal: Math.round(s.kcal / n), prot: round1(s.prot / n), gluc: round1(s.gluc / n), lip: round1(s.lip / n) };
}
