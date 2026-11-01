/**
 * Enregistrements stockés dans IndexedDB.
 *
 * Conventions :
 * - Instant : millisecondes depuis l'époque (Date.now()).
 * - Jour calendaire : chaîne "YYYY-MM-DD" en heure locale (évite les décalages de fuseau).
 * - Charges en kg, toujours la charge EXTERNE (lest ou haltère). Le poids du corps est stocké à part.
 * - Identifiants : UUID, pour que l'import/fusion d'une sauvegarde ne crée jamais de collision.
 */
import type { SessionType } from '../data/programmeSchema';

export type Instant = number;
export type DayKey = string; // "YYYY-MM-DD"
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Feeling = 'facile' | 'correct' | 'dur' | 'limite';

// ---------------------------------------------------------------------------
// Profil et état du programme (une seule ligne chacun)
// ---------------------------------------------------------------------------

export interface Profile {
  id: 'me';
  firstName: string;
  birthYear: number;
  heightCm: number;
  /** Poids de départ : sert de poids du corps tant qu'aucune pesée n'est saisie. */
  startWeightKg: number;
  goalWeightKg: number;
  sessionsPerWeek: 2 | 3 | 4;
  /** Jours de séance préférés (ISO). */
  trainingDays: IsoWeekday[];
  ankleMode: boolean;
  /** Date de désactivation du mode cheville : pilote le module jambes progressif (§5.5). */
  ankleHealedOn?: DayKey;
  mmaMode: boolean;
  dumbbell: { minKg: number; maxKg: number; stepKg: number };
  soundOn: boolean;
  /** Réglages nutrition (base v2). Absent sur une base v1 : la migration le complète. */
  nutrition?: NutritionSettings;
  /** Réglages hydratation (base v3). Absent sur une base v1/v2 : la migration le complète. */
  hydration?: HydrationSettings;
  /** Réglages mobilité (base v4). Absent sur une base v1–v3 : la migration le complète. */
  mobility?: MobilitySettings;
  createdAt: Instant;
  updatedAt: Instant;
}

// ---------------------------------------------------------------------------
// Nutrition (base v2)
// ---------------------------------------------------------------------------

export type MealId = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation';

export interface Nutrients {
  kcal: number;
  prot: number;
  gluc: number;
  lip: number;
}

export interface NutritionSettings {
  /** Requis par la formule de Mifflin-St Jeor ; null tant que non renseigné (jamais supposé). */
  sex: 'homme' | 'femme' | null;
  activity: string;
  deficitKcal: number;
  proteinGPerKgGoal: number;
  fatGPerKgMin: number;
  /** Objectif majoré les jours de séance / MMA. */
  sportBonus: boolean;
  /** Objectifs fixés à la main : chaque valeur renseignée remplace le calcul. */
  manual: Partial<Nutrients> | null;
}

/** Origine d'une saisie : aliment de la base, aliment perso, saisie libre, ou repas type. */
export type FoodSource =
  | { type: 'base'; id: string }
  | { type: 'perso'; id: string }
  | { type: 'libre' }
  | { type: 'repas'; id: string };

/** Saisie alimentaire. Les valeurs nutritionnelles sont figées à la saisie : l'historique ne bouge pas. */
export interface FoodEntry extends Nutrients {
  id: string;
  day: DayKey;
  meal: MealId;
  source: FoodSource;
  nom: string;
  grams?: number;
  portion?: { label: string; grams: number; count: number };
  createdAt: Instant;
}

export interface CustomFood {
  id: string;
  nom: string;
  categorie: string;
  pour100g: Nutrients;
  portions: { label: string; grams: number }[];
  archived?: boolean;
  createdAt: Instant;
}

export interface MealTemplateItem extends Nutrients {
  source: FoodSource;
  nom: string;
  grams?: number;
  portion?: { label: string; grams: number; count: number };
}

export interface MealTemplate {
  id: string;
  nom: string;
  items: MealTemplateItem[];
  createdAt: Instant;
}

// ---------------------------------------------------------------------------
// Hydratation (base v3)
// ---------------------------------------------------------------------------

export interface HydrationSettings {
  baseMl: number;
  strengthBonusMl: number;
  mmaTechniqueBonusMl: number;
  mmaIntenseBonusMl: number;
}

/** Une prise d'eau. Une ligne par prise : permet « annuler la dernière saisie » et un historique exact. */
export interface WaterEntry {
  id: string;
  day: DayKey;
  ml: number;
  createdAt: Instant;
}

// ---------------------------------------------------------------------------
// Étirements et mobilité (base v4)
// ---------------------------------------------------------------------------

export interface MobilitySettings {
  /** Méthode contracter-relâcher sur les exercices qui le permettent. */
  pnf: boolean;
  /** Niveau de maintien : chaque niveau ajoute du temps aux positions statiques. */
  holdLevel: number;
  /** Ressentis « facile » consécutifs, pour monter de niveau. */
  easyStreak: number;
}

export type MobilityFeeling = 'facile' | 'correct' | 'difficile';

export interface MobilitySession {
  id: string;
  day: DayKey;
  routineId: string;
  startedAt: Instant;
  endedAt: Instant;
  /** Temps réellement passé (pauses exclues). */
  durationSec: number;
  plannedSec: number;
  positionsDone: number;
  positionsTotal: number;
  feeling?: MobilityFeeling;
}

export interface FlexTest {
  id: string;
  testId: string;
  day: DayKey;
  value: number;
  createdAt: Instant;
}

export interface FoodFavorite {
  /** « base:poulet_blanc » ou « perso:<uuid> ». */
  key: string;
  createdAt: Instant;
}

/** Position personnelle sur l'échelle d'un exercice. */
export interface ExerciseProgress {
  variantId: string;
  /** Charge externe courante (lest ou haltère), 0 au poids du corps. */
  loadKg: number;
  /** Alternative retenue pour un créneau (ex. 'inverted_row' à la place de 'rear_delt_fly'). */
  chosenAlternative?: string;
  /** Résultat du test d'installation (rowing inversé) : false = abandonné. */
  setupOk?: boolean;
  /** Schéma cluster temporaire après stagnation (R3), jusqu'à cette date. */
  clusterUntil?: DayKey;
  updatedAt: Instant;
}

export interface ProgramState {
  id: 'current';
  phase: 1 | 2 | 3;
  /** Identifiant du bloc dans la phase ('base', 'force', 'hypertrophie'). */
  blockId: string;
  /** N° de cycle global (incrémenté à chaque cycle de 6 semaines). */
  cycleIndex: number;
  cycleStartedOn: DayKey;
  phaseStartedOn: DayKey;
  /** Prochaine séance de l'alternance. */
  nextSessionType: 'A' | 'B';
  /** Deload anticipé déclenché (R4) : semaine en cours traitée comme semaine de deload. */
  forcedDeloadFrom?: DayKey;
  /** Gel des progressions de charge (camp MMA, §10.4). */
  loadFrozen: boolean;
  exercises: Record<string, ExerciseProgress>;
  updatedAt: Instant;
}

// ---------------------------------------------------------------------------
// Séances et séries
// ---------------------------------------------------------------------------

export interface Readiness {
  sleep: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  anklePain: number; // 0–10
  mmaHardWithin24h: boolean;
}

/** Ajustements appliqués par le planner, conservés pour expliquer la séance a posteriori. */
export type Adjustment =
  | 'deload'
  | 'reduced_readiness'
  | 'reduced_mma'
  | 'reduced_comeback'
  | 'ankle_mode'
  | 'cluster'
  | 'mma_week';

/**
 * Saisie de charge pendant la séance :
 * - none     : poids du corps, pas de charge
 * - dumbbell : haltère, bornes et palier du profil
 * - weighted : lest, paliers 1,25 / 2,5 kg
 */
export type LoadInput = 'none' | 'dumbbell' | 'weighted';

/** Exercice tel que planifié au démarrage de la séance (copie figée, noms compris). */
export interface PlannedExercise {
  exerciseId: string;
  name: string;
  variantId: string;
  variantName: string;
  loadInput: LoadInput;
  loadKg: number;
  sets: number;
  reps: [number, number];
  /** Cible de reps par série (déduite de la dernière exposition, R1). */
  targetReps: number[];
  rir: [number, number];
  lastSetRir?: number;
  restSec: number;
  group?: string;
  onBelowMin: 'negatives' | 'rest_pause' | 'none';
  main: boolean;
  /** Exercice optionnel, sautable en un tap. */
  optional: boolean;
  /** Schéma en clusters (R3) : séries et fourchette ne sont pas comparables à l'habituel. */
  cluster?: boolean;
  /** 'sec' : exercice tenu (gainage, L-sit), les « reps » sont des secondes. Absent = répétitions. */
  unit?: 'reps' | 'sec';
  /** Valeur par côté (gainage latéral). */
  perSide?: boolean;
  /** Test de max (§11) : la série unique est enregistrée comme résultat de test. */
  testId?: string;
}

export interface ExerciseResult {
  exerciseId: string;
  feeling?: Feeling;
  /** Douleur articulaire signalée (0–10), distincte des courbatures. */
  jointPain?: number;
  skipped?: boolean;
  replacedBy?: string;
}

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface Session {
  id: string;
  type: SessionType;
  status: SessionStatus;
  day: DayKey;
  startedAt: Instant;
  endedAt?: Instant;
  phase: 1 | 2 | 3;
  blockId: string;
  cycleIndex: number;
  weekInCycle: number;
  isDeload: boolean;
  readiness?: Readiness;
  adjustments: Adjustment[];
  plan: PlannedExercise[];
  /**
   * Fin du repos en cours (horodatage) : le minuteur se recalcule à partir de là, écran verrouillé ou non.
   * La position dans la séance n'est pas stockée : elle se déduit des séries enregistrées (engine/sequence.ts),
   * ce qui rend la reprise exacte par construction.
   */
  restEndsAt?: Instant;
  /** Durée totale du repos en cours, pour l'anneau de progression. */
  restTotalSec?: number;
  bodyweightKg?: number;
  /** Aligné sur `plan` : results[i] concerne plan[i]. */
  results: ExerciseResult[];
  notes?: string;
}

export interface SetLog {
  id: string;
  sessionId: string;
  /** Position de l'exercice dans le plan de la séance. */
  exerciseIndex: number;
  exerciseId: string;
  variantId: string;
  setIndex: number;
  plannedReps: number;
  reps: number;
  /** Répétitions complétées en négatives (tractions, R2). */
  negatives: number;
  /** Mini-séries rest-pause ajoutées pour atteindre le minimum (R2). */
  restPauseReps: number;
  loadKg: number;
  completedAt: Instant;
}

// ---------------------------------------------------------------------------
// Tests, corps, MMA, calendrier
// ---------------------------------------------------------------------------

export interface MaxTest {
  id: string;
  testId: string; // 'pullup_max' | 'dips_max' | 'pushup_max' | 'pullup_3rm'
  day: DayKey;
  value: number; // reps, ou kg pour un 3RM
  loadKg: number;
  bodyweightKg?: number;
  sessionId?: string;
  createdAt: Instant;
}

export interface BodyMetric {
  id: string;
  day: DayKey;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  hipsCm?: number;
  note?: string;
  createdAt: Instant;
}

export interface Photo {
  id: string;
  day: DayKey;
  angle: 'face' | 'profil' | 'dos';
  blob: Blob;
  createdAt: Instant;
}

export interface MmaSession {
  id: string;
  day: DayKey;
  /** Heure approximative, pour la règle d'écart de 6 h le même jour (§10.3). */
  time?: string; // "HH:MM"
  kind: 'technique' | 'intense';
  durationMin: number;
  /** Séance planifiée (calendrier) ou réalisée. */
  done: boolean;
  note?: string;
  createdAt: Instant;
}

export interface ScheduleOverride {
  id: string;
  day: DayKey;
  action: 'move' | 'skip' | 'add';
  sessionType?: SessionType;
  /** Pour un décalage : jour d'origine. */
  fromDay?: DayKey;
  createdAt: Instant;
}

// ---------------------------------------------------------------------------
// Coaching et rappels
// ---------------------------------------------------------------------------

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';

export interface Recommendation {
  id: string;
  rule: RuleId;
  exerciseId?: string;
  title: string;
  /** Explication lisible : les chiffres qui déclenchent la règle et l'effet attendu. */
  explanation: string;
  /** Changement proposé, appliqué à programState si accepté. */
  change?:
    | { kind: 'variant'; exerciseId: string; variantId: string; loadKg: number }
    | { kind: 'load'; exerciseId: string; loadKg: number }
    | { kind: 'cluster'; exerciseId: string; until: DayKey }
    | { kind: 'alternative'; exerciseId: string; alternativeId: string }
    | { kind: 'deload'; from: DayKey }
    | { kind: 'phase'; phase: 1 | 2 | 3; blockId: string }
    /** Reprise après une longue pause (§9.4) : phase cible et, si demandé, un échelon en arrière partout. */
    | { kind: 'comeback'; phase: 1 | 2 | 3; blockId: string; stepBack: boolean };
  status: 'pending' | 'accepted' | 'dismissed' | 'expired';
  createdAt: Instant;
  resolvedAt?: Instant;
  sessionId?: string;
}

export interface Reminder {
  id: string;
  kind: string;
  label: string;
  enabled: boolean;
  time: string; // "HH:MM"
  days: 'training' | IsoWeekday[];
  everyDays?: number;
  onlyIfNotDone: boolean;
  /** Message personnalisé ; variables : {seance} {duree} {exercice1} {phase} {semaine} {poids_objectif} {prenom}. */
  message: string;
  updatedAt: Instant;
}

export interface Meta {
  key: 'schema' | 'lastBackupAt' | 'programmeVersion' | 'installedAt';
  value: string | number;
}
