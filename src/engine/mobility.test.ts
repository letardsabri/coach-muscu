import { describe, expect, it } from 'vitest';
import raw from '../data/souplesse.json';
import { parseSouplesse, souplesse as data } from '../data/souplesseData';
import type { MmaSession, MobilitySession } from '../db/models';
import {
  buildTimeline,
  currentRep,
  defaultMobilitySettings,
  levelSummary,
  nextSettings,
  positionAt,
  positionsReached,
  recommendedRoutines,
  regularityStreak,
  startOfStep,
  weekStats,
} from './mobility';
import type { CalendarDay } from './schedule';

const seance = (id: string) => data.seances.find((s) => s.id === id)!;
const base = defaultMobilitySettings();
const at = (level: number) => ({ ...base, holdLevel: level });
const minutes = (id: string, level = 0, ankleMode = false) => buildTimeline(seance(id), data, { ankleMode, settings: at(level) }).totalSec / 60;

describe('fichier souplesse.json', () => {
  it('contient les 18 exercices demandés et les 4 séances', () => {
    const ids = data.exercices.map((e) => e.id);
    for (const id of [
      'grenouille', 'frog_rocks', 'pancake', 'pancake_charge', 'papillon', 'cossack',
      'hanches_90_90', 'switches_90_90', 'pigeon', 'hip_cars', 'shin_box',
      'fente_basse', 'elevations_laterales', 'elevations_frontales', 'kicks_ralenti',
      'chat_vache', 'rotations_thoraciques', 'scorpions', 'jefferson_curl', 'cobra_actif',
    ]) {
      expect(ids).toContain(id);
    }
    expect(data.seances.map((s) => s.id)).toEqual(['hanches_adducteurs', 'kicks_teeps', 'dos_grappling', 'complete']);
  });

  it('marque le cossack « attention cheville » et le Jefferson curl « progression lente »', () => {
    expect(data.exercices.find((e) => e.id === 'cossack')?.alerte).toBe('attention cheville');
    expect(data.exercices.find((e) => e.id === 'jefferson_curl')?.alerte).toBe('progression lente');
  });

  it('chaque séance suit préparation → développement → renforcement', () => {
    const order = ['preparation', 'developpement', 'renforcement'];
    for (const s of data.seances) {
      const blocs = s.elements.map((e) => order.indexOf(e.bloc));
      expect(blocs).toEqual([...blocs].sort((a, b) => a - b));
      expect(new Set(blocs).size).toBe(3);
    }
  });

  it('refuse un exercice qui charge la cheville sans remplaçant', () => {
    const broken = structuredClone(raw) as typeof raw;
    delete (broken.exercices.find((e) => e.id === 'cossack') as { remplacement?: string }).remplacement;
    expect(() => parseSouplesse(broken)).toThrow(/sans remplaçant/);
  });

  it('refuse un élément en répétitions sans tempo', () => {
    const broken = structuredClone(raw) as typeof raw;
    delete (broken.seances[0]!.elements.find((e) => e.mode === 'reps') as { tempo?: number }).tempo;
    expect(() => parseSouplesse(broken)).toThrow(/tempo/);
  });
});

describe('déroulé guidé', () => {
  it('durées proches de celles annoncées (15 à 25 min)', () => {
    for (const s of data.seances) {
      expect(minutes(s.id)).toBeGreaterThan(s.duree - 3);
      expect(minutes(s.id)).toBeLessThan(s.duree + 3);
    }
  });

  it('la préparation dure 2 à 3 min', () => {
    for (const s of data.seances) {
      const t = buildTimeline(s, data, { ankleMode: false, settings: base });
      const prep = t.steps.filter((x) => x.bloc === 'preparation').reduce((n, x) => n + x.sec, 0);
      expect(prep).toBeGreaterThanOrEqual(110);
      expect(prep).toBeLessThanOrEqual(190);
    }
  });

  it('PNF : 3 cycles contracter 6 s / relâcher 25 s, gauche puis droite', () => {
    const t = buildTimeline(seance('hanches_adducteurs'), data, { ankleMode: false, settings: base });
    const pigeon = t.steps.filter((s) => s.exercise.id === 'pigeon');
    expect(pigeon.map((s) => s.phase ?? s.kind)).toEqual([
      'prep', 'settle', 'contract', 'relax', 'contract', 'relax', 'contract', 'relax',
      'prep', 'settle', 'contract', 'relax', 'contract', 'relax', 'contract', 'relax',
    ]);
    expect(pigeon.filter((s) => s.phase === 'contract').every((s) => s.sec === 6)).toBe(true);
    expect(pigeon.filter((s) => s.phase === 'relax').every((s) => s.sec === 25)).toBe(true);
    expect(pigeon[8]!.side).toBe('droite');
    expect(pigeon[8]!.label).toBe('Changez de côté');
  });

  it('répétitions : durée = répétitions × tempo, répétition en cours suivie', () => {
    const t = buildTimeline(seance('hanches_adducteurs'), data, { ankleMode: false, settings: base });
    const rocks = t.steps.find((s) => s.exercise.id === 'frog_rocks' && s.kind === 'work')!;
    expect(rocks.reps).toBe(8);
    expect(rocks.sec).toBe(32);
    expect(currentRep(rocks, 32)).toBe(1);
    expect(currentRep(rocks, 27.9)).toBe(2);
    expect(currentRep(rocks, 0.1)).toBe(8);
  });

  it('progression : maintiens 45 → 60 → 75 → 90 s, +1 répétition et charge 4 → 6 → 8 kg', () => {
    const hold = (level: number) =>
      buildTimeline(seance('hanches_adducteurs'), data, { ankleMode: false, settings: at(level) }).steps.find((s) => s.exercise.id === 'hanches_90_90' && s.kind === 'work')!.sec;
    expect([0, 1, 2, 3, 4].map(hold)).toEqual([45, 60, 75, 90, 90]);
    const pancake = (level: number) =>
      buildTimeline(seance('complete'), data, { ankleMode: false, settings: at(level) }).steps.find((s) => s.exercise.id === 'pancake_charge' && s.kind === 'work')!;
    expect([0, 1, 2, 3].map((l) => pancake(l).loadKg)).toEqual([4, 4, 6, 8]);
    expect([0, 1, 2, 3].map((l) => pancake(l).reps)).toEqual([6, 7, 8, 9]);
    expect(levelSummary(at(2), data)).toMatchObject({ holdSec: 75, extraReps: 2, loadKg: 6 });
  });

  it('Jefferson curl : progression de charge plus lente', () => {
    const jc = (level: number) =>
      buildTimeline(seance('dos_grappling'), data, { ankleMode: false, settings: at(level) }).steps.find((s) => s.exercise.id === 'jefferson_curl' && s.kind === 'work')!.loadKg;
    expect([0, 1, 2, 3].map(jc)).toEqual([4, 4, 4, 6]);
  });

  it('les échauffements articulaires ne progressent pas', () => {
    const t3 = buildTimeline(seance('dos_grappling'), data, { ankleMode: false, settings: at(3) });
    expect(t3.steps.find((s) => s.exercise.id === 'chat_vache' && s.kind === 'work')!.sec).toBe(60);
  });

  it('mode cheville : cossack, pigeon et shin box remplacés par des versions au sol', () => {
    const t = buildTimeline(seance('hanches_adducteurs'), data, { ankleMode: true, settings: base });
    expect(t.replaced).toEqual([
      { from: 'pigeon', to: 'pigeon_allonge' },
      { from: 'cossack', to: 'straddle_mur' },
    ]);
    const all = data.seances.flatMap((s) => buildTimeline(s, data, { ankleMode: true, settings: base }).steps);
    expect(all.some((s) => s.exercise.cheville === 'forte')).toBe(false);
    // Le pigeon remplacé garde ses cycles PNF.
    expect(t.steps.filter((s) => s.exercise.id === 'pigeon_allonge' && s.phase === 'contract')).toHaveLength(6);
    expect(buildTimeline(seance('dos_grappling'), data, { ankleMode: true, settings: base }).replaced).toEqual([{ from: 'shin_box', to: 'switches_90_90' }]);
  });

  it('positionAt, startOfStep et positions faites', () => {
    const t = buildTimeline(seance('dos_grappling'), data, { ankleMode: false, settings: base });
    expect(positionAt(t, 0)).toEqual({ index: 0, remaining: 5 });
    expect(positionAt(t, t.totalSec)).toBeNull();
    expect(startOfStep(t, 2)).toBe(t.steps[0]!.sec + t.steps[1]!.sec);
    expect(positionsReached(t, 0)).toBe(0);
    expect(positionsReached(t, startOfStep(t, 2))).toBe(1);
    expect(positionsReached(t, t.totalSec)).toBe(t.positions);
  });
});

describe('progression selon le ressenti', () => {
  it('2 « facile » de suite → niveau +1, plafonné à 3', () => {
    let s = base;
    s = nextSettings(s, 'facile', data).settings;
    expect(s.holdLevel).toBe(0);
    const r = nextSettings(s, 'facile', data);
    expect(r.change).toBe(1);
    expect(r.settings.holdLevel).toBe(1);
    const top = nextSettings({ ...base, holdLevel: 3, easyStreak: 1 }, 'facile', data);
    expect(top.change).toBe(0);
    expect(top.settings.holdLevel).toBe(3);
  });
  it('« difficile » → niveau −1, « correct » remet la série à zéro', () => {
    expect(nextSettings({ ...base, holdLevel: 2, easyStreak: 1 }, 'difficile', data)).toEqual({ settings: { ...base, holdLevel: 1, easyStreak: 0 }, change: -1 });
    expect(nextSettings({ ...base, holdLevel: 1, easyStreak: 1 }, 'correct', data).settings.easyStreak).toBe(0);
  });
});

describe('suivi', () => {
  const session = (day: string, durationSec = 900, plannedSec = 1200): MobilitySession => ({
    id: day + durationSec,
    day,
    routineId: 'complete',
    startedAt: 0,
    endedAt: 0,
    durationSec,
    plannedSec,
    positionsDone: 1,
    positionsTotal: 1,
  });
  it('semaine : séances et minutes, les séances trop courtes ne comptent pas', () => {
    const s = [session('2026-11-02'), session('2026-11-04', 300), session('2026-11-08'), session('2026-11-09')];
    expect(weekStats(s, '2026-11-02')).toEqual({ sessions: 2, minutes: 30 });
  });
  it('série de régularité (semaines à 3 séances ou plus)', () => {
    const days = ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-30'];
    expect(regularityStreak(days.map((d) => session(d)), '2026-11-02', 3)).toBe(2);
  });
});

describe('jours recommandés', () => {
  const day = (d: string, planned?: 'A' | 'B'): CalendarDay => ({ day: d, planned, done: [], mma: [], missed: false, warnings: [] }) as unknown as CalendarDay;
  const week = (strength: number[]) =>
    ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map((d, i) => day(d, strength.includes(i) ? 'A' : undefined));
  const mma = (d: string, kind: MmaSession['kind']): MmaSession => ({ id: d, day: d, kind, durationMin: 60, createdAt: 0 }) as MmaSession;

  it('4 séances sur les jours sans muscu ni MMA, dans l’ordre des séances', () => {
    const r = recommendedRoutines(week([0, 2, 4]), [], data);
    expect([...r.entries()]).toEqual([
      ['2026-11-03', { seance: 'hanches_adducteurs', evening: false }],
      ['2026-11-05', { seance: 'kicks_teeps', evening: false }],
      ['2026-11-07', { seance: 'dos_grappling', evening: false }],
      ['2026-11-08', { seance: 'complete', evening: false }],
    ]);
  });

  it('les jours de MMA ne sont jamais choisis comme jours libres', () => {
    const r = recommendedRoutines(week([0, 2, 4]), [mma('2026-11-07', 'technique')], data);
    expect(r.has('2026-11-07')).toBe(false);
    expect(r.size).toBe(3);
  });

  it('pas assez de jours libres : complète « le soir » un jour de muscu, jamais un jour de MMA intense', () => {
    const r = recommendedRoutines(week([0, 1, 2, 3, 4, 5]), [mma('2026-11-02', 'intense')], data);
    expect(r.size).toBe(3);
    expect(r.get('2026-11-08')).toEqual(expect.objectContaining({ evening: false }));
    expect(r.has('2026-11-02')).toBe(false);
    expect([...r.values()].filter((x) => x.evening)).toHaveLength(2);
  });
});
