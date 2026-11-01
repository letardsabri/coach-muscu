/**
 * Espace Mobilité : routines, suivi de la semaine, réglages, bibliothèque d'exercices, tests de souplesse.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { mobilite } from '../../data/mobiliteData';
import { db } from '../../db/db';
import type { Profile } from '../../db/models';
import { buildTimeline, regularityStreak, resolveExercise, weekStats } from '../../engine/mobility';
import { weekStart } from '../../engine/schedule';
import { dayKey } from '../../lib/dates';
import { LineChart } from '../../ui/charts';
import { NumberField, Sheet, Toggle } from '../../ui/components';
import { shortDate } from '../progress/stats';
import { addFlexTest, deleteFlexTest, updateMobilitySettings } from './mobilityRepo';

export function MobilityScreen(props: { profile: Profile; recommended?: string; onStart: (routineId: string) => void; onClose: () => void }) {
  const sessions = useLiveQuery(() => db.mobilitySessions.toArray(), []);
  const [openZone, setOpenZone] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  if (!sessions) return null;

  const settings = props.profile.mobility ?? { pnf: false, holdLevel: 0, easyStreak: 0 };
  const monday = weekStart(dayKey());
  const week = weekStats(sessions, monday);
  const { min, max } = mobilite.settings.weeklyTarget;
  const streak = regularityStreak(sessions, monday, min);
  const holdNow = 30 + settings.holdLevel * mobilite.settings.levelStepSec;

  return (
    <div className="overlay-screen">
      <main className="screen" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
        <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={props.onClose}>
          ‹ Retour
        </button>
        <h1 className="screen-title">Mobilité</h1>

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

        {mobilite.routines.map((r) => {
          const t = buildTimeline(r, mobilite, { ankleMode: props.profile.ankleMode, settings });
          const isReco = props.recommended === r.id;
          return (
            <section key={r.id} className={`card${isReco ? ' card-accent' : ''}`}>
              <div className="spread">
                <div>
                  {isReco && <p className="eyebrow" style={{ color: 'var(--accent)' }}>Recommandée aujourd'hui</p>}
                  <h3 className="card-h">{r.nom}</h3>
                  <small className="muted">{r.quand}</small>
                </div>
                <span className="chip num">{Math.round(t.totalSec / 60)} min</span>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>
                {[...new Set(t.steps.map((s) => s.exercise.nom))].join(' · ')}
              </p>
              {t.replaced.length > 0 && <p style={{ fontSize: 13, color: 'var(--warn)' }}>Mode cheville : {t.replaced.length} exercice(s) adapté(s).</p>}
              {r.type === 'echauffement' && <p className="faint" style={{ fontSize: 13 }}>Mouvements actifs uniquement : idéal juste avant une séance ou un MMA.</p>}
              <button className={isReco ? 'btn-primary' : 'btn-secondary'} onClick={() => props.onStart(r.id)}>
                Lancer
              </button>
            </section>
          );
        })}

        <section className="card" style={{ gap: 4 }}>
          <h3 className="card-h">Réglages</h3>
          <Toggle
            label="Méthode PNF (contracter-relâcher)"
            hint="Écart assis et ischios : étirer 20 s, contracter 6 s, relâcher et aller plus loin 20 s"
            checked={settings.pnf}
            onChange={(v) => void updateMobilitySettings({ pnf: v })}
          />
          <p className="muted" style={{ fontSize: 14 }}>
            Temps de maintien actuel : <b>{holdNow} s</b> pour une position de base de 30 s (niveau {settings.holdLevel}/{mobilite.settings.maxLevel}). Il
            augmente après 2 ressentis « facile » de suite, et diminue après un « difficile ».
          </p>
        </section>

        <section className="card" style={{ padding: '14px 18px' }}>
          <h3 className="card-h">Exercices</h3>
          {mobilite.zones.map((z) => {
            const list = mobilite.exercices.filter((e) => e.zone === z.id);
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
                    const used = resolveExercise(e.id, mobilite, props.profile.ankleMode);
                    return (
                      <article key={e.id} className="ex-info">
                        <b>
                          {e.nom}
                          {e.cheville === 'forte' && <span className="chip chip-warn" style={{ marginLeft: 6 }}>attention cheville</span>}
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
      {mobilite.tests.map((def) => {
        const list = tests.filter((t) => t.testId === def.id);
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
              {def.protocole} Test mensuel, optionnel.
            </p>
            <div className="spread">
              <button className="btn-secondary" style={{ width: 'auto', padding: '0 16px' }} onClick={() => onAdd(def.id)}>
                Nouveau test
              </button>
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
  const def = mobilite.tests.find((t) => t.id === testId)!;
  const [value, setValue] = useState<number | null>(null);
  const [negative, setNegative] = useState(false);
  return (
    <Sheet title={def.nom} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14 }}>
        {def.protocole}
      </p>
      <NumberField label="Mesure" value={value} onChange={setValue} unit={def.unite} autoFocus />
      {testId === 'doigts_orteils_cm' && (
        <Toggle label="Je n'atteins pas mes orteils" hint="La mesure est alors comptée en négatif" checked={negative} onChange={setNegative} />
      )}
      <button
        className="btn-primary"
        disabled={value === null}
        onClick={async () => {
          await addFlexTest(testId, negative ? -Math.abs(value ?? 0) : (value ?? 0));
          onClose();
        }}
      >
        Enregistrer
      </button>
    </Sheet>
  );
}
