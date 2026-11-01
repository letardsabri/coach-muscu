/**
 * Rendu SVG d'une silhouette stylisée à partir d'une pose (coordonnées des articulations).
 *
 * Repère : 240 × 160, sol à y = 141. Articulations :
 *   h tête · n épaules (cou) · p bassin · c point de contrôle du dos (courbe, optionnel)
 *   e/w coude/main proches · E/W coude/main éloignés
 *   k/f genou/pied proches · K/F genou/pied éloignés
 * Les membres éloignés sont plus sombres (vue de profil) ; `front: true` les dessine comme les proches.
 * Si un membre éloigné n'est pas donné, il est déduit du proche avec un léger décalage.
 * `accent` : segments en orange (torso, upperArm, foreArm, farUpperArm, farForeArm, thigh, shin,
 * farThigh, farShin ; raccourcis arm, farArm, leg, farLeg, arms, legs).
 */

export const W = 240;
export const H = 160;
export const GROUND = 141;

const C = {
  bg: '#141416',
  bgEdge: '#232327',
  body: '#ececee',
  far: '#7d7d84',
  prop: '#55555c',
  propLight: '#77777f',
  accent: '#ff5a1f',
  ground: '#2c2c31',
};

const ALIASES = {
  arm: ['upperArm', 'foreArm'],
  farArm: ['farUpperArm', 'farForeArm'],
  leg: ['thigh', 'shin'],
  farLeg: ['farThigh', 'farShin'],
  arms: ['upperArm', 'foreArm', 'farUpperArm', 'farForeArm'],
  legs: ['thigh', 'shin', 'farThigh', 'farShin'],
};

const r1 = (v) => Math.round(v * 10) / 10;
const pt = ([x, y]) => `${r1(x)} ${r1(y)}`;
const shift = (a, dx, dy) => (a ? [a[0] + dx, a[1] + dy] : a);

function line(a, b, color, width) {
  return `<path d="M${pt(a)} L${pt(b)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
}

function limb(a, b, c, colors, width) {
  // Deux segments (bras ou jambe), chacun pouvant être accentué.
  let out = '';
  if (a && b) out += line(a, b, colors[0], width);
  if (b && c) out += line(b, c, colors[1], width);
  return out;
}

function prop(pr) {
  switch (pr.t) {
    case 'bar':
      return `<path d="M${pr.x1} ${pr.y} H${pr.x2}" stroke="${C.propLight}" stroke-width="5" stroke-linecap="round"/>`;
    case 'stand':
      // Barre horizontale portée par deux montants (barres parallèles, barre basse).
      return (
        `<path d="M${pr.x1} ${pr.y} H${pr.x2}" stroke="${C.propLight}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M${pr.x1 + 6} ${pr.y} V${GROUND} M${pr.x2 - 6} ${pr.y} V${GROUND}" stroke="${C.prop}" stroke-width="4" stroke-linecap="round"/>`
      );
    case 'pole':
      return `<path d="M${pr.x} ${pr.y1} V${GROUND}" stroke="${C.prop}" stroke-width="5" stroke-linecap="round"/>`;
    case 'box':
      return `<rect x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${GROUND - pr.y}" rx="3" fill="${C.prop}"/>`;
    case 'wall':
      return `<path d="M${pr.x} 14 V${GROUND}" stroke="${C.prop}" stroke-width="6" stroke-linecap="round"/>`;
    case 'db': {
      // Haltère vu de côté : barre + deux disques ; `v` pour vertical.
      const [x, y] = [pr.x, pr.y];
      const s = pr.v
        ? `<rect x="${x - 6}" y="${y - 12}" width="12" height="7" rx="2"/><rect x="${x - 6}" y="${y + 5}" width="12" height="7" rx="2"/><rect x="${x - 1.5}" y="${y - 6}" width="3" height="12"/>`
        : `<rect x="${x - 12}" y="${y - 6}" width="7" height="12" rx="2"/><rect x="${x + 5}" y="${y - 6}" width="7" height="12" rx="2"/><rect x="${x - 6}" y="${y - 1.5}" width="12" height="3"/>`;
      return `<g fill="${C.propLight}">${s}</g>`;
    }
    case 'mat':
      return `<rect x="${pr.x1}" y="${GROUND - 2}" width="${pr.x2 - pr.x1}" height="5" rx="2.5" fill="${C.prop}"/>`;
    default:
      throw new Error(`accessoire inconnu ${pr.t}`);
  }
}

/** Corps seul (sans fond), pour réutiliser une pose dans un en-tête. */
export function figure(pose) {
  const acc = new Set((pose.accent ?? []).flatMap((a) => ALIASES[a] ?? [a]));
  const col = (name, far) => (acc.has(name) ? C.accent : far && !pose.front ? C.far : C.body);
  const { h, n, p, c, e, w, k, f } = pose;
  const E = pose.E ?? shift(e, -5, -3);
  const Wf = pose.W ?? shift(w, -5, -3);
  const K = pose.K ?? shift(k, -5, -2);
  const F = pose.F ?? shift(f, -5, -1);
  const limbW = 7.5;

  let s = '';
  // Membres éloignés derrière le corps.
  if (!pose.noFarLeg) s += limb(p, K, F, [col('farThigh', true), col('farShin', true)], limbW);
  if (!pose.noFarArm) s += limb(n, E, Wf, [col('farUpperArm', true), col('farForeArm', true)], limbW);
  // Tronc (courbe si point de contrôle), tête.
  const torsoCol = acc.has('torso') ? C.accent : C.body;
  s += c
    ? `<path d="M${pt(n)} Q${pt(c)} ${pt(p)}" stroke="${torsoCol}" stroke-width="11" stroke-linecap="round" fill="none"/>`
    : line(n, p, torsoCol, 11);
  s += `<circle cx="${r1(h[0])}" cy="${r1(h[1])}" r="9.5" fill="${C.body}"/>`;
  s += line(h, n, C.body, 6);
  // Membres proches devant.
  s += limb(p, k, f, [col('thigh'), col('shin')], limbW);
  s += limb(n, e, w, [col('upperArm'), col('foreArm')], limbW);
  return s;
}

function arrows(list = []) {
  return list
    .map(
      (d) =>
        `<path d="${d}" stroke="${C.accent}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85" marker-end="url(#fleche)"/>`,
    )
    .join('');
}

const DEFS = `<defs><marker id="fleche" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="${C.accent}"/></marker></defs>`;

export function renderPose(pose, title) {
  const props = (pose.props ?? []).map(prop).join('');
  const ground = pose.ground === false ? '' : `<path d="M18 ${GROUND + 1} H222" stroke="${C.ground}" stroke-width="3" stroke-linecap="round"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">` +
    `<title>${title}</title>${DEFS}` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="${C.bg}" stroke="${C.bgEdge}"/>` +
    ground +
    props +
    figure(pose) +
    arrows(pose.arrows) +
    `</svg>\n`
  );
}

/** En-tête de séance : 360 × 140, une ou plusieurs poses mises à l'échelle sur un halo orange. */
export function renderHeader(def, poses, title) {
  const HW = 360;
  const HH = 140;
  const figs = def.figures
    .map(({ pose, x, y, scale, opacity = 1 }) => {
      const pz = poses[pose];
      if (!pz) throw new Error(`en-tête ${title} : pose inconnue ${pose}`);
      const props = (pz.props ?? []).map(prop).join('');
      return `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">${props}${figure(pz)}</g>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HW} ${HH}" role="img" aria-label="${title}">` +
    `<title>${title}</title>` +
    `<defs><radialGradient id="halo" cx="${def.halo ?? 0.62}" cy="0.55" r="0.6"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.32"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="fond" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1b1f"/><stop offset="1" stop-color="#101012"/></linearGradient>` +
    `<clipPath id="cadre"><rect width="${HW}" height="${HH}" rx="18"/></clipPath></defs>` +
    `<g clip-path="url(#cadre)"><rect width="${HW}" height="${HH}" fill="url(#fond)"/><rect width="${HW}" height="${HH}" fill="url(#halo)"/>` +
    `<path d="M0 ${HH - 14} H${HW}" stroke="${C.ground}" stroke-width="3"/>` +
    figs +
    `</g></svg>\n`
  );
}
