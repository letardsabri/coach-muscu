/**
 * Tableau de bord : la prochaine séance d'abord (un tap pour commencer), puis la semaine,
 * le poids et les performances.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { programme } from '../../data/programme';
import { backupFileName, exportBackup, markBackupDone } from '../../db/backup';
import { db } from '../../db/db';
import { shareOrDownload } from '../../lib/files';
import type { MaxTest, Profile, ProgramState } from '../../db/models';
import { weightTrend } from '../../engine/body';
import { cycleInfo } from '../../engine/cycle';
import { buildPlan, buildTestPlan, type PlannableType } from '../../engine/planner';
import { DEFAULT_READINESS } from '../../engine/readiness';
import { unlockAudio } from '../../lib/device';
import { Recommendations } from '../coach/Recommendations';
import { latestBodyweight, startSession } from '../workout/workoutRepo';
import { buildCalendar, weekStart, weeklyLoadUnits, type CalendarDay } from '../../engine/schedule';
import { addDays, dayKey, diffDays, parseDay, relativeDay } from '../../lib/dates';
import { Delta } from '../../ui/Delta';
import { formatDose, kg, SESSION_LABELS } from '../../ui/format';
import { useHistory, useProfile, useProgramState, type Tab } from '../data';
import { exerciseHistory, weightPoints } from '../progress/stats';
import { StartSheet } from '../workout/StartSheet';

const KEY_LIFTS = [
  { id: 'pullup_pronation', label: 'Tractions' },
  { id: 'dips', label: 'Dips' },
  { id: 'pushup', label: 'Pompes' },
];

export function Home({ onResume, onNavigate }: { onResume: () => void; onNavigate: (t: Tab) => void }) {
  const profile = useProfile();
  const state = useProgramState();
  const data = useHistory();
  const [starting, setStarting] = useState<PlannableType | null>(null);

  if (!profile || !state || !data) return <main className="screen" />;

  const today = dayKey();
  const { weekInCycle, isDeload } = cycleInfo(state, today, programme);
  const phase = programme.phases[state.phase - 1]!;
  const active = data.sessions.find((s) => s.status === 'in_progress');
  const monday = weekStart(today);
  const week = buildCalendar({
    programme,
    profile,
    nextSessionType: state.nextSessionType,
    overrides: data.overrides,
    sessions: data.sessions,
    mma: data.mma,
    from: monday,
    to: addDays(monday, 6),
    today,
  });
  const ahead = buildCalendar({
    programme,
    profile,
    nextSessionType: state.nextSessionType,
    overrides: data.overrides,
    sessions: data.sessions,
    mma: data.mma,
    from: today,
    to: addDays(today, 14),
    today,
  });
  const nextDay = ahead.find((d) => d.planned);
  const type: PlannableType = nextDay?.planned ?? (profile.sessionsPerWeek === 2 ? 'F' : state.nextSessionType);
  const mmaThisWeek = data.mma.filter((m) => diffDays(m.day, monday) >= 0 && diffDays(addDays(monday, 6), m.day) >= 0).length;
  const preview = buildPlan({ programme, profile, state, type, today, lastSets: {}, mmaThisWeek });
  const doneThisWeek = week.reduce((n, d) => n + d.done.length, 0);

  return (
    <main className="screen">
      <div>
        <p className="eyebrow">
          Phase {state.phase} · {phase.name}
        </p>
        <h1 className="screen-title">{profile.firstName ? `Salut ${profile.firstName}` : 'Aujourd’hui'}</h1>
      </div>

      <div className="chips">
        <span className="chip">
          Cycle {state.cycleIndex} · semaine {weekInCycle}/{programme.cycle.weeks}
        </span>
        {isDeload && <span className="chip chip-warn">Deload</span>}
        {profile.ankleMode && <span className="chip">Mode cheville</span>}
        {profile.mmaMode && <span className="chip">MMA actif</span>}
      </div>

      <Recommendations />

      {!active && isDeload && <TestWeekCard state={state} tests={data.tests} />}

      {active ? (
        <section className="card card-accent">
          <p className="eyebrow">Séance en cours</p>
          <h2 className="card-title">{SESSION_LABELS[active.type]}</h2>
          <p className="muted">Ta séance est sauvegardée. Reprends exactement où tu t'es arrêté.</p>
          <button className="btn-primary" onClick={onResume}>
            Reprendre
          </button>
        </section>
      ) : (
        <section className="card card-accent">
          <div className="spread">
            <div>
              <p className="eyebrow" style={{ color: 'var(--accent)' }}>
                {nextDay ? dayLabel(nextDay.day, today) : 'Prochaine séance'}
              </p>
              <h2 className="card-title">{preview.name}</h2>
              <p className="muted">{preview.focus}</p>
            </div>
            <span className="chip chip-accent num">~{preview.estimatedMin} min</span>
          </div>
          <ul className="ex-list">
            {preview.plan.map((pe, i) => (
              <li key={i} className={pe.group ? 'superset' : undefined}>
                <span className="ex-name">{pe.name}</span>
                <span className="ex-dose num">{formatDose(pe)}</span>
              </li>
            ))}
          </ul>
          <button className="btn-primary" onClick={() => setStarting(type)}>
            Commencer
          </button>
          <button className="btn-ghost" onClick={() => setStarting('MIN')}>
            Peu de temps ? Séance minimale (15 min)
          </button>
        </section>
      )}

      <section className="card" onClick={() => onNavigate('calendar')} role="button">
        <div className="spread">
          <h3 className="card-h">Cette semaine</h3>
          <span className="num" style={{ fontWeight: 800 }}>
            {doneThisWeek}/{profile.sessionsPerWeek} séances
          </span>
        </div>
        <WeekStrip days={week} today={today} />
        {profile.mmaMode && (
          <p className="muted num" style={{ fontSize: 14 }}>
            Charge : {weeklyLoadUnits(programme, data.sessions.filter((s) => diffDays(s.day, monday) >= 0), data.mma.filter((m) => diffDays(m.day, monday) >= 0 && diffDays(addDays(monday, 6), m.day) >= 0))}{' '}
            / {programme.mma.budget.startUnits} UC
          </p>
        )}
      </section>

      <BackupReminder completedSessions={data.sessions.filter((s) => s.status === 'completed').length} />

      <WeightCard profile={profile} metrics={data.metrics} onOpen={() => onNavigate('body')} />

      <PerformanceCard profile={profile} state={state} data={data} onOpen={() => onNavigate('progress')} />

      {starting && <StartSheet initialType={starting} suggestedType={state.nextSessionType} onClose={() => setStarting(null)} />}
    </main>
  );
}

/** Semaine de deload : les tests de max remplacent une séance A et une séance B (§11). */
function TestWeekCard({ state, tests }: { state: ProgramState; tests: MaxTest[] }) {
  const [busy, setBusy] = useState(false);
  const weekStartDay = addDays(state.cycleStartedOn, (programme.cycle.deloadWeek - 1) * 7);
  const doneThisCycle = (id: string) => tests.some((t) => t.testId === id && diffDays(t.day, weekStartDay) >= 0);
  const doneA = doneThisCycle('pullup_max');
  const doneB = doneThisCycle('dips_max');
  if (doneA && doneB) return null;

  const start = async (which: 'A' | 'B') => {
    unlockAudio();
    setBusy(true);
    const lastTests: Record<string, number> = {};
    for (const t of [...tests].sort((a, b) => a.day.localeCompare(b.day))) lastTests[t.testId] = t.value;
    const planned = buildTestPlan({ programme, state, which, today: dayKey(), lastTests });
    await startSession({ type: 'TEST', planned, readiness: DEFAULT_READINESS, bodyweightKg: await latestBodyweight(), bodyweightChanged: false });
  };

  return (
    <section className="card">
      <div className="spread">
        <h3 className="card-h">Semaine de tests</h3>
        <span className="chip chip-warn">Deload</span>
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        Chaque test remplace une séance de la semaine. Échauffement complet, puis une seule série au maximum, standard strict. Les
        résultats servent aux critères de passage de phase.
      </p>
      <div className="inputs">
        <button className="btn-secondary" disabled={busy || doneA} onClick={() => void start('A')}>
          {doneA ? '✓ Tractions' : 'Test tractions'}
        </button>
        <button className="btn-secondary" disabled={busy || doneB} onClick={() => void start('B')}>
          {doneB ? '✓ Dips + pompes' : 'Test dips + pompes'}
        </button>
      </div>
    </section>
  );
}

const BACKUP_EVERY_DAYS = 14;

/** Les données ne vivent que sur le téléphone : on rappelle d'exporter une sauvegarde toutes les 2 semaines. */
function BackupReminder({ completedSessions }: { completedSessions: number }) {
  const last = useLiveQuery(() => db.meta.get('lastBackupAt'), []);
  const [busy, setBusy] = useState(false);
  if (last === undefined && completedSessions < 3) return null;
  const lastAt = typeof last?.value === 'number' ? last.value : undefined;
  const ageDays = lastAt ? (Date.now() - lastAt) / 86_400_000 : Infinity;
  if (ageDays < BACKUP_EVERY_DAYS || completedSessions < 3) return null;

  return (
    <section className="card">
      <div className="spread">
        <h3 className="card-h">Sauvegarde conseillée</h3>
        <span className="chip chip-warn">{lastAt ? `${Math.floor(ageDays)} j` : 'jamais'}</span>
      </div>
      <p className="muted" style={{ fontSize: 14 }}>
        Tes données ne sont que sur ce téléphone. Enregistre une copie dans Fichiers → iCloud Drive.
      </p>
      <button
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const backup = await exportBackup(false);
            const file = new File([JSON.stringify(backup)], backupFileName(), { type: 'application/json' });
            if ((await shareOrDownload(file, 'Sauvegarde Coach Muscu')) !== 'cancelled') await markBackupDone();
          } finally {
            setBusy(false);
          }
        }}
      >
        Exporter maintenant
      </button>
    </section>
  );
}

function dayLabel(day: string, today: string): string {
  const n = diffDays(day, today);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  return parseDay(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function WeekStrip({ days, today }: { days: CalendarDay[]; today: string }) {
  return (
    <div className="week-strip">
      {days.map((d) => {
        const done = d.done[d.done.length - 1];
        const label = parseDay(d.day).toLocaleDateString('fr-FR', { weekday: 'narrow' });
        const cls = done ? 'done' : d.missed ? 'missed' : d.planned ? 'planned' : 'rest';
        return (
          <div key={d.day} className={`day-cell ${cls}${d.day === today ? ' today' : ''}`}>
            <span className="day-name">{label}</span>
            <span className="day-mark">{done ? done.type : d.planned ?? (d.missed ? '×' : '·')}</span>
            {d.mma.length > 0 && <span className="mma-dot" aria-label="MMA" />}
          </div>
        );
      })}
    </div>
  );
}

function WeightCard({ profile, metrics, onOpen }: { profile: Profile; metrics: Parameters<typeof weightPoints>[0]; onOpen: () => void }) {
  const points = weightPoints(metrics);
  const trend = weightTrend(points, programme, profile.goalWeightKg);
  const current = trend?.current ?? profile.startWeightKg;
  const total = profile.startWeightKg - profile.goalWeightKg;
  const pct = total > 0 ? Math.min(1, Math.max(0, (profile.startWeightKg - current) / total)) : 0;
  return (
    <section className="card" onClick={onOpen} role="button">
      <div className="spread">
        <h3 className="card-h">Poids</h3>
        <span className="muted num">objectif {kg(profile.goalWeightKg)}</span>
      </div>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <span className="big-number num">{current.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>
        <span className="muted">kg {points.length > 1 ? '· moyenne 7 j' : points.length === 0 ? '· poids de départ' : ''}</span>
      </div>
      <div className="bar" aria-label={`${Math.round(pct * 100)} % de l'objectif`}>
        <div style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="muted num" style={{ fontSize: 14 }}>
        {kg(Math.max(0, Math.round((current - profile.goalWeightKg) * 10) / 10))} restants · {Math.round(pct * 100)} % du chemin
      </p>
      {trend?.message && <p style={{ fontSize: 14, color: trend.message.tone === 'warn' ? 'var(--warn)' : 'var(--ok)' }}>{trend.message.text}</p>}
      {points.length === 0 && <p className="faint" style={{ fontSize: 14 }}>Ajoute une pesée dans l'onglet Corps.</p>}
    </section>
  );
}

function PerformanceCard(props: {
  profile: Profile;
  state: ProgramState;
  data: NonNullable<ReturnType<typeof useHistory>>;
  onOpen: () => void;
}) {
  const { data, profile } = props;
  const completed = data.sessions.filter((s) => s.status === 'completed');
  const today = dayKey();
  return (
    <section className="card" onClick={props.onOpen} role="button">
      <div className="spread">
        <h3 className="card-h">Performances</h3>
        <span className="muted num">{completed.length} séance{completed.length > 1 ? 's' : ''}</span>
      </div>
      {KEY_LIFTS.map(({ id, label }) => {
        const hist = exerciseHistory(programme, completed, data.sets, id, profile.startWeightKg);
        const last = hist[hist.length - 1];
        const first = hist[0];
        const test = data.tests.filter((t) => t.testId === `${id === 'pullup_pronation' ? 'pullup' : id}_max`).sort((a, b) => a.day.localeCompare(b.day));
        const lastTest = test[test.length - 1];
        return (
          <div key={id} className="perf-row">
            <div>
              <b>{label}</b>
              <small className="muted">
                {last ? `${relativeDay(last.day, today)} · meilleure série ${last.bestReps}` : 'pas encore fait'}
                {lastTest ? ` · max ${lastTest.value}` : ''}
              </small>
            </div>
            {first && last && hist.length > 1 ? <Delta from={first.index} to={last.index} /> : <span className="faint">—</span>}
          </div>
        );
      })}
      <p className="faint" style={{ fontSize: 13 }}>Évolution de la force estimée (R5) depuis ta première séance.</p>
    </section>
  );
}
