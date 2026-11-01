/**
 * Tendances nutrition : calories et protéines sur 7 / 30 jours, moyennes hebdomadaires,
 * et poids lissé face à l'apport moyen (deux graphiques alignés, jamais de double axe).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../db/db';
import { rollingAverage } from '../../engine/body';
import { liters, waterByDay, waterGoal } from '../../engine/hydration';
import { averageOfLoggedDays, totalsByDay } from '../../engine/nutrition';
import { weekStart } from '../../engine/schedule';
import { addDays, dayKey, diffDays } from '../../lib/dates';
import { LineChart } from '../../ui/charts';
import { Segmented } from '../../ui/components';
import { useHistory } from '../data';
import { shortDate, weightPoints } from '../progress/stats';
import { useNutritionDay } from './useNutrition';

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

export function TrendsView() {
  const [period, setPeriod] = useState<7 | 30>(7);
  const today = dayKey();
  const from = addDays(today, -(period - 1));
  const entries = useLiveQuery(() => db.foodEntries.where('day').between(addDays(today, -59), today, true, true).toArray(), [today]);
  const data = useHistory();
  const water = useLiveQuery(() => db.waterEntries.where('day').between(addDays(today, -59), today, true, true).toArray(), [today]);
  const rest = useNutritionDay(today);
  if (!entries || !data || !rest || !water) return null;
  const days = Array.from({ length: period }, (_, i) => addDays(from, i));
  const waterTotals = waterByDay(water);
  const waterValues = days.map((d) => (waterTotals.has(d) ? Math.round((waterTotals.get(d)! / 1000) * 100) / 100 : null));
  const waterLogged = days.filter((d) => waterTotals.has(d));
  const waterAvg = waterLogged.length ? waterLogged.reduce((n, d) => n + waterTotals.get(d)!, 0) / waterLogged.length : null;
  const waterTarget = rest.profile.hydration ? waterGoal(rest.profile.hydration, { strength: false, mma: null }).ml : null;

  const totals = totalsByDay(entries);
  const labels = days.map(shortDate);
  const kcal = days.map((d) => totals.get(d)?.kcal ?? null);
  const prot = days.map((d) => totals.get(d)?.prot ?? null);
  const logged = days.filter((d) => totals.has(d));
  const avg = averageOfLoggedDays(logged.map((d) => totals.get(d)!));

  // Apport moyen glissant sur 7 jours (jours saisis uniquement) vs poids lissé 7 jours.
  const intake7 = days.map((d) => averageOfLoggedDays([...Array(7).keys()].map((k) => totals.get(addDays(d, -k))).filter((t): t is NonNullable<typeof t> => Boolean(t)))?.kcal ?? null);
  const weights = new Map(rollingAverage(weightPoints(data.metrics)).map((p) => [p.day, Math.round(p.value * 10) / 10]));
  const weight7 = days.map((d) => weights.get(d) ?? null);

  const weeks = [0, 1, 2, 3].map((w) => {
    const start = addDays(weekStart(today), -7 * w);
    const ds = [...Array(7).keys()].map((k) => addDays(start, k)).filter((d) => diffDays(today, d) >= 0 && totals.has(d));
    const wd = [...Array(7).keys()].map((k) => addDays(start, k)).filter((d) => diffDays(today, d) >= 0 && waterTotals.has(d));
    return { start, n: ds.length, avg: averageOfLoggedDays(ds.map((d) => totals.get(d)!)), water: wd.length ? wd.reduce((n, d) => n + waterTotals.get(d)!, 0) / wd.length : null };
  });

  return (
    <>
      <Segmented
        ariaLabel="Période"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 7, label: '7 jours' },
          { value: 30, label: '30 jours' },
        ]}
      />
      <section className="card">
        <div className="spread">
          <h3 className="card-h">Eau</h3>
          <span className="num muted">{waterAvg !== null ? `moy. ${liters(waterAvg)}` : 'aucune saisie'}</span>
        </div>
        {waterLogged.length > 0 && (
          <LineChart labels={labels} values={waterValues} unit="L" decimals={2} seriesLabel="Eau" height={150} reference={waterTarget ? { value: waterTarget / 1000, label: 'Objectif (repos)' } : undefined} />
        )}
      </section>
      {logged.length === 0 ? (
        <div className="card">
          <p className="muted">Aucun repas saisi sur cette période : les courbes de calories apparaîtront après quelques jours de suivi.</p>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="spread">
              <h3 className="card-h">Calories</h3>
              <span className="num muted">moy. {avg ? fmt(avg.kcal) : '—'} kcal · {logged.length} j saisi{logged.length > 1 ? 's' : ''}</span>
            </div>
            <LineChart labels={labels} values={kcal} unit="kcal" decimals={0} seriesLabel="Apport" reference={rest.targets ? { value: rest.targets.kcal, label: 'Objectif (aujourd’hui)' } : undefined} />
          </section>
          <section className="card">
            <div className="spread">
              <h3 className="card-h">Protéines</h3>
              <span className="num muted">moy. {avg ? fmt(avg.prot) : '—'} g</span>
            </div>
            <LineChart labels={labels} values={prot} unit="g" decimals={0} seriesLabel="Protéines" reference={rest.targets ? { value: rest.targets.prot, label: 'Objectif' } : undefined} />
          </section>
          <section className="card">
            <h3 className="card-h">Poids lissé (7 j)</h3>
            <LineChart labels={labels} values={weight7} unit="kg" seriesLabel="Poids" height={150} />
            <h3 className="card-h">Apport moyen (7 j)</h3>
            <LineChart labels={labels} values={intake7} unit="kcal" decimals={0} seriesLabel="Apport moyen" height={150} />
            <p className="faint" style={{ fontSize: 13 }}>
              Si le poids lissé ne baisse pas sur 2 à 3 semaines avec cet apport, l'objectif est trop haut pour toi ; s'il baisse trop vite, trop bas.
            </p>
          </section>
        </>
      )}
      <section className="card" style={{ padding: '14px 18px' }}>
        <h3 className="card-h">Moyennes hebdomadaires</h3>
        <div className="summary-table">
          {weeks.map((w) => (
            <div key={w.start}>
              <span>Sem. du {shortDate(w.start)}</span>
              <span className="num muted">{[w.avg ? `${fmt(w.avg.kcal)} kcal · ${fmt(w.avg.prot)} g prot.` : null, w.water !== null ? `${liters(w.water)} d’eau` : null].filter(Boolean).join(' · ') || '—'}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
