import { describe, expect, it } from 'vitest';
import { programme as p } from '../../data/programme';
import type { BodyMetric, FoodEntry, MobilitySession, Recommendation, Session, SetLog, WaterEntry } from '../../db/models';
import type { CalendarDay } from '../../engine/schedule';
import { addDays } from '../../lib/dates';
import { weeklyReview, type ReviewInput } from './review';

const MONDAY = '2026-11-02';
const day = (i: number) => addDays(MONDAY, i);

const session = (d: string, exercises: string[], bodyweightKg = 86): Session =>
  ({
    id: `s-${d}`,
    day: d,
    type: 'A',
    status: 'completed',
    bodyweightKg,
    plan: exercises.map((exerciseId) => ({ exerciseId })),
    results: [],
  }) as unknown as Session;

const set = (s: Session, exerciseIndex: number, reps: number, variantId = 'strict'): SetLog =>
  ({ id: `${s.id}-${exerciseIndex}-${reps}`, sessionId: s.id, exerciseIndex, exerciseId: s.plan[exerciseIndex]!.exerciseId, variantId, reps, loadKg: 0 }) as SetLog;

const calDay = (d: string, opts: Partial<CalendarDay> = {}): CalendarDay => ({ day: d, done: [], missed: false, mma: [], warnings: [], ...opts });

function input(over: Partial<ReviewInput> = {}): ReviewInput {
  return {
    p,
    monday: MONDAY,
    today: day(7),
    week: Array.from({ length: 7 }, (_, i) => calDay(day(i))),
    sessions: [],
    sets: [],
    metrics: [],
    food: [],
    water: [],
    souplesse: [],
    souplesseTarget: { min: 3, max: 4 },
    pendingRecos: [],
    nextWeekDeload: false,
    goalKg: 78,
    fallbackBodyweight: 86,
    targetsFor: () => ({ kcal: 2200, prot: 160 }),
    waterGoalFor: () => 3000,
    ...over,
  };
}

const weigh = (d: string, kg: number): BodyMetric => ({ id: d, day: d, weightKg: kg, createdAt: 0 });
const eat = (d: string, kcal: number, prot: number): FoodEntry => ({ id: d + kcal, day: d, meal: 'dejeuner', kcal, prot, gluc: 0, lip: 0, createdAt: 0 }) as FoodEntry;

describe('bilan hebdomadaire', () => {
  it('semaine vide : « garde le cap », aucune donnée inventée', () => {
    const r = weeklyReview(input());
    expect(r.partial).toBe(false);
    expect(r.weight).toBeNull();
    expect(r.nutrition).toBeNull();
    expect(r.hydration).toBeNull();
    expect(r.main.kind).toBe('cap');
  });

  it('séances : muscu faites / prévues, abdos, souplesse, MMA', () => {
    const a = session(day(0), ['pullup_pronation', 'hanging_knee_raise']);
    const b = session(day(2), ['pullup_pronation']);
    const souple: MobilitySession = { id: 'm', day: day(3), routineId: 'complete', startedAt: 0, endedAt: 0, durationSec: 1500, plannedSec: 1500, positionsDone: 1, positionsTotal: 1 };
    const week = Array.from({ length: 7 }, (_, i) => calDay(day(i)));
    week[0] = calDay(day(0), { done: [a] });
    week[2] = calDay(day(2), { done: [b] });
    week[4] = calDay(day(4), { missed: true });
    week[5] = calDay(day(5), { mma: [{ id: 'x' } as never] });
    const r = weeklyReview(input({ week, sessions: [a, b], sets: [set(a, 0, 8), set(a, 1, 12), set(b, 0, 8)], souplesse: [souple] }));
    expect(r.training).toMatchObject({ strengthDone: 2, strengthPlanned: 3, strengthMissed: 1, absDone: 1, souplesseDone: 1, souplesseMinutes: 25, mma: 1 });
    expect(r.extra.map((e) => e.kind)).toContain('abdos');
  });

  it('records : meilleure force relative de la semaine au-dessus de tout l’historique', () => {
    const old = session(day(-7), ['pullup_pronation'], 86);
    const now = session(day(1), ['pullup_pronation'], 84);
    const week = Array.from({ length: 7 }, (_, i) => calDay(day(i)));
    week[1] = calDay(day(1), { done: [now] });
    // Mêmes répétitions avec 2 kg de moins : force absolue en baisse, force relative identique → pas de record.
    const same = weeklyReview(input({ week, sessions: [old, now], sets: [set(old, 0, 8), set(now, 0, 8)] }));
    expect(same.performance.records).toEqual([]);
    expect(same.performance.stalled).toEqual(['Tractions pronation']);
    // Une répétition de plus : record.
    const better = weeklyReview(input({ week, sessions: [old, now], sets: [set(old, 0, 8), set(now, 0, 9)] }));
    expect(better.performance.records[0]).toMatchObject({ exerciseId: 'pullup_pronation' });
    expect(better.performance.records[0]!.gainPct).toBeGreaterThan(0);
    expect(better.performance.progressed).toEqual(['Tractions pronation']);
  });

  it('poids : moyenne de la semaine et écart avec la précédente', () => {
    const r = weeklyReview(input({ metrics: [weigh(day(-6), 86), weigh(day(-4), 85.8), weigh(day(1), 85.4), weigh(day(5), 85.2)] }));
    expect(r.weight).toMatchObject({ avg: 85.3, prevAvg: 85.9, delta: -0.6, measures: 2 });
  });

  it('nutrition et eau : moyennes des jours saisis seulement', () => {
    const water: WaterEntry[] = [
      { id: '1', day: day(0), ml: 2500, createdAt: 0 },
      { id: '2', day: day(1), ml: 1500, createdAt: 0 },
    ];
    const r = weeklyReview(input({ food: [eat(day(0), 2000, 150), eat(day(1), 2400, 170)], water }));
    expect(r.nutrition).toEqual({ daysLogged: 2, kcal: 2200, prot: 160, targetKcal: 2200, targetProt: 160 });
    expect(r.hydration).toEqual({ daysLogged: 2, avgMl: 2000, goalMl: 3000 });
    expect(r.extra.map((e) => e.kind)).toEqual(['eau', 'saisie']);
  });

  it('semaine en cours : partielle, et la régularité ne compte que les jours passés', () => {
    const week = Array.from({ length: 7 }, (_, i) => calDay(day(i), i === 4 ? { planned: 'B' } : {}));
    const r = weeklyReview(input({ today: day(2), week }));
    expect(r.partial).toBe(true);
    expect(r.daysElapsed).toBe(3);
    expect(r.training.strengthPlanned).toBe(1);
    expect(r.main.kind).toBe('cap');
  });
});

describe('recommandation principale (ordre de priorité)', () => {
  const missedWeek = Array.from({ length: 7 }, (_, i) => calDay(day(i), i % 2 === 0 && i < 6 ? { missed: true } : {}));
  // Poids qui remonte 3 semaines de suite.
  const stagnation = [weigh(day(-13), 85), weigh(day(-6), 85.1), weigh(day(1), 85.2)];
  const lowProt = [eat(day(0), 2200, 90), eat(day(1), 2200, 90)];

  it('1. deload en priorité absolue', () => {
    const r = weeklyReview(input({ nextWeekDeload: true, week: missedWeek, metrics: stagnation, food: lowProt }));
    expect(r.main.kind).toBe('deload');
    expect(r.extra.map((e) => e.kind)).toEqual(['regularite', 'calories_moins']);
  });

  it('1 bis. deload proposé par le coach', () => {
    const reco = { change: { kind: 'deload', from: day(7) } } as Recommendation;
    expect(weeklyReview(input({ pendingRecos: [reco] })).main.kind).toBe('deload');
  });

  it('2. régularité avant l’apport calorique', () => {
    expect(weeklyReview(input({ week: missedWeek, metrics: stagnation })).main.kind).toBe('regularite');
  });

  it('3. poids qui ne baisse plus depuis 2 semaines → − 150 kcal', () => {
    expect(weeklyReview(input({ metrics: stagnation, food: lowProt })).main.kind).toBe('calories_moins');
  });

  it('3. perte trop rapide → + 150 kcal', () => {
    const fast = Array.from({ length: 29 }, (_, i) => weigh(addDays(day(6), -28 + i), 86 - i * 0.15));
    expect(weeklyReview(input({ metrics: fast })).main.kind).toBe('calories_plus');
  });

  it('3. objectif atteint', () => {
    expect(weeklyReview(input({ metrics: [weigh(day(2), 77.8)] })).main.kind).toBe('objectif');
  });

  it('4. protéines sous 80 % de l’objectif', () => {
    expect(weeklyReview(input({ food: lowProt })).main).toMatchObject({ kind: 'proteines', tone: 'warn' });
  });

  it('5. sinon, garder le cap', () => {
    expect(weeklyReview(input({ food: [eat(day(0), 2200, 150)] })).main.kind).toBe('cap');
  });
});
