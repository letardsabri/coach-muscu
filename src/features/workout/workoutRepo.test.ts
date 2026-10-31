import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { ensureInitialized } from '../../db/init';
import type { Session } from '../../db/models';
import { deleteSession } from './workoutRepo';

const session = (id: string, type: Session['type'], startedAt: number, status: Session['status'] = 'completed') =>
  ({ id, type, status, day: '2026-11-02', startedAt, phase: 1, blockId: 'base', cycleIndex: 1, weekInCycle: 1, isDeload: false, adjustments: [], plan: [], results: [] }) as Session;

const set = (id: string, sessionId: string) => ({
  id,
  sessionId,
  exerciseIndex: 0,
  exerciseId: 'dips',
  variantId: 'strict',
  setIndex: 0,
  plannedReps: 6,
  reps: 6,
  negatives: 0,
  restPauseReps: 0,
  loadKg: 0,
  completedAt: 1,
});

describe('suppression d’une séance', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await ensureInitialized();
  });

  it('supprime la séance, ses séries et ses recommandations en attente, et rétablit l’alternance', async () => {
    await db.sessions.bulkAdd([session('s1', 'A', 1), session('s2', 'B', 2)]);
    await db.sets.bulkAdd([set('a', 's1'), set('b', 's2'), set('c', 's2')]);
    await db.recommendations.add({ id: 'r', rule: 'R1', title: '', explanation: '', status: 'pending', createdAt: 1, sessionId: 's2' });
    await db.programState.update('current', { nextSessionType: 'A' }); // après la séance B d'essai

    await deleteSession('s2');

    expect(await db.sessions.get('s2')).toBeUndefined();
    expect(await db.sets.where('sessionId').equals('s2').count()).toBe(0);
    expect(await db.sets.count()).toBe(1);
    expect(await db.recommendations.count()).toBe(0);
    expect((await db.programState.get('current'))?.nextSessionType).toBe('B');
  });

  it('une séance abandonnée se supprime sans toucher à l’alternance', async () => {
    await db.sessions.bulkAdd([session('s1', 'A', 1), session('s2', 'B', 2, 'abandoned')]);
    await db.programState.update('current', { nextSessionType: 'B' });
    await deleteSession('s2');
    expect(await db.sessions.count()).toBe(1);
    expect((await db.programState.get('current'))?.nextSessionType).toBe('B');
  });
});
