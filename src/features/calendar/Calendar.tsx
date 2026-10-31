/**
 * Calendrier hebdomadaire : alternance A/B projetée, repos, séances faites ou manquées, MMA.
 * Chaque jour s'ouvre pour décaler, annuler ou ajouter une séance, et saisir un entraînement MMA.
 */
import { useState } from 'react';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { MmaSession, Profile, ScheduleOverride } from '../../db/models';
import { buildCalendar, weekStart, weeklyLoadUnits, type CalendarDay } from '../../engine/schedule';
import { addDays, dayKey, diffDays, parseDay } from '../../lib/dates';
import { uuid } from '../../lib/id';
import { Segmented, Sheet, Stepper } from '../../ui/components';
import { SESSION_LABELS } from '../../ui/format';
import { useHistory, useProfile, useProgramState } from '../data';
import { shortDate } from '../progress/stats';

export function Calendar() {
  const profile = useProfile();
  const state = useProgramState();
  const data = useHistory();
  const [offset, setOffset] = useState(0);
  const [openDay, setOpenDay] = useState<string | null>(null);

  if (!profile || !state || !data) return <main className="screen" />;

  const today = dayKey();
  const from = addDays(weekStart(today), offset * 7);
  const days = buildCalendar({
    programme,
    profile,
    nextSessionType: state.nextSessionType,
    overrides: data.overrides,
    sessions: data.sessions,
    mma: data.mma,
    from,
    to: addDays(from, 6),
    today,
    trackingSince: dayKey(new Date(profile.createdAt)),
  });
  const selected = days.find((d) => d.day === openDay);
  const units = weeklyLoadUnits(
    programme,
    days.flatMap((d) => d.done),
    data.mma.filter((m) => diffDays(m.day, from) >= 0 && diffDays(addDays(from, 6), m.day) >= 0),
  );
  const plannedCount = days.filter((d) => d.planned).length + days.reduce((n, d) => n + d.done.length, 0);

  return (
    <main className="screen">
      <h1 className="screen-title">Calendrier</h1>

      <div className="spread">
        <button className="btn-ghost" aria-label="Semaine précédente" onClick={() => setOffset((o) => o - 1)}>
          ‹ Préc.
        </button>
        <button className="btn-ghost" style={{ color: 'var(--text)' }} onClick={() => setOffset(0)}>
          {offset === 0 ? 'Cette semaine' : `Semaine du ${shortDate(from)}`}
        </button>
        <button className="btn-ghost" aria-label="Semaine suivante" onClick={() => setOffset((o) => o + 1)}>
          Suiv. ›
        </button>
      </div>

      <div className="chips">
        <span className="chip num">{plannedCount} séances</span>
        {profile.mmaMode && (
          <span className={`chip num${units > programme.mma.budget.startUnits ? ' chip-warn' : ''}`}>
            Charge {units} / {programme.mma.budget.startUnits} UC
          </span>
        )}
      </div>

      <section className="card" style={{ padding: '4px 0' }}>
        {days.map((d) => (
          <DayRow key={d.day} day={d} today={today} onOpen={() => setOpenDay(d.day)} />
        ))}
      </section>

      <p className="faint" style={{ fontSize: 13 }}>
        L'alternance A/B est recalculée à chaque séance faite. Une séance manquée ne se rattrape pas : on reprend simplement à la
        suivante (R8).
      </p>

      {selected && (
        <DaySheet day={selected} today={today} profile={profile} overrides={data.overrides} onClose={() => setOpenDay(null)} />
      )}
    </main>
  );
}

function DayRow({ day, today, onOpen }: { day: CalendarDay; today: string; onOpen: () => void }) {
  const date = parseDay(day.day);
  const isToday = day.day === today;
  return (
    <button className={`cal-row${isToday ? ' today' : ''}`} onClick={onOpen}>
      <span className="cal-date">
        <b>{date.toLocaleDateString('fr-FR', { weekday: 'short' })}</b>
        <span className="num">{date.getDate()}</span>
      </span>
      <span className="cal-content">
        <span className="chips">
          {day.done.map((s) => (
            <span key={s.id} className="chip chip-ok">
              ✓ {s.type === 'A' || s.type === 'B' ? `${s.type} · ` : ''}
              {SESSION_LABELS[s.type]}
            </span>
          ))}
          {day.planned && (
            <span className="chip chip-accent">
              {day.planned} · {SESSION_LABELS[day.planned]}
              {day.movedFrom ? ' (décalée)' : ''}
            </span>
          )}
          {day.missed && <span className="chip chip-danger">Manquée</span>}
          {day.mma.map((m) => (
            <span key={m.id} className="chip">
              MMA {m.kind === 'intense' ? 'intense' : 'technique'}
            </span>
          ))}
          {!day.planned && day.done.length === 0 && !day.missed && day.mma.length === 0 && <span className="faint">Repos</span>}
        </span>
        {day.warnings.map((w) => (
          <small key={w} className="cal-warning">
            {w}
          </small>
        ))}
      </span>
      <span className="faint" aria-hidden>
        ›
      </span>
    </button>
  );
}

function DaySheet(props: { day: CalendarDay; today: string; profile: Profile; overrides: ScheduleOverride[]; onClose: () => void }) {
  const { day, today } = props;
  const [moving, setMoving] = useState(false);
  const [mmaKind, setMmaKind] = useState<MmaSession['kind']>('technique');
  const [mmaDuration, setMmaDuration] = useState(60);
  const isPast = diffDays(today, day.day) > 0;
  const related = props.overrides.filter((o) => o.day === day.day || o.fromDay === day.day);
  const title = parseDay(day.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const addOverride = async (o: Omit<ScheduleOverride, 'id' | 'createdAt'>) => {
    await db.scheduleOverrides.add({ ...o, id: uuid(), createdAt: Date.now() });
    props.onClose();
  };

  const targets = Array.from({ length: 8 }, (_, i) => addDays(day.day, i - 2)).filter(
    (d) => d !== day.day && diffDays(d, today) >= 0,
  );

  return (
    <Sheet title={title.charAt(0).toUpperCase() + title.slice(1)} onClose={props.onClose}>
      {day.warnings.length > 0 && (
        <div className="notes">
          {day.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      {day.done.map((s) => (
        <p key={s.id}>
          ✓ Séance {SESSION_LABELS[s.type]} terminée
        </p>
      ))}

      {day.planned && !moving && (
        <div className="menu-list">
          <p className="muted">
            Séance {day.planned} ({SESSION_LABELS[day.planned]}) prévue
          </p>
          <button onClick={() => setMoving(true)}>Décaler à un autre jour</button>
          <button onClick={() => void addOverride({ day: day.day, action: 'skip' })}>Annuler cette séance</button>
        </div>
      )}

      {moving && (
        <>
          <p className="muted">Décaler la séance au :</p>
          <div className="day-picker">
            {targets.map((d) => (
              <button key={d} onClick={() => void addOverride({ day: d, action: 'move', fromDay: day.day })}>
                {parseDay(d).toLocaleDateString('fr-FR', { weekday: 'short' })}
                <b className="num">{parseDay(d).getDate()}</b>
              </button>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 13 }}>
            Garde 48 h entre deux séances identiques ; l'app te prévient sinon.
          </p>
        </>
      )}

      {!day.planned && !isPast && day.done.length === 0 && (
        <div className="menu-list">
          <button onClick={() => void addOverride({ day: day.day, action: 'add' })}>Ajouter une séance ce jour-là</button>
        </div>
      )}

      {related.length > 0 && (
        <button
          className="btn-secondary"
          onClick={async () => {
            await db.scheduleOverrides.bulkDelete(related.map((o) => o.id));
            props.onClose();
          }}
        >
          Rétablir le planning habituel
        </button>
      )}

      <div className="card" style={{ gap: 12 }}>
        <h3 className="card-h">MMA</h3>
        {day.mma.map((m) => (
          <div key={m.id} className="spread">
            <span>
              {m.kind === 'intense' ? 'Intense / sparring' : 'Technique'} · {m.durationMin} min
            </span>
            <button className="btn-ghost btn-danger" onClick={() => void db.mmaSessions.delete(m.id)}>
              Supprimer
            </button>
          </div>
        ))}
        <Segmented
          ariaLabel="Type de séance MMA"
          value={mmaKind}
          onChange={setMmaKind}
          options={[
            { value: 'technique', label: 'Technique', hint: '1 UC' },
            { value: 'intense', label: 'Intense', hint: 'sparring · 2 UC' },
          ]}
        />
        <Stepper label="Durée" value={mmaDuration} onChange={setMmaDuration} step={15} min={15} max={240} unit="min" size="md" />
        <button
          className="btn-secondary"
          onClick={async () => {
            await db.mmaSessions.add({
              id: uuid(),
              day: day.day,
              kind: mmaKind,
              durationMin: mmaDuration,
              done: diffDays(today, day.day) >= 0,
              createdAt: Date.now(),
            });
          }}
        >
          Ajouter l'entraînement MMA
        </button>
        {!props.profile.mmaMode && <p className="faint" style={{ fontSize: 13 }}>Active « MMA actif » dans Réglages à la reprise pour adapter le volume.</p>}
      </div>
    </Sheet>
  );
}
