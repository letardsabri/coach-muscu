/**
 * Réglages des rappels : activation, heure, message personnalisé (avec variables), export Calendrier.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { Reminder } from '../../db/models';
import { buildPlan } from '../../engine/planner';
import { buildCalendar } from '../../engine/schedule';
import { addDays, dayKey } from '../../lib/dates';
import { shareOrDownload } from '../../lib/files';
import { Toggle } from '../../ui/components';
import { useHistory, useProfile, useProgramState } from '../data';
import { buildEvents, buildIcs, exportable, resolveMessage, VARIABLES, type Vars } from './reminders';

const EXPORT_DAYS = 56;
const SAMPLE: Vars = { seance: 'A — Tirage', duree: '31', exercice1: 'Tractions pronation', phase: '1', semaine: '2' };

export function RemindersPanel() {
  const profile = useProfile();
  const state = useProgramState();
  const data = useHistory();
  const reminders = useLiveQuery(() => db.reminders.toArray(), []);
  const [status, setStatus] = useState<string | null>(null);

  if (!profile || !state || !data || !reminders) return null;
  const order = programme.reminders.map((r) => r.kind);
  const sorted = [...reminders].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const baseVars: Vars = { prenom: profile.firstName, poids_objectif: `${profile.goalWeightKg} kg` };

  const exportIcs = async () => {
    const today = dayKey();
    const calendar = buildCalendar({
      programme,
      profile,
      nextSessionType: state.nextSessionType,
      overrides: data.overrides,
      sessions: data.sessions,
      mma: data.mma,
      from: today,
      to: addDays(today, EXPORT_DAYS),
      today,
    });
    const events = buildEvents({
      p: programme,
      reminders,
      calendar,
      state,
      from: today,
      days: EXPORT_DAYS,
      baseVars,
      sessionInfo: (type) => {
        const plan = buildPlan({ programme, profile, state, type, today, lastSets: {} });
        return { name: `${type} — ${plan.name.split('—')[1]?.trim() ?? plan.name}`, minutes: plan.estimatedMin, firstExercise: plan.plan[0]?.name ?? '' };
      },
    });
    if (events.length === 0) {
      setStatus('Aucun rappel activé à exporter.');
      return;
    }
    const file = new File([buildIcs(events)], `coach-muscu-rappels-${today}.ics`, { type: 'text/calendar' });
    const result = await shareOrDownload(file, 'Rappels Coach Muscu');
    setStatus(result === 'cancelled' ? null : `${events.length} rappels exportés pour les ${EXPORT_DAYS / 7} prochaines semaines.`);
  };

  return (
    <>
      <section className="card">
        <h3 className="card-h">Ajouter au Calendrier de l'iPhone</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          Une app web ne peut pas envoyer de notification quand elle est fermée. Tes rappels passent donc par le Calendrier
          d'iOS, qui sonne à l'heure prévue avec ton message.
        </p>
        <ol className="steps">
          <li>Touche « Exporter » puis « Enregistrer dans Fichiers ».</li>
          <li>Ouvre le fichier dans l'app Fichiers, puis « Tout ajouter » au Calendrier.</li>
          <li>Si ton planning change, supprime les anciens rappels avant de ré-exporter (sinon doublons).</li>
        </ol>
        <button className="btn-primary" onClick={() => void exportIcs()}>
          Exporter les rappels ({EXPORT_DAYS / 7} semaines)
        </button>
        {status && <p style={{ fontSize: 14, color: 'var(--ok)' }}>{status}</p>}
      </section>

      {sorted.map((r) => (
        <ReminderCard key={r.id} reminder={r} vars={{ ...SAMPLE, ...baseVars }} />
      ))}

      <section className="card">
        <h3 className="card-h">Variables utilisables</h3>
        <ul className="vars">
          {VARIABLES.map((v) => (
            <li key={v.name}>
              <code>{v.name}</code> {v.help}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function ReminderCard({ reminder: r, vars }: { reminder: Reminder; vars: Vars }) {
  const [message, setMessage] = useState(r.message);
  const update = (patch: Partial<Reminder>) => db.reminders.update(r.id, { ...patch, updatedAt: Date.now() });
  const defaults = programme.reminders.find((d) => d.kind === r.kind);
  const when =
    r.days === 'training'
      ? 'jours de séance'
      : `${r.days.map((d) => ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'][d - 1]).join(', ')}${r.everyDays ? ` · toutes les ${r.everyDays / 7} sem.` : ''}`;

  return (
    <section className="card" style={{ gap: 10 }}>
      <Toggle label={r.label} hint={when} checked={r.enabled} onChange={(on) => void update({ enabled: on })} />
      {r.enabled && (
        <>
          <label className="field">
            <span>Heure</span>
            <input type="time" value={r.time} onChange={(e) => e.target.value && void update({ time: e.target.value })} />
          </label>
          <label className="field">
            <span>Message</span>
            <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} onBlur={() => void update({ message: message.trim() || r.message })} />
          </label>
          <p className="faint" style={{ fontSize: 13 }}>
            Aperçu : {resolveMessage(message, vars)}
          </p>
          {defaults && message !== defaults.message && (
            <button
              className="btn-ghost"
              style={{ alignSelf: 'flex-start', padding: 0 }}
              onClick={() => {
                setMessage(defaults.message);
                void update({ message: defaults.message });
              }}
            >
              Message par défaut
            </button>
          )}
          {!exportable(r) && (
            <p className="notes">
              Rappel conditionnel : il demande des notifications push (serveur), il n'est pas inclus dans l'export Calendrier.
            </p>
          )}
        </>
      )}
    </section>
  );
}
