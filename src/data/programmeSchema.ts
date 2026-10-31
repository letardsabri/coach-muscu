/**
 * Schéma du fichier programme.json.
 *
 * Ce schéma est la seule définition des types du programme : les types TypeScript en sont
 * déduits (z.infer). Il est vérifié au démarrage de l'app et par un test avant chaque build,
 * pour qu'une erreur de saisie dans programme.json soit signalée clairement.
 *
 * Les numéros de section (§) renvoient à PROGRAMME.md.
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9_]+$/, 'identifiant en minuscules, chiffres et _ uniquement');

/** Fourchette [min, max] avec min ≤ max. */
const range = z
  .tuple([z.number().nonnegative(), z.number().nonnegative()])
  .refine(([a, b]) => a <= b, 'fourchette inversée (min > max)');

// ---------------------------------------------------------------------------
// Exercices et variantes (§2, §6)
// ---------------------------------------------------------------------------

/** Impact sur la cheville (§3) : « forte » est exclu en mode cheville. */
export const ankleImpact = z.enum(['aucune', 'faible', 'forte']);

/**
 * Type de charge, qui détermine le calcul de l'indice de performance (R5) :
 * - bodyweight : charge système = poids de corps × bodyweightFactor × coef variante + lest
 * - dumbbell   : charge = haltère × coef variante
 * - reps       : répétitions × coef variante (gainage, ponts sans charge)
 */
export const loadType = z.enum(['bodyweight', 'dumbbell', 'reps']);

export const variantSchema = z.object({
  id,
  name: z.string(),
  /** Coefficient de difficulté relatif à la variante de référence (1,0). */
  coef: z.number().positive(),
  /** Variante lestée : une charge externe est saisie. */
  weighted: z.boolean().default(false),
  cue: z.string().optional(),
  /** Variante réservée à un usage particulier, jamais atteinte par la progression normale. */
  offLadder: z.boolean().default(false),
  /** Phase minimale pour que R1 propose cette variante (ex. lest en phase 3, §5). */
  minPhase: z.number().int().min(1).max(3).optional(),
});

export const exerciseSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  muscles: z.array(z.string()).min(1),
  kind: z.enum(['compound', 'isolation', 'core', 'legs']),
  loadType,
  /** Fraction du poids de corps déplacée (tractions ≈ 1, pompes ≈ 0,64). */
  bodyweightFactor: z.number().positive().default(1),
  /** Unité des « répétitions » : 'sec' pour les exercices tenus (gainage, L-sit). */
  unit: z.enum(['reps', 'sec']).default('reps'),
  /** La valeur s'entend par côté (gainage latéral). */
  perSide: z.boolean().default(false),
  ankle: ankleImpact,
  ankleNote: z.string().optional(),
  cues: z.array(z.string()).default([]),
  /** Échelle de progression, du plus facile au plus dur. */
  variants: z.array(variantSchema).min(1),
  defaultVariant: id,
  /** Charge proposée à la toute première séance (haltères). */
  startLoadKg: z.number().nonnegative().optional(),
  /** Exercice soumis à un test d'installation avant d'être retenu (ex. rowing inversé). */
  requiresSetupTest: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Séances (§5, §9)
// ---------------------------------------------------------------------------

/** Condition de choix pour un créneau à options (module jambes §5.5). */
export const pickCondition = z.enum(['ankle', 'healed_lt4w', 'default']);

const repsOrPhase = z.union([range, z.literal('phase')]);

export const slotSchema = z.object({
  /** Exercice du créneau, ou options conditionnelles via `pick`. */
  exerciseId: id.optional(),
  pick: z
    .array(z.object({ when: pickCondition, exerciseId: id, reps: range }))
    .optional(),
  /** Exercices interchangeables proposés à l'utilisateur (ex. oiseau ↔ rowing inversé). */
  alternatives: z.array(id).default([]),
  sets: z.number().int().positive(),
  /** 'phase' : reprendre la fourchette du même exercice dans la séance A/B de la phase courante. */
  reps: repsOrPhase.optional(),
  rir: z.union([range, z.literal('phase')]),
  /** RIR cible de la dernière série si différent (isolation, §5 phase 2). */
  lastSetRir: z.number().int().min(0).optional(),
  restSec: z.number().int().nonnegative(),
  /** Créneaux partageant un même groupe s'enchaînent (superset) ; le repos s'applique après le dernier. */
  group: z.string().optional(),
  /** Variante imposée par le bloc (ex. lest en bloc Force). */
  variantHint: id.optional(),
  /** Que proposer si une série tombe sous le minimum (R2). */
  onBelowMin: z.enum(['negatives', 'rest_pause', 'none']).default('none'),
  /** Exercice « principal » : compte pour le minimum de séries en deload et pour R4. */
  main: z.boolean().default(false),
  /** Absent du mode cheville sauf option `pick` compatible. */
  optional: z.boolean().default(false),
}).refine((s) => Boolean(s.exerciseId) !== Boolean(s.pick), 'un créneau a soit exerciseId soit pick')
  .refine((s) => s.pick !== undefined || s.reps !== undefined, 'reps obligatoire sans pick');

export const sessionTemplateSchema = z.object({
  name: z.string(),
  focus: z.string(),
  estimatedMin: z.number().int().positive(),
  slots: z.array(slotSchema).min(1),
});

export const sessionType = z.enum(['A', 'B', 'F', 'MIN', 'TEST']);

export const blockSchema = z.object({
  id,
  name: z.string(),
  goal: z.string(),
  sessions: z.object({ A: sessionTemplateSchema, B: sessionTemplateSchema }),
});

export const phaseSchema = z.object({
  number: z.number().int().min(1).max(3),
  name: z.string(),
  goal: z.string(),
  sessionsPerWeek: z.array(z.number().int().min(2).max(4)),
  /** Phase 3 : blocs alternés F → H → F… Phases 1–2 : un seul bloc. */
  blocks: z.array(blockSchema).min(1),
});

// ---------------------------------------------------------------------------
// Critères de passage de phase (§5, R7)
// ---------------------------------------------------------------------------

type Criterion =
  | { type: 'minWeeks'; value: number }
  | { type: 'adherence'; pct: number; weeks: number }
  | { type: 'test'; test: string; min: number }
  | { type: 'sessionTopReached'; exerciseId: string; sets: number; reps: number }
  | { type: 'noJointPain'; maxPain: number; weeks: number }
  | { type: 'atLeast'; count: number; items: Criterion[] }
  | { type: 'anyOf'; items: Criterion[] };

export const criterionSchema: z.ZodType<Criterion> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('minWeeks'), value: z.number().int().positive() }),
    z.object({ type: z.literal('adherence'), pct: z.number().min(0).max(100), weeks: z.number().int().positive() }),
    z.object({ type: z.literal('test'), test: id, min: z.number().positive() }),
    z.object({
      type: z.literal('sessionTopReached'),
      exerciseId: id,
      sets: z.number().int().positive(),
      reps: z.number().int().positive(),
    }),
    z.object({ type: z.literal('noJointPain'), maxPain: z.number().min(0).max(10), weeks: z.number().int().positive() }),
    z.object({ type: z.literal('atLeast'), count: z.number().int().positive(), items: z.array(criterionSchema) }),
    z.object({ type: z.literal('anyOf'), items: z.array(criterionSchema) }),
  ]),
);

export const phaseTransitionSchema = z.object({
  from: z.number().int(),
  to: z.number().int(),
  criteria: z.array(criterionSchema),
  /** Passage malgré des critères non remplis si les performances progressent (§5 phase 1). */
  fallback: z.object({ afterWeeks: z.number().int().positive(), requireProgress: z.boolean() }).optional(),
});

// ---------------------------------------------------------------------------
// Programme complet
// ---------------------------------------------------------------------------

export const programmeSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string(),

  equipment: z.object({
    dumbbell: z.object({ minKg: z.number(), maxKg: z.number(), stepKg: z.number().positive() }),
    /** Paliers de lest (R1) : petit palier sous le seuil, grand palier au-delà. */
    weight: z.object({ smallStepKg: z.number(), largeStepKg: z.number(), thresholdKg: z.number(), maxKg: z.number() }),
  }),

  /** Correspondance bouton de ressenti → RIR (§1.3). */
  feelings: z.object({
    facile: z.number().int(),
    correct: z.number().int(),
    dur: z.number().int(),
    limite: z.number().int(),
  }),

  exercises: z.record(id, exerciseSchema),
  phases: z.array(phaseSchema).length(3),
  commonSessions: z.object({ F: sessionTemplateSchema, MIN: sessionTemplateSchema }),
  phaseTransitions: z.array(phaseTransitionSchema),

  cycle: z.object({ weeks: z.number().int().positive(), deloadWeek: z.number().int().positive() }),

  deload: z.object({
    setsFactor: z.number().positive().max(1),
    minSetsMain: z.number().int().positive(),
    repsAt: z.literal('min'),
    loadReducePct: z.number().min(0).max(50),
    rir: range,
  }),

  /** Seuils des règles R1–R8 (§7). */
  rules: z.object({
    R1: z.object({
      progressFeelings: z.array(z.enum(['facile', 'correct', 'dur', 'limite'])),
      /** Incrément proposé sur la première série encore sous max. */
      repIncrement: z.number().int().positive(),
      /** Même chose pour les exercices tenus, en secondes. */
      secIncrement: z.number().int().positive(),
    }),
    R2: z.object({ consecutiveBelowMin: z.number().int().positive(), loadReducePct: z.number() }),
    R3: z.object({ exposures: z.number().int().positive(), clusterWeeks: z.number().int().positive(), multipleStallTriggersDeload: z.number().int().positive() }),
    R4: z.object({
      perfDropPct: z.number().positive(),
      comparedToLastExposures: z.number().int().positive(),
      consecutiveDrops: z.number().int().positive(),
      lowReadinessSessions: z.number().int().positive(),
      jointPainThreshold: z.number().min(0).max(10),
      jointPainSessions: z.number().int().positive(),
    }),
    R5: z.object({ epleyDivisor: z.number().positive() }),
    R6: z.object({
      lowScoreMax: z.number(),
      reducedSetsDelta: z.number().int(),
      reducedRirDelta: z.number().int(),
      jointPainStop: z.number().min(0).max(10),
      ankleReactivatePain: z.number().min(0).max(10),
      mmaHardWithinHours: z.number().positive(),
    }),
    R8: z.object({
      reducedAfterDays: z.number().int().positive(),
      longBreaks: z.array(z.object({ minDays: z.number().int().positive(), action: z.enum(['reduced_week', 'step_back_phase2', 'restart_phase1']) })),
      resumeWithinHours: z.number().positive(),
    }),
  }),

  mma: z.object({
    loadUnits: z.object({
      mma_technique: z.number(),
      mma_intense: z.number(),
      strength: z.number(),
      strength_weighted: z.number(),
      minimal: z.number(),
    }),
    budget: z.object({ startUnits: z.number(), adaptedUnits: z.number(), adaptationWeeks: z.number().int() }),
    adjustments: z.array(
      z.object({
        minMmaPerWeek: z.number().int().positive(),
        strengthSessions: z.number().int().positive(),
        format: z.enum(['AB', 'F']),
        /** Séries retirées : 'first' = sur l'exercice 1 de chaque séance, 'main' = sur chaque exercice principal. */
        setsDelta: z.number().int(),
        setsDeltaScope: z.enum(['first', 'main', 'all']),
        rirDelta: z.number().int(),
        forbidRirZero: z.boolean(),
      }),
    ),
    placement: z.object({
      noPullBeforeHardMma: z.boolean(),
      noStrengthOnHardMmaDay: z.boolean(),
      minFullRestDays: z.number().int(),
      sameDayMinGapHours: z.number(),
    }),
    activation: z.object({ minPerWeek: z.number().int(), exitAfterWeeksWithout: z.number().int() }),
  }),

  tests: z.array(
    z.object({
      id,
      name: z.string(),
      exerciseId: id,
      variant: id,
      session: z.enum(['A', 'B']),
      unit: z.enum(['reps', 'kg']),
      fromPhase: z.number().int().min(1),
      optional: z.boolean().default(false),
      restBeforeSec: z.number().int().default(0),
    }),
  ),

  body: z.object({
    targetWeightKg: z.number().positive(),
    waistToHeightMax: z.number().positive(),
    lossRatePctPerWeek: range,
    fastLossAlertPctPerWeek: z.number().positive(),
    maintenanceBreakAtKg: z.number().positive(),
    checkpointKg: z.number().positive(),
    proteinGPerKg: range,
    measureEveryDays: z.number().int().positive(),
    photoEveryDays: z.number().int().positive(),
  }),

  schedule: z.object({
    defaultSessionsPerWeek: z.number().int().min(2).max(4),
    /** Jours ISO (1 = lundi … 7 = dimanche) par nombre de séances. */
    defaultDays: z.record(z.string(), z.array(z.number().int().min(1).max(7))),
    minHoursBetweenSameType: z.number().positive(),
    maxConsecutiveDays: z.number().int().positive(),
  }),

  reminders: z.array(
    z.object({
      kind: id,
      label: z.string(),
      enabled: z.boolean(),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      /** 'training' = jours de séance prévus ; sinon jours ISO explicites. */
      days: z.union([z.literal('training'), z.array(z.number().int().min(1).max(7))]),
      everyDays: z.number().int().positive().optional(),
      onlyIfNotDone: z.boolean().default(false),
      message: z.string(),
    }),
  ),
});

export type Programme = z.infer<typeof programmeSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type Slot = z.infer<typeof slotSchema>;
export type SessionTemplate = z.infer<typeof sessionTemplateSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Block = z.infer<typeof blockSchema>;
export type SessionType = z.infer<typeof sessionType>;
export type AnkleImpact = z.infer<typeof ankleImpact>;
export type { Criterion };
