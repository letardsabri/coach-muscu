/**
 * Service worker : l'app est entièrement mise en cache à la 1ʳᵉ ouverture et fonctionne ensuite hors ligne.
 * Quand une nouvelle version est publiée, on le signale sans jamais recharger de force
 * (le bandeau n'apparaît pas pendant une séance).
 */
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner({ hidden }: { hidden: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Vérifie les mises à jour toutes les heures quand l'app reste ouverte longtemps.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh || hidden) return null;
  return (
    <div className="update-banner" role="status">
      <span>Nouvelle version disponible</span>
      <span className="row">
        <button className="btn-ghost" onClick={() => setNeedRefresh(false)}>
          Plus tard
        </button>
        <button className="btn-primary" onClick={() => void updateServiceWorker(true)}>
          Mettre à jour
        </button>
      </span>
    </div>
  );
}
