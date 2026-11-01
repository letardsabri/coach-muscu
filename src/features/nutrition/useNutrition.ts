import { useLiveQuery } from 'dexie-react-hooks';
import { nutritionConfig } from '../../data/nutritionData';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { DayKey, MmaSession, Profile, ProgramState, Session } from '../../db/models';
import { rollingAverage } from '../../engine/body';
import { ageFrom, dailyTargets, sum, type DaySport } from '../../engine/nutrition';
import { buildCalendar } from '../../engine/schedule';
import { dayKey, diffDays } from '../../lib/dates';
import { useHistory, useProfile, useProgramState } from '../data';
import { weightPoints } from '../progress/stats';

/**
 * Sport du jour, pour le bonus calorique : séance terminée ce jour-là, ou séance prévue si le jour
 * n'est pas encore passé ; MMA saisi dans le calendrier (le plus intense compte).
 */
export function daySport(args: {
  day: DayKey;
  today: DayKey;
  profile: Profile;
  state: ProgramState;
  sessions: Session[];
  mma: MmaSession[];
  overrides: Parameters<typeof buildCalendar>[0]['overrides'];
}): DaySport {
  const { day, today } = args;
  let strength = args.sessions.some((s) => s.status === 'completed' && s.day === day && s.type !== 'TEST');
  if (!strength && diffDays(day, today) >= 0) {
    const [cal] = buildCalendar({
      programme,
      profile: args.profile,
      nextSessionType: args.state.nextSessionType,
      overrides: args.overrides,
      sessions: args.sessions,
      mma: args.mma,
      from: day,
      to: day,
      today,
    });
    strength = Boolean(cal?.planned);
  }
  const mmaOfDay = args.mma.filter((m) => m.day === day);
  const mma = mmaOfDay.some((m) => m.kind === 'intense') ? 'intense' : mmaOfDay.length ? 'technique' : null;
  return { strength, mma };
}

/** Poids de référence : moyenne 7 jours la plus récente, sinon poids de départ. */
export function referenceWeight(profile: Profile, metrics: Parameters<typeof weightPoints>[0]): number {
  const avg = rollingAverage(weightPoints(metrics));
  return Math.round((avg[avg.length - 1]?.value ?? profile.startWeightKg) * 10) / 10;
}

export function useNutritionDay(day: DayKey) {
  const profile = useProfile();
  const state = useProgramState();
  const data = useHistory();
  const entries = useLiveQuery(() => db.foodEntries.where('day').equals(day).sortBy('createdAt'), [day]);
  if (!profile || !state || !data || !entries) return null;

  const settings = profile.nutrition;
  const sport = daySport({ day, today: dayKey(), profile, state, sessions: data.sessions, mma: data.mma, overrides: data.overrides });
  const weightKg = referenceWeight(profile, data.metrics);
  const targets = settings
    ? dailyTargets({
        cfg: nutritionConfig,
        settings,
        weightKg,
        goalWeightKg: profile.goalWeightKg,
        heightCm: profile.heightCm,
        age: ageFrom(profile.birthYear),
        sport,
      })
    : null;
  return { profile, settings, entries, totals: sum(entries), targets, sport, weightKg };
}
