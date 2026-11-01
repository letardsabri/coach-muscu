import { describe, expect, it } from 'vitest';
import alimentsRaw from '../data/aliments.json';
import { aliments, parseAliments } from '../data/alimentsData';
import { nutritionConfig as cfg } from '../data/nutritionData';
import type { FoodEntry, NutritionSettings } from '../db/models';
import { averageOfLoggedDays, bmr, dailyTargets, defaultNutritionSettings, normalize, scale, searchFoods, totalsByDay, tupleToNutrients } from './nutrition';

const settings = (over: Partial<NutritionSettings> = {}): NutritionSettings => ({ ...defaultNutritionSettings(cfg), sex: 'homme', ...over });
const base = { cfg, weightKg: 86, goalWeightKg: 78, heightCm: 179, age: 22 };
const REST = { strength: false, mma: null };

describe('base d’aliments', () => {
  it('est valide : catégories connues, pas de doublon, au moins 150 aliments', () => {
    expect(aliments.aliments.length).toBeGreaterThanOrEqual(150);
  });
  it('calories cohérentes avec les macros (4/4/9), sauf boissons alcoolisées', () => {
    for (const a of aliments.aliments) {
      if (a.mots.includes('alcool')) continue;
      const [kcal, p, g, l] = a.pour100g;
      const fromMacros = 4 * p + 4 * g + 9 * l;
      expect(Math.abs(kcal - fromMacros), a.id).toBeLessThanOrEqual(Math.max(25, kcal * 0.15));
    }
  });
  it('refuse une catégorie inconnue', () => {
    const broken = structuredClone(alimentsRaw) as typeof alimentsRaw;
    broken.aliments[0]!.cat = 'inconnue';
    expect(() => parseAliments(broken)).toThrow(/catégorie inconnue/);
  });
});

describe('objectifs', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr('homme', 86, 179, 22)).toBeCloseTo(1873.75);
    expect(bmr('femme', 60, 165, 30)).toBeCloseTo(1320.25);
  });

  it('jour de repos avec les réglages par défaut', () => {
    const t = dailyTargets({ ...base, settings: settings(), sport: REST })!;
    expect(t.maintenance).toBe(2436); // 1873,75 × 1,3
    expect(t.kcal).toBe(2036);
    expect(t.prot).toBe(156); // 2 g × 78 kg
    expect(t.lip).toBe(69); // 0,8 g × 86 kg
    expect(t.gluc).toBe(Math.round((2035.875 - 4 * 156 - 9 * 68.8) / 4));
  });

  it('bonus les jours de séance et de MMA, déficit inchangé', () => {
    const muscu = dailyTargets({ ...base, settings: settings(), sport: { strength: true, mma: null } })!;
    const both = dailyTargets({ ...base, settings: settings(), sport: { strength: true, mma: 'intense' } })!;
    expect(muscu.kcal).toBe(2236);
    expect(both.kcal).toBe(2736);
    expect(muscu.deficit).toBe(400);
    expect(dailyTargets({ ...base, settings: settings({ sportBonus: false }), sport: { strength: true, mma: 'intense' } })!.kcal).toBe(2036);
  });

  it('déficit plafonné à 25 % de la dépense et plancher calorique', () => {
    const t = dailyTargets({ ...base, settings: settings({ deficitKcal: 1200 }), sport: REST })!;
    expect(t.deficit).toBe(609);
    const small = dailyTargets({ ...base, weightKg: 50, goalWeightKg: 50, heightCm: 150, settings: settings({ sex: 'femme', activity: 'sedentaire', deficitKcal: 600 }), sport: REST })!;
    expect(small.kcal).toBe(cfg.limits.minKcal);
  });

  it('objectifs manuels prioritaires, et pas de calcul sans sexe renseigné', () => {
    const t = dailyTargets({ ...base, settings: settings({ manual: { kcal: 2200, prot: 170 } }), sport: REST })!;
    expect(t).toMatchObject({ kcal: 2200, prot: 170, manualKeys: ['kcal', 'prot'] });
    expect(dailyTargets({ ...base, settings: settings({ sex: null }), sport: REST })).toBeNull();
    expect(dailyTargets({ ...base, settings: settings({ sex: null, manual: { kcal: 2000 } }), sport: REST })?.kcal).toBe(2000);
  });

  it('explique le calcul pas à pas', () => {
    const t = dailyTargets({ ...base, settings: settings(), sport: { strength: true, mma: null } })!;
    expect(t.steps[0]).toContain('1874');
    expect(t.steps.join('\n')).toContain("+ 200 kcal d'entraînement");
  });
});

describe('quantités', () => {
  it('calcule les valeurs pour un poids donné', () => {
    expect(scale(tupleToNutrients([121, 26, 0, 1.8]), 150)).toEqual({ kcal: 182, prot: 39, gluc: 0, lip: 2.7 });
  });
});

describe('recherche', () => {
  const items = aliments.aliments.map((a) => ({ key: `base:${a.id}`, nom: a.nom, mots: a.mots, catLabel: a.cat }));
  const top = (q: string, recent: string[] = []) => searchFoods(q, items, recent).slice(0, 3).map((i) => i.key);

  it('ignore les accents et la casse', () => {
    expect(normalize('Pâtes Œuf')).toBe('pates oeuf');
    expect(top('pates')[0]).toBe('base:pates');
    expect(top('oeuf')[0]).toBe('base:oeuf');
  });
  it('le plus courant d’abord (« poulet » → blanc de poulet)', () => {
    expect(top('poulet')[0]).toBe('base:poulet_blanc');
  });
  it('plusieurs mots partiels', () => {
    expect(top('steak hach 5')).toContain('base:steak_hache_5');
    expect(top('fromage bl')[0]).toMatch(/fromage_blanc/);
  });
  it('trouve par mot-clé (kebab → sandwich et sauce)', () => {
    const all = searchFoods('kebab', items).map((i) => i.key);
    expect(all).toEqual(expect.arrayContaining(['base:kebab', 'base:sauce_blanche', 'base:viande_kebab']));
  });
  it('les récents passent devant à pertinence égale', () => {
    expect(top('riz', ['base:riz_complet'])[0]).toBe('base:riz_complet');
  });
});

describe('historique', () => {
  const entry = (day: string, kcal: number, prot: number): FoodEntry =>
    ({ id: `${day}-${kcal}`, day, meal: 'dejeuner', source: { type: 'libre' }, nom: 'x', kcal, prot, gluc: 0, lip: 0, createdAt: 0 }) as FoodEntry;

  it('totaux par jour et moyenne sur les seuls jours saisis', () => {
    const totals = totalsByDay([entry('2026-11-02', 800, 50), entry('2026-11-02', 1200, 70), entry('2026-11-04', 1800, 130)]);
    expect(totals.get('2026-11-02')).toMatchObject({ kcal: 2000, prot: 120 });
    expect(averageOfLoggedDays([...totals.values()])).toMatchObject({ kcal: 1900, prot: 125 });
    expect(averageOfLoggedDays([])).toBeNull();
  });
});
