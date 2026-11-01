/**
 * Hydratation du jour : compteur en un tap (verre, bouteille, quantité perso), annulation,
 * objectif majoré les jours d'entraînement.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { nutritionConfig } from '../../data/nutritionData';
import { db } from '../../db/db';
import type { DayKey, HydrationSettings } from '../../db/models';
import { liters, waterGoal } from '../../engine/hydration';
import type { DaySport } from '../../engine/nutrition';
import { Sheet, Stepper } from '../../ui/components';
import { addWater, undoLastWater, updateHydrationSettings } from './nutritionRepo';

const LABELS: Record<number, string> = { 250: 'Verre', 500: 'Bouteille' };

export function useWaterDay(day: DayKey) {
  return useLiveQuery(() => db.waterEntries.where('day').equals(day).sortBy('createdAt'), [day]);
}

export function HydrationCard({ day, sport, settings }: { day: DayKey; sport: DaySport; settings: HydrationSettings }) {
  const entries = useWaterDay(day);
  const [custom, setCustom] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  if (!entries) return null;

  const total = entries.reduce((n, e) => n + e.ml, 0);
  const goal = waterGoal(settings, sport);
  const pct = Math.min(1, total / goal.ml);
  const show = (t: string) => {
    setFlash(t);
    window.setTimeout(() => setFlash(null), 1600);
  };

  return (
    <section className="card water-card">
      <div className="spread">
        <h3 className="card-h">Hydratation</h3>
        <button className="btn-ghost" style={{ padding: 0, minHeight: 32 }} onClick={() => setEditGoal(true)}>
          Objectif
        </button>
      </div>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <span className="big-number num">{liters(total)}</span>
        <span className="muted num">/ {liters(goal.ml)}</span>
      </div>
      <div className="bar water-bar" aria-label={`${Math.round(pct * 100)} % de l'objectif d'eau`}>
        <div style={{ width: `${pct * 100}%` }} />
      </div>
      {goal.bonusMl > 0 && <small className="faint">Jour d'entraînement : {goal.detail}</small>}
      {total >= goal.ml && <small style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ Objectif atteint</small>}
      <div className="water-buttons">
        {nutritionConfig.hydration.quickMl.map((ml) => (
          <button
            key={ml}
            onClick={async () => {
              await addWater(day, ml);
              show(`+${ml} ml`);
            }}
          >
            <b>+{ml} ml</b>
            <small>{LABELS[ml] ?? ''}</small>
          </button>
        ))}
        <button onClick={() => setCustom(true)}>
          <b>+ Autre</b>
          <small>quantité</small>
        </button>
      </div>
      <div className="spread">
        <button
          className="btn-ghost"
          style={{ padding: 0, minHeight: 36 }}
          disabled={entries.length === 0}
          onClick={async () => {
            const ml = await undoLastWater(day);
            if (ml) show(`−${ml} ml annulés`);
          }}
        >
          Annuler la dernière saisie
        </button>
        {flash && <small className="flash-line">{flash}</small>}
      </div>

      {custom && (
        <CustomWaterSheet
          onClose={() => setCustom(false)}
          onAdd={async (ml) => {
            await addWater(day, ml);
            setCustom(false);
            show(`+${ml} ml`);
          }}
        />
      )}
      {editGoal && <WaterGoalSheet settings={settings} onClose={() => setEditGoal(false)} />}
    </section>
  );
}

function CustomWaterSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (ml: number) => Promise<void> }) {
  const [ml, setMl] = useState(330);
  return (
    <Sheet title="Quantité d'eau" onClose={onClose}>
      <Stepper label="Quantité" value={ml} onChange={setMl} step={nutritionConfig.hydration.customStepMl} min={50} max={2000} unit="ml" />
      <div className="chips">
        {[150, 330, 750, 1000, 1500].map((v) => (
          <button key={v} className={`chip chip-btn${ml === v ? ' chip-accent' : ''}`} onClick={() => setMl(v)}>
            {v >= 1000 ? liters(v) : `${v} ml`}
          </button>
        ))}
      </div>
      <button className="btn-primary" onClick={() => void onAdd(ml)}>
        Ajouter {ml} ml
      </button>
    </Sheet>
  );
}

function WaterGoalSheet({ settings: s, onClose }: { settings: HydrationSettings; onClose: () => void }) {
  const set = (patch: Partial<HydrationSettings>) => void updateHydrationSettings(patch);
  return (
    <Sheet title="Objectif d'hydratation" onClose={onClose}>
      <Stepper label="Objectif de base (jour de repos)" value={s.baseMl} onChange={(v) => set({ baseMl: v })} step={250} min={1000} max={5000} unit="ml" />
      <Stepper size="md" label="En plus un jour de séance" value={s.strengthBonusMl} onChange={(v) => set({ strengthBonusMl: v })} step={250} min={0} max={2000} unit="ml" />
      <Stepper size="md" label="En plus un jour de MMA technique" value={s.mmaTechniqueBonusMl} onChange={(v) => set({ mmaTechniqueBonusMl: v })} step={250} min={0} max={2500} unit="ml" />
      <Stepper size="md" label="En plus un jour de MMA intense" value={s.mmaIntenseBonusMl} onChange={(v) => set({ mmaIntenseBonusMl: v })} step={250} min={0} max={3000} unit="ml" />
      <p className="faint" style={{ fontSize: 13 }}>
        Repère : environ 2,5 L de boissons par jour pour un homme adulte (2 L pour une femme), l'alimentation apportant le reste. Ajoute
        0,5 à 1 L par heure d'effort intense, davantage s'il fait chaud. Une urine claire est un bon indicateur.
      </p>
    </Sheet>
  );
}
