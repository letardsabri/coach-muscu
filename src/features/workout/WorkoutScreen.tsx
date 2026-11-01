/**
 * Mode entraînement — priorité absolue de l'app.
 *
 * Principes :
 * - Un seul geste par série : reps et charge sont pré-remplis, on valide.
 * - La position dans la séance se déduit des séries enregistrées : rien à « reprendre » manuellement.
 * - Le repos se compte à partir d'un horodatage (`restEndsAt`), jamais d'un compteur.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { PlannedExercise, Profile, Session, SetLog } from '../../db/models';
import { buildSequence, nextStep, stepAfter, stepKey, type Step } from '../../engine/sequence';
import { formatClock } from '../../lib/dates';
import { playRestEnd, unlockAudio, useNow, useWakeLock } from '../../lib/device';
import { cancelRestPush, scheduleRestPush } from '../../lib/push';
import { Sheet, Stepper } from '../../ui/components';
import { FEELINGS, formatLoad, formatRange, kg, unitLabel } from '../../ui/format';
import {
  abandonSession,
  deleteSession,
  finishSession,
  lastExposures,
  logSet,
  reportJointPain,
  setFeeling,
  shiftRest,
  skipExercise,
  skipRest,
  undoLastSet,
  type SetValues,
} from './workoutRepo';

export function WorkoutScreen({ sessionId, onPause }: { sessionId: string; onPause: () => void }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sessionId).sortBy('completedAt'), [sessionId]);
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const [history, setHistory] = useState<Record<string, SetLog[]>>({});
  const [sheet, setSheet] = useState<null | 'menu' | 'pain'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [goUntil, setGoUntil] = useState(0);
  const alertedFor = useRef<number | undefined>(undefined);
  const now = useNow(250);
  const wakeLockActive = useWakeLock(true);

  const exerciseIds = session?.plan.map((pe) => pe.exerciseId).join(',');
  useEffect(() => {
    if (!exerciseIds) return;
    void lastExposures([...new Set(exerciseIds.split(','))], sessionId).then(setHistory);
  }, [exerciseIds, sessionId]);

  // Fin de repos : son + flash, une seule fois par repos, et seulement si on la voit « en direct ».
  const restEndsAt = session?.restEndsAt;
  useEffect(() => {
    if (restEndsAt === undefined || alertedFor.current === restEndsAt || now < restEndsAt) return;
    alertedFor.current = restEndsAt;
    if (now - restEndsAt < 30_000) {
      if (profile?.soundOn !== false) playRestEnd();
      setGoUntil(now + 4000);
    }
  }, [now, restEndsAt, profile?.soundOn]);

  // Notification « Repos terminé » si l'app est quittée pendant un repos (programmée en partant,
  // annulée au retour : dans l'app, c'est le chrono et le son qui prennent le relais).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (restEndsAt !== undefined && restEndsAt - Date.now() > 3000) void scheduleRestPush(restEndsAt);
      } else void cancelRestPush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [restEndsAt]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!session || !sets || !profile) return <div className="workout" />;

  const steps = buildSequence(session.plan);
  const done = new Set(sets.map((s) => stepKey(s.exerciseIndex, s.setIndex)));
  const skipped = new Set(session.results.flatMap((r, i) => (r?.skipped ? [i] : [])));
  const current = nextStep(steps, done, skipped);
  const active = steps.filter((s) => !skipped.has(s.exerciseIndex));
  const progress = active.length ? active.filter((s) => done.has(stepKey(s.exerciseIndex, s.setIndex))).length / active.length : 1;
  const resting = restEndsAt !== undefined && restEndsAt > now;
  const elapsed = (now - session.startedAt) / 1000;

  const pendingFeeling = session.plan.findIndex(
    (pe, i) =>
      !pe.testId && !skipped.has(i) && !session.results[i]?.feeling && sets.filter((s) => s.exerciseIndex === i).length >= pe.sets,
  );

  const validate = async (step: Step, v: SetValues) => {
    unlockAudio();
    const hasNext = stepAfter(steps, step, done, skipped) !== undefined;
    await logSet(session, step, v, hasNext);
  };

  const confirmAbandon = async () => {
    setSheet(null);
    if (window.confirm('Abandonner la séance ? Les séries faites restent dans l’historique.')) await abandonSession(session.id);
  };

  const confirmDelete = async () => {
    setSheet(null);
    if (window.confirm('Supprimer définitivement cette séance et toutes ses séries ? (séance d’essai, erreur…)')) {
      await deleteSession(session.id);
    }
  };

  return (
    <div className="workout">
      <header className="workout-top">
        <button className="btn-ghost" onClick={onPause}>
          Pause
        </button>
        <div className="title">
          {session.plan.length > 0 && sessionTitle(session)}
          <small className="num">{formatClock(elapsed)}</small>
        </div>
        <button className="btn-ghost" aria-label="Options de la séance" onClick={() => setSheet('menu')}>
          •••
        </button>
      </header>
      <div className="progress" aria-hidden>
        <div style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {current ? (
        <ExerciseView
          key={stepKey(current.exerciseIndex, current.setIndex)}
          session={session}
          sets={sets}
          step={current}
          profile={profile}
          history={history}
          resting={resting}
          now={now}
          goVisible={goUntil > now}
          pendingFeeling={pendingFeeling}
          onValidate={validate}
          onUndo={() => void undoLastSet(session.id)}
          onSkip={() => void skipExercise(session.id, current.exerciseIndex)}
        />
      ) : (
        <FinishView session={session} sets={sets} elapsed={elapsed} onUndo={() => void undoLastSet(session.id)} />
      )}

      {sheet === 'menu' && (
        <Sheet title="Séance" onClose={() => setSheet(null)}>
          <div className="menu-list">
            {current && (
              <>
                <button onClick={() => setSheet('pain')}>Signaler une douleur articulaire</button>
                <button
                  onClick={() => {
                    setSheet(null);
                    void skipExercise(session.id, current.exerciseIndex);
                  }}
                >
                  Passer l'exercice en cours
                </button>
              </>
            )}
            {sets.length > 0 && (
              <button
                onClick={() => {
                  setSheet(null);
                  void undoLastSet(session.id);
                }}
              >
                Annuler la dernière série
              </button>
            )}
            <button onClick={onPause}>Mettre en pause (reprendre plus tard)</button>
            <button className="btn-danger" onClick={() => void confirmAbandon()}>
              Abandonner la séance (garder les séries)
            </button>
            <button className="btn-danger" onClick={() => void confirmDelete()}>
              Supprimer la séance (essai, erreur)
            </button>
          </div>
          <p className="faint" style={{ fontSize: 13 }}>
            Écran maintenu allumé : {wakeLockActive ? 'oui' : 'non disponible'} · Son : {profile.soundOn ? 'activé' : 'coupé'}
          </p>
        </Sheet>
      )}

      {sheet === 'pain' && current && (
        <Sheet title="Douleur articulaire" onClose={() => setSheet(null)}>
          <p className="muted">
            {session.plan[current.exerciseIndex]?.name} — douleur d'articulation (coude, épaule…), pas une courbature. À partir de{' '}
            {programme.rules.R6.jointPainStop}/10, l'exercice est retiré de la séance.
          </p>
          <div className="pain-grid">
            {Array.from({ length: 11 }, (_, v) => (
              <button
                key={v}
                className={v >= programme.rules.R6.jointPainStop ? 'high' : ''}
                onClick={async () => {
                  setSheet(null);
                  const stopped = await reportJointPain(session.id, current.exerciseIndex, v);
                  setToast(
                    stopped
                      ? `Exercice retiré (douleur ${v}/10). Si elle persiste, consulte un professionnel.`
                      : `Douleur ${v}/10 notée.`,
                  );
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function sessionTitle(session: Session) {
  const labels = { A: 'Séance A', B: 'Séance B', F: 'Séance F', MIN: 'Séance minimale', TEST: 'Tests' } as const;
  return `${labels[session.type]}${session.isDeload ? ' · deload' : ''}`;
}

// ---------------------------------------------------------------------------
// Série en cours
// ---------------------------------------------------------------------------

function ExerciseView(props: {
  session: Session;
  sets: SetLog[];
  step: Step;
  profile: Profile;
  history: Record<string, SetLog[]>;
  resting: boolean;
  now: number;
  goVisible: boolean;
  pendingFeeling: number;
  onValidate: (step: Step, v: SetValues) => Promise<void>;
  onUndo: () => void;
  onSkip: () => void;
}) {
  const { session, sets, step, profile } = props;
  const pe = session.plan[step.exerciseIndex]!;
  const exSets = sets.filter((s) => s.exerciseIndex === step.exerciseIndex);
  const lastSet = sets[sets.length - 1];
  const isNewExercise = !lastSet || lastSet.exerciseIndex !== step.exerciseIndex;
  const target = pe.targetReps[step.setIndex] ?? pe.reps[0];
  const isLastSet = step.setIndex === pe.sets - 1;
  const rir = isLastSet && pe.lastSetRir !== undefined ? `${pe.lastSetRir}` : formatRange(pe.rir);
  const cues = programme.exercises[pe.exerciseId]?.cues ?? [];
  const ankleNote = profile.ankleMode ? programme.exercises[pe.exerciseId]?.ankleNote : undefined;

  // Pré-remplissage : la série précédente du même exercice (plus proche de la réalité que la cible), sinon la cible.
  const [reps, setReps] = useState(exSets[exSets.length - 1]?.reps ?? target);
  const [load, setLoad] = useState(exSets[exSets.length - 1]?.loadKg ?? pe.loadKg);
  const [extra, setExtra] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showCues, setShowCues] = useState(false);

  const belowMin = reps < pe.reps[0] && pe.onBelowMin !== 'none';
  const isHold = pe.unit === 'sec';
  const w = programme.equipment.weight;
  const loadStep = pe.loadInput === 'weighted' ? (load >= w.thresholdKg ? w.largeStepKg : w.smallStepKg) : profile.dumbbell.stepKg;
  const loadMin = pe.loadInput === 'weighted' ? 0 : profile.dumbbell.minKg;
  const loadMax = pe.loadInput === 'weighted' ? w.maxKg : profile.dumbbell.maxKg;

  const submit = async () => {
    setBusy(true);
    try {
      await props.onValidate(step, {
        reps,
        loadKg: pe.loadInput === 'none' ? 0 : load,
        negatives: belowMin && pe.onBelowMin === 'negatives' ? extra : 0,
        restPauseReps: belowMin && pe.onBelowMin === 'rest_pause' ? extra : 0,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="workout-body">
        {props.resting && <RestCard session={session} now={props.now} />}
        {!props.resting && session.restEndsAt !== undefined && (
          // Repos écoulé (y compris pendant que l'app était fermée) : temps calculé sur l'horodatage.
          <div className={`card go${props.goVisible ? ' flash' : ''}`} role="status">
            C'est reparti !
            <small className="num overtime">Repos terminé depuis {formatOvertime((props.now - session.restEndsAt) / 1000)}</small>
          </div>
        )}
        {props.pendingFeeling >= 0 && <FeelingCard session={session} index={props.pendingFeeling} />}

        <section className="ex-head">
          {isNewExercise && props.resting && <p className="eyebrow">Ensuite</p>}
          <h1>{pe.name}</h1>
          <p className="variant">
            {pe.variantName}
            {pe.optional && ' · optionnel'}
          </p>
        </section>

        <div className="spread">
          <div className="set-dots" aria-label={`Série ${step.setIndex + 1} sur ${pe.sets}`}>
            {Array.from({ length: pe.sets }, (_, i) => (
              <span key={i} className={i < exSets.length ? 'done' : i === step.setIndex ? 'current' : ''} />
            ))}
          </div>
          <span className="muted num" style={{ fontWeight: 700 }}>
            Série {step.setIndex + 1}/{pe.sets}
          </span>
        </div>

        {pe.testId ? (
          <div className="card" style={{ gap: 6 }}>
            <p style={{ fontWeight: 700 }}>Test de max : une seule série, le plus de répétitions strictes possible.</p>
            <p className="muted" style={{ fontSize: 14 }}>
              Une répétition ne compte que si elle respecte le standard (amplitude complète, aucun élan). Dernier test : {target} reps.
            </p>
          </div>
        ) : (
          <>
            <div className="target">
              <div>
                Objectif
                <b className="num">
                  {target} {unitLabel(pe, target)}
                </b>
              </div>
              <div>
                Fourchette
                <b className="num">{formatRange(pe.reps)}</b>
              </div>
              <div>
                RIR
                <b className="num">{rir}</b>
              </div>
            </div>
            <History pe={pe} history={props.history[pe.exerciseId]} />
          </>
        )}

        {isHold && <HoldTimer onStop={setReps} />}

        <div className="inputs">
          <Stepper
            label={isHold ? (pe.perSide ? 'Secondes par côté' : 'Secondes') : 'Répétitions'}
            value={reps}
            onChange={setReps}
            step={isHold ? 5 : 1}
            min={0}
            max={isHold ? 300 : 100}
          />
          {pe.loadInput !== 'none' && (
            <Stepper
              label={pe.loadInput === 'weighted' ? 'Lest' : 'Haltère'}
              value={load}
              onChange={setLoad}
              step={loadStep}
              min={loadMin}
              max={loadMax}
              unit="kg"
            />
          )}
        </div>

        {belowMin && (
          <Stepper
            size="md"
            label={pe.onBelowMin === 'negatives' ? `Négatives pour atteindre ${pe.reps[0]}` : `Reps en rest-pause pour atteindre ${pe.reps[0]}`}
            value={extra}
            onChange={setExtra}
            step={1}
            min={0}
            max={20}
          />
        )}

        {(cues.length > 0 || ankleNote) && (
          <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setShowCues((v) => !v)}>
            {showCues ? 'Masquer les consignes' : 'Consignes'}
          </button>
        )}
        {showCues && (
          <ul className="cues">
            {cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
            {ankleNote && <li style={{ color: 'var(--warn)' }}>{ankleNote}</li>}
          </ul>
        )}
      </div>

      <div className="workout-actions">
        <button className="btn-primary" disabled={busy} onClick={() => void submit()}>
          Valider · {reps} {unitLabel(pe, reps)}
          {pe.loadInput !== 'none' ? ` · ${formatLoad(pe.loadInput, load)}` : ''}
        </button>
        <div className="link-row">
          <button className="btn-ghost" disabled={sets.length === 0} onClick={props.onUndo}>
            Annuler la dernière
          </button>
          <button className="btn-ghost" onClick={props.onSkip}>
            Passer l'exercice
          </button>
        </div>
      </div>
    </>
  );
}

function History({ pe, history }: { pe: PlannedExercise; history?: SetLog[] }) {
  if (!history || history.length === 0) {
    return <p className="faint">Première fois sur cet exercice : vise le bas de la fourchette, technique stricte.</p>;
  }
  const sameVariant = history.every((s) => s.variantId === pe.variantId);
  const load = history[0]!.loadKg;
  return (
    <p className="muted num">
      Dernière fois : <b style={{ color: 'var(--text)' }}>{history.map((s) => s.reps + (s.negatives ? `+${s.negatives}n` : '')).join(' · ')}</b>
      {pe.unit === 'sec' && ` ${unitLabel(pe)}`}
      {pe.loadInput !== 'none' && load > 0 ? ` @ ${kg(load)}` : ''}
      {!sameVariant && ' (autre variante)'}
    </p>
  );
}

/**
 * Chrono de maintien (gainage, L-sit) : démarré au début de la position, arrêté à la fin,
 * il remplit directement le nombre de secondes. Basé sur l'horodatage de départ.
 */
function HoldTimer({ onStop }: { onStop: (sec: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const now = useNow(200);
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  return startedAt ? (
    <button
      className="btn-secondary hold-timer running"
      onClick={() => {
        onStop(Math.round((Date.now() - startedAt) / 1000));
        setStartedAt(null);
        unlockAudio();
      }}
    >
      <span className="num">{formatClock(elapsed)}</span> · Stop
    </button>
  ) : (
    <button
      className="btn-secondary hold-timer"
      onClick={() => {
        unlockAudio();
        setStartedAt(Date.now());
      }}
    >
      Lancer le chrono de maintien
    </button>
  );
}

/** « 12 s », « 1 min 05 », « 12 min ». */
export function formatOvertime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m >= 10 ? `${m} min` : `${m} min ${String(s % 60).padStart(2, '0')}`;
}

function RestCard({ session, now }: { session: Session; now: number }) {
  const remaining = Math.max(0, ((session.restEndsAt ?? now) - now) / 1000);
  const total = session.restTotalSec ?? 60;
  const r = 50;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, remaining / total);
  return (
    <section className="card rest" aria-live="off">
      <div className="rest-ring">
        <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
          <circle cx="56" cy="56" r={r} stroke="var(--surface-3)" strokeWidth="8" fill="none" />
          <circle
            cx="56"
            cy="56"
            r={r}
            stroke="var(--accent)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
          />
        </svg>
        <span className="time num" role="timer">
          {formatClock(remaining)}
        </span>
      </div>
      <div className="rest-side">
        <p className="eyebrow">Repos</p>
        <div className="rest-buttons">
          <button onClick={() => void shiftRest(session, -15)}>−15 s</button>
          <button onClick={() => void shiftRest(session, 30)}>+30 s</button>
          <button onClick={() => void skipRest(session.id)}>Passer</button>
        </div>
      </div>
    </section>
  );
}

function FeelingCard({ session, index }: { session: Session; index: number }) {
  const pe = session.plan[index];
  if (!pe) return null;
  return (
    <section className="card" style={{ gap: 10 }}>
      <p style={{ fontWeight: 700 }}>
        Ressenti · {pe.name}
        <span className="faint" style={{ fontWeight: 500 }}>
          {' '}
          (dernière série)
        </span>
      </p>
      <div className="feelings">
        {FEELINGS.map((f) => (
          <button key={f.value} onClick={() => void setFeeling(session.id, index, f.value)}>
            {f.label}
            <small>{f.rir}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fin de séance
// ---------------------------------------------------------------------------

function FinishView(props: { session: Session; sets: SetLog[]; elapsed: number; onUndo: () => void }) {
  const { session, sets } = props;
  const [busy, setBusy] = useState(false);
  const totalReps = sets.reduce((n, s) => n + s.reps, 0);

  return (
    <>
      <div className="workout-body">
        <section>
          <p className="eyebrow">Bravo</p>
          <h1 className="screen-title">Séance terminée</h1>
        </section>

        <div className="card stats">
          <div>
            <span className="big-number num">{formatClock(props.elapsed)}</span>
            <small>durée</small>
          </div>
          <div>
            <span className="big-number num">{sets.length}</span>
            <small>séries</small>
          </div>
          <div>
            <span className="big-number num">{totalReps}</span>
            <small>répétitions</small>
          </div>
        </div>

        {session.plan.map((pe, i) => {
          const exSets = sets.filter((s) => s.exerciseIndex === i);
          const result = session.results[i];
          return (
            <section key={i} className="card" style={{ gap: 8 }}>
              <div className="spread">
                <span style={{ fontWeight: 700 }}>{pe.name}</span>
                {result?.skipped && <span className="chip">passé</span>}
              </div>
              {exSets.length > 0 && (
                <p className="muted num">
                  {exSets.map((s) => s.reps + (s.negatives ? `+${s.negatives}n` : '') + (s.restPauseReps ? `+${s.restPauseReps}rp` : '')).join(' · ')}
                  {pe.unit === 'sec' && ` ${unitLabel(pe)}`}
                  {pe.loadInput !== 'none' ? ` @ ${formatLoad(pe.loadInput, exSets[exSets.length - 1]!.loadKg)}` : ''}
                </p>
              )}
              {exSets.length > 0 && !pe.testId && (
                <div className="feelings">
                  {FEELINGS.map((f) => (
                    <button
                      key={f.value}
                      className={result?.feeling === f.value ? 'on' : ''}
                      onClick={() => void setFeeling(session.id, i, f.value)}
                    >
                      {f.label}
                      <small>{f.rir}</small>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        <p className="faint" style={{ fontSize: 13 }}>
          Ton ressenti sert à décider de la suite : après l'enregistrement, le coach analyse la séance et te propose ses
          recommandations sur l'accueil.
        </p>
      </div>

      <div className="workout-actions">
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await finishSession(session.id);
          }}
        >
          Enregistrer la séance
        </button>
        <div className="link-row">
          <button className="btn-ghost" disabled={sets.length === 0} onClick={props.onUndo}>
            Annuler la dernière série
          </button>
        </div>
      </div>
    </>
  );
}
