/**
 * Accès base du mode entraînement. Chaque action est écrite immédiatement :
 * fermer l'app ou verrouiller l'écran ne fait rien perdre.
 */
import Dexie from 'dexie';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { DayKey, ExerciseResult, Feeling, MaxTest, Readiness, Session, SetLog } from '../../db/models';
import type { PlannerOutput, PlannableType } from '../../engine/planner';
import type { Step } from '../../engine/sequence';
import { dayKey } from '../../lib/dates';
import { uuid } from '../../lib/id';
import { evaluateSession } from '../coach/coachRepo';

export function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('in_progress').last();
}

/** Séries de la dernière exposition d'un exercice (hors séance `excludeSessionId`). */
export async function lastExposure(exerciseId: string, excludeSessionId?: string): Promise<SetLog[]> {
  const recent = await db.sets
    .where('[exerciseId+completedAt]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .reverse()
    .limit(30)
    .toArray();
  const latest = recent.find((s) => s.sessionId !== excludeSessionId);
  if (!latest) return [];
  return recent.filter((s) => s.sessionId === latest.sessionId).sort((a, b) => a.setIndex - b.setIndex);
}

export async function lastExposures(exerciseIds: string[], excludeSessionId?: string) {
  const entries = await Promise.all(exerciseIds.map(async (id) => [id, await lastExposure(id, excludeSessionId)] as const));
  return Object.fromEntries(entries) as Record<string, SetLog[]>;
}

export async function lastCompletedSession(): Promise<Session | undefined> {
  return db.sessions
    .orderBy('startedAt')
    .reverse()
    .filter((s) => s.status === 'completed')
    .first();
}

/** Dernier poids connu : dernière pesée, sinon poids de départ du profil. */
export async function latestBodyweight(): Promise<number> {
  const last = await db.bodyMetrics.orderBy('day').reverse().filter((m) => m.weightKg !== undefined).first();
  if (last?.weightKg) return last.weightKg;
  return (await db.profile.get('me'))?.startWeightKg ?? 86;
}

export async function startSession(args: {
  type: PlannableType | 'TEST';
  planned: PlannerOutput;
  readiness: Readiness;
  bodyweightKg: number;
  bodyweightChanged: boolean;
}): Promise<string> {
  const state = await db.programState.get('current');
  if (!state) throw new Error('État du programme introuvable');
  const now = Date.now();
  const today: DayKey = dayKey();
  const session: Session = {
    id: uuid(),
    type: args.type,
    status: 'in_progress',
    day: today,
    startedAt: now,
    phase: state.phase,
    blockId: state.blockId,
    cycleIndex: state.cycleIndex,
    weekInCycle: args.planned.weekInCycle,
    isDeload: args.planned.isDeload,
    readiness: args.readiness,
    adjustments: args.planned.adjustments,
    plan: args.planned.plan,
    bodyweightKg: args.bodyweightKg,
    results: args.planned.plan.map((pe) => ({ exerciseId: pe.exerciseId })),
  };
  await db.transaction('rw', db.sessions, db.bodyMetrics, async () => {
    await db.sessions.add(session);
    if (args.bodyweightChanged) {
      await db.bodyMetrics.add({ id: uuid(), day: today, weightKg: args.bodyweightKg, createdAt: now });
    }
  });
  return session.id;
}

export interface SetValues {
  reps: number;
  loadKg: number;
  negatives: number;
  restPauseReps: number;
}

export async function logSet(session: Session, step: Step, v: SetValues, hasNext: boolean): Promise<void> {
  const pe = session.plan[step.exerciseIndex];
  if (!pe) return;
  const now = Date.now();
  const rest = hasNext ? step.restAfterSec : 0;
  await db.transaction('rw', db.sets, db.sessions, async () => {
    await db.sets.add({
      id: uuid(),
      sessionId: session.id,
      exerciseIndex: step.exerciseIndex,
      exerciseId: pe.exerciseId,
      variantId: pe.variantId,
      setIndex: step.setIndex,
      plannedReps: pe.targetReps[step.setIndex] ?? pe.reps[0],
      reps: v.reps,
      negatives: v.negatives,
      restPauseReps: v.restPauseReps,
      loadKg: v.loadKg,
      completedAt: now,
    });
    await db.sessions.update(session.id, {
      restEndsAt: rest > 0 ? now + rest * 1000 : undefined,
      restTotalSec: rest > 0 ? rest : undefined,
    });
  });
}

export async function undoLastSet(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sets, db.sessions, async () => {
    const sets = await db.sets.where('sessionId').equals(sessionId).sortBy('completedAt');
    const last = sets[sets.length - 1];
    if (last) await db.sets.delete(last.id);
    await db.sessions.update(sessionId, { restEndsAt: undefined, restTotalSec: undefined });
  });
}

export async function shiftRest(session: Session, deltaSec: number): Promise<void> {
  if (!session.restEndsAt) return;
  const now = Date.now();
  const endsAt = Math.max(now, session.restEndsAt + deltaSec * 1000);
  await db.sessions.update(session.id, {
    restEndsAt: endsAt,
    restTotalSec: Math.max(1, (session.restTotalSec ?? 0) + deltaSec),
  });
}

export async function skipRest(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { restEndsAt: undefined, restTotalSec: undefined });
}

async function patchResult(sessionId: string, index: number, patch: Partial<ExerciseResult>): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const results = s.plan.map((pe, i) => s.results[i] ?? { exerciseId: pe.exerciseId });
    results[index] = { ...results[index]!, ...patch };
    await db.sessions.update(sessionId, { results });
  });
}

export const setFeeling = (sessionId: string, index: number, feeling: Feeling) =>
  patchResult(sessionId, index, { feeling });

export const skipExercise = (sessionId: string, index: number) => patchResult(sessionId, index, { skipped: true });

/** Douleur articulaire (R6) : au-delà du seuil, l'exercice est retiré de la séance. Renvoie true si retiré. */
export async function reportJointPain(sessionId: string, index: number, pain: number): Promise<boolean> {
  const stop = pain >= programme.rules.R6.jointPainStop;
  await patchResult(sessionId, index, stop ? { jointPain: pain, skipped: true } : { jointPain: pain });
  return stop;
}

/**
 * Clôture : la séance est terminée, l'alternance A/B avance et la variante/charge réellement
 * utilisée devient le point de départ de la prochaine exposition. Les séries de test deviennent
 * des résultats de tests de max. Puis le moteur de progression évalue la séance (R1–R4, R7).
 */
export async function finishSession(sessionId: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', [db.sessions, db.sets, db.programState, db.maxTests], async () => {
    const session = await db.sessions.get(sessionId);
    const state = await db.programState.get('current');
    if (!session || !state) return;
    const sets = await db.sets.where('sessionId').equals(sessionId).sortBy('completedAt');

    const exercises = { ...state.exercises };
    const testResults: MaxTest[] = [];
    session.plan.forEach((pe, i) => {
      const done = sets.filter((s) => s.exerciseIndex === i);
      const last = done[done.length - 1];
      if (!last) return;
      if (pe.testId) {
        testResults.push({
          id: uuid(),
          testId: pe.testId,
          day: session.day,
          value: Math.max(...done.map((s) => s.reps)),
          loadKg: last.loadKg,
          bodyweightKg: session.bodyweightKg,
          sessionId,
          createdAt: now,
        });
        return; // un test ne change pas la variante d'entraînement
      }
      exercises[pe.exerciseId] = { ...exercises[pe.exerciseId], variantId: pe.variantId, loadKg: last.loadKg, updatedAt: now };
    });

    // Un test remplace une séance (§11) : celui des tractions compte comme A, celui de la poussée comme B.
    const actsAs = session.type === 'TEST' ? (session.plan.some((pe) => pe.testId === 'pullup_max') ? 'A' : 'B') : session.type;
    const next = actsAs === 'A' ? 'B' : actsAs === 'B' ? 'A' : state.nextSessionType;
    if (testResults.length > 0) await db.maxTests.bulkAdd(testResults);
    await db.sessions.update(sessionId, { status: 'completed', endedAt: now, restEndsAt: undefined, restTotalSec: undefined });
    await db.programState.put({ ...state, exercises, nextSessionType: next, updatedAt: now });
  });
  try {
    await evaluateSession(sessionId);
  } catch (e) {
    // Une erreur d'analyse ne doit jamais empêcher d'enregistrer la séance.
    console.error('Évaluation de la séance impossible', e);
  }
}

/** Abandon : les séries faites restent dans l'historique, l'alternance n'avance pas. */
export async function abandonSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { status: 'abandoned', endedAt: Date.now(), restEndsAt: undefined });
}

/**
 * Suppression définitive (séance d'essai, erreur de saisie) : la séance, ses séries, ses résultats de tests
 * et les recommandations en attente qu'elle a produites disparaissent. Si c'était la dernière séance
 * terminée, l'alternance A/B revient à ce qu'elle était avant elle.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.sets, db.maxTests, db.recommendations, db.programState], async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return;

    if (session.status === 'completed') {
      const completed = (await db.sessions.where('status').equals('completed').sortBy('startedAt')).filter((s) => s.type !== 'MIN' && s.type !== 'F');
      const isLatest = completed[completed.length - 1]?.id === sessionId;
      const actsAs = session.type === 'TEST' ? (session.plan.some((pe) => pe.testId === 'pullup_max') ? 'A' : 'B') : session.type;
      const state = await db.programState.get('current');
      if (isLatest && state && (actsAs === 'A' || actsAs === 'B')) {
        await db.programState.update('current', { nextSessionType: actsAs, updatedAt: Date.now() });
      }
    }

    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.maxTests.filter((t) => t.sessionId === sessionId).delete();
    await db.recommendations.filter((r) => r.sessionId === sessionId && r.status === 'pending').delete();
    await db.sessions.delete(sessionId);
  });
}
