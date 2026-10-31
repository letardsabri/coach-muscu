/**
 * Rappels (PROGRAMME.md §15, ARCHITECTURE.md §8).
 *
 * Une PWA ne peut pas programmer elle-même de notification quand elle est fermée sur iPhone.
 * Les rappels sont donc exportés vers le Calendrier d'iOS (fichier .ics) : c'est lui qui sonne,
 * avec le message personnalisé. Limite : le texte est figé à l'export et un rappel conditionnel
 * (« séance non faite ») est impossible sans serveur de notifications push.
 */
import type { Programme } from '../../data/programmeSchema';
import type { DayKey, IsoWeekday, ProgramState, Reminder } from '../../db/models';
import { cycleInfo, rollCycle } from '../../engine/cycle';
import type { CalendarDay, PlannedType } from '../../engine/schedule';
import { addDays, diffDays, isoWeekday, parseDay } from '../../lib/dates';

export const VARIABLES: { name: string; help: string }[] = [
  { name: '{seance}', help: 'type de séance (ex. « A — Tirage »)' },
  { name: '{duree}', help: 'durée estimée en minutes' },
  { name: '{exercice1}', help: 'premier exercice de la séance' },
  { name: '{phase}', help: 'phase en cours' },
  { name: '{semaine}', help: 'semaine du cycle' },
  { name: '{poids_objectif}', help: 'objectif de poids' },
  { name: '{prenom}', help: 'ton prénom' },
];

export type Vars = Partial<Record<'seance' | 'duree' | 'exercice1' | 'phase' | 'semaine' | 'poids_objectif' | 'prenom', string>>;

/** Remplace les {variables} connues ; une variable inconnue ou vide disparaît proprement. */
export function resolveMessage(template: string, vars: Vars): string {
  return template
    .replace(/\{(\w+)\}/g, (_, k: string) => vars[k as keyof Vars] ?? '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,])/g, '$1') // typographie française : on garde l'espace avant « ! » et « ? »
    .trim();
}

export interface ReminderEvent {
  uid: string;
  day: DayKey;
  time: string;
  title: string;
  message: string;
}

export interface SessionInfo {
  name: string;
  minutes: number;
  firstExercise: string;
}

/** Rappel compatible avec un export Calendrier (texte fixe, pas de condition). */
export const exportable = (r: Reminder) => r.enabled && !r.onlyIfNotDone;

export function buildEvents(args: {
  p: Programme;
  reminders: Reminder[];
  calendar: CalendarDay[];
  state: ProgramState;
  from: DayKey;
  days: number;
  sessionInfo: (type: PlannedType) => SessionInfo;
  baseVars: Vars;
}): ReminderEvent[] {
  const { p, from } = args;
  const events: ReminderEvent[] = [];
  const planned = new Map(args.calendar.filter((d) => d.planned).map((d) => [d.day, d.planned!]));

  for (const r of args.reminders.filter(exportable)) {
    for (let i = 0; i < args.days; i++) {
      const day = addDays(from, i);
      const weekday = isoWeekday(parseDay(day)) as IsoWeekday;
      const state = rollCycle(args.state, day, p);
      const { weekInCycle, isDeload } = cycleInfo(state, day, p);
      const vars: Vars = { ...args.baseVars, phase: String(state.phase), semaine: String(weekInCycle) };

      if (r.days === 'training') {
        const type = planned.get(day);
        if (!type) continue;
        const info = args.sessionInfo(type);
        Object.assign(vars, { seance: info.name, duree: String(info.minutes), exercice1: info.firstExercise });
      } else {
        if (!r.days.includes(weekday)) continue;
        if (r.kind === 'test_week' && !isDeload) continue;
        if (r.everyDays && Math.floor(diffDays(day, from) / 7) % Math.max(1, Math.round(r.everyDays / 7)) !== 0) continue;
      }
      events.push({ uid: `${r.kind}-${day}@coach-muscu`, day, time: r.time, title: r.label, message: resolveMessage(r.message, vars) });
    }
  }
  return events.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
}

// ---------------------------------------------------------------------------
// Format iCalendar (RFC 5545)
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Plie les lignes à 75 octets comme l'exige la norme (les lignes de suite commencent par un espace). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * Heures « flottantes » (sans fuseau) : 18:00 reste 18:00 à l'heure locale du téléphone, changement d'heure compris.
 * Chaque événement porte une alarme à l'heure exacte avec le message personnalisé.
 */
export function buildIcs(events: ReminderEvent[], stamp = new Date()): string {
  const dt = (day: DayKey, time: string) => `${day.replace(/-/g, '')}T${time.replace(':', '')}00`;
  const utc = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const total = (h ?? 0) * 60 + (m ?? 0) + 10;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Coach Muscu//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Coach Muscu',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${utc}`,
      `DTSTART:${dt(e.day, e.time)}`,
      `DTEND:${dt(e.day, end(e.time) < e.time ? e.time : end(e.time))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(e.message)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(e.message)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
