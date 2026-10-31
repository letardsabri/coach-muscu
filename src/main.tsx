import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

// Chargement différé : si programme.json est invalide, l'erreur s'affiche au lieu d'un écran noir.
import('./App')
  .then(({ App }) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((error: unknown) => {
    root.render(<pre className="fatal">{error instanceof Error ? error.message : String(error)}</pre>);
  });
