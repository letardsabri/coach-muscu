/**
 * Ouverture de l'espace Mobilité depuis n'importe quel écran (accueil, calendrier, séance).
 * `routineId` lance directement la routine guidée ; sans argument, ouvre l'écran Mobilité.
 */
import { createContext, useContext } from 'react';

export interface MobilityLauncher {
  open: (routineId?: string) => void;
}

export const MobilityContext = createContext<MobilityLauncher>({ open: () => undefined });

export const useMobility = () => useContext(MobilityContext);
