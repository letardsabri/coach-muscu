/**
 * Suivi corporel : pesée et mensurations en quelques taps, courbes, historique, photos.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { BodyMetric, Photo, Profile } from '../../db/models';
import { rollingAverage, weightTrend } from '../../engine/body';
import { dayKey } from '../../lib/dates';
import { uuid } from '../../lib/id';
import { LineChart } from '../../ui/charts';
import { Segmented, Sheet, Stepper } from '../../ui/components';
import { kg } from '../../ui/format';
import { useHistory, useProfile } from '../data';
import { metricPoints, shortDate, weightPoints } from '../progress/stats';

type MeasureKey = 'waistCm' | 'chestCm' | 'armCm' | 'thighCm' | 'hipsCm';

const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: 'waistCm', label: 'Tour de taille' },
  { key: 'chestCm', label: 'Poitrine' },
  { key: 'armCm', label: 'Bras (contracté)' },
  { key: 'thighCm', label: 'Cuisse' },
  { key: 'hipsCm', label: 'Hanches' },
];

/** `embedded` : affiché comme sous-onglet de Progrès (sans en-tête ni conteneur d'écran). */
export function Body({ embedded = false }: { embedded?: boolean }) {
  const profile = useProfile();
  const data = useHistory();
  const [entry, setEntry] = useState<'weight' | 'measures' | null>(null);
  const [measure, setMeasure] = useState<MeasureKey>('waistCm');

  if (!profile || !data) return embedded ? null : <main className="screen" />;

  const weights = weightPoints(data.metrics);
  const avg = rollingAverage(weights).slice(-90);
  const trend = weightTrend(weights, programme, profile.goalWeightKg);
  const measurePts = metricPoints(data.metrics, (m) => m[measure]);
  const waistTarget = Math.round(profile.heightCm * programme.body.waistToHeightMax * 10) / 10;
  const latestWaist = metricPoints(data.metrics, (m) => m.waistCm).at(-1);

  const content = (
    <>

      <div className="inputs">
        <button className="btn-primary" onClick={() => setEntry('weight')}>
          + Pesée
        </button>
        <button className="btn-secondary" style={{ minHeight: 60 }} onClick={() => setEntry('measures')}>
          + Mensurations
        </button>
      </div>

      <section className="card">
        <div className="spread">
          <h3 className="card-h">Poids · moyenne 7 jours</h3>
          {trend && <span className="num" style={{ fontWeight: 800 }}>{kg(Math.round(trend.current * 10) / 10)}</span>}
        </div>
        {avg.length >= 2 ? (
          <LineChart
            labels={avg.map((p) => shortDate(p.day))}
            values={avg.map((p) => Math.round(p.value * 10) / 10)}
            unit="kg"
            seriesLabel="Moyenne 7 j"
            reference={{ value: profile.goalWeightKg, label: 'Objectif' }}
          />
        ) : (
          <p className="muted">Pèse-toi 3 à 7 fois par semaine au réveil : la courbe apparaît dès la 2ᵉ pesée.</p>
        )}
        <p className="faint" style={{ fontSize: 13 }}>
          Pointillés : objectif {kg(profile.goalWeightKg)}. Zone conseillée : −{programme.body.lossRatePctPerWeek[0]} à −
          {programme.body.lossRatePctPerWeek[1]} % par semaine.
        </p>
        {trend?.message && (
          <p style={{ fontSize: 14, color: trend.message.tone === 'warn' ? 'var(--warn)' : 'var(--ok)' }}>{trend.message.text}</p>
        )}
      </section>

      <section className="card">
        <h3 className="card-h">Mensurations</h3>
        <div className="chips scroll-x">
          {MEASURES.map((m) => (
            <button key={m.key} className={`chip chip-btn${m.key === measure ? ' chip-accent' : ''}`} onClick={() => setMeasure(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
        {measurePts.length >= 2 ? (
          <LineChart
            labels={measurePts.map((p) => shortDate(p.day))}
            values={measurePts.map((p) => p.value)}
            unit="cm"
            seriesLabel={MEASURES.find((m) => m.key === measure)?.label}
            reference={measure === 'waistCm' ? { value: waistTarget, label: 'Repère santé' } : undefined}
          />
        ) : (
          <p className="muted">{measurePts.length === 1 ? `Une mesure : ${measurePts[0]!.value} cm.` : 'Aucune mesure.'} Mesure toutes les 2 semaines.</p>
        )}
        {measure === 'waistCm' && (
          <p className="faint" style={{ fontSize: 13 }}>
            Repère : tour de taille &lt; {waistTarget} cm (taille ÷ 2).
            {latestWaist && ` Actuel : ${latestWaist.value} cm.`}
          </p>
        )}
      </section>

      <Photos />

      <MetricHistory metrics={data.metrics} />

      {entry && <EntrySheet mode={entry} profile={profile} metrics={data.metrics} onClose={() => setEntry(null)} />}
    </>
  );
  if (embedded) return content;
  return (
    <main className="screen">
      <h1 className="screen-title">Corps</h1>
      {content}
    </main>
  );
}

function EntrySheet(props: { mode: 'weight' | 'measures'; profile: Profile; metrics: BodyMetric[]; onClose: () => void }) {
  const lastWeight = weightPoints(props.metrics).at(-1)?.value ?? props.profile.startWeightKg;
  const lastOf = (k: MeasureKey) => metricPoints(props.metrics, (m) => m[k]).at(-1)?.value;
  const [weight, setWeight] = useState(lastWeight);
  const [values, setValues] = useState<Record<MeasureKey, number>>({
    waistCm: lastOf('waistCm') ?? 90,
    chestCm: lastOf('chestCm') ?? 105,
    armCm: lastOf('armCm') ?? 37,
    thighCm: lastOf('thighCm') ?? 58,
    hipsCm: lastOf('hipsCm') ?? 100,
  });
  const [touched, setTouched] = useState<Set<MeasureKey>>(new Set());

  const save = async () => {
    const day = dayKey();
    const patch: Partial<BodyMetric> =
      props.mode === 'weight' ? { weightKg: weight } : Object.fromEntries([...touched].map((k) => [k, values[k]]));
    // Une ligne par jour : on complète celle du jour si elle existe.
    const existing = await db.bodyMetrics.where('day').equals(day).first();
    if (existing) await db.bodyMetrics.update(existing.id, patch);
    else await db.bodyMetrics.add({ id: uuid(), day, createdAt: Date.now(), ...patch });
    props.onClose();
  };

  return (
    <Sheet title={props.mode === 'weight' ? 'Pesée du jour' : 'Mensurations'} onClose={props.onClose}>
      {props.mode === 'weight' ? (
        <>
          <Stepper label="Poids au réveil" value={weight} onChange={setWeight} step={0.1} min={40} max={200} unit="kg" />
          <p className="faint" style={{ fontSize: 13 }}>Le matin, après les toilettes, avant de manger ou boire.</p>
        </>
      ) : (
        <>
          <p className="faint" style={{ fontSize: 13 }}>Ne sont enregistrées que les mesures modifiées. Mètre ruban horizontal, sans serrer.</p>
          {MEASURES.map((m) => (
            <Stepper
              key={m.key}
              size="md"
              label={m.label}
              value={values[m.key]}
              onChange={(v) => {
                setValues((s) => ({ ...s, [m.key]: v }));
                setTouched((t) => new Set(t).add(m.key));
              }}
              step={0.5}
              min={20}
              max={200}
              unit="cm"
            />
          ))}
        </>
      )}
      <button className="btn-primary" disabled={props.mode === 'measures' && touched.size === 0} onClick={() => void save()}>
        Enregistrer
      </button>
    </Sheet>
  );
}

function MetricHistory({ metrics }: { metrics: BodyMetric[] }) {
  const [all, setAll] = useState(false);
  const sorted = [...metrics].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt - a.createdAt);
  if (sorted.length === 0) return null;
  const shown = all ? sorted : sorted.slice(0, 8);
  return (
    <section className="card" style={{ padding: '14px 18px' }}>
      <h3 className="card-h">Historique</h3>
      <div className="summary-table">
        {shown.map((m) => (
          <div key={m.id}>
            <span>
              <b>{shortDate(m.day)}</b>{' '}
              <span className="muted num">
                {[
                  m.weightKg !== undefined && kg(m.weightKg),
                  m.waistCm !== undefined && `taille ${m.waistCm}`,
                  m.chestCm !== undefined && `poitrine ${m.chestCm}`,
                  m.armCm !== undefined && `bras ${m.armCm}`,
                  m.thighCm !== undefined && `cuisse ${m.thighCm}`,
                  m.hipsCm !== undefined && `hanches ${m.hipsCm}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <button
              className="btn-ghost btn-danger"
              style={{ minHeight: 32 }}
              onClick={() => {
                if (window.confirm('Supprimer cette mesure ?')) void db.bodyMetrics.delete(m.id);
              }}
            >
              Suppr.
            </button>
          </div>
        ))}
      </div>
      {sorted.length > 8 && (
        <button className="btn-ghost" onClick={() => setAll((v) => !v)}>
          {all ? 'Moins' : `Tout afficher (${sorted.length})`}
        </button>
      )}
    </section>
  );
}

function Photos() {
  const photos = useLiveQuery(() => db.photos.orderBy('day').reverse().toArray(), []);
  const [angle, setAngle] = useState<Photo['angle']>('face');
  const [open, setOpen] = useState<Photo | null>(null);
  const urls = useMemo(() => new Map((photos ?? []).map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = async (file: File | undefined) => {
    if (!file) return;
    await db.photos.add({ id: uuid(), day: dayKey(), angle, blob: file, createdAt: Date.now() });
  };

  return (
    <section className="card">
      <div className="spread">
        <h3 className="card-h">Photos</h3>
        <span className="faint" style={{ fontSize: 13 }}>
          stockées sur ce téléphone uniquement
        </span>
      </div>
      <Segmented
        ariaLabel="Angle"
        value={angle}
        onChange={setAngle}
        options={[
          { value: 'face', label: 'Face' },
          { value: 'profil', label: 'Profil' },
          { value: 'dos', label: 'Dos' },
        ]}
      />
      <label className="btn-secondary file-btn">
        + Ajouter une photo
        <input type="file" accept="image/*" onChange={(e) => void add(e.target.files?.[0])} />
      </label>
      {photos && photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setOpen(p)}>
              <img src={urls.get(p.id)} alt={`${p.angle} du ${shortDate(p.day)}`} />
              <span>
                {shortDate(p.day)} · {p.angle}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <Sheet title={`${shortDate(open.day)} · ${open.angle}`} onClose={() => setOpen(null)}>
          <img src={urls.get(open.id)} alt="" style={{ width: '100%', borderRadius: 14 }} />
          <button
            className="btn-secondary btn-danger"
            onClick={async () => {
              if (!window.confirm('Supprimer cette photo ?')) return;
              await db.photos.delete(open.id);
              setOpen(null);
            }}
          >
            Supprimer la photo
          </button>
        </Sheet>
      )}
    </section>
  );
}
