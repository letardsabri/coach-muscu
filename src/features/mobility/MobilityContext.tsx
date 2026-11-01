/**
 * Ouverture de l'espace Souplesse depuis n'importe quel écran (accueil, calendrier).
 * `routineId` lance directement la séance guidée ; sans argument, ouvre l'écran Souplesse.
 */
import { createContext, useContext } from 'react';

export interface MobilityLauncher {
  open: (routineId?: string) => void;
}

export const MobilityContext = createContext<MobilityLauncher>({ open: () => undefined });

export const useMobility = () => useContext(MobilityContext);
