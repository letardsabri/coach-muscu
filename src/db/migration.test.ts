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

describe('migration de la base v1 → v2', () => {
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
    expect(v2.verno).toBe(2);
    expect(await v2.sessions.count()).toBe(2);
    expect((await v2.sets.get('x'))?.reps).toBe(8);
    expect((await v2.bodyMetrics.get('m'))?.weightKg).toBe(85.4);
    expect(await v2.photos.count()).toBe(1);
    const profile = await v2.profile.get('me');
    expect(profile?.firstName).toBe('Test');
    expect(profile?.nutrition).toMatchObject({ sex: null, activity: 'peu_actif', deficitKcal: 400, sportBonus: true });
    expect(await v2.foodEntries.count()).toBe(0);
    await v2.foodEntries.add({ id: 'f', day: '2026-11-05', meal: 'dejeuner', source: { type: 'libre' }, nom: 'Test', kcal: 500, prot: 30, gluc: 50, lip: 15, createdAt: 1 });
    expect(await v2.foodEntries.where('[day+meal]').equals(['2026-11-05', 'dejeuner']).count()).toBe(1);
    v2.close();
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
      data: Object.fromEntries(Object.entries(v1Backup.data).filter(([k]) => !['foodEntries', 'customFoods', 'mealTemplates', 'foodFavorites'].includes(k))),
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

  it('export v2 → import : les saisies, aliments perso, repas types et favoris sont restitués', async () => {
    await db.delete();
    await db.open();
    await ensureInitialized();
    await db.foodEntries.add({ id: 'e', day: '2026-11-05', meal: 'diner', source: { type: 'base', id: 'riz_blanc' }, nom: 'Riz', grams: 200, kcal: 260, prot: 5.4, gluc: 56, lip: 0.6, createdAt: 1 });
    await db.customFoods.add({ id: 'c', nom: 'Mon wrap', categorie: 'plats', pour100g: { kcal: 200, prot: 12, gluc: 20, lip: 8 }, portions: [{ label: '1 wrap', grams: 250 }], createdAt: 1 });
    await db.mealTemplates.add({ id: 't', nom: 'Petit-déj', items: [], createdAt: 1 });
    await db.foodFavorites.add({ key: 'base:skyr', createdAt: 1 });
    const text = JSON.stringify(await exportBackup(false));

    await db.delete();
    await db.open();
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.version).toBe(2);
    await importBackup(parsed.backup, 'replace');
    expect((await db.foodEntries.get('e'))?.kcal).toBe(260);
    expect((await db.customFoods.get('c'))?.nom).toBe('Mon wrap');
    expect(await db.mealTemplates.count()).toBe(1);
    expect(await db.foodFavorites.get('base:skyr')).toBeDefined();
  });
});
