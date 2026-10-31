/**
 * Où en es-tu des critères de passage à la phase suivante (R7) ? Mis à jour en direct.
 */
import { programme } from '../../data/programme';
import { buildExposures, evaluatePhase, MAIN_LIFTS } from '../../engine/progression';
import { dayKey } from '../../lib/dates';
import { useHistory, useProfile, useProgramState } from '../data';

export function PhaseCriteria() {
  const profile = useProfile();
  const state = useProgramState();
  const data = useHistory();
  if (!profile || !state || !data) return null;

  const exposuresByExercise = Object.fromEntries(
    MAIN_LIFTS.map((id) => [id, buildExposures(programme, data.sessions, data.sets, id, profile.startWeightKg)]),
  );
  const { results, met, to } = evaluatePhase({
    p: programme,
    profile,
    state,
    today: dayKey(),
    sessions: data.sessions,
    tests: data.tests,
    exposuresByExercise,
  });

  if (!to) {
    return (
      <section className="card">
        <h3 className="card-h">Phase {state.phase} · {programme.phases[state.phase - 1]?.name}</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          Phase de croisière : les blocs Force et Hypertrophie alternent à chaque cycle.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="spread">
        <h3 className="card-h">Vers la phase {to}</h3>
        <span className={`chip ${met ? 'chip-ok' : ''}`}>
          {results.filter((r) => r.ok).length}/{results.length}
        </span>
      </div>
      <ul className="criteria">
        {results.map((r) => (
          <li key={r.label} className={r.ok ? 'ok' : ''}>
            <span aria-hidden>{r.ok ? '✓' : '○'}</span>
            {r.label.replace(/^Au moins (\d) parmi : /, 'Au moins $1 tests réussis : ')}
          </li>
        ))}
      </ul>
    </section>
  );
}
