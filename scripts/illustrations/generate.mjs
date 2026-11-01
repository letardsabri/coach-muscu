/**
 * Génère les illustrations provisoires (SVG) dans public/illustrations/ et une planche de contrôle
 * (public/illustrations/planche.html, non référencée par l'app).
 * Usage : npm run illustrations
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exercices, seances, souplesse } from './poses.mjs';
import { renderHeader, renderPose } from './render.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'public', 'illustrations');
const programme = JSON.parse(readFileSync(join(root, 'src/data/programme.json'), 'utf8'));
const soupleData = JSON.parse(readFileSync(join(root, 'src/data/souplesse.json'), 'utf8'));

const names = {
  ...Object.fromEntries(Object.entries(programme.exercises).map(([id, e]) => [id, e.name])),
  ...Object.fromEntries(soupleData.exercices.map((e) => [e.id, e.nom])),
};
const headerNames = { A: 'Séance A — Tirage', B: 'Séance B — Poussée', F: 'Séance F — Full body', abdos: 'Abdos', souplesse: 'Souplesse' };

const write = (dir, id, svg) => {
  mkdirSync(join(out, dir), { recursive: true });
  writeFileSync(join(out, dir, `${id}.svg`), svg);
};

const tiles = [];
for (const [dir, set] of [['exercices', exercices], ['souplesse', souplesse]]) {
  for (const [id, pose] of Object.entries(set)) {
    write(dir, id, renderPose(pose, names[id] ?? id));
    tiles.push(`<figure><img src="${dir}/${id}.svg" width="240" height="160"><figcaption>${names[id] ?? id}</figcaption></figure>`);
  }
}
const all = { ...exercices, ...souplesse };
for (const [id, def] of Object.entries(seances)) {
  write('seances', id, renderHeader(def, all, headerNames[id] ?? id));
  tiles.push(`<figure class="wide"><img src="seances/${id}.svg" width="360" height="140"><figcaption>${headerNames[id]}</figcaption></figure>`);
}

writeFileSync(
  join(out, 'planche.html'),
  `<!doctype html><meta charset="utf-8"><title>Planche</title><style>body{margin:0;background:#0b0b0c;color:#aaa;font:9px system-ui;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:4px}figure{margin:0}img{display:block;width:100%;height:auto}figure.wide{grid-column:span 2}</style>${tiles.join('')}`,
);
console.log(`${Object.keys(exercices).length} exercices, ${Object.keys(souplesse).length} souplesse, ${Object.keys(seances).length} en-têtes`);
