/**
 * Mode étirement guidé : minuteur par position, passage automatique, gauche / droite, PNF, son.
 *
 * Le temps est calculé à partir d'horodatages (début, pauses), jamais par un compteur : après un
 * verrouillage d'écran, la position affichée est la bonne. « Passer » et « Revenir » décalent ce temps.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { mobilite, type Routine } from '../../data/mobiliteData';
import type { MobilityFeeling, Profile } from '../../db/models';
import { buildTimeline, positionAt, positionsReached, startOfStep, type TimelineStep } from '../../engine/mobility';
import { formatClock } from '../../lib/dates';
import { playTick, unlockAudio, useNow, useWakeLock } from '../../lib/device';
import { saveMobilitySession } from './mobilityRepo';

const PHASE_COLORS: Record<string, string> = { contract: 'var(--warn)', relax: 'var(--ok)' };

export function GuidedRoutine({ routine, profile, onExit }: { routine: Routine; profile: Profile; onExit: () => void }) {
  const settings = profile.mobility ?? { pnf: false, holdLevel: 0, easyStreak: 0 };
  const timeline = useMemo(() => buildTimeline(routine, mobilite, { ankleMode: profile.ankleMode, settings }), [routine, profile.ankleMode, settings]);
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

  // Fin de routine, et bip à chaque changement d'étape.
  useEffect(() => {
    if (done) return;
    if (!pos) {
      if (profile.soundOn) playTick(true);
      // Temps réellement passé (pauses exclues) : « passer » des positions ne gonfle pas le suivi.
      const endedAt = Date.now();
      setDone({ elapsed: timeline.totalSec, endedAt, realSec: Math.round((endedAt - startedAt - pausedMs) / 1000) });
      return;
    }
    if (pos.index !== lastIndex.current) {
      if (lastIndex.current !== -1 && profile.soundOn) playTick(false);
      lastIndex.current = pos.index;
    }
  }, [pos, done, timeline.totalSec, profile.soundOn, startedAt, pausedMs]);

  const jump = (index: number) => {
    const target = startOfStep(timeline, Math.max(0, Math.min(index, timeline.steps.length)));
    setShiftSec((s) => s + (target - elapsed) + 0.01);
  };

  const stopEarly = async () => {
    const realSec = Math.round(Math.min((Date.now() - startedAt - pausedMs - (pausedAt !== null ? Date.now() - pausedAt : 0)) / 1000, timeline.totalSec));
    if (realSec >= 60 && window.confirm('Arrêter la routine ? Le temps déjà fait sera enregistré.')) {
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
    } else if (realSec < 60 && window.confirm('Arrêter la routine ? (moins d’une minute : rien ne sera enregistré)')) {
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
        <p className="eyebrow" style={{ color: step.kind === 'prep' ? 'var(--text-2)' : PHASE_COLORS[step.phase ?? ''] ?? 'var(--accent)' }}>
          {step.label}
        </p>
        <div className={`guided-timer num${step.kind === 'prep' ? ' prep' : ''}`} role="timer">
          {Math.ceil(pos.remaining)}
        </div>
        <section className="ex-head" style={{ textAlign: 'center' }}>
          <h1>{step.exercise.nom}</h1>
          <p className="variant">
            {sideLabel(step)}
            {step.sets > 1 ? ` · passage ${step.set}/${step.sets}` : ''}
          </p>
        </section>
        <div className="card guided-cues">
          <p>
            <b>Consigne :</b> {step.exercise.consigne}
          </p>
          <p className="muted">
            <b>À éviter :</b> {step.exercise.erreur}
          </p>
          {profile.ankleMode && step.exercise.noteCheville && <p style={{ color: 'var(--warn)' }}>{step.exercise.noteCheville}</p>}
          {step.kind === 'prep' && <p className="faint">{step.exercise.description}</p>}
        </div>
        {next && <p className="faint" style={{ textAlign: 'center' }}>Ensuite : {next.exercise.nom}</p>}
        <p className="faint" style={{ textAlign: 'center', fontSize: 13 }}>
          Étirement modéré, jamais de douleur.
        </p>
      </div>

      <div className="workout-actions guided-actions">
        <button className="btn-secondary" aria-label="Étape précédente" onClick={() => jump(pos.index - 1)}>
          ‹
        </button>
        <button
          className="btn-primary"
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
  if (!step.side) return step.exercise.type === 'dynamique' ? 'Mouvement continu' : 'Position';
  return step.side === 'gauche' ? 'Côté gauche' : 'Côté droit';
}

function FinishView(props: { routine: Routine; timelineSec: number; realSec: number; positions: number; startedAt: number; endedAt: number; onExit: () => void }) {
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
        ? 'Bien joué : les positions tenues passent à +15 s la prochaine fois.'
        : change === -1
          ? 'Noté : les temps de maintien redescendent d’un cran.'
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
            <small>positions</small>
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
              Sert à ajuster le temps de maintien des prochaines séances.
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
