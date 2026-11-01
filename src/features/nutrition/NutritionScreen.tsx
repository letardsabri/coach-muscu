/**
 * Onglet Nutrition : vue du jour (résumé + repas) et tendances.
 * Ton neutre : un dépassement s'affiche sans couleur d'alerte ; on met en avant les protéines et la régularité.
 */
import { lazy, Suspense, useState } from 'react';
import { nutritionConfig } from '../../data/nutritionData';
import type { DayKey, FoodEntry, MealId } from '../../db/models';
import { sum, type Targets } from '../../engine/nutrition';
import { addDays, dayKey, diffDays, parseDay } from '../../lib/dates';
import { Segmented, Sheet } from '../../ui/components';
import { AddFoodSheet, EditEntrySheet } from './AddFoodSheet';
import { GoalsSheet } from './GoalsSheet';
import { copyEntries, previousDay, saveMealTemplate } from './nutritionRepo';
import { useNutritionDay } from './useNutrition';
import { db } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

const TrendsView = lazy(() => import('./TrendsView').then((m) => ({ default: m.TrendsView })));

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

export function dayTitle(day: DayKey, today: DayKey = dayKey()): string {
  const n = diffDays(day, today);
  if (n === 0) return "Aujourd'hui";
  if (n === -1) return 'Hier';
  if (n === 1) return 'Demain';
  const s = parseDay(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function NutritionScreen() {
  const [view, setView] = useState<'jour' | 'tendances'>('jour');
  const [day, setDay] = useState<DayKey>(dayKey());
  return (
    <main className="screen">
      <h1 className="screen-title">Nutrition</h1>
      <Segmented
        ariaLabel="Vue"
        value={view}
        onChange={setView}
        options={[
          { value: 'jour', label: 'Jour' },
          { value: 'tendances', label: 'Tendances' },
        ]}
      />
      {view === 'jour' ? (
        <DayView day={day} setDay={setDay} />
      ) : (
        <Suspense fallback={null}>
          <TrendsView />
        </Suspense>
      )}
    </main>
  );
}

function DayView({ day, setDay }: { day: DayKey; setDay: (d: DayKey) => void }) {
  const data = useNutritionDay(day);
  const yesterdayCount = useLiveQuery(() => db.foodEntries.where('day').equals(previousDay(day)).count(), [day]);
  const [adding, setAdding] = useState<MealId | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [goals, setGoals] = useState(false);
  const [mealMenu, setMealMenu] = useState<MealId | null>(null);
  if (!data) return null;
  const { entries, totals, targets, settings } = data;

  return (
    <>
      <div className="spread day-nav">
        <button className="btn-ghost" aria-label="Jour précédent" onClick={() => setDay(addDays(day, -1))}>
          ‹
        </button>
        <button className="day-title" onClick={() => setDay(dayKey())}>
          {dayTitle(day)}
        </button>
        <button className="btn-ghost" aria-label="Jour suivant" onClick={() => setDay(addDays(day, 1))}>
          ›
        </button>
      </div>

      <SummaryCard totals={totals} targets={targets} onGoals={() => setGoals(true)} sportNote={sportNote(data.sport)} />

      {entries.length === 0 && (yesterdayCount ?? 0) > 0 && (
        <button
          className="btn-secondary"
          onClick={async () => {
            await copyEntries(previousDay(day), day);
          }}
        >
          Copier toute la journée de la veille ({yesterdayCount} aliments)
        </button>
      )}

      {nutritionConfig.meals.map((m) => {
        const mealId = m.id as MealId;
        const items = entries.filter((e) => e.meal === mealId);
        const t = sum(items);
        return (
          <section key={m.id} className="card meal-card">
            <div className="spread">
              <button className="meal-head" onClick={() => setMealMenu(mealId)}>
                <h3 className="card-h">{m.label}</h3>
                <span className="muted num">{items.length ? `${fmt(t.kcal)} kcal · ${fmt(t.prot)} g prot.` : '—'}</span>
              </button>
              <button className="add-btn" aria-label={`Ajouter au ${m.label.toLowerCase()}`} onClick={() => setAdding(mealId)}>
                +
              </button>
            </div>
            {items.map((e) => (
              <button key={e.id} className="entry-row" onClick={() => setEditing(e)}>
                <span>
                  {e.nom}
                  <small className="muted num">
                    {e.portion ? `${e.portion.count.toLocaleString('fr-FR')} × ${e.portion.label}` : e.grams ? `${e.grams} g` : 'saisie libre'}
                  </small>
                </span>
                <span className="num entry-kcal">
                  {fmt(e.kcal)}
                  <small> kcal</small>
                </span>
              </button>
            ))}
          </section>
        );
      })}

      {adding && <AddFoodSheet day={day} meal={adding} onClose={() => setAdding(null)} />}
      {editing && <EditEntrySheet entry={editing} onClose={() => setEditing(null)} />}
      {goals && settings && <GoalsSheet settings={settings} targets={targets} weightKg={data.weightKg} onClose={() => setGoals(false)} />}
      {mealMenu && (
        <MealMenu
          day={day}
          meal={mealMenu}
          entries={entries.filter((e) => e.meal === mealMenu)}
          onClose={() => setMealMenu(null)}
        />
      )}
    </>
  );
}

function sportNote(sport: { strength: boolean; mma: 'technique' | 'intense' | null }): string | null {
  const parts = [sport.strength && 'séance', sport.mma && `MMA ${sport.mma}`].filter(Boolean);
  return parts.length ? `Jour d'entraînement (${parts.join(' + ')}) : objectif ajusté` : null;
}

function SummaryCard(props: { totals: ReturnType<typeof sum>; targets: Targets | null; onGoals: () => void; sportNote: string | null }) {
  const { totals, targets } = props;
  if (!targets) {
    return (
      <section className="card card-accent">
        <h3 className="card-h">Tes objectifs</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          Pour calculer ton objectif calorique, renseigne ton profil nutrition (sexe et niveau d'activité). Tu peux aussi fixer tes objectifs à la
          main.
        </p>
        <p className="num" style={{ fontWeight: 700 }}>
          Aujourd'hui : {fmt(totals.kcal)} kcal · {fmt(totals.prot)} g de protéines
        </p>
        <button className="btn-primary" onClick={props.onGoals}>
          Régler mes objectifs
        </button>
      </section>
    );
  }
  const diff = targets.kcal - totals.kcal;
  const frac = Math.min(1, totals.kcal / targets.kcal);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <section className="card summary-card">
      <div className="summary-top">
        <div className="kcal-ring">
          <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden>
            <circle cx="64" cy="64" r={r} stroke="var(--surface-3)" strokeWidth="10" fill="none" />
            <circle
              cx="64"
              cy="64"
              r={r}
              stroke={diff >= 0 ? 'var(--accent)' : 'var(--text-2)'}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - frac)}
            />
          </svg>
          <span className="ring-center">
            <b className="num">{fmt(Math.abs(diff))}</b>
            <small>{diff >= 0 ? 'restantes' : 'au-dessus'}</small>
          </span>
        </div>
        <div className="summary-side">
          <p className="num">
            <b>{fmt(totals.kcal)}</b> <span className="muted">/ {fmt(targets.kcal)} kcal</span>
          </p>
          <MacroBar label="Protéines" value={totals.prot} target={targets.prot} highlight />
          <MacroBar label="Glucides" value={totals.gluc} target={targets.gluc} />
          <MacroBar label="Lipides" value={totals.lip} target={targets.lip} />
        </div>
      </div>
      {totals.prot >= targets.prot && <p style={{ fontSize: 14, color: 'var(--ok)' }}>✓ Objectif protéines atteint.</p>}
      {diff < 0 && (
        <p className="muted" style={{ fontSize: 14 }}>
          {fmt(-diff)} kcal au-dessus de l'objectif aujourd'hui. Ce qui compte, c'est la moyenne de la semaine.
        </p>
      )}
      <div className="spread">
        <small className="faint">{props.sportNote ?? 'Jour de repos'}</small>
        <button className="btn-ghost" style={{ padding: 0 }} onClick={props.onGoals}>
          Objectifs
        </button>
      </div>
    </section>
  );
}

function MacroBar(props: { label: string; value: number; target: number; highlight?: boolean }) {
  const pct = props.target > 0 ? Math.min(1, props.value / props.target) : 0;
  return (
    <div className="macro">
      <div className="spread">
        <small style={{ fontWeight: props.highlight ? 700 : 600 }}>{props.label}</small>
        <small className="num muted">
          {fmt(props.value)} / {fmt(props.target)} g
        </small>
      </div>
      <div className={`bar${props.highlight ? '' : ' bar-soft'}`}>
        <div style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function MealMenu(props: { day: DayKey; meal: MealId; entries: FoodEntry[]; onClose: () => void }) {
  const yesterday = useLiveQuery(() => db.foodEntries.where('[day+meal]').equals([previousDay(props.day), props.meal]).count(), [props.day, props.meal]);
  const [name, setName] = useState('');
  const label = nutritionConfig.meals.find((m) => m.id === props.meal)?.label ?? '';
  return (
    <Sheet title={label} onClose={props.onClose}>
      <div className="menu-list">
        <button
          disabled={!yesterday}
          onClick={async () => {
            await copyEntries(previousDay(props.day), props.day, props.meal);
            props.onClose();
          }}
        >
          Copier le {label.toLowerCase()} de la veille {yesterday ? `(${yesterday})` : '(vide)'}
        </button>
      </div>
      {props.entries.length > 0 && (
        <>
          <label className="field">
            <span>Enregistrer ce repas comme repas type</span>
            <input type="text" value={name} placeholder="Ex. Petit-déj habituel" onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            className="btn-secondary"
            disabled={!name.trim()}
            onClick={async () => {
              await saveMealTemplate(name.trim(), props.entries);
              props.onClose();
            }}
          >
            Enregistrer le repas type ({props.entries.length} aliments)
          </button>
        </>
      )}
    </Sheet>
  );
}
