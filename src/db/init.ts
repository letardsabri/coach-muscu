/**
 * Initialisation au premier lancement et entretien à chaque ouverture.
 */
import { programme } from '../data/programme';
import { rollCycle } from '../engine/cycle';
import { dayKey } from '../lib/dates';
import { uuid } from '../lib/id';
import { db } from './db';
import type { IsoWeekday, Profile, ProgramState, Reminder } from './models';

export async function ensureInitialized(): Promise<void> {
  const today = dayKey();
  const now = Date.now();

  await db.transaction('rw', [db.profile, db.programState, db.reminders, db.meta, db.sessions], async () => {
    if (!(await db.profile.get('me'))) {
      const sessionsPerWeek = programme.schedule.defaultSessionsPerWeek as Profile['sessionsPerWeek'];
      const profile: Profile = {
        id: 'me',
        firstName: '',
        birthYear: 2004,
        heightCm: 179,
        startWeightKg: 86,
        goalWeightKg: programme.body.targetWeightKg,
        sessionsPerWeek,
        trainingDays: (programme.schedule.defaultDays[String(sessionsPerWeek)] ?? [1, 3, 5]) as IsoWeekday[],
        ankleMode: true,
        mmaMode: false,
        dumbbell: { ...programme.equipment.dumbbell },
        soundOn: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.profile.add(profile);
    }

    const state = await db.programState.get('current');
    if (!state) {
      const initial: ProgramState = {
        id: 'current',
        phase: 1,
        blockId: programme.phases[0]!.blocks[0]!.id,
        cycleIndex: 1,
        cycleStartedOn: today,
        phaseStartedOn: today,
        nextSessionType: 'A',
        loadFrozen: false,
        exercises: {},
        updatedAt: now,
      };
      await db.programState.add(initial);
    } else {
      const rolled = rollCycle(state, today, programme);
      if (rolled !== state) await db.programState.put({ ...rolled, updatedAt: now });
    }

    if ((await db.reminders.count()) === 0) {
      const reminders: Reminder[] = programme.reminders.map((r) => ({
        id: uuid(),
        kind: r.kind,
        label: r.label,
        enabled: r.enabled,
        time: r.time,
        days: r.days === 'training' ? 'training' : (r.days as IsoWeekday[]),
        everyDays: r.everyDays,
        onlyIfNotDone: r.onlyIfNotDone,
        message: r.message,
        updatedAt: now,
      }));
      await db.reminders.bulkAdd(reminders);
    }

    if (!(await db.meta.get('installedAt'))) await db.meta.put({ key: 'installedAt', value: now });
    await db.meta.put({ key: 'programmeVersion', value: programme.version });

    // Une séance en cours trop ancienne n'est plus proposée en reprise (R8) : ses séries restent enregistrées.
    const limit = now - programme.rules.R8.resumeWithinHours * 3_600_000;
    const stale = await db.sessions.where('status').equals('in_progress').filter((s) => s.startedAt < limit).toArray();
    for (const s of stale) await db.sessions.update(s.id, { status: 'abandoned', restEndsAt: undefined });
  });

  // Demande à iOS de ne pas effacer les données (app installée sur l'écran d'accueil : déjà exemptée).
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Non bloquant.
  }
}
