/** Carte Mobilité de l'accueil : routine recommandée du jour et suivi de la semaine. */
import { useLiveQuery } from 'dexie-react-hooks';
import { mobilite } from '../../data/mobiliteData';
import { db } from '../../db/db';
import { weekStats } from '../../engine/mobility';
import { weekStart } from '../../engine/schedule';
import { dayKey } from '../../lib/dates';
import { useMobility } from './MobilityContext';
import { routineName, useMobilityWeek } from './useMobility';

export function MobilityCard() {
  const { open } = useMobility();
  const reco = useMobilityWeek();
  const sessions = useLiveQuery(() => db.mobilitySessions.toArray(), []);
  if (!reco || !sessions) return null;
  const today = dayKey();
  const todayReco = reco.get(today);
  const doneToday = sessions.some((s) => s.day === today);
  const week = weekStats(sessions, weekStart(today));
  const { min, max } = mobilite.settings.weeklyTarget;

  return (
    <section className="card" onClick={() => open()} role="button">
      <div className="spread">
        <h3 className="card-h">Mobilité</h3>
        <span className={`chip num${week.sessions >= min ? ' chip-ok' : ''}`}>
          {week.sessions}/{min}–{max} cette sem.
        </span>
      </div>
      {todayReco && !doneToday ? (
        <div className="spread">
          <p className="muted" style={{ fontSize: 14 }}>
            Recommandé aujourd'hui : <b style={{ color: 'var(--text)' }}>{routineName(todayReco)}</b>
          </p>
          <button
            className="chip chip-btn chip-accent"
            onClick={(e) => {
              e.stopPropagation();
              open(todayReco);
            }}
          >
            Lancer
          </button>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 14 }}>
          {doneToday ? '✓ Séance de mobilité faite aujourd’hui.' : 'Pas de séance recommandée aujourd’hui. Les routines restent disponibles.'}
        </p>
      )}
    </section>
  );
}
