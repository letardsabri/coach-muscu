/**
 * Sauvegarde et restauration (ARCHITECTURE.md §9).
 *
 * Format : un seul fichier JSON lisible, versionné, contenant toutes les tables.
 * Les photos (Blob) sont encodées en base64 si on choisit de les inclure.
 * L'import est validé (Zod) avant toute écriture, puis :
 *   - « remplacer » : la base est vidée puis remplie avec la sauvegarde ;
 *   - « fusionner » : les enregistrements sont ajoutés ou mis à jour par identifiant (UUID : aucune collision).
 */
import { z } from 'zod';
import { programme } from '../data/programme';
import { BACKUP_FORMAT_VERSION, db } from './db';

export const BACKUP_FORMAT = 'coach-muscu-backup';

const TABLES = [
  'profile',
  'programState',
  'sessions',
  'sets',
  'maxTests',
  'bodyMetrics',
  'mmaSessions',
  'scheduleOverrides',
  'recommendations',
  'reminders',
  'meta',
  // v2 — nutrition (absentes des sauvegardes v1 : importées comme vides)
  'foodEntries',
  'customFoods',
  'mealTemplates',
  'foodFavorites',
  // v3 — hydratation (absente des sauvegardes v1/v2 : importée comme vide)
  'waterEntries',
  // v4 — mobilité (absente des sauvegardes v1–v3 : importée comme vide)
  'mobilitySessions',
  'flexTests',
] as const;
type TableName = (typeof TABLES)[number];

/** Validation volontairement structurelle : chaque table est une liste d'objets avec leur clé primaire. */
const row = (key: string) => z.record(z.string(), z.unknown()).refine((r) => r[key] !== undefined, `clé « ${key} » manquante`);

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().positive().max(BACKUP_FORMAT_VERSION, 'sauvegarde créée par une version plus récente de l’app'),
  exportedAt: z.string(),
  programmeVersion: z.number().optional(),
  data: z.object({
    profile: z.array(row('id')).max(1),
    programState: z.array(row('id')).max(1),
    sessions: z.array(row('id')),
    sets: z.array(row('id')),
    maxTests: z.array(row('id')),
    bodyMetrics: z.array(row('id')),
    mmaSessions: z.array(row('id')),
    scheduleOverrides: z.array(row('id')),
    recommendations: z.array(row('id')),
    reminders: z.array(row('id')),
    meta: z.array(row('key')),
    foodEntries: z.array(row('id')).default([]),
    customFoods: z.array(row('id')).default([]),
    mealTemplates: z.array(row('id')).default([]),
    foodFavorites: z.array(row('key')).default([]),
    waterEntries: z.array(row('id')).default([]),
    mobilitySessions: z.array(row('id')).default([]),
    flexTests: z.array(row('id')).default([]),
    photos: z
      .array(z.object({ id: z.string(), day: z.string(), angle: z.string(), createdAt: z.number(), dataUrl: z.string() }))
      .optional(),
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export async function exportBackup(includePhotos: boolean): Promise<Backup> {
  const data = Object.fromEntries(
    await Promise.all(TABLES.map(async (t) => [t, await (db[t] as unknown as { toArray(): Promise<unknown[]> }).toArray()])),
  ) as Backup['data'];
  if (includePhotos) {
    const photos = await db.photos.toArray();
    data.photos = await Promise.all(
      photos.map(async (p) => ({ id: p.id, day: p.day, angle: p.angle, createdAt: p.createdAt, dataUrl: await blobToDataUrl(p.blob) })),
    );
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    programmeVersion: programme.version,
    data,
  };
}

export function backupFileName(date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `coach-muscu-sauvegarde-${d}.json`;
}

export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Ce fichier n’est pas un JSON valide.' };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: `Sauvegarde invalide : ${first ? `${first.path.join('.')} — ${first.message}` : 'format inconnu'}` };
  }
  return { ok: true, backup: result.data };
}

export function summarize(b: Backup) {
  return {
    sessions: b.data.sessions.length,
    sets: b.data.sets.length,
    foodEntries: b.data.foodEntries.length,
    waterEntries: b.data.waterEntries.length,
    mobilitySessions: b.data.mobilitySessions.length,
    bodyMetrics: b.data.bodyMetrics.length,
    maxTests: b.data.maxTests.length,
    photos: b.data.photos?.length ?? 0,
    exportedAt: b.exportedAt,
  };
}

export async function importBackup(b: Backup, mode: 'replace' | 'merge'): Promise<void> {
  const photos = await Promise.all(
    (b.data.photos ?? []).map(async (p) => ({ ...p, blob: await dataUrlToBlob(p.dataUrl), dataUrl: undefined })),
  );
  const all = [...TABLES, 'photos'] as const;
  await db.transaction('rw', all.map((t) => db[t]), async () => {
    if (mode === 'replace') {
      for (const t of all) await db[t].clear();
    }
    for (const t of TABLES) {
      const rows = b.data[t as TableName] as never[];
      if (rows.length) await (db[t] as unknown as { bulkPut(r: unknown[]): Promise<unknown> }).bulkPut(rows);
    }
    if (photos.length) {
      await db.photos.bulkPut(
        photos.map(({ id, day, angle, createdAt, blob }) => ({ id, day, angle: angle as 'face' | 'profil' | 'dos', createdAt, blob })),
      );
    }
    await db.meta.put({ key: 'lastBackupAt', value: Date.now() });
  });
}

export async function markBackupDone(): Promise<void> {
  await db.meta.put({ key: 'lastBackupAt', value: Date.now() });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const [head, b64 = ''] = dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head ?? '')?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
