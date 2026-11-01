import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { ensureInitialized } from './db/init';
import { Calendar } from './features/calendar/Calendar';
import { evaluateStartup } from './features/coach/coachRepo';
import { Home } from './features/dashboard/Home';
import type { Tab } from './features/data';
import type { ProgressView } from './features/progress/Progress';
import { Settings } from './features/settings/Settings';
import { getActiveSession } from './features/workout/workoutRepo';
import { WorkoutScreen } from './features/workout/WorkoutScreen';
import { IconCalendar, IconChart, IconFood, IconHome, IconSettings } from './ui/icons';
import { UpdateBanner } from './ui/UpdateBanner';

// Écrans à graphiques chargés à la demande : Chart.js et la base d'aliments ne ralentissent pas l'ouverture.
const Progress = lazy(() => import('./features/progress/Progress').then((m) => ({ default: m.Progress })));
const NutritionScreen = lazy(() => import('./features/nutrition/NutritionScreen').then((m) => ({ default: m.NutritionScreen })));

type MainTab = Exclude<Tab, 'body'>;

const TABS: { id: MainTab; label: string; icon: ComponentType }[] = [
  { id: 'home', label: 'Accueil', icon: IconHome },
  { id: 'nutrition', label: 'Nutrition', icon: IconFood },
  { id: 'progress', label: 'Progrès', icon: IconChart },
  { id: 'calendar', label: 'Calendrier', icon: IconCalendar },
  { id: 'settings', label: 'Réglages', icon: IconSettings },
];

export function App() {
  const [init, setInit] = useState<'pending' | 'ok' | Error>('pending');
  const [tab, setTab] = useState<MainTab>('home');
  const [progressView, setProgressView] = useState<ProgressView>('force');
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

  const navigate = (t: Tab) => {
    if (t === 'body') {
      setProgressView('corps');
      setTab('progress');
    } else {
      if (t === 'progress') setProgressView('force');
      setTab(t);
    }
  };

  return (
    <>
      <UpdateBanner hidden={Boolean(active)} />
      {tab === 'home' && <Home onResume={() => setPausedId(null)} onNavigate={navigate} />}
      <Suspense fallback={<main className="screen" />}>
        {tab === 'nutrition' && <NutritionScreen />}
        {tab === 'progress' && <Progress key={progressView} initialView={progressView} />}
      </Suspense>
      {tab === 'calendar' && <Calendar />}
      {tab === 'settings' && <Settings />}
      <nav className="nav" aria-label="Navigation principale">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => navigate(id)}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
