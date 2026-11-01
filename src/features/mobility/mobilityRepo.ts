/**
 * Accès base de la souplesse : séances guidées, niveau de progression, tests de souplesse.
 */
import { souplesse } from '../../data/souplesseData';
import { db } from '../../db/db';
import type { MobilityFeeling, MobilitySession, MobilitySettings } from '../../db/models';
import { defaultMobilitySettings, nextSettings } from '../../engine/mobility';
import { dayKey } from '../../lib/dates';
import { uuid } from '../../lib/id';

/**
 * Enregistre une séance. Avec un ressenti, met à jour la progression (maintiens, répétitions, charge)
 * et renvoie le changement de niveau (+1 / −1 / 0).
 */
export async function saveMobilitySession(s: Omit<MobilitySession, 'id' | 'day' | 'feeling'>, feeling?: MobilityFeeling): Promise<-1 | 0 | 1> {
  let change: -1 | 0 | 1 = 0;
  await db.transaction('rw', db.mobilitySessions, db.profile, async () => {
    await db.mobilitySessions.add({ ...s, id: uuid(), day: dayKey(new Date(s.startedAt)), feeling });
    if (!feeling) return;
    const profile = await db.profile.get('me');
    const current = profile?.mobility ?? defaultMobilitySettings();
    const next = nextSettings(current, feeling, souplesse);
    change = next.change;
    await db.profile.update('me', { mobility: next.settings, updatedAt: Date.now() });
  });
  return change;
}

export async function updateMobilitySettings(patch: Partial<MobilitySettings>): Promise<void> {
  const profile = await db.profile.get('me');
  await db.profile.update('me', { mobility: { ...(profile?.mobility ?? defaultMobilitySettings()), ...patch }, updatedAt: Date.now() });
}

export async function addFlexTest(testId: string, value: number): Promise<void> {
  await db.flexTests.add({ id: uuid(), testId, day: dayKey(), value, createdAt: Date.now() });
}

export async function deleteFlexTest(id: string): Promise<void> {
  await db.flexTests.delete(id);
}
