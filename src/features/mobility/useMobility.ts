import { mobilite } from '../../data/mobiliteData';
import { programme } from '../../data/programme';
import { recommendedRoutines } from '../../engine/mobility';
import { buildCalendar, weekStart } from '../../engine/schedule';
import { addDays, dayKey } from '../../lib/dates';
import { useHistory, useProfile, useProgramState } from '../data';

/** Routines recommandées par jour pour la semaine contenant `day` (calendrier, accueil). */
export function useMobilityWeek(day: string = dayKey()) {
  const profile = useProfile();
  const state = useProgramState();
  const data = useHistory();
  if (!profile || !state || !data) return null;
  const monday = weekStart(day);
  const today = dayKey();
  const week = buildCalendar({
    programme,
    profile,
    nextSessionType: state.nextSessionType,
    overrides: data.overrides,
    sessions: data.sessions,
    mma: data.mma,
    from: monday,
    to: addDays(monday, 6),
    today,
    trackingSince: dayKey(new Date(profile.createdAt)),
  });
  return recommendedRoutines(week, data.mma, mobilite);
}

export const routineName = (id: string) => mobilite.routines.find((r) => r.id === id)?.nom ?? id;
