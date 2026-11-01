/**
 * Migration v1 → v2 : on crée une vraie base v1 (schéma d'origine), on la remplit,
 * puis on l'ouvre avec la version actuelle de l'app. Rien ne doit être perdu.
 */
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { exportBackup, importBackup, parseBackup } from './backup';
import { CoachDB, db } from './db';
import { ensureInitialized } from './init';

const V1_SCHEMA = {
  profile: 'id',
  programState: 'id',
  sessions: 'id, day, startedAt, status, type, [type+day]',
  sets: 'id, sessionId, exerciseId, completedAt, [exerciseId+completedAt]',
  maxTests: 'id, testId, day, [testId+day]',
  bodyMetrics: 'id, day',
  photos: 'id, day',
  mmaSessions: 'id, day',
  scheduleOverrides: 'id, day',
  recommendations: 'id, status, createdAt, exerciseId',
  reminders: 'id, kind',
  meta: 'key',
};

describe('migration de la base v1 → version actuelle', () => {
  it('conserve toutes les données et ajoute les tables et réglages nutrition', async () => {
    const name = 'migration-test';
    const v1 = new Dexie(name);
    v1.version(1).stores(V1_SCHEMA);
    await v1.open();
    await v1.table('profile').add({ id: 'me', firstName: 'Test', heightCm: 179, startWeightKg: 86, goalWeightKg: 78, birthYear: 2004 });
    await v1.table('sessions').bulkAdd([
      { id: 's1', day: '2026-11-02', startedAt: 1, status: 'completed', type: 'A' },
      { id: 's2', day: '2026-11-04', startedAt: 2, status: 'completed', type: 'B' },
    ]);
    await v1.table('sets').add({ id: 'x', sessionId: 's1', exerciseId: 'dips', completedAt: 1, reps: 8 });
    await v1.table('bodyMetrics').add({ id: 'm', day: '2026-11-02', weightKg: 85.4 });
    await v1.table('photos').add({ id: 'p', day: '2026-11-02', blob: new Blob([new Uint8Array([7])]) });
    v1.close();

    const v2 = new CoachDB(name);
    await v2.open();
    expect(v2.verno).toBe(4);
    expect(await v2.sessions.count()).toBe(2);
    expect((await v2.sets.get('x'))?.reps).toBe(8);
    expect((await v2.bodyMetrics.get('m'))?.weightKg).toBe(85.4);
    expect(await v2.photos.count()).toBe(1);
    const profile = await v2.profile.get('me');
    expect(profile?.firstName).toBe('Test');
    expect(profile?.nutrition).toMatchObject({ sex: null, activity: 'peu_actif', deficitKcal: 400, sportBonus: true });
    expect(profile?.hydration).toMatchObject({ baseMl: 2500, strengthBonusMl: 500 });
    expect(profile?.mobility).toMatchObject({ pnf: false, holdLevel: 0 });
    expect(await v2.foodEntries.count()).toBe(0);
    await v2.foodEntries.add({ id: 'f', day: '2026-11-05', meal: 'dejeuner', source: { type: 'libre' }, nom: 'Test', kcal: 500, prot: 30, gluc: 50, lip: 15, createdAt: 1 });
    expect(await v2.foodEntries.where('[day+meal]').equals(['2026-11-05', 'dejeuner']).count()).toBe(1);
    v2.close();
  });
});

describe('migration de la base v2 → version actuelle', () => {
  it('conserve séances, mesures, repas et réglages nutrition ; ajoute l’hydratation', async () => {
    const name = 'migration-v2-test';
    const v2 = new Dexie(name);
    v2.version(1).stores(V1_SCHEMA);
    v2.version(2).stores({ foodEntries: 'id, day, [day+meal], createdAt', customFoods: 'id, nom', mealTemplates: 'id', foodFavorites: 'key' });
    await v2.open();
    await v2.table('profile').add({ id: 'me', firstName: 'Test', nutrition: { sex: 'homme', activity: 'actif', deficitKcal: 500, proteinGPerKgGoal: 2.2, fatGPerKgMin: 0.8, sportBonus: false, manual: null } });
    await v2.table('sessions').add({ id: 's1', day: '2026-11-02', startedAt: 1, status: 'completed', type: 'A' });
    await v2.table('bodyMetrics').add({ id: 'm', day: '2026-11-02', weightKg: 85 });
    await v2.table('foodEntries').add({ id: 'f', day: '2026-11-02', meal: 'diner', source: { type: 'libre' }, nom: 'Repas', kcal: 700, prot: 40, gluc: 60, lip: 20, createdAt: 1 });
    await v2.table('customFoods').add({ id: 'c', nom: 'Wrap', categorie: 'plats', pour100g: { kcal: 200, prot: 10, gluc: 20, lip: 8 }, portions: [], createdAt: 1 });
    v2.close();

    const v3 = new CoachDB(name);
    await v3.open();
    expect(v3.verno).toBe(4);
    expect(await v3.sessions.count()).toBe(1);
    expect((await v3.bodyMetrics.get('m'))?.weightKg).toBe(85);
    expect((await v3.foodEntries.get('f'))?.kcal).toBe(700);
    expect((await v3.customFoods.get('c'))?.nom).toBe('Wrap');
    const profile = await v3.profile.get('me');
    expect(profile?.nutrition).toMatchObject({ sex: 'homme', activity: 'actif', deficitKcal: 500 }); // réglages perso intacts
    expect(profile?.hydration).toMatchObject({ baseMl: 2500 });
    await v3.waterEntries.add({ id: 'w', day: '2026-11-02', ml: 250, createdAt: 1 });
    expect(await v3.waterEntries.where('day').equals('2026-11-02').count()).toBe(1);
    v3.close();
  });
});

describe('migration de la base v3 → v4', () => {
  it('conserve tout (dont l’eau et les réglages perso) et ajoute la mobilité', async () => {
    const name = 'migration-v3-test';
    const v3 = new Dexie(name);
    v3.version(1).stores(V1_SCHEMA);
    v3.version(2).stores({ foodEntries: 'id, day, [day+meal], createdAt', customFoods: 'id, nom', mealTemplates: 'id', foodFavorites: 'key' });
    v3.version(3).stores({ waterEntries: 'id, day, createdAt' });
    await v3.open();
    await v3.table('profile').add({ id: 'me', hydration: { baseMl: 3000, strengthBonusMl: 250, mmaTechniqueBonusMl: 500, mmaIntenseBonusMl: 750 }, nutrition: { sex: 'homme' } });
    await v3.table('sessions').add({ id: 's1', day: '2026-11-02', startedAt: 1, status: 'completed', type: 'B' });
    await v3.table('foodEntries').add({ id: 'f', day: '2026-11-02', meal: 'dejeuner', kcal: 600, createdAt: 1 });
    await v3.table('waterEntries').bulkAdd([
      { id: 'w1', day: '2026-11-02', ml: 250, createdAt: 1 },
      { id: 'w2', day: '2026-11-02', ml: 500, createdAt: 2 },
    ]);
    v3.close();

    const v4 = new CoachDB(name);
    await v4.open();
    expect(v4.verno).toBe(4);
    expect(await v4.sessions.count()).toBe(1);
    expect((await v4.foodEntries.get('f'))?.kcal).toBe(600);
    expect(await v4.waterEntries.count()).toBe(2);
    const profile = await v4.profile.get('me');
    expect(profile?.hydration?.baseMl).toBe(3000);
    expect(profile?.mobility).toEqual({ pnf: false, holdLevel: 0, easyStreak: 0 });
    await v4.mobilitySessions.add({ id: 'm', day: '2026-11-02', routineId: 'hanches', startedAt: 1, endedAt: 2, durationSec: 700, plannedSec: 720, positionsDone: 9, positionsTotal: 9 });
    await v4.flexTests.add({ id: 't', testId: 'straddle_cm', day: '2026-11-02', value: 95, createdAt: 1 });
    expect(await v4.flexTests.where('testId').equals('straddle_cm').count()).toBe(1);
    v4.close();
  });
});

describe('sauvegardes et nutrition', () => {
  it('une sauvegarde v1 (sans tables nutrition) reste importable', async () => {
    await db.delete();
    await db.open();
    await ensureInitialized();
    const v1Backup = await exportBackup(false);
    const legacy = {
      ...v1Backup,
      version: 1,
      data: Object.fromEntries(Object.entries(v1Backup.data).filter(([k]) => !['foodEntries', 'customFoods', 'mealTemplates', 'foodFavorites', 'waterEntries', 'mobilitySessions', 'flexTests'].includes(k))),
    };
    // Profil d'une ancienne version : sans réglages nutrition.
    const profile = (legacy.data.profile as Record<string, unknown>[])[0]!;
    delete profile.nutrition;

    const parsed = parseBackup(JSON.stringify(legacy));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.data.foodEntries).toEqual([]);
    await importBackup(parsed.backup, 'replace');
    await ensureInitialized();
    expect((await db.profile.get('me'))?.nutrition?.activity).toBe('peu_actif');
  });

  it('une sauvegarde v2 (sans hydratation) reste importable', async () => {
    await db.delete();
    await db.open();
    await ensureInitialized();
    const b = await exportBackup(false);
    const legacy = { ...b, version: 2, data: Object.fromEntries(Object.entries(b.data).filter(([k]) => !['waterEntries', 'mobilitySessions', 'flexTests'].includes(k))) };
    delete (legacy.data.profile as Record<string, unknown>[])[0]!.hydration;
    const parsed = parseBackup(JSON.stringify(legacy));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data.waterEntries).toEqual([]);
    await importBackup(parsed.backup, 'replace');
    await ensureInitialized();
    expect((await db.profile.get('me'))?.hydration?.baseMl).toBe(2500);
  });

  it('export → import : les saisies, aliments perso, repas types, favoris et l’eau sont restitués', async () => {
    await db.delete();
    await db.open();
    await ensureInitialized();
    await db.foodEntries.add({ id: 'e', day: '2026-11-05', meal: 'diner', source: { type: 'base', id: 'riz_blanc' }, nom: 'Riz', grams: 200, kcal: 260, prot: 5.4, gluc: 56, lip: 0.6, createdAt: 1 });
    await db.customFoods.add({ id: 'c', nom: 'Mon wrap', categorie: 'plats', pour100g: { kcal: 200, prot: 12, gluc: 20, lip: 8 }, portions: [{ label: '1 wrap', grams: 250 }], createdAt: 1 });
    await db.mealTemplates.add({ id: 't', nom: 'Petit-déj', items: [], createdAt: 1 });
    await db.foodFavorites.add({ key: 'base:skyr', createdAt: 1 });
    await db.waterEntries.add({ id: 'w', day: '2026-11-05', ml: 500, createdAt: 1 });
    await db.mobilitySessions.add({ id: 'ms', day: '2026-11-05', routineId: 'express', startedAt: 1, endedAt: 2, durationSec: 280, plannedSec: 280, positionsDone: 6, positionsTotal: 6, feeling: 'correct' });
    await db.flexTests.add({ id: 'ft', testId: 'doigts_orteils_cm', day: '2026-11-05', value: -4, createdAt: 1 });
    const text = JSON.stringify(await exportBackup(false));

    await db.delete();
    await db.open();
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.version).toBe(4);
    await importBackup(parsed.backup, 'replace');
    expect((await db.foodEntries.get('e'))?.kcal).toBe(260);
    expect((await db.customFoods.get('c'))?.nom).toBe('Mon wrap');
    expect(await db.mealTemplates.count()).toBe(1);
    expect(await db.foodFavorites.get('base:skyr')).toBeDefined();
    expect((await db.waterEntries.get('w'))?.ml).toBe(500);
    expect((await db.mobilitySessions.get('ms'))?.feeling).toBe('correct');
    expect((await db.flexTests.get('ft'))?.value).toBe(-4);
  });
});
