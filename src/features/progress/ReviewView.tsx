/**
 * Bilan hebdomadaire (Progrès › Bilan) et carte de l'accueil (lundi → mercredi : semaine précédente).
 * Rien n'est stocké : le bilan est recalculé à chaque affichage à partir de l'historique.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { nutritionConfig } from '../../data/nutritionData';
import { programme } from '../../data/programme';
import { souplesse } from '../../data/souplesseData';
import { db } from '../../db/db';
import { cycleInfo } from '../../engine/cycle';
import { waterGoal } from '../../engine/hydration';
import { ageFrom, dailyTargets } from '../../engine/nutrition';
import { buildCalendar, weekStart } from '../../engine/schedule';
import { addDays, dayKey, diffDays, parseDay } from '../../lib/dates';
import { useHistory, useProfile, useProgramState } from '../data';
import { daySport, referenceWeight } from '../nutrition/useNutrition';
import { weeklyReview, type Advice, type WeeklyReview } from './review';

export function useWeeklyReview(monday: string): WeeklyReview | null {
  const profile = useProfile();
  const state = useProgramState();
  const data = useHistory();
  const sunday = addDays(monday, 6);
  const extra = useLiveQuery(async () => {
    const [food, water, souple, recos] = await Promise.all([
      db.foodEntries.where('day').between(monday, sunday, true, true).toArray(),
      db.waterEntries.where('day').between(monday, sunday, true, true).toArray(),
      db.mobilitySessions.where('day').between(monday, sunday, true, true).toArray(),
      db.recommendations.where('status').equals('pending').toArray(),
    ]);
    return { food, water, souple, recos };
  }, [monday, sunday]);
  if (!profile || !state || !data || !extra) return null;

  const today = dayKey();
  const week = buildCalendar({
    programme,
    profile,
    nextSessionType: state.nextSessionType,
    overrides: data.overrides,
    sessions: data.sessions,
    mma: data.mma,
    from: monday,
    to: sunday,
    today,
    trackingSince: dayKey(new Date(profile.createdAt)),
  });
  const weightKg = referenceWeight(profile, data.metrics);
  const sportOf = (day: string) => daySport({ day, today, profile, state, sessions: data.sessions, mma: data.mma, overrides: data.overrides });

  return weeklyReview({
    p: programme,
    monday,
    today,
    week,
    sessions: data.sessions,
    sets: data.sets,
    metrics: data.metrics,
    food: extra.food,
    water: extra.water,
    souplesse: extra.souple,
    souplesseTarget: souplesse.settings.weeklyTarget,
    pendingRecos: extra.recos,
    nextWeekDeload: cycleInfo(state, addDays(monday, 7), programme).isDeload,
    goalKg: profile.goalWeightKg,
    fallbackBodyweight: profile.startWeightKg,
    targetsFor: (day) => {
      if (!profile.nutrition) return null;
      const t = dailyTargets({
        cfg: nutritionConfig,
        settings: profile.nutrition,
        weightKg,
        goalWeightKg: profile.goalWeightKg,
        heightCm: profile.heightCm,
        age: ageFrom(profile.birthYear),
        sport: sportOf(day),
      });
      return t ? { kcal: t.kcal, prot: t.prot } : null;
    },
    waterGoalFor: (day) => (profile.hydration ? waterGoal(profile.hydration, sportOf(day)).ml : null),
  });
}

const fmt = (v: number, digits = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: digits });
const short = (day: string) => parseDay(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const TONE_COLOR: Record<Advice['tone'], string> = { ok: 'var(--ok)', warn: 'var(--warn)', info: 'var(--accent)' };

export function ReviewView() {
  const thisMonday = weekStart(dayKey());
  const [monday, setMonday] = useState(thisMonday);
  const r = useWeeklyReview(monday);
  if (!r) return null;
  const isCurrent = monday === thisMonday;
  const t = r.training;

  return (
    <>
      <div className="spread">
        <button className="btn-ghost" onClick={() => setMonday(addDays(monday, -7))}>
          ‹ Préc.
        </button>
        <b>{isCurrent ? 'Cette semaine' : diffDays(thisMonday, monday) === 7 ? 'Semaine dernière' : `Semaine du ${short(monday)}`}</b>
        <button className="btn-ghost" disabled={isCurrent} onClick={() => setMonday(addDays(monday, 7))}>
          Suiv. ›
        </button>
      </div>
      {r.partial && (
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          Semaine en cours (jour {r.daysElapsed}/7) : chiffres à ce jour, bilan complet dimanche soir.
        </p>
      )}

      <AdviceCard advice={r.main} main />
      {r.extra.map((a) => (
        <AdviceCard key={a.kind} advice={a} />
      ))}

      <section className="card">
        <h3 className="card-h">Séances</h3>
        <div className="review-grid">
          <Stat value={`${t.strengthDone}/${t.strengthPlanned}`} label="muscu" ok={t.strengthPlanned > 0 && t.strengthDone >= t.strengthPlanned} />
          <Stat value={t.strengthDone ? `${t.absDone}/${t.strengthDone}` : "—"} label="avec abdos" ok={t.strengthDone > 0 && t.absDone === t.strengthDone} />
          <Stat value={`${t.souplesseDone}`} label={`souplesse (${t.souplesseTarget.min}–${t.souplesseTarget.max})`} ok={t.souplesseDone >= t.souplesseTarget.min} />
          <Stat value={`${t.mma}`} label="MMA" />
        </div>
        {t.souplesseMinutes > 0 && <p className="faint num" style={{ fontSize: 13 }}>Souplesse : {t.souplesseMinutes} min au total.</p>}
      </section>

      <section className="card">
        <h3 className="card-h">Performances</h3>
        {r.performance.records.length > 0 ? (
          <ul className="review-list">
            {r.performance.records.map((rec) => (
              <li key={rec.exerciseId}>
                <span>🏆 {rec.name}</span>
                <b className="num" style={{ color: 'var(--ok)' }}>+{fmt(rec.gainPct)} %</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>
            {t.strengthDone === 0 ? 'Pas de séance de muscu cette semaine.' : 'Pas de nouveau record cette semaine.'}
          </p>
        )}
        {(r.performance.progressed.length > 0 || r.performance.stalled.length > 0) && (
          <p className="muted" style={{ fontSize: 14 }}>
            {r.performance.progressed.length > 0 && (
              <>
                En progrès : <b style={{ color: 'var(--text)' }}>{r.performance.progressed.join(', ')}</b>.{' '}
              </>
            )}
            {r.performance.stalled.length > 0 && <>Stable : {r.performance.stalled.join(', ')}.</>}
          </p>
        )}
        <p className="faint" style={{ fontSize: 13 }}>Comparé à ton meilleur niveau avant la semaine (force relative pour les exercices au poids du corps).</p>
      </section>

      <section className="card">
        <h3 className="card-h">Poids</h3>
        {r.weight ? (
          <>
            <div className="spread">
              <span className="big-number num" style={{ fontSize: 30 }}>
                {fmt(r.weight.avg)} kg
              </span>
              {r.weight.delta !== undefined && (
                <span className="num" style={{ fontWeight: 700, color: r.weight.delta <= 0 ? 'var(--ok)' : 'var(--text-2)' }}>
                  {r.weight.delta > 0 ? '+' : ''}
                  {fmt(r.weight.delta)} kg
                </span>
              )}
            </div>
            <p className="muted num" style={{ fontSize: 14 }}>
              Moyenne de {r.weight.measures} pesée{r.weight.measures > 1 ? 's' : ''}
              {r.weight.prevAvg !== undefined ? `, semaine précédente ${fmt(r.weight.prevAvg)} kg` : ''}.
              {r.weight.weeklyPct !== undefined ? ` Tendance : ${r.weight.weeklyPct > 0 ? '+' : ''}${fmt(r.weight.weeklyPct)} % par semaine.` : ''}
            </p>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>Pas de pesée cette semaine.</p>
        )}
      </section>

      <section className="card">
        <h3 className="card-h">Nutrition et hydratation</h3>
        {r.nutrition ? (
          <div className="review-grid">
            <Stat value={fmt(r.nutrition.kcal, 0)} label={r.nutrition.targetKcal ? `kcal / ${fmt(r.nutrition.targetKcal, 0)}` : 'kcal / jour'} />
            <Stat
              value={`${fmt(r.nutrition.prot, 0)} g`}
              label={r.nutrition.targetProt ? `protéines / ${r.nutrition.targetProt} g` : 'protéines'}
              ok={r.nutrition.targetProt !== undefined && r.nutrition.prot >= r.nutrition.targetProt * 0.9}
            />
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>Aucun repas saisi cette semaine.</p>
        )}
        {r.hydration ? (
          <div className="review-grid">
            <Stat
              value={`${fmt(r.hydration.avgMl / 1000)} L`}
              label={r.hydration.goalMl ? `eau / ${fmt(r.hydration.goalMl / 1000)} L` : 'eau / jour'}
              ok={r.hydration.goalMl !== undefined && r.hydration.avgMl >= r.hydration.goalMl * 0.9}
            />
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>Pas d'eau saisie cette semaine.</p>
        )}
        <p className="faint num" style={{ fontSize: 13 }}>
          Moyennes des jours saisis
          {r.nutrition ? ` (repas : ${r.nutrition.daysLogged} j` : ''}
          {r.hydration ? `${r.nutrition ? ',' : ' ('} eau : ${r.hydration.daysLogged} j` : ''}
          {r.nutrition || r.hydration ? ')' : ''}. Un jour non saisi ne compte pas comme zéro.
        </p>
      </section>
    </>
  );
}

function AdviceCard({ advice, main }: { advice: Advice; main?: boolean }) {
  return (
    <section className={`card${main ? ' card-accent' : ''}`} style={{ gap: 6 }}>
      {main && <p className="eyebrow" style={{ color: TONE_COLOR[advice.tone] }}>Pour la semaine prochaine</p>}
      <h3 className="card-h" style={main ? undefined : { fontSize: 16 }}>
        {advice.title}
      </h3>
      <p className="muted" style={{ fontSize: 14 }}>
        {advice.text}
      </p>
    </section>
  );
}

function Stat({ value, label, ok }: { value: string; label: string; ok?: boolean }) {
  return (
    <div>
      <span className="big-number num" style={{ fontSize: 26, color: ok ? 'var(--ok)' : undefined }}>
        {value}
      </span>
      <small>{label}</small>
    </div>
  );
}

/** Carte de l'accueil, du lundi au mercredi : recommandation issue de la semaine écoulée. */
export function ReviewCard({ onOpen }: { onOpen: () => void }) {
  const today = dayKey();
  const lastMonday = addDays(weekStart(today), -7);
  const r = useWeeklyReview(lastMonday);
  const weekday = parseDay(today).getDay(); // 1 = lundi … 3 = mercredi
  if (!r || weekday < 1 || weekday > 3) return null;
  return (
    <section className="card" onClick={onOpen} role="button">
      <div className="spread">
        <h3 className="card-h">Bilan de la semaine dernière</h3>
        <span className="num muted" style={{ fontSize: 14 }}>
          {r.training.strengthDone}/{r.training.strengthPlanned} séances
        </span>
      </div>
      <p style={{ margin: 0, fontWeight: 600, color: TONE_COLOR[r.main.tone] }}>{r.main.title}</p>
      <p className="muted" style={{ fontSize: 14 }}>
        {r.main.text}
      </p>
      <span className="faint" style={{ fontSize: 13 }}>
        Voir le bilan complet ›
      </span>
    </section>
  );
}
