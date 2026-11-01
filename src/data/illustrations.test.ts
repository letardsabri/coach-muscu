import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Illustration } from '../ui/Illustration';
import { illustrations } from './illustrationsData';
import { programme } from './programme';
import { souplesse } from './souplesseData';

// Fichiers présents dans public/illustrations (contenu brut des SVG), clé « illustrations/… ».
const files = Object.fromEntries(
  Object.entries(import.meta.glob('/public/illustrations/**/*.{svg,webp,png,jpg}', { query: '?raw', import: 'default', eager: true })).map(([k, v]) => [
    k.replace('/public/', ''),
    String(v),
  ]),
);

describe('illustrations.json', () => {
  it('chaque exercice de muscu, d’abdos et de souplesse a une image', () => {
    expect(Object.keys(programme.exercises).filter((id) => !illustrations.exercices[id])).toEqual([]);
    expect(souplesse.exercices.map((e) => e.id).filter((id) => !illustrations.souplesse[id])).toEqual([]);
  });

  it('chaque type de séance a un en-tête, plus Abdos et Souplesse', () => {
    for (const id of ['A', 'B', 'F', 'MIN', 'TEST', 'abdos', 'souplesse']) expect(illustrations.seances[id]).toBeDefined();
  });

  it('chaque fichier référencé existe et les SVG sont valides', () => {
    const paths = [...Object.values(illustrations.exercices), ...Object.values(illustrations.souplesse), ...Object.values(illustrations.seances)];
    expect(paths.filter((p) => !(p in files))).toEqual([]);
    for (const p of paths.filter((x) => x.endsWith('.svg'))) {
      const svg = files[p]!;
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).toContain('<title>');
    }
  });
});

describe('composant Illustration', () => {
  it('image en chargement différé quand elle existe', () => {
    const html = renderToStaticMarkup(createElement(Illustration, { kind: 'exercices', id: 'dips', alt: 'Dips', size: 'large' }));
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('illustrations/exercices/dips.svg');
  });

  it('placeholder sobre si aucune image n’est prévue', () => {
    const html = renderToStaticMarkup(createElement(Illustration, { kind: 'exercices', id: 'inconnu', alt: 'Planche', size: 'large' }));
    expect(html).toContain('illu-placeholder');
    expect(html).toContain('aria-label="Planche"');
    expect(html).not.toContain('<img');
  });
});
