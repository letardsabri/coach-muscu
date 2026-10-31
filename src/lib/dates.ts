import type { DayKey, IsoWeekday } from '../db/models';

const DAY_MS = 86_400_000;

/** Jour calendaire local "YYYY-MM-DD". */
export function dayKey(d: Date = new Date()): DayKey {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDay(k: DayKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Nombre de jours de b à a (a − b). L'arrondi absorbe les changements d'heure. */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / DAY_MS);
}

export function addDays(k: DayKey, n: number): DayKey {
  const d = parseDay(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function isoWeekday(d: Date = new Date()): IsoWeekday {
  const w = d.getDay();
  return (w === 0 ? 7 : w) as IsoWeekday;
}

/** "mm:ss" pour un nombre de secondes positif. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** « aujourd'hui », « hier », « il y a 3 jours ». */
export function relativeDay(k: DayKey, today: DayKey = dayKey()): string {
  const n = diffDays(today, k);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  return `il y a ${n} jours`;
}
