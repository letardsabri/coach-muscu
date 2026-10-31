/**
 * Progression intelligente — règles R1 à R4, R7 et R8 (PROGRAMME.md §7, §9.4).
 *
 * Le moteur ne modifie jamais rien lui-même : il produit des **recommandations expliquées**
 * (règle, chiffres déclencheurs, changement proposé). L'utilisateur les applique ou les ignore.
 *
 * Toutes les fonctions sont pures ; les seuils viennent de programme.json (`rules`, `deload`,
 * `phaseTransitions`, `equipment`).
 */
import type { Criterion, Programme } from '../data/programmeSchema';
import type {
  DayKey,
  Feeling,
  MaxTest,
  Profile,
  ProgramState,
  Recommendation,
  RuleId,
  Session,
  SetLog,
} from '../db/models';
import { addDays, diffDays } from '../lib/dates';
import { exposureIndex } from './performance';
import { isLowReadiness } from './readiness';
import { roundToStep } from './targets';

export type RecommendationDraft = Pick<Recommendation, 'rule' | 'exerciseId' | 'title' | 'explanation' | 'change'>;

// ---------------------------------------------------------------------------
// Expositions : une ligne par séance terminée où l'exercice a été fait
// ---------------------------------------------------------------------------

export interface Exposure {
  sessionId: string;
  day: DayKey;
  phase: number;
  isDeload: boolean;
  isTest: boolean;
  cluster: boolean;
  lowReadiness: boolean;
  exerciseId: string;
  variantId: string;
  loadKg: number;
  plannedSets: number;
  range: [number, number];
  reps: number[];
  feeling?: Feeling;
  jointPain?: number;
  index: number;
}

export function buildExposures(
  p: Programme,
  sessions: Session[],
  sets: SetLog[],
  exerciseId: string,
  fallbackBodyweight: number,
): Exposure[] {
  const out: Exposure[] = [];
  const done = sessions.filter((s) => s.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  for (const s of done) {
    const own = sets.filter((x) => x.sessionId === s.id);
    s.plan.forEach((pe, i) => {
      if (pe.exerciseId !== exerciseId) return;
      const exSets = own.filter((x) => x.exerciseIndex === i).sort((a, b) => a.setIndex - b.setIndex);
      if (exSets.length === 0) return;
      const last = exSets[exSets.length - 1]!;
      out.push({
        sessionId: s.id,
        day: s.day,
        phase: s.phase,
        isDeload: s.isDeload,
        isTest: pe.testId !== undefined,
        cluster: pe.cluster === true,
        lowReadiness: s.readiness ? isLowReadiness(s.readiness, p) : false,
        exerciseId,
        variantId: last.variantId,
        loadKg: last.loadKg,
        plannedSets: pe.sets,
        range: pe.reps,
        reps: exSets.map((x) => x.reps),
        feeling: s.results[i]?.feeling,
        jointPain: s.results[i]?.jointPain,
        index: exposureIndex(p, s, own, i, fallbackBodyweight),
      });
    });
  }
  return out;
}

/** Expositions utilisables par R1–R3 : ni deload, ni test, ni clusters (paramètres non comparables). */
const regular = (list: Exposure[]) => list.filter((e) => !e.isDeload && !e.isTest && !e.cluster);
const sameSetup = (a: Exposure, b: Exposure) => a.variantId === b.variantId && a.loadKg === b.loadKg;

// ---------------------------------------------------------------------------
// Échelle : échelon suivant / précédent (§6)
// ---------------------------------------------------------------------------

export type LadderMove = { variantId: string; loadKg: number; label: string } | { blocked: string };

const fmt = (kg: number) => `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;

export function stepUp(p: Programme, profile: Profile, phase: number, exerciseId: string, variantId: string, loadKg: number): LadderMove {
  const ex = p.exercises[exerciseId];
  if (!ex) return { blocked: 'exercice inconnu' };
  const variant = ex.variants.find((v) => v.id === variantId);
  const w = p.equipment.weight;
  const d = profile.dumbbell;

  // Haltères : on monte la charge tant que possible, puis on passe à la variante suivante à charge max.
  if (ex.loadType === 'dumbbell' && loadKg + d.stepKg <= d.maxKg) {
    return { variantId, loadKg: loadKg + d.stepKg, label: `${fmt(loadKg)} → ${fmt(loadKg + d.stepKg)}` };
  }
  // Variante lestée : on ajoute du lest (palier selon le seuil).
  if (variant?.weighted && ex.loadType !== 'dumbbell') {
    const inc = loadKg < w.thresholdKg ? w.smallStepKg : w.largeStepKg;
    if (loadKg + inc > w.maxKg) return { blocked: `lest maximal (${fmt(w.maxKg)}) atteint` };
    return { variantId, loadKg: loadKg + inc, label: `lest ${fmt(loadKg)} → ${fmt(loadKg + inc)}` };
  }

  const ladder = ex.variants.filter((v) => !v.offLadder);
  const next = ladder[ladder.findIndex((v) => v.id === variantId) + 1];
  if (!next) return { blocked: 'dernière variante de l’échelle atteinte' };
  if (next.minPhase && phase < next.minPhase) {
    return { blocked: `prochaine étape : ${next.name.toLowerCase()}, réservée à la phase ${next.minPhase}` };
  }
  const nextLoad = next.weighted && ex.loadType !== 'dumbbell' ? w.largeStepKg : ex.loadType === 'dumbbell' ? loadKg : 0;
  return { variantId: next.id, loadKg: nextLoad, label: `${variant?.name ?? variantId} → ${next.name}` };
}

export function stepDown(p: Programme, profile: Profile, exerciseId: string, variantId: string, loadKg: number): LadderMove {
  const ex = p.exercises[exerciseId];
  if (!ex) return { blocked: 'exercice inconnu' };
  const variant = ex.variants.find((v) => v.id === variantId);
  const w = p.equipment.weight;
  const d = profile.dumbbell;

  if (ex.loadType === 'dumbbell' && loadKg - d.stepKg >= d.minKg) {
    return { variantId, loadKg: loadKg - d.stepKg, label: `${fmt(loadKg)} → ${fmt(loadKg - d.stepKg)}` };
  }
  if (variant?.weighted && ex.loadType !== 'dumbbell') {
    const reduced = roundToStep(loadKg * (1 - p.rules.R2.loadReducePct / 100), w.smallStepKg);
    const target = Math.min(reduced, loadKg - w.smallStepKg);
    if (target > 0) return { variantId, loadKg: target, label: `lest ${fmt(loadKg)} → ${fmt(target)}` };
  }

  const ladder = ex.variants.filter((v) => !v.offLadder);
  const i = ladder.findIndex((v) => v.id === variantId);
  const prev = i > 0 ? ladder[i - 1] : ex.variants.find((v) => v.offLadder);
  if (!prev || prev.id === variantId) return { blocked: 'déjà à l’échelon le plus facile' };
  const prevLoad = ex.loadType === 'dumbbell' ? loadKg : prev.weighted ? w.smallStepKg : 0;
  return { variantId: prev.id, loadKg: prevLoad, label: `${variant?.name ?? variantId} → ${prev.name}` };
}

// ---------------------------------------------------------------------------
// R1, R2, R3 — par exercice
// ---------------------------------------------------------------------------

export interface ExerciseContext {
  p: Programme;
  profile: Profile;
  state: ProgramState;
  today: DayKey;
  exposures: Exposure[];
}

/** R1 — double progression. */
export function ruleR1({ p, profile, state, exposures }: ExerciseContext): RecommendationDraft | undefined {
  const list = regular(exposures);
  const e = list[list.length - 1];
  if (!e) return;
  const ex = p.exercises[e.exerciseId]!;
  const [, max] = e.range;
  const allTop = e.reps.length >= e.plannedSets && e.reps.every((r) => r >= max);
  if (!allTop) return;

  const repsText = e.reps.join(' · ');
  const feeling = e.feeling ?? 'correct';
  if (!p.rules.R1.progressFeelings.includes(feeling)) {
    return {
      rule: 'R1',
      exerciseId: e.exerciseId,
      title: `${ex.name} : haut de fourchette atteint, à confirmer`,
      explanation: `${e.plannedSets} × ${max} atteint (${repsText}) mais ressenti « ${feeling} ». On garde les mêmes paramètres : la progression viendra quand ce sera « correct » ou « facile ».`,
    };
  }

  const move = stepUp(p, profile, state.phase, e.exerciseId, e.variantId, e.loadKg);
  if ('blocked' in move) {
    return {
      rule: 'R1',
      exerciseId: e.exerciseId,
      title: `${ex.name} : haut de fourchette atteint`,
      explanation: `${e.plannedSets} × ${max} atteint (${repsText}). Pas de nouvel échelon pour l'instant : ${move.blocked}. Continue à consolider, c'est un critère de passage de phase.`,
    };
  }
  const isLoadIncrease = move.variantId === e.variantId && move.loadKg > e.loadKg;
  if (state.loadFrozen && isLoadIncrease) {
    return {
      rule: 'R1',
      exerciseId: e.exerciseId,
      title: `${ex.name} : progression en pause`,
      explanation: `${e.plannedSets} × ${max} atteint, mais les charges sont gelées (camp MMA, §10.4). Objectif : maintien.`,
    };
  }
  return {
    rule: 'R1',
    exerciseId: e.exerciseId,
    title: `${ex.name} : on passe à l'échelon suivant`,
    explanation:
      ex.unit === 'sec'
        ? `Tu tiens ${e.plannedSets} × ${max} s (${repsText}) avec un ressenti « ${feeling} ». Tenir plus longtemps travaille surtout l'endurance : ${move.label}, et on repart à ${e.range[0]} s.`
        : `Tu as atteint ${e.plannedSets} × ${max} (${repsText}) avec un ressenti « ${feeling} ». Double progression : ${move.label}, et on repart du bas de la fourchette (${e.range[0]} reps). Plus de répétitions n'apporterait plus grand-chose ; c'est la difficulté par répétition qui doit monter.`,
    change: { kind: 'variant', exerciseId: e.exerciseId, variantId: move.variantId, loadKg: move.loadKg },
  };
}

/** R2 — première série sous le minimum deux expositions de suite. */
export function ruleR2({ p, profile, exposures }: ExerciseContext): RecommendationDraft | undefined {
  const n = p.rules.R2.consecutiveBelowMin;
  const list = regular(exposures).slice(-n);
  if (list.length < n) return;
  const last = list[list.length - 1]!;
  if (!list.every((e) => sameSetup(e, last) && (e.reps[0] ?? 0) < e.range[0])) return;
  const ex = p.exercises[last.exerciseId]!;
  const firsts = list.map((e) => e.reps[0]).join(', ');

  if (list.every((e) => e.lowReadiness)) {
    return {
      rule: 'R2',
      exerciseId: last.exerciseId,
      title: `${ex.name} : sous le minimum, mais tu étais fatigué`,
      explanation: `1ʳᵉ série à ${firsts} reps pour un minimum de ${last.range[0]}, avec une forme du jour basse à chaque fois. On ne baisse pas la difficulté : priorité au sommeil et à la récupération.`,
    };
  }
  const move = stepDown(p, profile, last.exerciseId, last.variantId, last.loadKg);
  if ('blocked' in move) return;
  return {
    rule: 'R2',
    exerciseId: last.exerciseId,
    title: `${ex.name} : un cran en dessous`,
    explanation: `${n} séances de suite avec une 1ʳᵉ série sous le minimum (${firsts} pour ${last.range[0]}). La difficulté est trop élevée pour progresser proprement : ${move.label}.${
      ex.loadType === 'dumbbell' ? ' Astuce : tu peux aussi garder l’ancienne charge avec une descente lente (3 s) en échelon intermédiaire.' : ''
    }`,
    change: { kind: 'variant', exerciseId: last.exerciseId, variantId: move.variantId, loadKg: move.loadKg },
  };
}

/** R3 — stagnation : pas de hausse de l'indice sur 3 expositions comparables, forme normale. */
export function ruleR3({ p, state, today, exposures }: ExerciseContext): RecommendationDraft | undefined {
  const k = p.rules.R3.exposures;
  const list = regular(exposures);
  const last = list[list.length - 1];
  if (!last) return;
  const comparable = list.filter((e) => sameSetup(e, last)).slice(-(k + 1));
  if (comparable.length < k + 1) return;
  const [base, ...recent] = comparable as [Exposure, ...Exposure[]];
  if (recent.some((e) => e.lowReadiness)) return;
  if (recent.every((e) => e.reps.every((r) => r >= e.range[1]))) return; // haut atteint : c'est R1
  // Variante et charge identiques : les reps totales mesurent la progression (une rep gagnée sur la
  // 3ᵉ série compte, alors que l'e1RM de la meilleure série ne bougerait pas).
  const total = (e: Exposure) => e.reps.reduce((s, r) => s + r, 0);
  if (Math.max(...recent.map(total)) > total(base)) return;

  const ex = p.exercises[last.exerciseId]!;
  const progress = state.exercises[last.exerciseId];
  const recentlyClustered = progress?.clusterUntil && diffDays(today, progress.clusterUntil) < 28;
  const detail = `${total(base)} reps au total il y a ${k} séances, puis ${recent.map(total).join(' → ')}.`;

  if (recentlyClustered) {
    return {
      rule: 'R3',
      exerciseId: last.exerciseId,
      title: `${ex.name} : stagnation persistante`,
      explanation: `${detail} Les clusters n'ont pas suffi. Étape suivante : une variante voisine pendant un cycle (${
        ex.variants.filter((v) => v.id !== last.variantId && !v.offLadder).slice(0, 2).map((v) => v.name.toLowerCase()).join(' ou ') || 'autre prise'
      }), puis retour à la variante actuelle.`,
    };
  }
  return {
    rule: 'R3',
    exerciseId: last.exerciseId,
    title: `${ex.name} : stagnation, on change de schéma`,
    explanation: `${detail} Sans fatigue particulière. Pendant ${p.rules.R3.clusterWeeks} semaines : séries en clusters (2× plus de séries, moitié moins de reps, 45 s de repos) pour accumuler plus de répétitions de qualité.`,
    change: { kind: 'cluster', exerciseId: last.exerciseId, until: addDays(today, p.rules.R3.clusterWeeks * 7) },
  };
}

// ---------------------------------------------------------------------------
// R4 — deload anticipé
// ---------------------------------------------------------------------------

export const MAIN_LIFTS = ['pullup_pronation', 'dips'];

export function ruleR4(args: {
  p: Programme;
  state: ProgramState;
  today: DayKey;
  weekInCycle: number;
  sessions: Session[];
  exposuresByExercise: Record<string, Exposure[]>;
  stalledCount: number;
}): RecommendationDraft | undefined {
  const { p, state, today } = args;
  const R4 = p.rules.R4;
  if (args.weekInCycle >= p.cycle.deloadWeek - 1) return; // deload planifié imminent
  if (state.forcedDeloadFrom && diffDays(today, state.forcedDeloadFrom) < 21) return;

  const reasons: string[] = [];

  for (const id of MAIN_LIFTS) {
    const list = regular(args.exposuresByExercise[id] ?? []);
    const need = R4.comparedToLastExposures + R4.consecutiveDrops;
    if (list.length < need) continue;
    const window = list.slice(-need);
    // Mesure de la performance de séance : reps totales si variante et charge sont identiques sur la fenêtre
    // (sensible : 6·6·5·5 → 3·3·3·2 = −50 %), sinon indice R5. L'e1RM seul est trop amorti par le poids du
    // corps (−3 reps sur la meilleure série ≈ −8 %) pour détecter une vraie baisse au poids du corps.
    const same = window.every((e) => sameSetup(e, window[0]!));
    const perf = (e: Exposure) => (same ? e.reps.reduce((s, r) => s + r, 0) : e.index);
    const ref = window.slice(0, R4.comparedToLastExposures);
    const mean = ref.reduce((s, e) => s + perf(e), 0) / ref.length;
    const drops = window.slice(R4.comparedToLastExposures);
    if (drops.every((e) => perf(e) <= mean * (1 - R4.perfDropPct / 100))) {
      const name = args.p.exercises[id]!.name.toLowerCase();
      const pct = Math.round((1 - perf(drops[drops.length - 1]!) / mean) * 100);
      reasons.push(`${name} en baisse de ${pct} % sur ${R4.consecutiveDrops} séances`);
    }
  }

  const completed = args.sessions.filter((s) => s.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  const lastReadiness = completed.slice(-R4.lowReadinessSessions);
  if (lastReadiness.length === R4.lowReadinessSessions && lastReadiness.every((s) => s.readiness && isLowReadiness(s.readiness, p))) {
    reasons.push(`forme du jour basse ${R4.lowReadinessSessions} séances de suite`);
  }

  const lastPain = completed.slice(-R4.jointPainSessions);
  if (
    lastPain.length === R4.jointPainSessions &&
    lastPain.every((s) => s.results.some((r) => (r.jointPain ?? 0) >= R4.jointPainThreshold))
  ) {
    reasons.push(`douleur articulaire ≥ ${R4.jointPainThreshold}/10 deux séances de suite`);
  }

  if (args.stalledCount >= p.rules.R3.multipleStallTriggersDeload) {
    reasons.push(`${args.stalledCount} exercices stagnent en même temps (fatigue globale, R3)`);
  }

  if (reasons.length === 0) return;
  return {
    rule: 'R4',
    title: 'Semaine de décharge conseillée',
    explanation: `Signaux de fatigue : ${reasons.join(' ; ')}. Une semaine de deload (séries ÷ 2, RIR 3–4) dissipe la fatigue ; les performances remontent souvent juste après. Le cycle repart ensuite de zéro.`,
    change: { kind: 'deload', from: addDays(today, 1) },
  };
}

// ---------------------------------------------------------------------------
// R7 — passage de phase
// ---------------------------------------------------------------------------

export interface CriterionResult {
  label: string;
  ok: boolean;
}

export interface PhaseContext {
  p: Programme;
  profile: Profile;
  state: ProgramState;
  today: DayKey;
  sessions: Session[];
  tests: MaxTest[];
  exposuresByExercise: Record<string, Exposure[]>;
}

const TEST_LABELS: Record<string, string> = { pullup_max: 'Tractions max', dips_max: 'Dips max', pushup_max: 'Pompes max' };

function evalCriterion(c: Criterion, ctx: PhaseContext): CriterionResult {
  const { p, state, today } = ctx;
  switch (c.type) {
    case 'minWeeks': {
      const weeks = Math.floor(diffDays(today, state.phaseStartedOn) / 7);
      return { label: `${c.value} semaines minimum en phase ${state.phase} (${weeks})`, ok: weeks >= c.value };
    }
    case 'adherence': {
      const from = addDays(today, -7 * c.weeks);
      const done = ctx.sessions.filter((s) => s.status === 'completed' && diffDays(s.day, from) > 0).length;
      const expected = ctx.profile.sessionsPerWeek * c.weeks;
      const pct = Math.round((done / expected) * 100);
      return { label: `Assiduité ≥ ${c.pct} % sur ${c.weeks} semaines (${pct} %)`, ok: pct >= c.pct };
    }
    case 'test': {
      const list = ctx.tests.filter((t) => t.testId === c.test).sort((a, b) => a.day.localeCompare(b.day));
      const last = list[list.length - 1];
      return { label: `${TEST_LABELS[c.test] ?? c.test} ≥ ${c.min} (${last ? last.value : 'pas de test'})`, ok: (last?.value ?? 0) >= c.min };
    }
    case 'sessionTopReached': {
      const list = (ctx.exposuresByExercise[c.exerciseId] ?? []).filter((e) => e.phase === state.phase && !e.isTest);
      const ok = list.some((e) => e.reps.length >= c.sets && e.reps.slice(0, c.sets).every((r) => r >= c.reps));
      return { label: `${p.exercises[c.exerciseId]?.name ?? c.exerciseId} : ${c.sets} × ${c.reps} en séance`, ok };
    }
    case 'noJointPain': {
      const from = addDays(today, -7 * c.weeks);
      const painful = ctx.sessions.some(
        (s) => diffDays(s.day, from) > 0 && s.results.some((r) => (r.jointPain ?? 0) > c.maxPain),
      );
      return { label: `Aucune douleur articulaire > ${c.maxPain}/10 sur ${c.weeks} semaines`, ok: !painful };
    }
    case 'atLeast': {
      const sub = c.items.map((i) => evalCriterion(i, ctx));
      const n = sub.filter((s) => s.ok).length;
      return { label: `Au moins ${c.count} parmi : ${sub.map((s) => `${s.ok ? '✓' : '✗'} ${s.label}`).join(', ')}`, ok: n >= c.count };
    }
    case 'anyOf': {
      const sub = c.items.map((i) => evalCriterion(i, ctx));
      return { label: sub.map((s) => `${s.ok ? '✓' : '✗'} ${s.label}`).join(' ou '), ok: sub.some((s) => s.ok) };
    }
  }
}

export function evaluatePhase(ctx: PhaseContext): { results: CriterionResult[]; met: boolean; fallback: boolean; to?: number } {
  const transition = ctx.p.phaseTransitions.find((t) => t.from === ctx.state.phase);
  if (!transition) return { results: [], met: false, fallback: false };
  const results = transition.criteria.map((c) => evalCriterion(c, ctx));
  const met = results.every((r) => r.ok);

  let fallback = false;
  if (!met && transition.fallback) {
    const weeks = diffDays(ctx.today, ctx.state.phaseStartedOn) / 7;
    const pull = (ctx.exposuresByExercise.pullup_pronation ?? []).filter((e) => e.phase === ctx.state.phase && !e.isTest && !e.isDeload);
    const progressing = pull.length >= 2 && pull[pull.length - 1]!.index > pull[0]!.index;
    fallback = weeks >= transition.fallback.afterWeeks && (!transition.fallback.requireProgress || progressing);
  }
  return { results, met, fallback, to: transition.to };
}

export function ruleR7(ctx: PhaseContext): RecommendationDraft | undefined {
  const { met, fallback, results, to } = evaluatePhase(ctx);
  if (!to || (!met && !fallback)) return;
  const target = ctx.p.phases[to - 1];
  if (!target) return;
  const list = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.label}`).join('\n');
  return {
    rule: 'R7',
    title: `Passage en phase ${to} : ${target.name}`,
    explanation: met
      ? `Tous les critères sont remplis :\n${list}\n\nLa phase ${to} augmente le volume et l'intensité. Le changement démarre un nouveau cycle.`
      : `Critères pas tous remplis, mais tu progresses toujours après plusieurs cycles : la phase ${to} te conviendra aussi.\n${list}`,
    change: { kind: 'phase', phase: to as 1 | 2 | 3, blockId: target.blocks[0]!.id },
  };
}

// ---------------------------------------------------------------------------
// R8 — reprise après une longue pause
// ---------------------------------------------------------------------------

export function ruleR8Comeback(p: Programme, state: ProgramState, lastSessionDay: DayKey | undefined, today: DayKey): RecommendationDraft | undefined {
  if (!lastSessionDay) return;
  const gap = diffDays(today, lastSessionDay);
  const breaks = [...p.rules.R8.longBreaks].sort((a, b) => b.minDays - a.minDays);
  const match = breaks.find((b) => gap >= b.minDays);
  if (!match || match.action === 'reduced_week') return; // la semaine allégée est gérée par le planner

  if (match.action === 'restart_phase1') {
    return {
      rule: 'R8',
      title: `Reprise après ${gap} jours : retour en phase 1`,
      explanation: `Plus de 3 mois sans séance (§9.4). Un cycle de phase 1 pour réhabituer tendons et articulations ; les progrès reviennent beaucoup plus vite que la première fois.`,
      change: { kind: 'comeback', phase: 1, blockId: p.phases[0]!.blocks[0]!.id, stepBack: true },
    };
  }
  const phase = Math.min(state.phase, 2) as 1 | 2;
  return {
    rule: 'R8',
    title: `Reprise après ${gap} jours : un échelon en arrière`,
    explanation: `Entre 1 et 3 mois d'arrêt (§9.4) : chaque exercice redescend d'un échelon${state.phase === 3 ? ' et on refait un cycle en phase 2' : ''}. Tu remonteras vite.`,
    change: { kind: 'comeback', phase, blockId: p.phases[phase - 1]!.blocks[0]!.id, stepBack: true },
  };
}

// ---------------------------------------------------------------------------
// Point d'entrée après une séance
// ---------------------------------------------------------------------------

export function evaluateAfterSession(args: {
  p: Programme;
  profile: Profile;
  state: ProgramState;
  today: DayKey;
  weekInCycle: number;
  session: Session;
  sessions: Session[];
  sets: SetLog[];
  tests: MaxTest[];
  fallbackBodyweight: number;
}): RecommendationDraft[] {
  const { p, profile, state, today, session } = args;
  const ids = new Set([...session.plan.map((pe) => pe.exerciseId), ...MAIN_LIFTS]);
  const exposuresByExercise: Record<string, Exposure[]> = {};
  for (const id of ids) exposuresByExercise[id] = buildExposures(p, args.sessions, args.sets, id, args.fallbackBodyweight);

  const drafts: RecommendationDraft[] = [];
  let stalled = 0;

  if (!session.isDeload && session.type !== 'TEST') {
    for (const pe of session.plan) {
      const ctx: ExerciseContext = { p, profile, state, today, exposures: exposuresByExercise[pe.exerciseId] ?? [] };
      const r = ruleR1(ctx) ?? ruleR2(ctx) ?? ruleR3(ctx);
      if (r?.rule === 'R3' && r.change) stalled++;
      if (r) drafts.push(r);
    }
  }

  const r4 = ruleR4({ p, state, today, weekInCycle: args.weekInCycle, sessions: args.sessions, exposuresByExercise, stalledCount: stalled });
  if (r4) {
    // Fatigue globale : les clusters individuels n'ont plus de sens.
    const kept = drafts.filter((d) => !(d.rule === 'R3' && d.change));
    kept.push(r4);
    drafts.length = 0;
    drafts.push(...kept);
  }

  if (session.type === 'TEST') {
    const r7 = ruleR7({ p, profile, state, today, sessions: args.sessions, tests: args.tests, exposuresByExercise });
    if (r7) drafts.push(r7);
  }
  return drafts;
}

/**
 * Identité d'une recommandation : une nouvelle remplace l'ancienne en attente de même clé.
 * Pour un exercice, une seule recommandation à la fois (R1, R2 ou R3) ; sinon une par règle.
 */
export const recKey = (r: { rule: RuleId; exerciseId?: string }) => (r.exerciseId ? `ex:${r.exerciseId}` : `rule:${r.rule}`);
