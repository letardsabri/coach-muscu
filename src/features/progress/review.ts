/**
 * Bilan hebdomadaire (lundi → dimanche), recalculé à partir de l'historique : rien n'est stocké,
 * un bilan passé reste juste si une saisie est corrigée après coup. Fonction pure, testée.
 *
 * Recommandation principale, par priorité :
 *   1. deload (semaine prévue par le cycle, ou proposé par le coach) ;
 *   2. régularité (moins de la moitié des séances prévues faites) ;
 *   3. apport calorique (perte trop rapide, ou poids qui ne baisse plus depuis 2 semaines) ;
 *   4. protéines (moyenne < 80 % de l'objectif) ;
 *   5. garder le cap.
 */
import type { Programme } from '../../data/programmeSchema';
import type { BodyMetric, FoodEntry, MobilitySession, Recommendation, Session, SetLog, WaterEntry } from '../../db/models';
import { weightTrend } from '../../engine/body';
import { counts } from '../../engine/mobility';
import { totalsByDay } from '../../engine/nutrition';
import type { CalendarDay } from '../../engine/schedule';
import { addDays, diffDays } from '../../lib/dates';
import { exerciseHistory, weightPoints } from './stats';

export interface ReviewInput {
  p: Programme;
  monday: string;
  today: string;
  /** Les 7 jours de la semaine (calendrier). */
  week: CalendarDay[];
  sessions: Session[];
  sets: SetLog[];
  metrics: BodyMetric[];
  food: FoodEntry[];
  water: WaterEntry[];
  souplesse: MobilitySession[];
  souplesseTarget: { min: number; max: number };
  pendingRecos: Recommendation[];
  /** La semaine suivante est une semaine de deload (cycle). */
  nextWeekDeload: boolean;
  goalKg: number;
  fallbackBodyweight: number;
  /** Objectifs du jour (kcal, protéines), null si les objectifs nutrition ne sont pas réglés. */
  targetsFor: (day: string) => { kcal: number; prot: number } | null;
  /** Objectif d'eau du jour (ml), null si non réglé. */
  waterGoalFor: (day: string) => number | null;
}

export type Tone = 'ok' | 'warn' | 'info';
export interface Advice {
  kind: 'deload' | 'regularite' | 'calories_plus' | 'calories_moins' | 'objectif' | 'proteines' | 'cap' | 'eau' | 'saisie' | 'souplesse' | 'abdos';
  tone: Tone;
  title: string;
  text: string;
}

export interface WeeklyReview {
  monday: string;
  sunday: string;
  /** Semaine pas encore terminée : chiffres « à ce jour ». */
  partial: boolean;
  daysElapsed: number;
  training: {
    strengthDone: number;
    strengthPlanned: number;
    /** Séances déjà passées sans être faites (semaine en cours : jours écoulés seulement). */
    strengthMissed: number;
    absDone: number;
    souplesseDone: number;
    souplesseMinutes: number;
    souplesseTarget: { min: number; max: number };
    mma: number;
  };
  performance: {
    records: { exerciseId: string; name: string; gainPct: number }[];
    progressed: string[];
    stalled: string[];
  };
  weight: { avg: number; prevAvg?: number; delta?: number; measures: number; weeklyPct?: number } | null;
  nutrition: { daysLogged: number; kcal: number; prot: number; targetKcal?: number; targetProt?: number } | null;
  hydration: { daysLogged: number; avgMl: number; goalMl?: number } | null;
  main: Advice;
  extra: Advice[];
}

const inRange = (day: string, from: string, to: string) => diffDays(day, from) >= 0 && diffDays(to, day) >= 0;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const isStrength = (s: Session) => s.status === 'completed' && (s.type === 'A' || s.type === 'B' || s.type === 'F');

function weekWeight(metrics: BodyMetric[], from: string) {
  const xs = metrics.filter((m) => m.weightKg !== undefined && inRange(m.day, from, addDays(from, 6))).map((m) => m.weightKg!);
  return xs.length ? { avg: Math.round(avg(xs) * 10) / 10, n: xs.length } : null;
}

export function weeklyReview(input: ReviewInput): WeeklyReview {
  const { p, monday, today, week } = input;
  const sunday = addDays(monday, 6);
  const partial = diffDays(sunday, today) > 0;
  const daysElapsed = partial ? Math.max(0, diffDays(today, monday) + 1) : 7;
  const lastDay = partial ? today : sunday;

  // --- Séances ------------------------------------------------------------
  const strength = week.flatMap((d) => d.done.filter(isStrength));
  const strengthMissed = week.filter((d) => d.missed).length;
  const strengthPlanned = strength.length + strengthMissed + week.filter((d) => d.planned && d.done.filter(isStrength).length === 0).length;
  const setsBySession = new Map<string, SetLog[]>();
  for (const s of input.sets) setsBySession.set(s.sessionId, [...(setsBySession.get(s.sessionId) ?? []), s]);
  const absDone = strength.filter((s) => (setsBySession.get(s.id) ?? []).some((x) => p.exercises[x.exerciseId]?.kind === 'core')).length;
  const soupleWeek = input.souplesse.filter((s) => counts(s) && inRange(s.day, monday, sunday));
  const training = {
    strengthDone: strength.length,
    strengthPlanned,
    strengthMissed,
    absDone,
    souplesseDone: soupleWeek.length,
    souplesseMinutes: Math.round(soupleWeek.reduce((n, s) => n + s.durationSec, 0) / 60),
    souplesseTarget: input.souplesseTarget,
    mma: week.reduce((n, d) => n + d.mma.length, 0),
  };

  // --- Performances : record = meilleur score de la semaine au-dessus de tout l'historique précédent.
  // Exercices au poids du corps : force relative (÷ poids du corps), pour ne pas pénaliser la perte de poids.
  const records: WeeklyReview['performance']['records'] = [];
  const progressed: string[] = [];
  const stalled: string[] = [];
  const weekIds = [...new Set(strength.flatMap((s) => (setsBySession.get(s.id) ?? []).map((x) => x.exerciseId)))];
  for (const id of weekIds) {
    const ex = p.exercises[id];
    if (!ex) continue;
    const hist = exerciseHistory(p, input.sessions, input.sets, id, input.fallbackBodyweight);
    const score = (h: (typeof hist)[number]) => (ex.loadType === 'bodyweight' ? h.index / h.bodyweightKg : h.index);
    const before = hist.filter((h) => diffDays(monday, h.day) > 0);
    const during = hist.filter((h) => inRange(h.day, monday, sunday));
    if (before.length === 0 || during.length === 0) continue;
    const bestBefore = Math.max(...before.map(score));
    const bestNow = Math.max(...during.map(score));
    if (bestNow > bestBefore * 1.001) records.push({ exerciseId: id, name: ex.name, gainPct: Math.round(((bestNow - bestBefore) / bestBefore) * 1000) / 10 });
    if (score(during[during.length - 1]!) > score(before[before.length - 1]!) * 1.001) progressed.push(ex.name);
    else stalled.push(ex.name);
  }
  records.sort((a, b) => b.gainPct - a.gainPct);

  // --- Poids --------------------------------------------------------------
  const ww = weekWeight(input.metrics, monday);
  const prev = weekWeight(input.metrics, addDays(monday, -7));
  const prev2 = weekWeight(input.metrics, addDays(monday, -14));
  const trend = weightTrend(
    weightPoints(input.metrics).filter((x) => diffDays(lastDay, x.day) >= 0),
    p,
    input.goalKg,
  );
  const weight = ww
    ? {
        avg: ww.avg,
        prevAvg: prev?.avg,
        delta: prev ? Math.round((ww.avg - prev.avg) * 10) / 10 : undefined,
        measures: ww.n,
        weeklyPct: trend?.weeklyPct,
      }
    : null;

  // --- Nutrition et eau (moyenne des jours saisis) --------------------------
  const totals = [...totalsByDay(input.food.filter((f) => inRange(f.day, monday, sunday))).entries()].filter(([, t]) => t.kcal > 0);
  let nutrition: WeeklyReview['nutrition'] = null;
  if (totals.length) {
    const targets = totals.map(([d]) => input.targetsFor(d)).filter((t): t is { kcal: number; prot: number } => t !== null);
    nutrition = {
      daysLogged: totals.length,
      kcal: Math.round(avg(totals.map(([, t]) => t.kcal))),
      prot: Math.round(avg(totals.map(([, t]) => t.prot))),
      targetKcal: targets.length ? Math.round(avg(targets.map((t) => t.kcal))) : undefined,
      targetProt: targets.length ? Math.round(avg(targets.map((t) => t.prot))) : undefined,
    };
  }
  const waterDays = new Map<string, number>();
  for (const w of input.water) if (inRange(w.day, monday, sunday)) waterDays.set(w.day, (waterDays.get(w.day) ?? 0) + w.ml);
  let hydration: WeeklyReview['hydration'] = null;
  if (waterDays.size) {
    const goals = [...waterDays.keys()].map(input.waterGoalFor).filter((g): g is number => g !== null);
    hydration = {
      daysLogged: waterDays.size,
      avgMl: Math.round(avg([...waterDays.values()]) / 10) * 10,
      goalMl: goals.length ? Math.round(avg(goals) / 10) * 10 : undefined,
    };
  }

  // --- Recommandations ------------------------------------------------------
  const advices: Advice[] = [];
  const deloadReco = input.pendingRecos.find((r) => r.change?.kind === 'deload');
  if (input.nextWeekDeload || deloadReco) {
    advices.push({
      kind: 'deload',
      tone: 'info',
      title: 'Semaine de deload',
      text: input.nextWeekDeload
        ? 'La semaine prochaine est une semaine de deload prévue par le cycle : charges et volume réduits pour récupérer et repartir plus fort.'
        : 'Le coach propose un deload (voir les recommandations de l’accueil) : la fatigue s’accumule, une semaine allégée fera repartir la progression.',
    });
  }
  const due = training.strengthDone + training.strengthMissed;
  if (due >= 2 && training.strengthDone / due < 0.5) {
    advices.push({
      kind: 'regularite',
      tone: 'warn',
      title: 'Priorité à la régularité',
      text: `${training.strengthDone} séance${training.strengthDone > 1 ? 's' : ''} sur ${due} prévue${due > 1 ? 's' : ''}. Vise d’abord toutes les séances de la semaine, même courtes : c’est la régularité qui fait progresser.`,
    });
  }
  const lossPct = weight?.weeklyPct !== undefined ? -weight.weeklyPct : undefined;
  if (ww && ww.avg <= input.goalKg) {
    advices.push({ kind: 'objectif', tone: 'ok', title: 'Objectif de poids atteint', text: `Moyenne de ${fmt(ww.avg)} kg : tu peux remonter l’apport vers la maintenance pour stabiliser.` });
  } else if (lossPct !== undefined && lossPct > p.body.fastLossAlertPctPerWeek) {
    advices.push({
      kind: 'calories_plus',
      tone: 'warn',
      title: 'Ajuste l’apport : + 150 kcal',
      text: `Tu perds ${fmt(lossPct)} % de ton poids par semaine : c’est trop rapide pour garder le muscle. Ajoute environ 150 kcal par jour.`,
    });
  } else if (ww && prev && prev2 && ww.avg >= prev.avg && prev.avg >= prev2.avg) {
    advices.push({
      kind: 'calories_moins',
      tone: 'warn',
      title: 'Ajuste l’apport : − 150 kcal',
      text: 'Ton poids moyen ne baisse plus depuis 2 semaines. Vérifie d’abord que tes saisies sont complètes, puis retire environ 150 kcal par jour.',
    });
  }
  if (nutrition?.targetProt && nutrition.prot < nutrition.targetProt * 0.8) {
    advices.push({
      kind: 'proteines',
      tone: 'warn',
      title: 'Priorité aux protéines',
      text: `${nutrition.prot} g par jour en moyenne pour un objectif de ${nutrition.targetProt} g : ajoute une source de protéines à un ou deux repas (skyr, œufs, poulet, whey).`,
    });
  }
  const main = advices.shift() ?? {
    kind: 'cap' as const,
    tone: 'ok' as const,
    title: 'Garde le cap',
    text: 'Rien à corriger en priorité : continue sur la même lancée la semaine prochaine.',
  };

  const extra: Advice[] = [...advices];
  if (training.strengthDone > 0 && training.absDone < training.strengthDone) {
    extra.push({ kind: 'abdos', tone: 'info', title: 'Abdos', text: `Faits dans ${training.absDone} séance(s) sur ${training.strengthDone} : ne saute pas la fin de séance.` });
  }
  if (hydration?.goalMl && hydration.avgMl < hydration.goalMl * 0.8) {
    extra.push({ kind: 'eau', tone: 'info', title: 'Hydratation', text: `${liters(hydration.avgMl)} par jour en moyenne pour ${liters(hydration.goalMl)} visés : garde une bouteille à portée de main.` });
  }
  const loggable = daysElapsed;
  if (loggable >= 4 && (nutrition?.daysLogged ?? 0) < 4) {
    extra.push({ kind: 'saisie', tone: 'info', title: 'Saisies', text: `${nutrition?.daysLogged ?? 0} jour(s) saisi(s) sur ${loggable} : au moins 4 jours rendent les moyennes fiables.` });
  }
  if (!partial && training.souplesseDone < training.souplesseTarget.min) {
    extra.push({ kind: 'souplesse', tone: 'info', title: 'Souplesse', text: `${training.souplesseDone} séance(s) sur ${training.souplesseTarget.min}–${training.souplesseTarget.max} recommandées.` });
  }

  return {
    monday,
    sunday,
    partial,
    daysElapsed,
    training,
    performance: { records, progressed, stalled },
    weight,
    nutrition,
    hydration,
    main,
    extra: extra.slice(0, 2),
  };
}

const fmt = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const liters = (ml: number) => `${(ml / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} L`;
