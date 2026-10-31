import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup, parseBackup, summarize } from './backup';
import { db } from './db';
import { ensureInitialized } from './init';

async function seed() {
  await ensureInitialized();
  await db.bodyMetrics.add({ id: 'm1', day: '2026-11-01', weightKg: 85.6, createdAt: 1 });
  await db.maxTests.add({ id: 't1', testId: 'pullup_max', day: '2026-11-01', value: 8, loadKg: 0, createdAt: 1 });
  await db.photos.add({ id: 'p1', day: '2026-11-01', angle: 'face', blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }), createdAt: 1 });
}

describe('sauvegarde', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('export → JSON → import « remplacer » restitue les données, photos comprises', async () => {
    await seed();
    const text = JSON.stringify(await exportBackup(true));

    await db.delete();
    await db.open();
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(summarize(parsed.backup)).toMatchObject({ bodyMetrics: 1, maxTests: 1, photos: 1 });

    await importBackup(parsed.backup, 'replace');
    expect((await db.bodyMetrics.get('m1'))?.weightKg).toBe(85.6);
    expect(await db.profile.get('me')).toBeDefined();
    const photo = await db.photos.get('p1');
    expect(new Uint8Array(await photo!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 250]));
    expect(await db.meta.get('lastBackupAt')).toBeDefined();
  });

  it('« fusionner » garde les données locales et ajoute celles de la sauvegarde', async () => {
    await seed();
    const backup = await exportBackup(false);
    await db.bodyMetrics.add({ id: 'local', day: '2026-11-05', weightKg: 85, createdAt: 2 });
    await db.bodyMetrics.delete('m1');
    await importBackup(backup, 'merge');
    expect(await db.bodyMetrics.count()).toBe(2);
  });

  it('refuse un fichier invalide sans rien écrire', () => {
    expect(parseBackup('pas du json')).toMatchObject({ ok: false });
    expect(parseBackup('{"format":"autre"}')).toMatchObject({ ok: false });
    const future = { format: 'coach-muscu-backup', version: 99, exportedAt: '', data: {} };
    expect(parseBackup(JSON.stringify(future))).toMatchObject({ ok: false });
  });
});
