import { describe, expect, it } from 'vitest';
import { programme as p } from '../data/programme';
import type { Feeling, MaxTest, PlannedExercise, Profile, ProgramState, Readiness, Session, SetLog } from '../db/models';
import { addDays } from '../lib/dates';
import {
  buildExposures,
  evaluateAfterSession,
  evaluatePhase,
  ruleR1,
  ruleR2,
  ruleR3,
  ruleR4,
  ruleR8Comeback,
  stepDown,
  stepUp,
  type ExerciseContext,
} from './progression';

const profile = {
  sessionsPerWeek: 3,
  startWeightKg: 86,
  dumbbell: { minKg: 4, maxKg: 12, stepKg: 2 },
} as Profile;

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

const NORMAL: Readiness = { sleep: 4, energy: 4, soreness: 2, anklePain: 0, mmaHardWithin24h: false };
const LOW: Readiness = { sleep: 2, energy: 2, soreness: 4, anklePain: 0, mmaHardWithin24h: false };

/** Fabrique une séance terminée avec un seul exercice. */
function fake(
  i: number,
  exerciseId: string,
  reps: number[],
  opts: { range?: [number, number]; variantId?: string; loadKg?: number; feeling?: Feeling; readiness?: Readiness; bw?: number; deload?: boolean; jointPain?: number; phase?: 1 | 2 | 3 } = {},
) {
  const id = `s${i}`;
  const pe = {
    exerciseId,
    name: exerciseId,
    variantId: opts.variantId ?? p.exercises[exerciseId]!.defaultVariant,
    variantName: '',
    loadInput: 'none',
    loadKg: opts.loadKg ?? 0,
    sets: reps.length,
    reps: opts.range ?? [3, 6],
    targetReps: reps,
    rir: [2, 3],
    restSec: 120,
    onBelowMin: 'none',
    main: true,
    optional: false,
  } as PlannedExercise;
  const session = {
    id,
    type: 'A',
    status: 'completed',
    day: addDays('2026-11-02', i * 2),
    startedAt: i,
    phase: opts.phase ?? 1,
    blockId: 'base',
    cycleIndex: 1,
    weekInCycle: 1,
    isDeload: opts.deload ?? false,
    readiness: opts.readiness ?? NORMAL,
    adjustments: [],
    plan: [pe],
    bodyweightKg: opts.bw ?? 86,
    results: [{ exerciseId, feeling: opts.feeling ?? 'correct', jointPain: opts.jointPain }],
  } as Session;
  const sets: SetLog[] = reps.map((r, k) => ({
    id: `${id}-${k}`,
    sessionId: id,
    exerciseIndex: 0,
    exerciseId,
    variantId: pe.variantId,
    setIndex: k,
    plannedReps: r,
    reps: r,
    negatives: 0,
    restPauseReps: 0,
    loadKg: pe.loadKg,
    completedAt: i * 1000 + k,
  }));
  return { session, sets };
}

function ctxFrom(list: ReturnType<typeof fake>[], exerciseId: string, st: ProgramState = state): ExerciseContext {
  const sessions = list.map((x) => x.session);
  const sets = list.flatMap((x) => x.sets);
  return { p, profile, state: st, today: '2026-12-01', exposures: buildExposures(p, sessions, sets, exerciseId, 86) };
}

describe('échelle de variantes', () => {
  it('tractions : strictes → tempo, puis lest réservé à la phase 3', () => {
    expect(stepUp(p, profile, 1, 'pullup_pronation', 'strict', 0)).toMatchObject({ variantId: 'tempo', loadKg: 0 });
    expect(stepUp(p, profile, 2, 'pullup_pronation', 'tempo', 0)).toMatchObject({ blocked: expect.stringContaining('phase 3') });
    expect(stepUp(p, profile, 3, 'pullup_pronation', 'tempo', 0)).toMatchObject({ variantId: 'weighted', loadKg: 2.5 });
  });
  it('lest : +1,25 kg sous 10 kg, +2,5 kg au-delà', () => {
    expect(stepUp(p, profile, 3, 'dips', 'weighted', 5)).toMatchObject({ loadKg: 6.25 });
    expect(stepUp(p, profile, 3, 'dips', 'weighted', 10)).toMatchObject({ loadKg: 12.5 });
  });
  it('haltères : +2 kg jusqu’à 12 kg, puis variante suivante', () => {
    expect(stepUp(p, profile, 1, 'curl', 'seated', 8)).toMatchObject({ variantId: 'seated', loadKg: 10 });
    expect(stepUp(p, profile, 1, 'curl', 'seated', 12)).toMatchObject({ variantId: 'tempo', loadKg: 12 });
  });
  it('pompes : depuis la variante genoux (hors échelle) on rejoint les classiques', () => {
    expect(stepUp(p, profile, 1, 'pushup', 'knees', 0)).toMatchObject({ variantId: 'classic' });
  });
  it('échelon précédent', () => {
    expect(stepDown(p, profile, 'pullup_pronation', 'strict', 0)).toMatchObject({ variantId: 'negatives' });
    expect(stepDown(p, profile, 'curl', 'seated', 10)).toMatchObject({ loadKg: 8 });
    expect(stepDown(p, profile, 'dips', 'weighted', 10)).toMatchObject({ variantId: 'weighted', loadKg: 8.75 });
  });
});

describe('R1 — double progression', () => {
  it('haut de fourchette + ressenti correct → échelon suivant', () => {
    const r = ruleR1(ctxFrom([fake(1, 'pullup_pronation', [6, 6, 6, 6])], 'pullup_pronation'));
    expect(r?.change).toEqual({ kind: 'variant', exerciseId: 'pullup_pronation', variantId: 'tempo', loadKg: 0 });
    expect(r?.explanation).toContain('4 × 6');
  });
  it('haut atteint mais ressenti dur → confirmation, aucun changement', () => {
    const r = ruleR1(ctxFrom([fake(1, 'pullup_pronation', [6, 6, 6, 6], { feeling: 'dur' })], 'pullup_pronation'));
    expect(r?.change).toBeUndefined();
    expect(r?.title).toContain('confirmer');
  });
  it('une série sous le max → rien', () => {
    expect(ruleR1(ctxFrom([fake(1, 'pullup_pronation', [6, 6, 6, 5])], 'pullup_pronation'))).toBeUndefined();
  });
  it('charges gelées (camp MMA) → pas de hausse de charge', () => {
    const r = ruleR1(ctxFrom([fake(1, 'curl', [15, 15, 15], { range: [10, 15], loadKg: 8 })], 'curl', { ...state, loadFrozen: true }));
    expect(r?.change).toBeUndefined();
    expect(r?.title).toContain('pause');
  });
  it('abdos tenus : 2 × 30 s en L-sit tuck → une jambe tendue, on repart à 10 s', () => {
    const r = ruleR1(ctxFrom([fake(1, 'lsit', [30, 30], { range: [10, 30], variantId: 'tuck' })], 'lsit'));
    expect(r?.change).toMatchObject({ variantId: 'one_leg', loadKg: 0 });
    expect(r?.explanation).toContain('on repart à 10 s');
  });
  it('crunch lesté : +2 kg quand 2 × 20 est atteint', () => {
    const r = ruleR1(ctxFrom([fake(1, 'weighted_crunch', [20, 20], { range: [10, 20], loadKg: 6 })], 'weighted_crunch'));
    expect(r?.change).toMatchObject({ variantId: 'standard', loadKg: 8 });
  });
  it('les séances de deload ne déclenchent pas de progression', () => {
    expect(ruleR1(ctxFrom([fake(1, 'pullup_pronation', [6, 6], { deload: true })], 'pullup_pronation'))).toBeUndefined();
  });
});

describe('R2 — sous le minimum', () => {
  it('deux séances de suite sous le minimum → un cran en dessous', () => {
    const r = ruleR2(ctxFrom([fake(1, 'curl', [9, 8, 8], { range: [10, 15], loadKg: 10 }), fake(2, 'curl', [9, 8, 7], { range: [10, 15], loadKg: 10 })], 'curl'));
    expect(r?.change).toMatchObject({ kind: 'variant', loadKg: 8 });
  });
  it('si la forme était basse à chaque fois → message fatigue, pas de baisse', () => {
    const r = ruleR2(
      ctxFrom([fake(1, 'curl', [9, 8, 8], { range: [10, 15], loadKg: 10, readiness: LOW }), fake(2, 'curl', [9, 8, 7], { range: [10, 15], loadKg: 10, readiness: LOW })], 'curl'),
    );
    expect(r?.change).toBeUndefined();
    expect(r?.explanation).toContain('récupération');
  });
});

describe('R3 — stagnation', () => {
  const stuck = [fake(1, 'dips', [8, 7, 7, 6], { range: [6, 10] }), fake(2, 'dips', [8, 7, 6, 6], { range: [6, 10] }), fake(3, 'dips', [8, 7, 7, 6], { range: [6, 10] }), fake(4, 'dips', [7, 7, 7, 6], { range: [6, 10] })];
  it('3 séances sans hausse de l’indice → clusters', () => {
    const r = ruleR3(ctxFrom(stuck, 'dips'));
    expect(r?.change).toMatchObject({ kind: 'cluster', exerciseId: 'dips' });
  });
  it('pas de stagnation si les reps totales montent', () => {
    const up = [...stuck.slice(0, 3), fake(4, 'dips', [9, 8, 7, 7], { range: [6, 10] })];
    expect(ruleR3(ctxFrom(up, 'dips'))).toBeUndefined();
  });
  it('une rep gagnée sur une série secondaire compte comme une progression', () => {
    const up = [...stuck.slice(0, 3), fake(4, 'dips', [8, 8, 7, 6], { range: [6, 10] })];
    expect(ruleR3(ctxFrom(up, 'dips'))).toBeUndefined();
  });
  it('pas de stagnation retenue si la forme était basse', () => {
    const tired = [...stuck.slice(0, 3), fake(4, 'dips', [7, 7, 7, 6], { range: [6, 10], readiness: LOW })];
    expect(ruleR3(ctxFrom(tired, 'dips'))).toBeUndefined();
  });
});

describe('R4 — deload anticipé', () => {
  const run = (list: ReturnType<typeof fake>[], weekInCycle = 3) => {
    const sessions = list.map((x) => x.session);
    const sets = list.flatMap((x) => x.sets);
    return ruleR4({
      p,
      state,
      today: '2026-12-01',
      weekInCycle,
      sessions,
      exposuresByExercise: { pullup_pronation: buildExposures(p, sessions, sets, 'pullup_pronation', 86), dips: [] },
      stalledCount: 0,
    });
  };
  const good = [fake(1, 'pullup_pronation', [6, 6, 5, 5]), fake(2, 'pullup_pronation', [6, 6, 5, 5]), fake(3, 'pullup_pronation', [6, 6, 5, 5])];

  it('baisse ≥ 10 % deux séances de suite sur un mouvement principal', () => {
    const r = run([...good, fake(4, 'pullup_pronation', [3, 3, 3, 2]), fake(5, 'pullup_pronation', [3, 3, 2, 2])]);
    expect(r?.change).toMatchObject({ kind: 'deload' });
    expect(r?.explanation).toContain('tractions pronation en baisse');
  });
  it('une seule mauvaise séance ne suffit pas', () => {
    expect(run([...good, fake(4, 'pullup_pronation', [3, 3, 3, 2]), fake(5, 'pullup_pronation', [6, 6, 5, 5])])).toBeUndefined();
  });
  it('forme basse 3 séances de suite', () => {
    const r = run([...good.slice(0, 1), ...[2, 3, 4].map((i) => fake(i, 'pullup_pronation', [6, 6, 5, 5], { readiness: LOW }))]);
    expect(r?.explanation).toContain('forme du jour basse');
  });
  it('pas de deload anticipé juste avant le deload planifié', () => {
    expect(run([...good, fake(4, 'pullup_pronation', [3, 3, 3, 2]), fake(5, 'pullup_pronation', [3, 3, 2, 2])], 5)).toBeUndefined();
  });
});

describe('R7 — passage de phase', () => {
  const tests = (pull: number, dips: number, push: number): MaxTest[] => [
    { id: 'a', testId: 'pullup_max', day: '2026-12-10', value: pull, loadKg: 0, createdAt: 0 },
    { id: 'b', testId: 'dips_max', day: '2026-12-11', value: dips, loadKg: 0, createdAt: 0 },
    { id: 'c', testId: 'pushup_max', day: '2026-12-11', value: push, loadKg: 0, createdAt: 0 },
  ];
  const sessions = Array.from({ length: 12 }, (_, i) => fake(i, 'pullup_pronation', [5, 5, 5, 5]).session).map((s, i) => ({
    ...s,
    day: addDays('2026-11-16', i * 2),
  }));
  const ctx = (t: MaxTest[], today = '2026-12-12') => ({ p, profile, state, today, sessions, tests: t, exposuresByExercise: {} });

  it('critères remplis après 6 semaines avec 2 tests sur 3', () => {
    const r = evaluatePhase(ctx(tests(8, 14, 26)));
    expect(r.met).toBe(true);
    expect(r.to).toBe(2);
  });
  it('trop tôt : minimum 5 semaines', () => {
    expect(evaluatePhase(ctx(tests(9, 16, 30), '2026-11-20')).met).toBe(false);
  });
  it('un seul test réussi : pas encore', () => {
    expect(evaluatePhase(ctx(tests(8, 12, 20))).met).toBe(false);
  });
});

describe('R8 — reprise', () => {
  it('1 à 3 mois d’arrêt : un échelon en arrière', () => {
    expect(ruleR8Comeback(p, { ...state, phase: 3 }, '2026-10-01', '2026-11-15')?.change).toMatchObject({ kind: 'comeback', phase: 2, stepBack: true });
  });
  it('plus de 3 mois : retour en phase 1', () => {
    expect(ruleR8Comeback(p, { ...state, phase: 2 }, '2026-05-01', '2026-10-01')?.change).toMatchObject({ phase: 1 });
  });
  it('moins de 4 semaines : rien (séance allégée gérée par le planner)', () => {
    expect(ruleR8Comeback(p, state, '2026-10-01', '2026-10-20')).toBeUndefined();
  });
});

describe('évaluation complète après une séance', () => {
  it('produit une recommandation par exercice concerné', () => {
    const s = fake(1, 'pullup_pronation', [6, 6, 6, 6]);
    const drafts = evaluateAfterSession({
      p,
      profile,
      state,
      today: '2026-11-04',
      weekInCycle: 1,
      session: s.session,
      sessions: [s.session],
      sets: s.sets,
      tests: [],
      fallbackBodyweight: 86,
    });
    expect(drafts.map((d) => d.rule)).toEqual(['R1']);
  });
});
