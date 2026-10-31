/**
 * Construction de la séance du jour (ARCHITECTURE.md §6).
 *
 * Ordre d'application :
 *   phase/bloc → choix des exercices (options jambes §5.5, alternatives, mode cheville §3)
 *   → variante et charge personnelles → cibles (R1) → deload (§8) OU séance allégée (R6, R8).
 *
 * Fonction pure : aucune lecture de base, tout est passé en entrée.
 */
import type { Block, Programme, SessionTemplate, Slot } from '../data/programmeSchema';
import type {
  Adjustment,
  DayKey,
  LoadInput,
  PlannedExercise,
  Profile,
  ProgramState,
  Readiness,
  SetLog,
} from '../db/models';
import { diffDays } from '../lib/dates';
import { cycleInfo } from './cycle';
import { isLowReadiness } from './readiness';
import { clamp, roundToStep, targetRepsFromLast } from './targets';

export type PlannableType = 'A' | 'B' | 'F' | 'MIN';

export interface PlannerInput {
  programme: Programme;
  profile: Profile;
  state: ProgramState;
  type: PlannableType;
  today: DayKey;
  readiness?: Readiness;
  /** Jour de la dernière séance terminée (R8). */
  lastSessionDay?: DayKey;
  /** Séries de la dernière exposition de chaque exercice. */
  lastSets: Record<string, SetLog[]>;
  /** Séances MMA de la semaine en cours (prévues ou faites), pour la surcouche phase 4 (§10.2). */
  mmaThisWeek?: number;
}

export interface PlannerOutput {
  name: string;
  focus: string;
  estimatedMin: number;
  plan: PlannedExercise[];
  adjustments: Adjustment[];
  isDeload: boolean;
  weekInCycle: number;
  /** Explications lisibles des ajustements, affichées avant de commencer. */
  notes: string[];
}

export function currentBlock(p: Programme, state: ProgramState): Block {
  const phase = p.phases[state.phase - 1];
  if (!phase) throw new Error(`Phase ${state.phase} absente du programme`);
  return phase.blocks.find((b) => b.id === state.blockId) ?? phase.blocks[0]!;
}

export function sessionTemplate(p: Programme, state: ProgramState, type: PlannableType): SessionTemplate {
  if (type === 'A' || type === 'B') return currentBlock(p, state).sessions[type];
  return p.commonSessions[type];
}

/** Condition du module jambes (§5.5). */
function pickCondition(profile: Profile, today: DayKey): 'ankle' | 'healed_lt4w' | 'default' {
  if (profile.ankleMode) return 'ankle';
  if (profile.ankleHealedOn && diffDays(today, profile.ankleHealedOn) < 28) return 'healed_lt4w';
  return 'default';
}

/** Créneau du même exercice dans les séances A/B du bloc : source des valeurs « phase » (séances F et MIN). */
function phaseSlot(block: Block, exerciseId: string): Slot | undefined {
  return [...block.sessions.A.slots, ...block.sessions.B.slots].find((s) => s.exerciseId === exerciseId);
}

function asRange(v: Slot['reps'] | Slot['rir'] | undefined, fallback: [number, number]): [number, number] {
  return Array.isArray(v) ? [v[0], v[1]] : fallback;
}

export function buildPlan(input: PlannerInput): PlannerOutput {
  const { programme: p, profile, state, type, today } = input;
  const block = currentBlock(p, state);
  const template = sessionTemplate(p, state, type);
  const { weekInCycle, isDeload, forcedDeload } = cycleInfo(state, today, p);
  const condition = pickCondition(profile, today);
  const adjustments: Adjustment[] = [];
  const notes: string[] = [];
  const plan: PlannedExercise[] = [];

  for (const slot of template.slots) {
    // 1. Quel exercice ?
    let exerciseId: string;
    let reps: [number, number];
    if (slot.pick) {
      const option = slot.pick.find((o) => o.when === condition) ?? slot.pick.find((o) => o.when === 'default')!;
      exerciseId = option.exerciseId;
      reps = [option.reps[0], option.reps[1]];
    } else {
      const base = slot.exerciseId!;
      const chosen = state.exercises[base]?.chosenAlternative;
      exerciseId = chosen && slot.alternatives.includes(chosen) ? chosen : base;
      reps = slot.reps === 'phase' ? asRange(phaseSlot(block, base)?.reps, [5, 8]) : asRange(slot.reps, [5, 8]);
    }

    const ex = p.exercises[exerciseId];
    if (!ex) continue;

    // §3 — mode cheville : les exercices à impact fort sont exclus.
    if (profile.ankleMode && ex.ankle === 'forte') {
      notes.push(`${ex.name} retiré (mode cheville).`);
      continue;
    }

    const rir = slot.rir === 'phase' ? asRange(phaseSlot(block, exerciseId)?.rir, [2, 2]) : asRange(slot.rir, [2, 2]);

    // 2. Variante et charge personnelles.
    const progress = state.exercises[exerciseId];
    let variantId = progress?.variantId ?? ex.defaultVariant;
    let loadKg = progress?.loadKg ?? ex.startLoadKg ?? 0;
    if (slot.variantHint && variantId !== slot.variantHint) {
      // Bloc Force : lest imposé. Premier passage au lest → grand palier de départ.
      variantId = slot.variantHint;
      loadKg = p.equipment.weight.largeStepKg;
    }
    const variant = ex.variants.find((v) => v.id === variantId) ?? ex.variants.find((v) => v.id === ex.defaultVariant)!;

    const loadInput: LoadInput = variant.weighted ? 'weighted' : ex.loadType === 'dumbbell' ? 'dumbbell' : 'none';
    if (loadInput === 'none') loadKg = 0;
    if (loadInput === 'dumbbell') {
      loadKg = clamp(loadKg || (ex.startLoadKg ?? profile.dumbbell.minKg), profile.dumbbell.minKg, profile.dumbbell.maxKg);
    }

    // 3. Cibles (R1) à partir de la dernière exposition, si elle est comparable.
    const last = input.lastSets[exerciseId] ?? [];
    const comparable = last.length > 0 && last.every((s) => s.variantId === variant.id && s.loadKg === loadKg);
    const targetReps = targetRepsFromLast(
      slot.sets,
      reps,
      comparable ? last.map((s) => s.reps) : [],
      ex.unit === 'sec' ? p.rules.R1.secIncrement : p.rules.R1.repIncrement,
    );

    const pe: PlannedExercise = {
      exerciseId,
      name: ex.name,
      variantId: variant.id,
      variantName: variant.name,
      loadInput,
      loadKg,
      sets: slot.sets,
      reps,
      targetReps,
      rir,
      lastSetRir: slot.lastSetRir,
      restSec: slot.restSec,
      group: slot.group,
      onBelowMin: slot.onBelowMin,
      main: slot.main,
      optional: slot.optional,
      ...(ex.unit === 'sec' ? { unit: 'sec' as const } : {}),
      ...(ex.perSide ? { perSide: true } : {}),
    };

    // R3 — clusters temporaires après stagnation : 2× plus de séries, moitié moins de reps, 45 s de repos.
    if (progress?.clusterUntil && diffDays(progress.clusterUntil, today) >= 0 && !isDeload && ex.unit !== 'sec') {
      pe.sets = slot.sets * 2;
      pe.reps = [Math.ceil(reps[0] / 2), Math.ceil(reps[1] / 2)];
      pe.targetReps = targetReps.flatMap((t) => [Math.ceil(t / 2), Math.ceil(t / 2)]);
      pe.restSec = 45;
      pe.lastSetRir = undefined;
      pe.cluster = true;
      if (!adjustments.includes('cluster')) adjustments.push('cluster');
      notes.push(`${ex.name} en clusters jusqu'au ${progress.clusterUntil} (R3).`);
    }
    plan.push(pe);
  }

  // 4. Deload (§8) — prioritaire : il intègre déjà une forte baisse de volume.
  if (isDeload) {
    adjustments.push('deload');
    notes.push(
      forcedDeload
        ? 'Deload anticipé (R4) : séries ÷ 2, RIR 3–4.'
        : `Semaine ${p.cycle.deloadWeek} : deload planifié, séries ÷ 2, RIR 3–4.`,
    );
    const d = p.deload;
    for (const pe of plan) {
      const reduced = Math.ceil(pe.sets * d.setsFactor);
      pe.sets = Math.min(pe.sets, pe.main ? Math.max(d.minSetsMain, reduced) : Math.max(1, reduced));
      pe.targetReps = Array.from({ length: pe.sets }, () => pe.reps[0]);
      pe.rir = [d.rir[0], d.rir[1]];
      pe.lastSetRir = undefined;
      if (pe.loadInput === 'weighted') {
        pe.loadKg = roundToStep(pe.loadKg * (1 - d.loadReducePct / 100), p.equipment.weight.smallStepKg);
      }
    }
  } else {
    // 5. Séance allégée : les raisons ne se cumulent pas, une seule réduction est appliquée.
    const R6 = p.rules.R6;
    const reasons: Adjustment[] = [];
    if (input.readiness && isLowReadiness(input.readiness, p)) {
      reasons.push('reduced_readiness');
      notes.push('Forme du jour basse (R6) : −1 série par exercice, RIR +1.');
    }
    if (input.readiness?.mmaHardWithin24h && type === 'A') {
      reasons.push('reduced_mma');
      notes.push('MMA intense dans les 24 h (R6) : tirage allégé.');
    }
    if (input.lastSessionDay && diffDays(today, input.lastSessionDay) >= p.rules.R8.reducedAfterDays) {
      reasons.push('reduced_comeback');
      notes.push(`Reprise après ${diffDays(today, input.lastSessionDay)} jours (R8) : séance allégée.`);
    }
    if (reasons.length > 0) {
      adjustments.push(...reasons);
      for (const pe of plan) {
        pe.sets = Math.max(1, pe.sets + R6.reducedSetsDelta);
        pe.targetReps = pe.targetReps.slice(0, pe.sets);
        pe.rir = [pe.rir[0] + R6.reducedRirDelta, pe.rir[1] + R6.reducedRirDelta];
        pe.lastSetRir = undefined;
      }
    }

    // 6. Phase 4 — surcouche MMA selon le nombre de séances de la semaine (§10.2).
    const mmaCount = input.mmaThisWeek ?? 0;
    const mmaRule = profile.mmaMode
      ? [...p.mma.adjustments].sort((a, b) => b.minMmaPerWeek - a.minMmaPerWeek).find((a) => mmaCount >= a.minMmaPerWeek)
      : undefined;
    if (mmaRule) {
      adjustments.push('mma_week');
      notes.push(
        `${mmaCount} séance${mmaCount > 1 ? 's' : ''} MMA cette semaine (§10.2) : ${mmaRule.setsDelta} série ${
          mmaRule.setsDeltaScope === 'first' ? 'sur le 1er exercice' : mmaRule.setsDeltaScope === 'main' ? 'par exercice principal' : 'par exercice'
        }${mmaRule.rirDelta ? `, RIR +${mmaRule.rirDelta}` : ''}${mmaRule.forbidRirZero ? ', jamais à l’échec' : ''}.`,
      );
      if (mmaRule.format === 'F' && type !== 'F' && type !== 'MIN') notes.push('Format conseillé cette semaine : 2 séances F (full body).');
      plan.forEach((pe, i) => {
        const applies =
          mmaRule.setsDeltaScope === 'all' || (mmaRule.setsDeltaScope === 'main' && pe.main) || (mmaRule.setsDeltaScope === 'first' && i === 0);
        if (applies) {
          pe.sets = Math.max(1, pe.sets + mmaRule.setsDelta);
          pe.targetReps = pe.targetReps.slice(0, pe.sets);
        }
        pe.rir = [pe.rir[0] + mmaRule.rirDelta, pe.rir[1] + mmaRule.rirDelta];
        if (mmaRule.forbidRirZero) {
          pe.rir = [Math.max(1, pe.rir[0]), Math.max(1, pe.rir[1])];
          if (pe.lastSetRir === 0) pe.lastSetRir = undefined;
        }
      });
    }
  }

  if (profile.ankleMode) adjustments.push('ankle_mode');
  if (isDeload && type !== 'MIN') {
    notes.push('Semaine de tests : remplace une séance A et une séance B par les tests de max (§11).');
  }

  return {
    name: template.name,
    focus: template.focus,
    estimatedMin: template.estimatedMin,
    plan,
    adjustments,
    isDeload,
    weekInCycle,
    notes,
  };
}

/**
 * Séance de tests de max (§11) : une série unique au maximum par test, standard strict.
 * `which` = 'A' (tractions) ou 'B' (dips puis pompes, 5 min entre les deux).
 */
export function buildTestPlan(args: {
  programme: Programme;
  state: ProgramState;
  which: 'A' | 'B';
  today: DayKey;
  lastTests: Record<string, number>;
}): PlannerOutput {
  const { programme: p, state, which, today } = args;
  const tests = p.tests.filter((t) => !t.optional && t.session === which && t.fromPhase <= state.phase);
  const plan: PlannedExercise[] = tests.map((t, i) => {
    const ex = p.exercises[t.exerciseId]!;
    const variant = ex.variants.find((v) => v.id === t.variant)!;
    const previous = args.lastTests[t.id];
    return {
      exerciseId: t.exerciseId,
      name: t.name,
      variantId: variant.id,
      variantName: `${variant.name} · standard strict`,
      loadInput: 'none',
      loadKg: 0,
      sets: 1,
      reps: [1, 100],
      targetReps: [previous ?? 8],
      rir: [0, 0],
      restSec: tests[i + 1]?.restBeforeSec ?? 0,
      onBelowMin: 'none',
      main: true,
      optional: false,
      testId: t.id,
    };
  });
  const { weekInCycle, isDeload } = cycleInfo(state, today, p);
  return {
    name: `Tests de max — ${which === 'A' ? 'Tirage' : 'Poussée'}`,
    focus: tests.map((t) => t.name).join(' · '),
    estimatedMin: which === 'A' ? 8 : 14,
    plan,
    adjustments: [],
    isDeload,
    weekInCycle,
    notes: ['Échauffement complet, puis une seule série au maximum de répétitions strictes (§2).'],
  };
}
