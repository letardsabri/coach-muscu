/**
 * Suivi des performances : force estimée par exercice, volume hebdomadaire par muscle,
 * tests de max et historique des séances.
 */
import { useState } from 'react';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { Profile, Session, SetLog } from '../../db/models';
import { weekStart } from '../../engine/schedule';
import { addDays, dayKey, formatClock } from '../../lib/dates';
import { uuid } from '../../lib/id';
import { BarChart, Delta, LineChart } from '../../ui/charts';
import { Segmented, Sheet, Stepper } from '../../ui/components';
import { formatLoad, SESSION_LABELS } from '../../ui/format';
import { useHistory, useProfile } from '../data';
import { Body } from '../body/Body';
import { evaluatePhaseNow } from '../coach/coachRepo';
import { PhaseCriteria } from '../coach/PhaseCriteria';
import { deleteSession, latestBodyweight } from '../workout/workoutRepo';
import { exerciseHistory, GROUP_ORDER, groupBy, shortDate, weeklyVolume } from './stats';

export type ProgressView = 'force' | 'volume' | 'tests' | 'history' | 'corps';
type View = ProgressView;

const TRACKED = [
  'pullup_pronation',
  'pullup_supination',
  'dips',
  'pushup',
  'curl',
  'lateral_raise',
  'hanging_knee_raise',
  'lsit',
  'weighted_crunch',
  'side_plank',
];

export function Progress({ initialView = 'force' }: { initialView?: View }) {
  const profile = useProfile();
  const data = useHistory();
  const [view, setView] = useState<View>(initialView);

  if (!profile || !data) return <main className="screen" />;
  const completed = data.sessions.filter((s) => s.status === 'completed');
  // L'historique montre aussi les séances abandonnées, pour pouvoir les supprimer.
  const finished = data.sessions.filter((s) => s.status !== 'in_progress');

  return (
    <main className="screen">
      <h1 className="screen-title">Progrès</h1>
      <Segmented
        ariaLabel="Vue"
        value={view}
        onChange={setView}
        options={[
          { value: 'force', label: 'Force' },
          { value: 'volume', label: 'Volume' },
          { value: 'tests', label: 'Max' },
          { value: 'history', label: 'Séances' },
          { value: 'corps', label: 'Corps' },
        ]}
      />
      {view === 'corps' && <Body embedded />}
      {(view === 'force' || view === 'volume') && completed.length === 0 && (
        <div className="card">
          <p className="muted">Termine une première séance : tes courbes apparaîtront ici.</p>
        </div>
      )}
      {view === 'force' && completed.length > 0 && <ForceView profile={profile} sessions={completed} sets={data.sets} />}
      {view === 'volume' && completed.length > 0 && <VolumeView sets={data.sets} />}
      {view === 'history' &&
        (finished.length === 0 ? (
          <div className="card">
            <p className="muted">Aucune séance enregistrée pour l'instant.</p>
          </div>
        ) : (
          <HistoryView sessions={finished} sets={data.sets} />
        ))}
      {view === 'tests' && <TestsView tests={data.tests} />}
    </main>
  );
}

function ForceView({ profile, sessions, sets }: { profile: Profile; sessions: Session[]; sets: SetLog[] }) {
  const [exerciseId, setExerciseId] = useState(TRACKED[0]!);
  const [relative, setRelative] = useState(true);
  const ex = programme.exercises[exerciseId]!;
  const hist = exerciseHistory(programme, sessions, sets, exerciseId, profile.startWeightKg);
  const labels = hist.map((h) => shortDate(h.day));
  // Force relative = e1RM ÷ poids du corps : à reps égales, elle ne baisse pas quand tu maigris.
  const canRelative = ex.loadType === 'bodyweight';
  const showRelative = canRelative && relative;
  const values = hist.map((h) => (showRelative ? Math.round((h.index / h.bodyweightKg) * 100) / 100 : Math.round(h.index * 10) / 10));
  const first = values[0];
  const last = values[values.length - 1];

  return (
    <>
      <div className="chips scroll-x">
        {TRACKED.map((id) => (
          <button key={id} className={`chip chip-btn${id === exerciseId ? ' chip-accent' : ''}`} onClick={() => setExerciseId(id)}>
            {programme.exercises[id]?.shortName}
          </button>
        ))}
      </div>

      {hist.length === 0 ? (
        <div className="card">
          <p className="muted">Pas encore de séance avec {ex.name.toLowerCase()}.</p>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="spread">
              <h3 className="card-h">{showRelative ? 'Force relative' : 'Force estimée'}</h3>
              {first !== undefined && last !== undefined && hist.length > 1 && <Delta from={first} to={last} />}
            </div>
            {canRelative && (
              <Segmented
                ariaLabel="Mode"
                value={relative ? 'rel' : 'abs'}
                onChange={(v) => setRelative(v === 'rel')}
                options={[
                  { value: 'rel', label: 'Relative', hint: '× poids du corps' },
                  { value: 'abs', label: 'Absolue', hint: 'kg' },
                ]}
              />
            )}
            <LineChart
              labels={labels}
              values={values}
              unit={showRelative ? '× PDC' : ex.loadType === 'reps' ? '' : 'kg'}
              decimals={showRelative ? 2 : 1}
              seriesLabel={showRelative ? 'Relative' : 'e1RM'}
            />
            <p className="faint" style={{ fontSize: 13 }}>
              {ex.loadType === 'reps'
                ? 'Meilleure série × difficulté de la variante.'
                : showRelative
                  ? 'e1RM ÷ poids du corps. À répétitions égales, elle reste stable quand tu perds du poids et monte dès que tu progresses.'
                  : 'e1RM (R5) : intègre poids du corps, lest, variante et RIR. Baisse si tu maigris à reps égales.'}
            </p>
          </section>

          <section className="card">
            <h3 className="card-h">Meilleure série ({ex.unit === 'sec' ? 'secondes' : 'reps'})</h3>
            <LineChart
              labels={labels}
              values={hist.map((h) => h.bestReps)}
              unit={ex.unit === 'sec' ? 's' : 'reps'}
              decimals={0}
              seriesLabel={ex.unit === 'sec' ? 'Maintien' : 'Reps'}
            />
          </section>

          {(ex.loadType === 'dumbbell' || hist.some((h) => h.loadKg > 0)) && (
            <section className="card">
              <h3 className="card-h">{ex.loadType === 'dumbbell' ? 'Charge (haltère)' : 'Lest'}</h3>
              <LineChart labels={labels} values={hist.map((h) => h.loadKg)} unit="kg" seriesLabel="Charge" />
            </section>
          )}
        </>
      )}
    </>
  );
}

function VolumeView({ sets }: { sets: SetLog[] }) {
  const [group, setGroup] = useState('Dos');
  const weeks = 12;
  const from = addDays(weekStart(dayKey()), -7 * (weeks - 1));
  const vol = weeklyVolume(programme, sets, from, weeks);
  const values = vol.map((w) => w.groups[group] ?? 0);
  const current = values[values.length - 1] ?? 0;

  return (
    <>
      <div className="chips scroll-x">
        {GROUP_ORDER.map((g) => (
          <button key={g} className={`chip chip-btn${g === group ? ' chip-accent' : ''}`} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      <section className="card">
        <div className="spread">
          <h3 className="card-h">Séries par semaine · {group}</h3>
          <span className="num" style={{ fontWeight: 800 }}>
            {current.toLocaleString('fr-FR')} cette sem.
          </span>
        </div>
        <BarChart labels={vol.map((w) => shortDate(w.week))} values={values} unit="séries" seriesLabel={group} />
        <p className="faint" style={{ fontSize: 13 }}>
          Repère hypertrophie : 10–20 séries/semaine pour les groupes prioritaires. 1 série pour le muscle principal, 0,5 pour un
          muscle secondaire.
        </p>
      </section>
      <section className="card">
        <h3 className="card-h">Cette semaine</h3>
        <div className="summary-table">
          {GROUP_ORDER.map((g) => (
            <div key={g}>
              <span>{g}</span>
              <span className="num" style={{ fontWeight: 700 }}>
                {(vol[vol.length - 1]?.groups[g] ?? 0).toLocaleString('fr-FR')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

const TEST_EXPLAIN = 'Protocole §11 : après échauffement, frais, standard strict. Idéalement en semaine de deload.';

function TestsView({ tests }: { tests: { id: string; testId: string; day: string; value: number }[] }) {
  const [adding, setAdding] = useState(false);
  const byTest = groupBy(tests, (t) => t.testId);
  return (
    <>
      <PhaseCriteria />
      {programme.tests
        .filter((t) => !t.optional)
        .map((t) => {
          const list = (byTest.get(t.id) ?? []).sort((a, b) => a.day.localeCompare(b.day));
          const last = list[list.length - 1];
          return (
            <section key={t.id} className="card">
              <div className="spread">
                <h3 className="card-h">{t.name}</h3>
                <span className="big-number num" style={{ fontSize: 26 }}>
                  {last ? last.value : '—'}
                </span>
              </div>
              {list.length > 1 && (
                <LineChart labels={list.map((x) => shortDate(x.day))} values={list.map((x) => x.value)} unit="reps" decimals={0} height={150} seriesLabel="Max" />
              )}
              {list.length === 1 && <p className="faint">Test du {shortDate(list[0]!.day)}. La courbe apparaît au 2ᵉ test.</p>}
            </section>
          );
        })}
      <button className="btn-secondary" onClick={() => setAdding(true)}>
        Enregistrer un test de max
      </button>
      <p className="faint" style={{ fontSize: 13 }}>{TEST_EXPLAIN}</p>
      {adding && <AddTestSheet onClose={() => setAdding(false)} />}
    </>
  );
}

function AddTestSheet({ onClose }: { onClose: () => void }) {
  const options = programme.tests.filter((t) => !t.optional);
  const [testId, setTestId] = useState(options[0]!.id);
  const [value, setValue] = useState(8);
  const save = async () => {
    const bodyweightKg = await latestBodyweight();
    await db.maxTests.add({ id: uuid(), testId, day: dayKey(), value, loadKg: 0, bodyweightKg, createdAt: Date.now() });
    await evaluatePhaseNow(); // R7 : un nouveau test peut remplir les critères de passage
    onClose();
  };
  return (
    <Sheet title="Test de max" onClose={onClose}>
      <Segmented
        ariaLabel="Test"
        value={testId}
        onChange={setTestId}
        options={options.map((t) => ({ value: t.id, label: programme.exercises[t.exerciseId]?.shortName ?? t.name }))}
      />
      <Stepper label="Répétitions strictes" value={value} onChange={setValue} step={1} min={0} max={100} />
      <button className="btn-primary" onClick={() => void save()}>
        Enregistrer
      </button>
    </Sheet>
  );
}

function HistoryView({ sessions, sets }: { sessions: Session[]; sets: SetLog[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const bySession = groupBy(sets, (s) => s.sessionId);
  const list = [...sessions].reverse().slice(0, 60);
  return (
    <section className="card" style={{ padding: '6px 18px' }}>
      <div className="summary-table">
        {list.map((s) => {
          const own = bySession.get(s.id) ?? [];
          const duration = s.endedAt ? (s.endedAt - s.startedAt) / 1000 : 0;
          return (
            <div key={s.id} style={{ flexDirection: 'column', gap: 6 }}>
              <button className="spread" style={{ width: '100%', minHeight: 44, textAlign: 'left' }} onClick={() => setOpen(open === s.id ? null : s.id)}>
                <span>
                  <b>{shortDate(s.day)}</b> · {SESSION_LABELS[s.type]}
                  {s.isDeload && ' · deload'}
                  {s.status === 'abandoned' && <span className="faint"> · abandonnée</span>}
                </span>
                <span className="muted num">
                  {own.length} séries · {formatClock(duration)}
                </span>
              </button>
              {open === s.id && (
                <div className="muted num" style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 }}>
                  {s.plan.map((pe, i) => {
                    const ex = own.filter((x) => x.exerciseIndex === i).sort((a, b) => a.setIndex - b.setIndex);
                    if (ex.length === 0) return null;
                    const load = formatLoad(pe.loadInput, ex[ex.length - 1]!.loadKg);
                    return (
                      <span key={i}>
                        {pe.name} : {ex.map((x) => x.reps + (x.negatives ? `+${x.negatives}n` : '')).join(' · ')}
                        {load && ` @ ${load}`}
                        {s.results[i]?.feeling && ` · ${s.results[i]!.feeling}`}
                      </span>
                    );
                  })}
                  <button
                    className="btn-ghost btn-danger"
                    style={{ alignSelf: 'flex-start', padding: 0 }}
                    onClick={async () => {
                      if (!window.confirm(`Supprimer définitivement la séance du ${shortDate(s.day)} et ses ${own.length} séries ?`)) return;
                      await deleteSession(s.id);
                      setOpen(null);
                    }}
                  >
                    Supprimer cette séance
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
