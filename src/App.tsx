import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { ensureInitialized } from './db/init';
import { Calendar } from './features/calendar/Calendar';
import { evaluateStartup } from './features/coach/coachRepo';
import { Home } from './features/dashboard/Home';
import type { Tab } from './features/data';

// Écrans à graphiques chargés à la demande : Chart.js ne ralentit pas l'ouverture de l'app.
const Progress = lazy(() => import('./features/progress/Progress').then((m) => ({ default: m.Progress })));
const Body = lazy(() => import('./features/body/Body').then((m) => ({ default: m.Body })));
import { Settings } from './features/settings/Settings';
import { getActiveSession } from './features/workout/workoutRepo';
import { WorkoutScreen } from './features/workout/WorkoutScreen';
import { IconBody, IconCalendar, IconChart, IconHome, IconSettings } from './ui/icons';
import { UpdateBanner } from './ui/UpdateBanner';

const TABS: { id: Tab; label: string; icon: ComponentType }[] = [
  { id: 'home', label: 'Accueil', icon: IconHome },
  { id: 'progress', label: 'Progrès', icon: IconChart },
  { id: 'calendar', label: 'Calendrier', icon: IconCalendar },
  { id: 'body', label: 'Corps', icon: IconBody },
  { id: 'settings', label: 'Réglages', icon: IconSettings },
];

export function App() {
  const [init, setInit] = useState<'pending' | 'ok' | Error>('pending');
  const [tab, setTab] = useState<Tab>('home');
  /** Séance mise en pause par l'utilisateur : on reste sur les onglets jusqu'à « Reprendre ». */
  const [pausedId, setPausedId] = useState<string | null>(null);
  const active = useLiveQuery(() => getActiveSession(), []);

  useEffect(() => {
    ensureInitialized()
      .then(() => {
        setInit('ok');
        void evaluateStartup().catch((e: unknown) => console.error('Évaluation au démarrage impossible', e));
      })
      .catch((e: unknown) => setInit(e instanceof Error ? e : new Error(String(e))));
  }, []);

  if (init instanceof Error) return <pre className="fatal">{init.message}</pre>;
  if (init === 'pending') return null;

  // Une séance en cours s'ouvre directement, y compris après fermeture de l'app.
  if (active && active.id !== pausedId) {
    return <WorkoutScreen key={active.id} sessionId={active.id} onPause={() => setPausedId(active.id)} />;
  }

  return (
    <>
      <UpdateBanner hidden={Boolean(active)} />
      {tab === 'home' && <Home onResume={() => setPausedId(null)} onNavigate={setTab} />}
      <Suspense fallback={<main className="screen" />}>
        {tab === 'progress' && <Progress />}
        {tab === 'body' && <Body />}
      </Suspense>
      {tab === 'calendar' && <Calendar />}
      {tab === 'settings' && <Settings />}
      <nav className="nav" aria-label="Navigation principale">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
