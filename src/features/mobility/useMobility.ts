import { programme } from '../../data/programme';
import { souplesse } from '../../data/souplesseData';
import { recommendedRoutines } from '../../engine/mobility';
import { buildCalendar, weekStart } from '../../engine/schedule';
import { addDays, dayKey } from '../../lib/dates';
import { useHistory, useProfile, useProgramState } from '../data';

/** Séances de souplesse recommandées par jour pour la semaine contenant `day` (calendrier, accueil). */
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
  return recommendedRoutines(week, data.mma, souplesse);
}

/** Nom d'une séance, y compris celles de l'ancien module mobilité (historique). */
export const routineName = (id: string) => souplesse.seances.find((s) => s.id === id)?.nom ?? souplesse.anciennesRoutines[id] ?? id;
