/**
 * Réglages : profil, objectif, planning, modes cheville / MMA.
 * Sous-pages : rappels et sauvegarde.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { RemindersPanel } from '../reminders/RemindersPanel';
import { BackupPanel } from './BackupPanel';
import { programme } from '../../data/programme';
import { db } from '../../db/db';
import type { IsoWeekday, Profile } from '../../db/models';
import { dayKey } from '../../lib/dates';
import { audioSessionSupported, playRestEnd, setSoundPrefs, unlockAudio } from '../../lib/device';
import { Segmented, Stepper, Toggle } from '../../ui/components';

const WEEKDAYS: { day: IsoWeekday; label: string }[] = [
  { day: 1, label: 'L' },
  { day: 2, label: 'M' },
  { day: 3, label: 'M' },
  { day: 4, label: 'J' },
  { day: 5, label: 'V' },
  { day: 6, label: 'S' },
  { day: 7, label: 'D' },
];

type Page = 'main' | 'reminders' | 'backup';

export function Settings({ initialPage = 'main' }: { initialPage?: Page }) {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const state = useLiveQuery(() => db.programState.get('current'), []);
  const [page, setPage] = useState<Page>(initialPage);
  if (!profile) return <main className="screen" />;

  if (page !== 'main') {
    return (
      <main className="screen">
        <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setPage('main')}>
          ‹ Réglages
        </button>
        <h1 className="screen-title">{page === 'reminders' ? 'Rappels' : 'Sauvegarde'}</h1>
        {page === 'reminders' ? <RemindersPanel /> : <BackupPanel />}
      </main>
    );
  }

  const update = (patch: Partial<Profile>) => db.profile.update('me', { ...patch, updatedAt: Date.now() });
  const toggleDay = (d: IsoWeekday) => {
    const days = profile.trainingDays.includes(d) ? profile.trainingDays.filter((x) => x !== d) : [...profile.trainingDays, d];
    void update({ trainingDays: days.sort((a, b) => a - b) });
  };
  const daysMismatch = profile.trainingDays.length !== profile.sessionsPerWeek;

  return (
    <main className="screen">
      <h1 className="screen-title">Réglages</h1>

      <section className="card" style={{ padding: '4px 0' }}>
        <button className="cal-row" onClick={() => setPage('reminders')}>
          <span className="cal-content">
            <b>Rappels</b>
            <small className="muted">Heures, messages personnalisés, export Calendrier</small>
          </span>
          <span className="faint">›</span>
        </button>
        <button className="cal-row" onClick={() => setPage('backup')}>
          <span className="cal-content">
            <b>Sauvegarde</b>
            <small className="muted">Exporter, restaurer, stockage</small>
          </span>
          <span className="faint">›</span>
        </button>
      </section>

      <section className="card">
        <h3 className="card-h">Profil</h3>
        <label className="field">
          <span>Prénom</span>
          <input
            type="text"
            defaultValue={profile.firstName}
            placeholder="Optionnel"
            autoComplete="given-name"
            onBlur={(e) => void update({ firstName: e.target.value.trim() })}
          />
        </label>
        <div className="inputs">
          <Stepper size="md" label="Taille" value={profile.heightCm} onChange={(v) => void update({ heightCm: v })} step={1} min={140} max={220} unit="cm" />
          <Stepper size="md" label="Année de naissance" value={profile.birthYear} onChange={(v) => void update({ birthYear: v })} step={1} min={1950} max={2015} />
        </div>
        <div className="inputs">
          <Stepper size="md" label="Poids de départ" value={profile.startWeightKg} onChange={(v) => void update({ startWeightKg: v })} step={0.5} min={40} max={200} unit="kg" />
          <Stepper size="md" label="Objectif" value={profile.goalWeightKg} onChange={(v) => void update({ goalWeightKg: v })} step={0.5} min={40} max={200} unit="kg" />
        </div>
      </section>

      <section className="card">
        <h3 className="card-h">Planning</h3>
        <p style={{ fontWeight: 600 }}>Séances par semaine</p>
        <Segmented
          ariaLabel="Séances par semaine"
          value={profile.sessionsPerWeek}
          onChange={(n) =>
            void update({
              sessionsPerWeek: n,
              trainingDays: (programme.schedule.defaultDays[String(n)] ?? profile.trainingDays) as IsoWeekday[],
            })
          }
          options={[
            { value: 2, label: '2', hint: 'full body' },
            { value: 3, label: '3', hint: 'conseillé' },
            { value: 4, label: '4', hint: 'phase 2+' },
          ]}
        />
        <p style={{ fontWeight: 600 }}>Jours d'entraînement</p>
        <div className="weekday-picker" role="group" aria-label="Jours d'entraînement">
          {WEEKDAYS.map(({ day, label }) => (
            <button key={day} aria-pressed={profile.trainingDays.includes(day)} className={profile.trainingDays.includes(day) ? 'on' : ''} onClick={() => toggleDay(day)}>
              {label}
            </button>
          ))}
        </div>
        {daysMismatch && (
          <p className="notes">
            {profile.trainingDays.length} jours choisis pour {profile.sessionsPerWeek} séances par semaine.
          </p>
        )}
      </section>

      <section className="card" style={{ gap: 4 }}>
        <Toggle
          label="Mode cheville blessée"
          hint="Exclut les exercices qui chargent la cheville, bras assis"
          checked={profile.ankleMode}
          onChange={(on) => void update(on ? { ankleMode: true, ankleHealedOn: undefined } : { ankleMode: false, ankleHealedOn: dayKey() })}
        />
        <Toggle label="MMA actif" hint="Phase 4 : ajuste volume et placement des séances" checked={profile.mmaMode} onChange={(on) => void update({ mmaMode: on })} />
        {state && (
          <Toggle
            label="Geler les charges"
            hint="Camp MMA / compétition : maintien, pas de hausse de lest ni d'haltère (§10.4)"
            checked={state.loadFrozen}
            onChange={(on) => void db.programState.update('current', { loadFrozen: on, updatedAt: Date.now() })}
          />
        )}
        <Toggle label="Son des alertes" hint="Fin de repos, changements en mode guidé" checked={profile.soundOn} onChange={(on) => void update({ soundOn: on })} />
        {profile.soundOn && <SoundSettings profile={profile} update={update} />}
      </section>

      <p className="faint" style={{ fontSize: 13, textAlign: 'center' }}>
        Programme v{programme.version} · {programme.updatedAt}
      </p>
    </main>
  );
}

function SoundSettings({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => Promise<number> }) {
  const volume = profile.soundVolume ?? 0.8;
  const mode = profile.soundMode ?? 'mix';
  return (
    <div className="sound-settings">
      <label className="field">
        <span>Volume de l'alerte : {Math.round(volume * 100)} %</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSoundPrefs({ volume: v });
            void update({ soundVolume: v });
          }}
        />
      </label>
      <div className="field">
        <span>Avec ta musique</span>
        <Segmented
          ariaLabel="Mode du son"
          value={mode}
          onChange={(m) => {
            setSoundPrefs({ mode: m });
            void update({ soundMode: m });
          }}
          options={[
            { value: 'mix', label: 'Baisse la musique', hint: 'conseillé' },
            { value: 'loud', label: 'Toujours audible', hint: 'coupe la musique' },
          ]}
        />
      </div>
      <p className="faint" style={{ fontSize: 13 }}>
        {mode === 'mix'
          ? 'La musique baisse le temps du bip puis reprend. Le bouton silencieux de l’iPhone coupe l’alerte.'
          : 'L’alerte sonne même en mode silencieux, mais iOS arrête alors ta musique.'}
        {!audioSessionSupported() && ' (Réglage sans effet sur ce navigateur : iOS 16.4 ou plus récent requis.)'}
      </p>
      <button
        className="btn-secondary"
        onClick={() => {
          unlockAudio();
          window.setTimeout(playRestEnd, 150);
        }}
      >
        Tester le son
      </button>
    </div>
  );
}
