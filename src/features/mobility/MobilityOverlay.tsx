/** Espace Souplesse plein écran : liste des séances, ou séance guidée lancée directement. */
import { useState } from 'react';
import { souplesse } from '../../data/souplesseData';
import { dayKey } from '../../lib/dates';
import { useProfile } from '../data';
import { GuidedRoutine } from './GuidedRoutine';
import { MobilityScreen } from './MobilityScreen';
import { useMobilityWeek } from './useMobility';

export function MobilityOverlay({ initialRoutine, onClose }: { initialRoutine?: string; onClose: () => void }) {
  const profile = useProfile();
  const reco = useMobilityWeek();
  const [running, setRunning] = useState<string | undefined>(initialRoutine);
  if (!profile) return null;

  const routine = running ? souplesse.seances.find((r) => r.id === running) : undefined;
  if (routine) {
    return (
      <div className="overlay-screen">
        <GuidedRoutine
          routine={routine}
          profile={profile}
          // Lancée depuis un raccourci : on revient d'où l'on vient ; sinon à la liste des séances.
          onExit={() => (initialRoutine ? onClose() : setRunning(undefined))}
        />
      </div>
    );
  }
  return <MobilityScreen profile={profile} recommended={reco?.get(dayKey())} onStart={setRunning} onClose={onClose} />;
}
