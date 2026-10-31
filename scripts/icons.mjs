/**
 * Génère les icônes de l'app à partir d'un SVG unique.
 * Usage : node scripts/icons.mjs   (à relancer seulement si le dessin change)
 *
 * - apple-touch-icon.png (180×180) : icône de l'écran d'accueil iPhone (iOS arrondit lui-même les coins)
 * - icon-192.png, icon-512.png     : manifest
 * - icon-512-maskable.png          : manifest, dessin réduit dans la zone de sécurité (80 %)
 * - favicon.svg
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

/** Barre de traction (claire) + chevron montant (orange) : la barre et la progression. */
function svg({ scale = 1, rounded = false } = {}) {
  const t = (256 * (1 - scale)).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="glow" cx="50%" cy="62%" r="62%">
      <stop offset="0" stop-color="#ff5a1f" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="#0b0b0c"/>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#glow)"/>
  <g transform="translate(${t} ${t}) scale(${scale})">
    <rect x="104" y="138" width="304" height="38" rx="19" fill="#f5f5f7"/>
    <polyline points="146,382 256,258 366,382" fill="none" stroke="#ff5a1f" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

const render = (svgText, size, name) =>
  sharp(Buffer.from(svgText)).resize(size, size).flatten({ background: '#0b0b0c' }).png().toFile(join(out, name));

await render(svg(), 180, 'apple-touch-icon.png');
await render(svg(), 192, 'icon-192.png');
await render(svg(), 512, 'icon-512.png');
await render(svg({ scale: 0.78 }), 512, 'icon-512-maskable.png');
writeFileSync(join(out, 'favicon.svg'), svg({ rounded: true }));
console.log('Icônes générées dans', out);
