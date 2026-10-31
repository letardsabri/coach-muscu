import { describe, expect, it } from 'vitest';
import { programme as p } from '../../data/programme';
import type { Profile, ProgramState, Reminder } from '../../db/models';
import { buildCalendar } from '../../engine/schedule';
import { buildEvents, buildIcs, resolveMessage } from './reminders';

const state: ProgramState = {
  id: 'current',
  phase: 1,
  blockId: 'base',
  cycleIndex: 1,
  cycleStartedOn: '2026-11-02',
  phaseStartedOn: '2026-11-02',
  nextSessionType: 'A',
  loadFrozen: false,
  exercises: {},
  updatedAt: 0,
};
const profile = { sessionsPerWeek: 3, trainingDays: [1, 3, 5] } as Profile;
const reminder = (over: Partial<Reminder>): Reminder => ({
  id: over.kind ?? 'x',
  kind: 'session_today',
  label: 'Séance du jour',
  enabled: true,
  time: '18:00',
  days: 'training',
  onlyIfNotDone: false,
  message: 'Séance {seance} aujourd’hui · {duree} min. {exercice1} en premier.',
  updatedAt: 0,
  ...over,
});

const run = (reminders: Reminder[], days = 14) =>
  buildEvents({
    p,
    reminders,
    calendar: buildCalendar({ programme: p, profile, nextSessionType: 'A', overrides: [], sessions: [], mma: [], from: '2026-11-02', to: '2026-12-31', today: '2026-11-02' }),
    state,
    from: '2026-11-02',
    days,
    sessionInfo: (t) => ({ name: `${t} — ${t === 'A' ? 'Tirage' : 'Poussée'}`, minutes: 31, firstExercise: t === 'A' ? 'Tractions pronation' : 'Dips' }),
    baseVars: { prenom: 'Sam', poids_objectif: '78 kg' },
  });

describe('rappels', () => {
  it('remplace les variables, et une variable vide disparaît proprement', () => {
    expect(resolveMessage('Salut {prenom}, séance {seance} !', { prenom: 'Sam', seance: 'A' })).toBe('Salut Sam, séance A !');
    expect(resolveMessage('Salut {prenom}, go.', {})).toBe('Salut, go.');
  });

  it('un rappel par jour de séance, avec le bon type en alternance', () => {
    const ev = run([reminder({})]);
    expect(ev.map((e) => e.day)).toEqual(['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13']);
    expect(ev[0]!.message).toBe('Séance A — Tirage aujourd’hui · 31 min. Tractions pronation en premier.');
    expect(ev[1]!.message).toContain('B — Poussée');
  });

  it('« séance non faite » est exclu de l’export (conditionnel)', () => {
    expect(run([reminder({ kind: 'session_missed', onlyIfNotDone: true })])).toHaveLength(0);
  });

  it('mensurations toutes les 2 semaines le dimanche', () => {
    const ev = run([reminder({ kind: 'measurements', days: [7], everyDays: 14, message: 'Mesures' })], 42);
    expect(ev.map((e) => e.day)).toEqual(['2026-11-08', '2026-11-22', '2026-12-06']);
  });

  it('semaine de tests : uniquement le lundi de la semaine de deload', () => {
    const ev = run([reminder({ kind: 'test_week', days: [1], message: 'Tests' })], 56);
    expect(ev.map((e) => e.day)).toEqual(['2026-12-07']);
  });

  it('fichier .ics valide : alarmes, échappement, lignes ≤ 75 octets', () => {
    const ics = buildIcs(run([reminder({ message: 'Go, go; go ! Un message assez long pour dépasser soixante-quinze octets sur une seule ligne {seance}' })], 3));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261102T180000');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('Go\\, go\\; go');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
