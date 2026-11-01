import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/** Tout l'historique, réactif : chaque écriture en base met à jour les écrans qui l'utilisent. */
export function useHistory() {
  return useLiveQuery(async () => {
    const [sessions, sets, metrics, tests, mma, overrides] = await Promise.all([
      db.sessions.orderBy('startedAt').toArray(),
      db.sets.toArray(),
      db.bodyMetrics.toArray(),
      db.maxTests.toArray(),
      db.mmaSessions.toArray(),
      db.scheduleOverrides.toArray(),
    ]);
    return { sessions, sets, metrics, tests, mma, overrides };
  }, []);
}

export function useProfile() {
  return useLiveQuery(() => db.profile.get('me'), []);
}

export function useProgramState() {
  return useLiveQuery(() => db.programState.get('current'), []);
}

/** « body » ouvre Progrès sur le sous-onglet Corps (Corps n'est plus un onglet principal). */
export type Tab = 'home' | 'nutrition' | 'progress' | 'calendar' | 'body' | 'settings';
