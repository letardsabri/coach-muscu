/**
 * Espace Souplesse (MMA / Muay Thaï) : séances, suivi de la semaine, niveau, bibliothèque d'exercices, tests mensuels.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { souplesse } from '../../data/souplesseData';
import { db } from '../../db/db';
import type { Profile } from '../../db/models';
import { buildTimeline, defaultMobilitySettings, levelSummary, regularityStreak, resolveExercise, weekStats, type StretchReco } from '../../engine/mobility';
import { weekStart } from '../../engine/schedule';
import { dayKey } from '../../lib/dates';
import { LineChart } from '../../ui/charts';
import { NumberField, Sheet } from '../../ui/components';
import { Illustration } from '../../ui/Illustration';
import { shortDate } from '../progress/stats';
import { addFlexTest, deleteFlexTest } from './mobilityRepo';

export function MobilityScreen(props: { profile: Profile; recommended?: StretchReco; onStart: (routineId: string) => void; onClose: () => void }) {
  const sessions = useLiveQuery(() => db.mobilitySessions.toArray(), []);
  const [openZone, setOpenZone] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  if (!sessions) return null;

  const settings = props.profile.mobility ?? defaultMobilitySettings();
  const monday = weekStart(dayKey());
  const week = weekStats(sessions, monday);
  const { min, max } = souplesse.settings.weeklyTarget;
  const streak = regularityStreak(sessions, monday, min);
  const level = levelSummary(settings, souplesse);

  return (
    <div className="overlay-screen">
      <main className="screen" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
        <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={props.onClose}>
          ‹ Retour
        </button>
        <h1 className="screen-title">Souplesse</h1>
        <Illustration kind="seances" id="souplesse" alt="Souplesse" size="header" />
        <p className="muted" style={{ fontSize: 14, marginTop: -8 }}>
          Kicks hauts, teeps, garde au sol, sprawl, grappling. Séances à part entière, jamais juste avant la muscu ou le MMA : un jour sans
          entraînement, ou le soir.
        </p>

        <section className="card">
          <div className="spread">
            <h3 className="card-h">Cette semaine</h3>
            <span className={`chip num${week.sessions >= min ? ' chip-ok' : ''}`}>
              {week.sessions} / {min}–{max} séances
            </span>
          </div>
          <div className="stats">
            <div>
              <span className="big-number num">{week.sessions}</span>
              <small>séances</small>
            </div>
            <div>
              <span className="big-number num">{week.minutes}</span>
              <small>minutes</small>
            </div>
            <div>
              <span className="big-number num">{streak}</span>
              <small>sem. d'affilée</small>
            </div>
          </div>
          <p className="faint" style={{ fontSize: 13 }}>
            Recommandé, jamais obligatoire. Série de régularité : semaines consécutives à {min} séances ou plus.
          </p>
        </section>

        {souplesse.seances.map((r) => {
          const t = buildTimeline(r, souplesse, { ankleMode: props.profile.ankleMode, settings });
          const isReco = props.recommended?.seance === r.id;
          return (
            <section key={r.id} className={`card${isReco ? ' card-accent' : ''}`}>
              <div className="spread">
                <div>
                  {isReco && (
                    <p className="eyebrow" style={{ color: 'var(--accent)' }}>
                      Recommandée aujourd'hui{props.recommended?.evening ? ' · le soir' : ''}
                    </p>
                  )}
                  <h3 className="card-h">{r.nom}</h3>
                </div>
                <span className="chip num">{Math.round(t.totalSec / 60)} min</span>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>
                {[...new Set(t.steps.map((s) => s.exercise.nom))].join(' · ')}
              </p>
              {t.replaced.length > 0 && <p style={{ fontSize: 13, color: 'var(--warn)' }}>Mode cheville : {t.replaced.length} exercice(s) adapté(s).</p>}
              {isReco && props.recommended?.evening && (
                <p className="faint" style={{ fontSize: 13 }}>Jour de muscu : fais-la le soir, à distance de la séance.</p>
              )}
              <button className={isReco ? 'btn-primary' : 'btn-secondary'} onClick={() => props.onStart(r.id)}>
                Lancer
              </button>
            </section>
          );
        })}

        <section className="card" style={{ gap: 6 }}>
          <div className="spread">
            <h3 className="card-h">Progression</h3>
            <span className="chip num">
              niveau {level.level}/{level.maxLevel}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 14 }}>
            Maintiens <b className="num">{level.holdSec} s</b> · répétitions <b className="num">+{level.extraReps}</b> · haltère{' '}
            <b className="num">{level.loadKg} kg</b> sur les étirements chargés (le Jefferson curl monte plus lentement).
          </p>
          <p className="faint" style={{ fontSize: 13 }}>
            Le niveau monte après 2 ressentis « facile » de suite et descend après un « difficile ». PNF : contracte 6 s, relâche et gagne de
            l'amplitude 25 s, 3 cycles.
          </p>
        </section>

        <section className="card" style={{ padding: '14px 18px' }}>
          <h3 className="card-h">Exercices</h3>
            {souplesse.zones.map((z) => {
            const list = souplesse.exercices.filter((e) => e.zone === z.id);
            const open = openZone === z.id;
            return (
              <div key={z.id} className="zone">
                <button className="spread zone-head" onClick={() => setOpenZone(open ? null : z.id)} aria-expanded={open}>
                  <b>{z.label}</b>
                  <span className="muted">
                    {list.length} {open ? '▴' : '▾'}
                  </span>
                </button>
                {open &&
                  list.map((e) => {
                    const used = resolveExercise(e.id, souplesse, props.profile.ankleMode);
                    return (
                      <article key={e.id} className="ex-info">
                        <Illustration kind="souplesse" id={e.id} alt={e.nom} size="large" className="illu-info" />
                        <b>
                          {e.nom}
                          {e.alerte && <span className="chip chip-warn" style={{ marginLeft: 6 }}>{e.alerte}</span>}
                          {e.pnf && <span className="chip" style={{ marginLeft: 6 }}>PNF</span>}
                          {e.charge && <span className="chip" style={{ marginLeft: 6 }}>haltère</span>}
                        </b>
                        <p>{e.description}</p>
                        <p>
                          <b>Consigne :</b> {e.consigne}
                        </p>
                        <p className="muted">
                          <b>Erreur fréquente :</b> {e.erreur}
                        </p>
                        {e.noteCheville && <p style={{ color: 'var(--warn)' }}>{e.noteCheville}</p>}
                        {used.id !== e.id && <p style={{ color: 'var(--warn)' }}>Mode cheville : remplacé par « {used.nom} ».</p>}
                      </article>
                    );
                  })}
              </div>
            );
          })}
        </section>

        <FlexTests onAdd={setTesting} />
        {testing && <FlexTestSheet testId={testing} onClose={() => setTesting(null)} />}
      </main>
    </div>
  );
}

function FlexTests({ onAdd }: { onAdd: (id: string) => void }) {
  const tests = useLiveQuery(() => db.flexTests.orderBy('day').toArray(), []);
  if (!tests) return null;
  return (
    <>
      {souplesse.tests.map((def) => {
        const list = tests.filter((t) => t.testId === def.id);
        if (def.archive && list.length === 0) return null;
        const last = list[list.length - 1];
        const first = list[0];
        return (
          <section key={def.id} className="card">
            <div className="spread">
              <h3 className="card-h">{def.nom}</h3>
              <span className="big-number num" style={{ fontSize: 24 }}>
                {last ? `${last.value.toLocaleString('fr-FR')} ${def.unite}` : '—'}
              </span>
            </div>
            {list.length > 1 && (
              <LineChart labels={list.map((t) => shortDate(t.day))} values={list.map((t) => t.value)} unit={def.unite} decimals={1} seriesLabel={def.nom} height={140} />
            )}
            {first && last && list.length > 1 && (
              <p className="muted num" style={{ fontSize: 14 }}>
                Depuis le {shortDate(first.day)} : {last.value - first.value >= 0 ? '+' : ''}
                {(last.value - first.value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} {def.unite}
              </p>
            )}
            <p className="faint" style={{ fontSize: 13 }}>
              {def.protocole} {def.archive ? '' : 'Test mensuel, optionnel.'}
            </p>
            <div className="spread">
              {!def.archive ? (
                <button className="btn-secondary" style={{ width: 'auto', padding: '0 16px' }} onClick={() => onAdd(def.id)}>
                  Nouveau test
                </button>
              ) : (
                <span />
              )}
              {last && (
                <button
                  className="btn-ghost btn-danger"
                  onClick={() => {
                    if (window.confirm('Supprimer la dernière mesure ?')) void deleteFlexTest(last.id);
                  }}
                >
                  Suppr. dernière
                </button>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}

function FlexTestSheet({ testId, onClose }: { testId: string; onClose: () => void }) {
  const def = souplesse.tests.find((t) => t.id === testId)!;
  const [value, setValue] = useState<number | null>(null);
  return (
    <Sheet title={def.nom} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14 }}>
        {def.protocole}
      </p>
      <NumberField label="Mesure" value={value} onChange={setValue} unit={def.unite} autoFocus />
      <button
        className="btn-primary"
        disabled={value === null}
        onClick={async () => {
          await addFlexTest(testId, value ?? 0);
          onClose();
        }}
      >
        Enregistrer
      </button>
    </Sheet>
  );
}
