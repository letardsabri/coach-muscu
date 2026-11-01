import { describe, expect, it } from 'vitest';
import raw from '../data/mobilite.json';
import { mobilite as data, parseMobilite } from '../data/mobiliteData';
import type { MmaSession, MobilitySession } from '../db/models';
import {
  buildTimeline,
  defaultMobilitySettings,
  nextSettings,
  positionAt,
  positionsReached,
  recommendedRoutines,
  regularityStreak,
  startOfStep,
  weekStats,
} from './mobility';
import type { CalendarDay } from './schedule';

const routine = (id: string) => data.routines.find((r) => r.id === id)!;
const base = defaultMobilitySettings();

describe('fichier mobilite.json', () => {
  it('contient les 15 exercices demandés et les 4 routines', () => {
    const ids = data.exercices.map((e) => e.id);
    for (const id of ['papillon', 'grenouille', 'straddle', 'hanches_90_90', 'pigeon', 'fente_genou_sol', 'couch_stretch', 'ischios_sangle', 'figure_4', 'suspension_passive', 'pecs_barres', 'thread_needle', 'chat_vache', 'mobilite_cou']) {
      expect(ids).toContain(id);
    }
    expect(data.routines.map((r) => r.id)).toEqual(['express', 'hanches', 'recup_haut', 'complete']);
  });
  it('refuse un exercice qui charge la cheville sans remplaçant', () => {
    const broken = structuredClone(raw) as typeof raw;
    delete (broken.exercices.find((e) => e.id === 'couch_stretch') as { remplacement?: string }).remplacement;
    expect(() => parseMobilite(broken)).toThrow(/sans remplaçant/);
  });
});

describe('déroulé guidé', () => {
  it('durées des routines proches de celles annoncées', () => {
    const min = (id: string) => buildTimeline(routine(id), data, { ankleMode: false, settings: base }).totalSec / 60;
    expect(min('express')).toBeGreaterThan(4);
    expect(min('express')).toBeLessThan(6);
    expect(min('hanches')).toBeGreaterThan(11);
    expect(min('hanches')).toBeLessThan(16);
    expect(min('recup_haut')).toBeGreaterThan(8);
    expect(min('recup_haut')).toBeLessThan(12);
    expect(min('complete')).toBeGreaterThan(17);
    expect(min('complete')).toBeLessThan(24);
  });

  it('gauche puis droite, avec « Changez de côté »', () => {
    const t = buildTimeline(routine('hanches'), data, { ankleMode: false, settings: base });
    const pigeon = t.steps.filter((s) => s.exercise.id === 'pigeon');
    expect(pigeon.map((s) => `${s.kind}:${s.side}`)).toEqual(['prep:gauche', 'work:gauche', 'prep:droite', 'work:droite']);
    expect(pigeon[2]!.label).toBe('Changez de côté');
  });

  it('mode cheville : couch stretch remplacé par la fente genou au sol', () => {
    const t = buildTimeline(routine('complete'), data, { ankleMode: true, settings: base });
    expect(t.replaced).toEqual([{ from: 'couch_stretch', to: 'fente_genou_sol' }]);
    expect(t.steps.some((s) => s.exercise.id === 'couch_stretch')).toBe(false);
    const express = buildTimeline(routine('express'), data, { ankleMode: true, settings: base });
    expect(express.steps.some((s) => s.exercise.id === 'balanciers_allonge')).toBe(true);
    expect(express.steps.some((s) => s.exercise.id === 'rotations_hanches_4p')).toBe(true);
    expect(express.steps.some((s) => s.exercise.cheville === 'forte')).toBe(false);
  });

  it('PNF : étirer, contracter, relâcher sur straddle et ischios seulement', () => {
    const t = buildTimeline(routine('hanches'), data, { ankleMode: false, settings: { ...base, pnf: true } });
    const straddle = t.steps.filter((s) => s.exercise.id === 'straddle' && s.kind === 'work');
    expect(straddle.map((s) => `${s.phase}${s.sec}`)).toEqual(['stretch20', 'contract6', 'relax20', 'stretch20', 'contract6', 'relax20']);
    expect(t.steps.filter((s) => s.exercise.id === 'papillon' && s.kind === 'work').every((s) => s.phase === 'hold')).toBe(true);
  });

  it('progression : +15 s par niveau sur le statique, plafonné à 60 s, dynamique inchangé', () => {
    const t = buildTimeline(routine('recup_haut'), data, { ankleMode: false, settings: { ...base, holdLevel: 2 } });
    expect(t.steps.find((s) => s.exercise.id === 'pecs_barres' && s.kind === 'work')!.sec).toBe(60);
    expect(t.steps.find((s) => s.exercise.id === 'suspension_passive' && s.kind === 'work')!.sec).toBe(60);
    expect(t.steps.find((s) => s.exercise.id === 'chat_vache' && s.kind === 'work')!.sec).toBe(60);
    expect(t.steps.find((s) => s.exercise.id === 'mobilite_cou' && s.kind === 'work')!.sec).toBe(60);
  });

  it('position calculée depuis le temps écoulé (fiable après verrouillage d’écran)', () => {
    const t = buildTimeline(routine('express'), data, { ankleMode: false, settings: base });
    expect(positionAt(t, 0)).toEqual({ index: 0, remaining: 5 });
    expect(positionAt(t, 7)).toEqual({ index: 1, remaining: 43 });
    expect(positionAt(t, t.totalSec)).toBeNull();
    expect(startOfStep(t, 2)).toBe(50);
    expect(positionsReached(t, 51)).toBe(1);
  });
});

describe('progression du maintien', () => {
  it('2 « facile » de suite → niveau +1 ; « difficile » → −1', () => {
    let s = base;
    s = nextSettings(s, 'facile', data).settings;
    expect(s).toMatchObject({ holdLevel: 0, easyStreak: 1 });
    const up = nextSettings(s, 'facile', data);
    expect(up).toMatchObject({ change: 1, settings: { holdLevel: 1, easyStreak: 0 } });
    expect(nextSettings(up.settings, 'difficile', data)).toMatchObject({ change: -1, settings: { holdLevel: 0 } });
    expect(nextSettings({ ...base, holdLevel: 2, easyStreak: 1 }, 'facile', data).settings.holdLevel).toBe(2);
  });
});

describe('suivi', () => {
  const sess = (day: string, durationSec = 600, plannedSec = 600): MobilitySession =>
    ({ id: day + durationSec, day, routineId: 'hanches', startedAt: 0, endedAt: 0, durationSec, plannedSec, positionsDone: 1, positionsTotal: 1 }) as MobilitySession;

  it('séances et minutes de la semaine ; une séance à moins de 50 % ne compte pas', () => {
    expect(weekStats([sess('2026-11-02'), sess('2026-11-04', 200), sess('2026-11-09')], '2026-11-02')).toEqual({ sessions: 1, minutes: 10 });
  });

  it('série de régularité : semaines consécutives à ≥ 3 séances', () => {
    const w = (monday: string, n: number) => Array.from({ length: n }, (_, i) => sess(`${monday.slice(0, 8)}${String(Number(monday.slice(8)) + i).padStart(2, '0')}`));
    const list = [...w('2026-10-19', 3), ...w('2026-10-26', 4), ...w('2026-11-02', 1)];
    expect(regularityStreak(list, '2026-11-02', 3)).toBe(2); // semaine en cours pas encore atteinte
    expect(regularityStreak([...list, ...w('2026-11-05', 2)], '2026-11-02', 3)).toBe(3);
  });
});

describe('jours recommandés', () => {
  const day = (d: string, planned?: 'A' | 'B'): CalendarDay => ({ day: d, done: [], planned, missed: false, mma: [], warnings: [] });
  const week = [day('2026-11-02', 'A'), day('2026-11-03'), day('2026-11-04', 'B'), day('2026-11-05'), day('2026-11-06', 'A'), day('2026-11-07'), day('2026-11-08')];

  it('récupération après les séances, souplesse sur 2 jours de repos, 5 au maximum', () => {
    const r = recommendedRoutines(week, [], data);
    expect([...r.entries()]).toEqual([
      ['2026-11-02', 'recup_haut'],
      ['2026-11-04', 'recup_haut'],
      ['2026-11-06', 'recup_haut'],
      ['2026-11-03', 'hanches'],
      ['2026-11-05', 'complete'],
    ]);
  });

  it('pas de longue séance un jour de MMA intense sans muscu', () => {
    const mma: MmaSession[] = [{ id: 'm', day: '2026-11-03', kind: 'intense', durationMin: 90, done: false, createdAt: 0 }];
    const r = recommendedRoutines(week, mma, data);
    expect(r.has('2026-11-03')).toBe(false);
    expect(r.get('2026-11-05')).toBe('hanches');
  });
});
