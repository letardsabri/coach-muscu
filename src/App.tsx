import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import { MobilityContext } from './features/mobility/MobilityContext';
import { db } from './db/db';
import { ensureInitialized } from './db/init';
import { setSoundPrefs } from './lib/device';
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
const MobilityOverlay = lazy(() => import('./features/mobility/MobilityOverlay').then((m) => ({ default: m.MobilityOverlay })));
const NutritionScreen = lazy(() => import('./features/nutrition/NutritionScreen').then((m) => ({ default: m.NutritionScreen })));

type MainTab = Exclude<Tab, 'body' | 'review'>;

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
  /** Espace Souplesse ouvert (plein écran), avec éventuellement une séance lancée directement. */
  const [mobility, setMobility] = useState<{ routine?: string } | null>(null);
  const launcher = useMemo(() => ({ open: (routine?: string) => setMobility({ routine }) }), []);
  const active = useLiveQuery(() => getActiveSession(), []);
  const soundProfile = useLiveQuery(() => db.profile.get('me'), []);
  useEffect(() => {
    if (soundProfile) setSoundPrefs({ volume: soundProfile.soundVolume ?? 0.8, mode: soundProfile.soundMode ?? 'mix' });
  }, [soundProfile]);

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

  // Souplesse ouverte (séance guidée comprise) : plein écran, au-dessus de tout.
  if (mobility) {
    return (
      <MobilityContext.Provider value={launcher}>
        <Suspense fallback={null}>
          <MobilityOverlay initialRoutine={mobility.routine} onClose={() => setMobility(null)} />
        </Suspense>
      </MobilityContext.Provider>
    );
  }

  // Une séance en cours s'ouvre directement, y compris après fermeture de l'app.
  if (active && active.id !== pausedId) {
    return (
      <MobilityContext.Provider value={launcher}>
        <WorkoutScreen key={active.id} sessionId={active.id} onPause={() => setPausedId(active.id)} />
      </MobilityContext.Provider>
    );
  }

  const navigate = (t: Tab) => {
    if (t === 'body' || t === 'review') {
      setProgressView(t === 'body' ? 'corps' : 'bilan');
      setTab('progress');
    } else {
      if (t === 'progress') setProgressView('force');
      setTab(t);
    }
  };

  return (
    <MobilityContext.Provider value={launcher}>
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
    </MobilityContext.Provider>
  );
}
