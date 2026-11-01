/**
 * Avant de commencer : forme du jour (R6) en 10 secondes, pré-remplie à « normal ».
 * Le plan affiché se recalcule en direct avec les ajustements qu'elle entraîne.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { Readiness, SetLog } from '../../db/models';
import { buildPlan, type PlannableType } from '../../engine/planner';
import { DEFAULT_READINESS } from '../../engine/readiness';
import { weekStart } from '../../engine/schedule';
import { addDays, dayKey } from '../../lib/dates';
import { unlockAudio } from '../../lib/device';
import { Scale, Segmented, Sheet, Stepper, Toggle } from '../../ui/components';
import { ADJUSTMENT_LABELS, formatDose } from '../../ui/format';
import { lastCompletedSession, lastExposures, latestBodyweight, startSession } from './workoutRepo';

interface Loaded {
  lastSets: Record<string, SetLog[]>;
  lastSessionDay?: string;
  bodyweight: number;
  mmaThisWeek: number;
}

export function StartSheet(props: { initialType: PlannableType; suggestedType: 'A' | 'B'; onClose: () => void }) {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const state = useLiveQuery(() => db.programState.get('current'), []);
  const [type, setType] = useState<PlannableType>(props.initialType);
  const [readiness, setReadiness] = useState<Readiness>(DEFAULT_READINESS);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const monday = weekStart(dayKey());
      const [lastSets, last, bodyweight, mmaThisWeek] = await Promise.all([
        lastExposures(Object.keys(programme.exercises)),
        lastCompletedSession(),
        latestBodyweight(),
        db.mmaSessions.where('day').between(monday, addDays(monday, 6), true, true).count(),
      ]);
      setLoaded({ lastSets, lastSessionDay: last?.day, bodyweight, mmaThisWeek });
      setWeight(bodyweight);
    })();
  }, []);

  const planned = useMemo(() => {
    if (!profile || !state || !loaded) return null;
    return buildPlan({
      programme,
      profile,
      state,
      type,
      today: dayKey(),
      readiness,
      lastSessionDay: loaded.lastSessionDay,
      lastSets: loaded.lastSets,
      mmaThisWeek: loaded.mmaThisWeek,
    });
  }, [profile, state, loaded, type, readiness]);

  if (!profile || !planned || weight === null || !loaded) return null;

  const patch = (p: Partial<Readiness>) => setReadiness((r) => ({ ...r, ...p }));
  const ankleWarning = !profile.ankleMode && readiness.anklePain >= programme.rules.R6.ankleReactivatePain;

  const start = async () => {
    unlockAudio(); // geste utilisateur : autorise le son de fin de repos sur iOS
    setBusy(true);
    try {
      await startSession({
        type,
        planned,
        readiness,
        bodyweightKg: weight,
        bodyweightChanged: Math.abs(weight - loaded.bodyweight) >= 0.05,
      });
    } finally {
      setBusy(false);
    }
  };

  const reactivateAnkle = () =>
    db.profile.update('me', { ankleMode: true, ankleHealedOn: undefined, updatedAt: Date.now() });

  return (
    <Sheet title="Forme du jour" onClose={props.onClose}>
      <Segmented
        ariaLabel="Type de séance"
        value={type}
        onChange={setType}
        options={[
          { value: 'A', label: 'A', hint: props.suggestedType === 'A' ? 'prévue' : 'Tirage' },
          { value: 'B', label: 'B', hint: props.suggestedType === 'B' ? 'prévue' : 'Poussée' },
          { value: 'F', label: 'F', hint: 'Full body' },
          { value: 'MIN', label: 'Min', hint: '15 min' },
        ]}
      />

      <Scale label="Sommeil" low="mauvais" high="excellent" value={readiness.sleep} onChange={(v) => patch({ sleep: v as Readiness['sleep'] })} />
      <Scale label="Énergie" low="vide" high="au top" value={readiness.energy} onChange={(v) => patch({ energy: v as Readiness['energy'] })} />
      <Scale
        label="Courbatures"
        low="aucune"
        high="fortes"
        value={readiness.soreness}
        onChange={(v) => patch({ soreness: v as Readiness['soreness'] })}
      />
      <Scale label="Douleur cheville" low="0" high="10" min={0} max={10} value={readiness.anklePain} onChange={(v) => patch({ anklePain: v })} />

      {ankleWarning && (
        <div className="card">
          <p className="notes">Douleur cheville ≥ {programme.rules.R6.ankleReactivatePain}/10 alors que le mode cheville est désactivé.</p>
          <button className="btn-secondary" onClick={reactivateAnkle}>
            Réactiver le mode cheville
          </button>
        </div>
      )}

      {profile.mmaMode && (
        <Toggle label="MMA intense dans les 24 h" checked={readiness.mmaHardWithin24h} onChange={(v) => patch({ mmaHardWithin24h: v })} />
      )}

      <Stepper label="Poids ce matin (optionnel)" value={weight} onChange={setWeight} step={0.1} min={40} max={200} unit="kg" size="md" />

      <div className="card">
        <div className="spread">
          <h3 style={{ fontWeight: 800 }}>{planned.name}</h3>
          <span className="chip num">~{planned.estimatedMin} min</span>
        </div>
        {planned.adjustments.length > 0 && (
          <div className="chips">
            {planned.adjustments.map((a) => (
              <span key={a} className={a === 'ankle_mode' ? 'chip' : 'chip chip-warn'}>
                {ADJUSTMENT_LABELS[a]}
              </span>
            ))}
          </div>
        )}
        {planned.notes.length > 0 && (
          <div className="notes">
            {planned.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        )}
        <ul className="ex-list">
          {planned.plan.map((pe, i) => (
            <li key={i} className={pe.group ? 'superset' : undefined}>
              <span className="ex-name">
                {pe.name}
                <small>{pe.variantName}</small>
              </span>
              <span className="ex-dose num">{formatDose(pe)}</span>
            </li>
          ))}
        </ul>
      </div>

      <button className="btn-primary" disabled={busy} onClick={() => void start()}>
        C'est parti
      </button>
    </Sheet>
  );
}
