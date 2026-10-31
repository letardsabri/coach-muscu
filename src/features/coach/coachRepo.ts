/**
 * Recommandations : génération (moteur engine/progression.ts), stockage, application.
 * Une recommandation n'agit sur le programme que lorsqu'on l'applique.
 */
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { ExerciseProgress, ProgramState, Recommendation } from '../../db/models';
import { cycleInfo } from '../../engine/cycle';
import {
  buildExposures,
  evaluateAfterSession,
  MAIN_LIFTS,
  recKey,

  ruleR7,
  ruleR8Comeback,
  stepDown,
  type RecommendationDraft,
} from '../../engine/progression';
import { dayKey } from '../../lib/dates';
import { uuid } from '../../lib/id';
import { latestBodyweight } from '../workout/workoutRepo';

/** Enregistre les nouvelles recommandations ; une ancienne en attente de même clé expire. */
async function saveDrafts(drafts: RecommendationDraft[], sessionId?: string): Promise<void> {
  if (drafts.length === 0) return;
  const now = Date.now();
  await db.transaction('rw', db.recommendations, async () => {
    const keys = new Set(drafts.map(recKey));
    const pending = await db.recommendations.where('status').equals('pending').toArray();
    for (const r of pending) {
      if (keys.has(recKey(r))) await db.recommendations.update(r.id, { status: 'expired', resolvedAt: now });
    }
    await db.recommendations.bulkAdd(
      drafts.map((d) => ({ ...d, id: uuid(), status: 'pending' as const, createdAt: now, sessionId })),
    );
  });
}

async function loadAll() {
  const [profile, state, sessions, sets, tests, bodyweight] = await Promise.all([
    db.profile.get('me'),
    db.programState.get('current'),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.maxTests.toArray(),
    latestBodyweight(),
  ]);
  if (!profile || !state) throw new Error('Profil ou état du programme introuvable');
  return { profile, state, sessions, sets, tests, bodyweight };
}

/** Après chaque séance terminée : R1–R4, et R7 après une séance de tests. */
export async function evaluateSession(sessionId: string): Promise<void> {
  const { profile, state, sessions, sets, tests, bodyweight } = await loadAll();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  const today = dayKey();
  const drafts = evaluateAfterSession({
    p: programme,
    profile,
    state,
    today,
    weekInCycle: cycleInfo(state, today, programme).weekInCycle,
    session,
    sessions,
    sets,
    tests,
    fallbackBodyweight: bodyweight,
  });
  await saveDrafts(drafts, sessionId);
}

/** R7 seul : après la saisie manuelle d'un test de max. */
export async function evaluatePhaseNow(): Promise<void> {
  const { profile, state, sessions, sets, tests, bodyweight } = await loadAll();
  const exposuresByExercise = Object.fromEntries(
    MAIN_LIFTS.map((id) => [id, buildExposures(programme, sessions, sets, id, bodyweight)]),
  );
  const r7 = ruleR7({ p: programme, profile, state, today: dayKey(), sessions, tests, exposuresByExercise });
  if (r7) await saveDrafts([r7]);
}

/** À l'ouverture de l'app : R8 (longue pause). Proposée une seule fois par pause. */
export async function evaluateStartup(): Promise<void> {
  const [state, sessions, existing] = await Promise.all([
    db.programState.get('current'),
    db.sessions.toArray(),
    db.recommendations.where('createdAt').above(0).filter((r) => r.rule === 'R8').toArray(),
  ]);
  if (!state) return;
  const completed = sessions.filter((s) => s.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  const last = completed[completed.length - 1];
  if (!last) return;
  if (existing.some((r) => r.createdAt > (last.endedAt ?? last.startedAt))) return;
  const r8 = ruleR8Comeback(programme, state, last.day, dayKey());
  if (r8) await saveDrafts([r8]);
}

export async function dismissRecommendation(id: string): Promise<void> {
  await db.recommendations.update(id, { status: 'dismissed', resolvedAt: Date.now() });
}

/** Applique le changement proposé au programme personnel (programState). */
export async function applyRecommendation(rec: Recommendation): Promise<void> {
  const now = Date.now();
  const today = dayKey();
  await db.transaction('rw', db.programState, db.recommendations, db.profile, async () => {
    const state = await db.programState.get('current');
    const profile = await db.profile.get('me');
    if (!state || !profile) return;
    const change = rec.change;
    let next: ProgramState = { ...state, exercises: { ...state.exercises }, updatedAt: now };

    const current = (id: string): ExerciseProgress =>
      next.exercises[id] ?? {
        variantId: programme.exercises[id]?.defaultVariant ?? '',
        loadKg: programme.exercises[id]?.startLoadKg ?? 0,
        updatedAt: now,
      };

    switch (change?.kind) {
      case 'variant':
      case 'load':
        next.exercises[change.exerciseId] = {
          ...current(change.exerciseId),
          ...(change.kind === 'variant' ? { variantId: change.variantId } : {}),
          loadKg: change.loadKg,
          clusterUntil: undefined,
          updatedAt: now,
        };
        break;
      case 'cluster':
        next.exercises[change.exerciseId] = { ...current(change.exerciseId), clusterUntil: change.until, updatedAt: now };
        break;
      case 'alternative':
        next.exercises[change.exerciseId] = { ...current(change.exerciseId), chosenAlternative: change.alternativeId, updatedAt: now };
        break;
      case 'deload':
        next.forcedDeloadFrom = change.from;
        break;
      case 'phase':
      case 'comeback':
        next = {
          ...next,
          phase: change.phase,
          blockId: change.blockId,
          phaseStartedOn: today,
          cycleStartedOn: today,
          cycleIndex: next.cycleIndex + 1,
          forcedDeloadFrom: undefined,
        };
        if (change.kind === 'comeback' && change.stepBack) {
          for (const [id, ex] of Object.entries(next.exercises)) {
            const move = stepDown(programme, profile, id, ex.variantId, ex.loadKg);
            if (!('blocked' in move)) next.exercises[id] = { ...ex, variantId: move.variantId, loadKg: move.loadKg, clusterUntil: undefined, updatedAt: now };
          }
        }
        break;
      default:
        break;
    }

    await db.programState.put(next);
    await db.recommendations.update(rec.id, { status: 'accepted', resolvedAt: now });
  });
}
