/**
 * Calendrier (PROGRAMME.md §9, §10.3, R8).
 *
 * Le planning n'est pas stocké séance par séance : il est **projeté** à partir des jours
 * d'entraînement du profil, des modifications ponctuelles (décaler / annuler / ajouter) et
 * de l'alternance A/B courante. Une séance manquée ne se rattrape pas en doublant (R8) :
 * l'alternance reprend simplement à la prochaine séance prévue.
 */
import type { Programme } from '../data/programmeSchema';
import type { DayKey, IsoWeekday, MmaSession, Profile, ScheduleOverride, Session } from '../db/models';
import { addDays, diffDays, isoWeekday, parseDay } from '../lib/dates';

export type PlannedType = 'A' | 'B' | 'F';

export interface CalendarDay {
  day: DayKey;
  /** Séances terminées ce jour-là. */
  done: Session[];
  /** Séance prévue (jours à venir et aujourd'hui si rien n'est fait). */
  planned?: PlannedType;
  /** Jour d'entraînement passé sans séance terminée. */
  missed: boolean;
  /** Origine d'un décalage, pour l'affichage. */
  movedFrom?: DayKey;
  mma: MmaSession[];
  warnings: string[];
}

/** Lundi de la semaine ISO contenant `day`. */
export function weekStart(day: DayKey): DayKey {
  return addDays(day, 1 - isoWeekday(parseDay(day)));
}

/** Jours de séance prévus (sans type) après application des modifications. */
export function plannedDays(profile: Profile, overrides: ScheduleOverride[], from: DayKey, to: DayKey) {
  const result = new Map<DayKey, { movedFrom?: DayKey; type?: PlannedType }>();
  for (let d = from; diffDays(to, d) >= 0; d = addDays(d, 1)) {
    if (profile.trainingDays.includes(isoWeekday(parseDay(d)) as IsoWeekday)) result.set(d, {});
  }
  const ordered = [...overrides].sort((a, b) => a.createdAt - b.createdAt);
  for (const o of ordered) {
    if (o.action === 'skip') result.delete(o.day);
    if (o.action === 'move' && o.fromDay) {
      result.delete(o.fromDay);
      if (diffDays(o.day, from) >= 0 && diffDays(to, o.day) >= 0) result.set(o.day, { movedFrom: o.fromDay });
    }
    if (o.action === 'add' && diffDays(o.day, from) >= 0 && diffDays(to, o.day) >= 0) {
      const t = o.sessionType;
      result.set(o.day, { type: t === 'A' || t === 'B' || t === 'F' ? t : undefined });
    }
  }
  return result;
}

export function buildCalendar(args: {
  programme: Programme;
  profile: Profile;
  nextSessionType: 'A' | 'B';
  overrides: ScheduleOverride[];
  sessions: Session[];
  mma: MmaSession[];
  from: DayKey;
  to: DayKey;
  today: DayKey;
  /** Premier jour d'utilisation : avant, un jour d'entraînement sans séance n'est pas « manqué ». */
  trackingSince?: DayKey;
}): CalendarDay[] {
  const { profile, today } = args;
  // On projette depuis aujourd'hui pour que l'alternance soit juste quel que soit l'intervalle affiché.
  const projectionStart = diffDays(args.from, today) < 0 ? args.from : today;
  const planned = plannedDays(profile, args.overrides, projectionStart, args.to);
  const completed = args.sessions.filter((s) => s.status === 'completed');

  let next: 'A' | 'B' = args.nextSessionType;
  const days: CalendarDay[] = [];
  for (let d = args.from; diffDays(args.to, d) >= 0; d = addDays(d, 1)) {
    const done = completed.filter((s) => s.day === d);
    const slot = planned.get(d);
    const isPast = diffDays(today, d) > 0;
    const day: CalendarDay = {
      day: d,
      done,
      missed:
        isPast &&
        slot !== undefined &&
        done.length === 0 &&
        (args.trackingSince === undefined || diffDays(d, args.trackingSince) >= 0),
      movedFrom: slot?.movedFrom,
      mma: args.mma.filter((m) => m.day === d),
      warnings: [],
    };
    if (slot && !isPast && done.length === 0) {
      if (profile.sessionsPerWeek === 2) day.planned = slot.type ?? 'F';
      else {
        day.planned = slot.type ?? next;
        if (day.planned === 'A' || day.planned === 'B') next = day.planned === 'A' ? 'B' : 'A';
      }
    }
    days.push(day);
  }
  addWarnings(days, args.programme, args.mma);
  return days;
}

/** Type effectif d'un jour : réalisé, sinon prévu. */
function dayType(d: CalendarDay): string | undefined {
  const s = d.done[d.done.length - 1];
  return s ? s.type : d.planned;
}

/** Règles de récupération §9.1 et de placement MMA §10.3, appliquées aux jours à venir. */
function addWarnings(days: CalendarDay[], p: Programme, allMma: MmaSession[]) {
  const minDays = p.schedule.minHoursBetweenSameType / 24;
  days.forEach((d, i) => {
    const type = dayType(d);
    if (!type || d.planned === undefined) return;

    for (let j = i - 1; j >= 0 && diffDays(d.day, days[j]!.day) < minDays; j--) {
      const other = dayType(days[j]!);
      if (other === type && (type === 'A' || type === 'B')) {
        d.warnings.push(`Moins de ${p.schedule.minHoursBetweenSameType} h depuis la dernière séance ${type}.`);
      }
    }

    let streak = 1;
    for (let j = i - 1; j >= 0 && diffDays(d.day, days[j]!.day) === streak && dayType(days[j]!); j--) streak++;
    if (streak > p.schedule.maxConsecutiveDays) d.warnings.push(`${streak} jours d'affilée : prévois un jour de repos.`);

    const hardToday = allMma.some((m) => m.day === d.day && m.kind === 'intense');
    const hardTomorrow = allMma.some((m) => m.day === addDays(d.day, 1) && m.kind === 'intense');
    if (p.mma.placement.noStrengthOnHardMmaDay && hardToday) d.warnings.push('MMA intense le même jour : pas de musculation.');
    if (p.mma.placement.noPullBeforeHardMma && hardTomorrow && (type === 'A' || type === 'F')) {
      d.warnings.push('Tirage la veille d’un MMA intense : préfère la séance B ou décale.');
    }
  });
}

/** Charge hebdomadaire en unités (§10.1). */
export function weeklyLoadUnits(p: Programme, sessions: Session[], mma: MmaSession[]): number {
  const u = p.mma.loadUnits;
  const strength = sessions
    .filter((s) => s.status === 'completed')
    .reduce((n, s) => {
      if (s.type === 'MIN') return n + u.minimal;
      const weighted = s.plan.some((pe) => pe.loadInput === 'weighted');
      return n + (weighted ? u.strength_weighted : u.strength);
    }, 0);
  const combat = mma.reduce((n, m) => n + (m.kind === 'intense' ? u.mma_intense : u.mma_technique), 0);
  return strength + combat;
}
