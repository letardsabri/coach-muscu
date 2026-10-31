import { describe, expect, it } from 'vitest';
import { programme as p } from '../data/programme';
import type { Profile, ProgramState, SetLog } from '../db/models';
import { cycleInfo, rollCycle } from './cycle';
import { buildPlan, buildTestPlan, type PlannerInput } from './planner';
import { buildSequence, nextStep, stepKey } from './sequence';
import { targetRepsFromLast } from './targets';

const profile: Profile = {
  id: 'me',
  firstName: '',
  birthYear: 2004,
  heightCm: 179,
  startWeightKg: 86,
  goalWeightKg: 78,
  sessionsPerWeek: 3,
  trainingDays: [1, 3, 5],
  ankleMode: true,
  mmaMode: false,
  dumbbell: { minKg: 4, maxKg: 12, stepKg: 2 },
  soundOn: true,
  createdAt: 0,
  updatedAt: 0,
};

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

const input = (over: Partial<PlannerInput> = {}): PlannerInput => ({
  programme: p,
  profile,
  state,
  type: 'A',
  today: '2026-11-02',
  lastSets: {},
  ...over,
});

const set = (exerciseId: string, setIndex: number, reps: number, loadKg = 0, variantId = 'strict'): SetLog => ({
  id: `${exerciseId}-${setIndex}`,
  sessionId: 's1',
  exerciseIndex: 0,
  exerciseId,
  variantId,
  setIndex,
  plannedReps: reps,
  reps,
  negatives: 0,
  restPauseReps: 0,
  loadKg,
  completedAt: setIndex,
});

describe('targetRepsFromLast (R1)', () => {
  it('démarre au bas de la fourchette sans historique', () => {
    expect(targetRepsFromLast(4, [3, 6], [], 1)).toEqual([3, 3, 3, 3]);
  });
  it('vise +1 sur la première série encore sous le max', () => {
    expect(targetRepsFromLast(4, [3, 6], [6, 5, 4, 4], 1)).toEqual([6, 6, 4, 4]);
  });
  it('reste au max quand tout est atteint', () => {
    expect(targetRepsFromLast(3, [4, 8], [8, 8, 8], 1)).toEqual([8, 8, 8]);
  });
});

describe('cycle', () => {
  it('semaine 6 = deload', () => {
    expect(cycleInfo(state, '2026-12-07', p)).toMatchObject({ weekInCycle: 6, isDeload: true });
    expect(cycleInfo(state, '2026-11-30', p)).toMatchObject({ weekInCycle: 5, isDeload: false });
  });
  it('passe au cycle suivant après 6 semaines', () => {
    const next = rollCycle(state, '2026-12-14', p);
    expect(next.cycleIndex).toBe(2);
    expect(next.cycleStartedOn).toBe('2026-12-14');
  });
  it('phase 3 : alternance des blocs Force / Hypertrophie à chaque cycle', () => {
    const p3 = { ...state, phase: 3 as const, blockId: 'force' };
    expect(rollCycle(p3, '2026-12-14', p).blockId).toBe('hypertrophie');
    expect(rollCycle(p3, '2027-01-25', p).blockId).toBe('force');
    expect(rollCycle(state, '2026-12-14', p).blockId).toBe('base');
  });

  it('un deload anticipé remet le compteur à zéro', () => {
    const forced = { ...state, forcedDeloadFrom: '2026-11-16' };
    expect(cycleInfo(forced, '2026-11-18', p).isDeload).toBe(true);
    const next = rollCycle(forced, '2026-11-23', p);
    expect(next).toMatchObject({ cycleIndex: 2, cycleStartedOn: '2026-11-23', forcedDeloadFrom: undefined });
  });
});

describe('planner', () => {
  it('séance A phase 1 en mode cheville', () => {
    const out = buildPlan(input());
    expect(out.plan.map((e) => e.exerciseId)).toEqual([
      'pullup_pronation',
      'pullup_supination',
      'curl',
      'rear_delt_fly',
      'hanging_knee_raise',
      'side_plank',
      'glute_bridge_single',
    ]);
    expect(out.plan[5]).toMatchObject({ unit: 'sec', perSide: true, reps: [20, 45], group: 'abs' });
    expect(out.plan[0]).toMatchObject({ sets: 4, reps: [3, 6], targetReps: [3, 3, 3, 3], loadInput: 'none' });
    expect(out.plan[2]).toMatchObject({ loadInput: 'dumbbell', loadKg: 8 });
    expect(out.adjustments).toEqual(['ankle_mode']);
  });

  it('séance B : abdos (L-sit + crunch), puis pont fessier en mode cheville, bulgare une fois guéri', () => {
    const b = buildPlan(input({ type: 'B' })).plan;
    expect(b.slice(4).map((e) => e.exerciseId)).toEqual(['lsit', 'weighted_crunch', 'glute_bridge_single']);
    expect(b[5]).toMatchObject({ loadInput: 'dumbbell', loadKg: 6 });
    const healed = { ...profile, ankleMode: false, ankleHealedOn: '2026-10-01' };
    expect(buildPlan(input({ type: 'B', profile: healed })).plan[6]?.exerciseId).toBe('bulgarian_split_squat');
    const recent = { ...profile, ankleMode: false, ankleHealedOn: '2026-10-25' };
    expect(buildPlan(input({ type: 'B', profile: recent })).plan[6]?.exerciseId).toBe('split_squat');
  });

  it('abdos présents dans toutes les séances de toutes les phases', () => {
    const abs = new Set(['hanging_knee_raise', 'side_plank', 'lsit', 'weighted_crunch']);
    for (const phase of [1, 2, 3] as const) {
      for (const blockId of phase === 3 ? ['force', 'hypertrophie'] : ['base']) {
        for (const type of ['A', 'B', 'F', 'MIN'] as const) {
          const plan = buildPlan(input({ type, state: { ...state, phase, blockId } })).plan;
          expect(plan.some((e) => abs.has(e.exerciseId)), `phase ${phase} ${blockId} ${type}`).toBe(true);
        }
      }
    }
  });

  it('exercice tenu : cible +5 s sur la première série sous le max', () => {
    const lastSets = { lsit: [set('lsit', 0, 15, 0, 'tuck'), set('lsit', 1, 12, 0, 'tuck')] };
    expect(buildPlan(input({ type: 'B', lastSets })).plan[4]?.targetReps).toEqual([20, 12]);
  });

  it('reprend la dernière exposition comparable', () => {
    const lastSets = { pullup_pronation: [set('pullup_pronation', 0, 5), set('pullup_pronation', 1, 4)] };
    // Dernière fois 5, 4 → séries manquantes complétées par la dernière valeur, +1 sur la 1re série sous le max.
    expect(buildPlan(input({ lastSets })).plan[0]?.targetReps).toEqual([6, 4, 4, 4]);
  });

  it('ignore une exposition avec une autre variante', () => {
    const lastSets = { pullup_pronation: [set('pullup_pronation', 0, 6, 0, 'tempo')] };
    expect(buildPlan(input({ lastSets })).plan[0]?.targetReps).toEqual([3, 3, 3, 3]);
  });

  it('deload : séries ÷ 2, minimum 2 sur les principaux, RIR 3–4', () => {
    const out = buildPlan(input({ today: '2026-12-07' }));
    expect(out.isDeload).toBe(true);
    expect(out.plan[0]).toMatchObject({ sets: 2, rir: [3, 4], targetReps: [3, 3] });
    expect(out.plan[4]).toMatchObject({ sets: 1 });
  });

  it('forme basse : −1 série, RIR +1, sans cumul des raisons', () => {
    const out = buildPlan(
      input({
        readiness: { sleep: 2, energy: 2, soreness: 4, anklePain: 0, mmaHardWithin24h: true },
        lastSessionDay: '2026-10-01',
      }),
    );
    expect(out.adjustments).toEqual(['reduced_readiness', 'reduced_mma', 'reduced_comeback', 'ankle_mode']);
    expect(out.plan[0]).toMatchObject({ sets: 3, rir: [3, 4] });
  });

  it('séance F reprend les fourchettes de la phase', () => {
    const out = buildPlan(input({ type: 'F' }));
    expect(out.plan[0]).toMatchObject({ exerciseId: 'pullup_pronation', sets: 3, reps: [3, 6], rir: [2, 3] });
    expect(out.plan[1]).toMatchObject({ exerciseId: 'dips', reps: [6, 10] });
  });

  it('clusters (R3) : séries ×2, reps ÷2, repos 45 s', () => {
    const st = { ...state, exercises: { dips: { variantId: 'strict', loadKg: 0, clusterUntil: '2026-11-10', updatedAt: 0 } } };
    const pe = buildPlan(input({ type: 'B', state: st })).plan[0]!;
    expect(pe).toMatchObject({ sets: 8, reps: [3, 5], restSec: 45, cluster: true });
    expect(buildPlan(input({ type: 'B', state: st, today: '2026-11-11' })).plan[0]!.sets).toBe(4);
  });

  it('MMA 2×/semaine : −1 série sur les principaux, RIR +1', () => {
    const mma = { ...profile, mmaMode: true };
    const out = buildPlan(input({ profile: mma, mmaThisWeek: 2 }));
    expect(out.adjustments).toContain('mma_week');
    expect(out.plan[0]).toMatchObject({ sets: 3, rir: [3, 4] });
    expect(out.plan[2]).toMatchObject({ sets: 3 }); // curl : pas un exercice principal
  });

  it('séance de tests B : dips puis pompes, 5 min entre les deux', () => {
    const out = buildTestPlan({ programme: p, state, which: 'B', today: '2026-12-07', lastTests: { dips_max: 14 } });
    expect(out.plan.map((e) => [e.testId, e.sets, e.targetReps[0], e.restSec])).toEqual([
      ['dips_max', 1, 14, 300],
      ['pushup_max', 1, 8, 0],
    ]);
  });

  it('bloc Force : lest imposé', () => {
    const f = { ...state, phase: 3 as const, blockId: 'force' };
    expect(buildPlan(input({ state: f })).plan[0]).toMatchObject({ variantId: 'weighted', loadInput: 'weighted', loadKg: 2.5 });
  });
});

describe('sequence', () => {
  const plan = buildPlan(input()).plan;
  const steps = buildSequence(plan);

  it('enchaîne les supersets série par série', () => {
    const order = steps.map((s) => `${plan[s.exerciseIndex]!.exerciseId}#${s.setIndex}`);
    expect(order.slice(7, 13)).toEqual([
      'curl#0',
      'rear_delt_fly#0',
      'curl#1',
      'rear_delt_fly#1',
      'curl#2',
      'rear_delt_fly#2',
    ]);
    expect(steps[7]!.restAfterSec).toBe(0);
    expect(steps[8]!.restAfterSec).toBe(60);
  });

  it('pas de repos après la dernière série', () => {
    expect(steps[steps.length - 1]!.restAfterSec).toBe(0);
    expect(steps.length).toBe(4 + 3 + 3 + 3 + 2 + 2 + 2);
  });

  it('reprend à la première étape non faite, en sautant les exercices passés', () => {
    const done = new Set([stepKey(0, 0), stepKey(0, 1)]);
    expect(nextStep(steps, done, new Set())).toMatchObject({ exerciseIndex: 0, setIndex: 2 });
    expect(nextStep(steps, done, new Set([0]))).toMatchObject({ exerciseIndex: 1, setIndex: 0 });
  });
});
