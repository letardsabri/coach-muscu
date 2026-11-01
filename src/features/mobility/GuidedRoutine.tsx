/**
 * Séance de souplesse guidée : minuteur par exercice (temps, répétitions au tempo ou cycles PNF),
 * passage automatique, gauche / droite, son à chaque changement.
 *
 * Le temps est calculé à partir d'horodatages (début, pauses), jamais par un compteur : après un
 * verrouillage d'écran, l'étape affichée est la bonne. « Passer », « Revenir » et « Fini » décalent ce temps.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { souplesse, type Seance } from '../../data/souplesseData';
import type { MobilityFeeling, Profile } from '../../db/models';
import { buildTimeline, currentRep, defaultMobilitySettings, positionAt, positionsReached, startOfStep, type TimelineStep } from '../../engine/mobility';
import { formatClock } from '../../lib/dates';
import { playTick, unlockAudio, useNow, useWakeLock } from '../../lib/device';
import { Illustration } from '../../ui/Illustration';
import { saveMobilitySession } from './mobilityRepo';

const PHASE_COLORS: Record<string, string> = { contract: 'var(--warn)', relax: 'var(--ok)' };
const blocLabel = (id: string) => souplesse.blocs.find((b) => b.id === id)?.label ?? id;

export function GuidedRoutine({ routine, profile, onExit }: { routine: Seance; profile: Profile; onExit: () => void }) {
  const settings = profile.mobility ?? defaultMobilitySettings();
  const timeline = useMemo(() => buildTimeline(routine, souplesse, { ankleMode: profile.ankleMode, settings }), [routine, profile.ankleMode, settings]);
  const [startedAt] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [shiftSec, setShiftSec] = useState(0);
  const [done, setDone] = useState<{ elapsed: number; endedAt: number; realSec: number } | null>(null);
  const lastIndex = useRef(-1);
  const now = useNow(200);
  useWakeLock(!done);

  const elapsed = done
    ? done.elapsed
    : Math.max(0, (now - startedAt - pausedMs - (pausedAt !== null ? now - pausedAt : 0)) / 1000 + shiftSec);
  const pos = positionAt(timeline, elapsed);

  // Fin de séance, et bip à chaque changement d'étape.
  useEffect(() => {
    if (done) return;
    if (!pos) {
      if (profile.soundOn) playTick(true);
      // Temps réellement passé (pauses exclues) : « passer » des exercices ne gonfle pas le suivi.
      const endedAt = Date.now();
      setDone({ elapsed: timeline.totalSec, endedAt, realSec: Math.round((endedAt - startedAt - pausedMs) / 1000) });
      return;
    }
    if (pos.index !== lastIndex.current) {
      if (lastIndex.current !== -1 && profile.soundOn) playTick(timeline.steps[pos.index]!.phase === 'contract');
      lastIndex.current = pos.index;
    }
  }, [pos, done, timeline, profile.soundOn, startedAt, pausedMs]);

  const jump = (index: number) => {
    const target = startOfStep(timeline, Math.max(0, Math.min(index, timeline.steps.length)));
    setShiftSec((s) => s + (target - elapsed) + 0.01);
  };

  const stopEarly = async () => {
    const realSec = Math.round(Math.min((Date.now() - startedAt - pausedMs - (pausedAt !== null ? Date.now() - pausedAt : 0)) / 1000, timeline.totalSec));
    if (realSec >= 60 && window.confirm('Arrêter la séance ? Le temps déjà fait sera enregistré.')) {
      await saveMobilitySession({
        routineId: routine.id,
        startedAt,
        endedAt: Date.now(),
        durationSec: realSec,
        plannedSec: timeline.totalSec,
        positionsDone: positionsReached(timeline, elapsed),
        positionsTotal: timeline.positions,
      });
      onExit();
    } else if (realSec < 60 && window.confirm('Arrêter la séance ? (moins d’une minute : rien ne sera enregistré)')) {
      onExit();
    }
  };

  if (done) {
    return (
      <FinishView
        routine={routine}
        timelineSec={timeline.totalSec}
        realSec={Math.min(done.realSec, timeline.totalSec)}
        positions={timeline.positions}
        startedAt={startedAt}
        endedAt={done.endedAt}
        onExit={onExit}
      />
    );
  }
  if (!pos) return null;

  const step = timeline.steps[pos.index]!;
  const next = timeline.steps.slice(pos.index + 1).find((s) => s.kind === 'work' && s.exercise.id !== step.exercise.id);
  const progress = elapsed / timeline.totalSec;
  const paused = pausedAt !== null;
  const rep = step.phase === 'reps' ? currentRep(step, pos.remaining) : 0;
  // Fin de l'exercice en cours (côté compris) : « Fini » saute toutes ses étapes restantes.
  const endOfPosition = timeline.steps.findIndex((s, i) => i >= pos.index && s.last) + 1;

  return (
    <div className="workout guided">
      <header className="workout-top">
        <button className="btn-ghost" onClick={() => void stopEarly()}>
          Arrêter
        </button>
        <div className="title">
          {routine.nom}
          <small className="num">
            {formatClock(elapsed)} / {formatClock(timeline.totalSec)}
          </small>
        </div>
        <span style={{ width: 70 }} />
      </header>
      <div className="progress" aria-hidden>
        <div style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </div>

      <div className="workout-body guided-body">
        <p className="faint" style={{ textAlign: 'center', fontSize: 13, margin: 0 }}>
          {blocLabel(step.bloc)}
        </p>
        <p className="eyebrow" style={{ color: step.kind === 'prep' ? 'var(--text-2)' : PHASE_COLORS[step.phase ?? ''] ?? 'var(--accent)' }}>
          {step.label}
          {step.cycle ? ` · cycle ${step.cycle}/${step.cycles}` : ''}
        </p>
        {step.phase === 'reps' ? (
          <div className="guided-timer num" role="timer" aria-label={`Répétition ${rep} sur ${step.reps}`}>
            {rep}
            <span className="guided-of">/{step.reps}</span>
          </div>
        ) : (
          <div className={`guided-timer num${step.kind === 'prep' ? ' prep' : ''}`} role="timer">
            {Math.ceil(pos.remaining)}
          </div>
        )}
        {step.phase === 'reps' && (
          <p className="muted num" style={{ textAlign: 'center', margin: 0 }}>
            {step.tempo} s par répétition · encore {Math.ceil(pos.remaining)} s
          </p>
        )}
        <section className="ex-head" style={{ textAlign: 'center' }}>
          <Illustration kind="souplesse" id={step.exercise.id} alt={step.exercise.nom} size="large" />
          <h1>{step.exercise.nom}</h1>
          <p className="variant">
            {sideLabel(step)}
            {step.sets > 1 ? ` · passage ${step.set}/${step.sets}` : ''}
            {step.loadKg ? ` · haltère ${step.loadKg} kg` : ''}
          </p>
          {step.exercise.alerte && <span className="chip chip-warn">{step.exercise.alerte}</span>}
        </section>
        <div className="card guided-cues">
          {step.phase === 'contract' && step.exercise.pnf ? (
            <p style={{ color: 'var(--warn)', fontWeight: 600 }}>{step.exercise.pnf}</p>
          ) : (
            <p>
              <b>Consigne :</b> {step.exercise.consigne}
            </p>
          )}
          <p className="muted">
            <b>À éviter :</b> {step.exercise.erreur}
          </p>
          {profile.ankleMode && step.exercise.noteCheville && <p style={{ color: 'var(--warn)' }}>{step.exercise.noteCheville}</p>}
          {step.kind === 'prep' && <p className="faint">{step.exercise.description}</p>}
        </div>
        {next && <p className="faint" style={{ textAlign: 'center' }}>Ensuite : {next.exercise.nom}</p>}
        <p className="faint" style={{ textAlign: 'center', fontSize: 13 }}>
          Étirement intense, jamais de douleur articulaire.
        </p>
      </div>

      <div className="workout-actions guided-actions">
        {step.phase === 'reps' && (
          <button className="btn-primary guided-done" onClick={() => jump(endOfPosition)}>
            Fini ✓
          </button>
        )}
        <button className="btn-secondary" aria-label="Étape précédente" onClick={() => jump(pos.index - 1)}>
          ‹
        </button>
        <button
          className={`guided-pause ${step.phase === 'reps' ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => {
            unlockAudio();
            if (paused) {
              setPausedMs((ms) => ms + (Date.now() - pausedAt));
              setPausedAt(null);
            } else setPausedAt(Date.now());
          }}
        >
          {paused ? 'Reprendre' : 'Pause'}
        </button>
        <button className="btn-secondary" aria-label="Étape suivante" onClick={() => jump(pos.index + 1)}>
          ›
        </button>
      </div>
    </div>
  );
}

function sideLabel(step: TimelineStep): string {
  if (step.side) return step.side === 'gauche' ? 'Côté gauche' : 'Côté droit';
  if (step.phase === 'reps') return 'Mouvement lent';
  return step.bloc === 'preparation' ? 'Mouvement continu' : 'Position';
}

function FinishView(props: { routine: Seance; timelineSec: number; realSec: number; positions: number; startedAt: number; endedAt: number; onExit: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async (feeling: MobilityFeeling) => {
    const change = await saveMobilitySession(
      {
        routineId: props.routine.id,
        startedAt: props.startedAt,
        endedAt: props.endedAt,
        durationSec: props.realSec,
        plannedSec: props.timelineSec,
        positionsDone: props.positions,
        positionsTotal: props.positions,
      },
      feeling,
    );
    setSaved(true);
    setMessage(
      change === 1
        ? 'Bien joué : niveau supérieur la prochaine fois (maintiens +15 s, +1 répétition, charge ajustée).'
        : change === -1
          ? 'Noté : on redescend d’un niveau la prochaine fois.'
          : 'Séance enregistrée.',
    );
  };

  return (
    <div className="workout">
      <div className="workout-body" style={{ paddingTop: 'calc(var(--safe-top) + 24px)' }}>
        <p className="eyebrow">Terminé</p>
        <h1 className="screen-title">{props.routine.nom}</h1>
        <div className="card stats">
          <div>
            <span className="big-number num">{formatClock(props.realSec)}</span>
            <small>durée</small>
          </div>
          <div>
            <span className="big-number num">{props.positions}</span>
            <small>exercices</small>
          </div>
          <div>
            <span className="big-number num">{props.realSec >= props.timelineSec * 0.5 ? '✓' : '—'}</span>
            <small>{props.realSec >= props.timelineSec * 0.5 ? 'comptée' : 'trop courte'}</small>
          </div>
        </div>
        {!saved ? (
          <section className="card">
            <h3 className="card-h">Ressenti</h3>
            <p className="muted" style={{ fontSize: 14 }}>
              Sert à ajuster les prochaines séances : temps de maintien, répétitions et charge.
            </p>
            <div className="feelings" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {(['facile', 'correct', 'difficile'] as MobilityFeeling[]).map((f) => (
                <button key={f} onClick={() => void save(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <p style={{ color: 'var(--ok)', fontWeight: 600 }}>{message}</p>
        )}
      </div>
      <div className="workout-actions">
        <button className="btn-primary" disabled={!saved} onClick={props.onExit}>
          Terminer
        </button>
      </div>
    </div>
  );
}
