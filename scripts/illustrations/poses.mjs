/**
 * Poses des illustrations provisoires (voir render.mjs pour le repère et les articulations).
 * Proportions : tronc ≈ 44, bras 24 + 22, cuisse 30, jambe 30, tête à ≈ 14 au-dessus des épaules.
 * Modifier une posture = changer quelques coordonnées, puis `npm run illustrations`.
 */

const quad = {
  // Quatre pattes, de profil, tête à gauche.
  h: [76, 94], n: [90, 102], p: [150, 102],
  e: [90, 121], w: [90, 140], E: [86, 121], W: [85, 140],
  k: [150, 140], f: [182, 140], K: [146, 140], F: [178, 140],
};

const supine = {
  // Allongé sur le dos, tête à gauche.
  h: [52, 130], n: [66, 135], p: [124, 135],
  e: [86, 140], w: [104, 140], E: [82, 140], W: [100, 140],
};

const prone = {
  // Allongé sur le ventre, tête à gauche.
  h: [52, 129], n: [66, 134], p: [126, 135],
  f: [196, 138], k: [160, 137], K: [158, 137], F: [194, 138],
};

export const exercices = {
  // ---------------------------------------------------------------- Tirage
  pullup_pronation: {
    front: true, ground: false,
    props: [{ t: 'bar', x1: 62, x2: 178, y: 18 }],
    h: [120, 36], n: [120, 52], p: [120, 96],
    e: [146, 42], w: [146, 18], E: [94, 42], W: [94, 18],
    k: [127, 122], f: [126, 148], K: [113, 122], F: [114, 148],
    accent: ['arms'],
    arrows: ['M186 112 V64'],
  },
  pullup_supination: {
    ground: false,
    props: [{ t: 'bar', x1: 80, x2: 170, y: 18 }],
    h: [112, 32], n: [116, 48], p: [108, 94],
    e: [136, 52], w: [130, 18], E: [132, 54], W: [126, 18],
    k: [122, 116], f: [108, 136], K: [118, 118], F: [104, 138],
    accent: ['upperArm', 'foreArm'],
    arrows: ['M170 112 V66'],
  },
  dips: {
    props: [{ t: 'stand', x1: 92, x2: 170, y: 80 }],
    h: [134, 50], n: [124, 64], p: [112, 106],
    e: [102, 74], w: [128, 80], E: [98, 72], W: [124, 80],
    k: [100, 128], f: [80, 120], K: [96, 128], F: [78, 122],
    accent: ['torso', 'arm'],
    arrows: ['M190 104 V56'],
  },
  pushup: {
    h: [62, 104], n: [76, 114], p: [140, 124],
    e: [62, 126], w: [80, 140], E: [58, 125], W: [76, 140],
    k: [170, 131], f: [200, 139], K: [168, 131], F: [198, 139],
    accent: ['torso', 'upperArm'],
    arrows: ['M100 100 V68'],
  },
  curl: {
    props: [{ t: 'box', x: 102, y: 110, w: 40 }, { t: 'db', x: 144, y: 70, v: true }, { t: 'db', x: 118, y: 106, v: true }],
    h: [122, 48], n: [122, 64], p: [122, 108],
    e: [124, 88], w: [144, 72], E: [120, 88], W: [118, 104],
    k: [154, 110], f: [154, 140], K: [150, 110], F: [150, 140],
    accent: ['upperArm'],
    arrows: ['M170 104 Q178 80 160 62'],
  },
  rear_delt_fly: {
    props: [{ t: 'box', x: 88, y: 110, w: 40 }, { t: 'db', x: 146, y: 46, v: true }, { t: 'db', x: 154, y: 126, v: true }],
    h: [168, 86], n: [152, 90], p: [110, 108],
    e: [150, 68], w: [146, 50], E: [154, 108], W: [154, 124],
    k: [144, 110], f: [146, 140], K: [140, 110], F: [142, 140],
    accent: ['upperArm'],
    arrows: ['M182 66 Q184 44 164 36'],
  },
  inverted_row: {
    props: [{ t: 'stand', x1: 96, x2: 150, y: 74 }],
    h: [92, 94], n: [106, 100], p: [150, 118],
    e: [98, 80], w: [120, 74], E: [94, 82], W: [116, 74],
    k: [178, 128], f: [204, 138], K: [176, 128], F: [202, 138],
    accent: ['upperArm', 'torso'],
    arrows: ['M70 118 V86'],
  },
  lateral_raise: {
    front: true,
    props: [{ t: 'box', x: 96, y: 112, w: 48 }, { t: 'db', x: 70, y: 70, v: true }, { t: 'db', x: 170, y: 70, v: true }],
    h: [120, 46], n: [120, 62], p: [120, 106],
    e: [144, 66], w: [168, 70], E: [96, 66], W: [72, 70],
    k: [134, 114], f: [136, 140], K: [106, 114], F: [104, 140],
    accent: ['upperArm', 'farUpperArm'],
    arrows: ['M190 116 Q198 92 188 74', 'M50 116 Q42 92 52 74'],
  },
  triceps_overhead: {
    props: [{ t: 'box', x: 102, y: 110, w: 40 }, { t: 'db', x: 104, y: 56, v: true }],
    h: [126, 48], n: [122, 64], p: [122, 108],
    e: [120, 38], w: [104, 56], E: [116, 38], W: [100, 58],
    k: [154, 110], f: [154, 140], K: [150, 110], F: [150, 140],
    accent: ['upperArm', 'farUpperArm'],
    arrows: ['M90 64 Q84 34 112 24'],
  },
  // ---------------------------------------------------------------- Abdos
  hanging_knee_raise: {
    ground: false,
    props: [{ t: 'bar', x1: 80, x2: 170, y: 16 }],
    h: [130, 44], n: [120, 58], p: [118, 104],
    e: [120, 38], w: [120, 16], E: [116, 38], W: [116, 16],
    k: [146, 96], f: [150, 126], K: [142, 98], F: [146, 128],
    accent: ['torso'],
    arrows: ['M176 134 Q186 108 172 88'],
  },
  side_plank: {
    front: true,
    h: [66, 98], n: [78, 110], p: [138, 122],
    e: [80, 140], w: [100, 140], E: [86, 86], W: [92, 62],
    k: [170, 131], f: [202, 139], K: [168, 128], F: [200, 135],
    accent: ['torso'],
    arrows: ['M138 140 V132'],
  },
  lsit: {
    props: [{ t: 'stand', x1: 92, x2: 132, y: 86 }],
    h: [116, 26], n: [112, 40], p: [108, 84],
    e: [112, 62], w: [112, 86], E: [108, 62], W: [108, 86],
    k: [138, 84], f: [168, 82], K: [136, 82], F: [166, 80],
    accent: ['torso', 'thigh'],
    arrows: ['M184 104 V88'],
  },
  weighted_crunch: {
    props: [{ t: 'db', x: 100, y: 108 }],
    h: [80, 112], n: [92, 122], p: [134, 136],
    e: [108, 116], w: [100, 108], E: [104, 118], W: [98, 110],
    k: [154, 108], f: [172, 140], K: [150, 108], F: [168, 140],
    accent: ['torso'],
    arrows: ['M66 136 Q60 112 78 96'],
  },
  // ---------------------------------------------------------------- Jambes
  glute_bridge_single: {
    h: [56, 131], n: [70, 136], p: [124, 108],
    e: [90, 140], w: [110, 140],
    k: [154, 108], f: [158, 140], K: [160, 94], F: [192, 82],
    accent: ['thigh', 'torso'],
    arrows: ['M124 136 V120'],
  },
  split_squat: {
    props: [{ t: 'db', x: 116, y: 100, v: true }],
    h: [118, 44], n: [118, 58], p: [118, 102],
    e: [118, 80], w: [116, 98],
    k: [148, 106], f: [150, 140], K: [100, 134], F: [72, 136],
    accent: ['thigh'],
    arrows: ['M178 76 V112'],
  },
  bulgarian_split_squat: {
    props: [{ t: 'box', x: 44, y: 114, w: 36 }, { t: 'db', x: 124, y: 102, v: true }],
    h: [126, 46], n: [126, 60], p: [124, 104],
    e: [126, 82], w: [124, 100],
    k: [154, 110], f: [156, 140], K: [100, 132], F: [72, 114],
    accent: ['thigh'],
    arrows: ['M184 78 V114'],
  },
  single_leg_rdl: {
    props: [{ t: 'db', x: 160, y: 120, v: true }],
    h: [172, 78], n: [158, 84], p: [118, 86],
    e: [160, 104], w: [160, 120],
    k: [120, 114], f: [120, 140], K: [90, 84], F: [60, 80],
    noFarArm: true,
    accent: ['thigh'],
    arrows: ['M192 112 Q196 92 182 70'],
  },
};

export const souplesse = {
  // ---------------------------------------------------------------- Préparation / dos
  chat_vache: {
    ...quad, c: [120, 80],
    accent: ['torso'],
    arrows: ['M120 70 V52', 'M120 122 V136'],
  },
  essuie_glaces: {
    ...supine,
    k: [150, 106], f: [168, 138], K: [160, 114], F: [172, 140],
    accent: ['thigh', 'farThigh'],
    arrows: ['M130 92 Q156 74 182 94'],
  },
  hip_cars: {
    ...quad,
    k: [170, 112], f: [196, 124],
    accent: ['thigh'],
    arrows: ['M190 94 Q214 104 200 130 Q184 146 168 128'],
  },
  rotations_thoraciques: {
    ...quad,
    h: [74, 90], e: [96, 74], w: [80, 86],
    accent: ['torso', 'upperArm'],
    arrows: ['M112 68 Q118 44 98 40'],
  },
  scorpions: {
    ...prone,
    e: [44, 140], w: [26, 140],
    k: [150, 100], f: [118, 84],
    accent: ['torso', 'thigh'],
    arrows: ['M176 92 Q160 62 128 70'],
  },
  jefferson_curl: {
    props: [{ t: 'db', x: 132, y: 132 }],
    h: [134, 118], n: [140, 104], c: [154, 64], p: [118, 84],
    e: [138, 116], w: [134, 130], E: [134, 116], W: [130, 130],
    k: [120, 112], f: [120, 140], K: [116, 112], F: [116, 140],
    accent: ['torso'],
    arrows: ['M176 70 Q184 100 164 122'],
  },
  cobra_actif: {
    ...prone,
    h: [70, 92], n: [82, 106], c: [96, 132], p: [128, 135],
    e: [96, 124], w: [86, 140], E: [92, 124], W: [82, 140],
    accent: ['torso'],
    arrows: ['M56 126 V96'],
  },
  // ---------------------------------------------------------------- Adducteurs / écart
  grenouille: {
    front: true,
    h: [120, 80], n: [120, 92], p: [120, 116],
    e: [134, 118], w: [138, 140], E: [106, 118], W: [102, 140],
    k: [168, 138], f: [184, 126], K: [72, 138], F: [56, 126],
    accent: ['thigh', 'farThigh'],
    arrows: ['M120 52 V70'],
  },
  frog_rocks: {
    front: true,
    h: [120, 82], n: [120, 94], p: [120, 118],
    e: [134, 120], w: [138, 140], E: [106, 120], W: [102, 140],
    k: [168, 138], f: [184, 126], K: [72, 138], F: [56, 126],
    accent: ['thigh', 'farThigh'],
    arrows: ['M90 56 H150', 'M150 56 H90'],
  },
  pancake: {
    front: true,
    h: [120, 98], n: [120, 110], p: [120, 132],
    e: [132, 126], w: [134, 140], E: [108, 126], W: [106, 140],
    k: [164, 135], f: [206, 138], K: [76, 135], F: [34, 138],
    accent: ['thigh', 'farThigh'],
    arrows: ['M120 62 V84'],
  },
  pancake_charge: {
    front: true,
    props: [{ t: 'db', x: 120, y: 134 }],
    h: [120, 98], n: [120, 110], p: [120, 132],
    e: [130, 124], w: [124, 134], E: [110, 124], W: [116, 134],
    k: [164, 135], f: [206, 138], K: [76, 135], F: [34, 138],
    accent: ['thigh', 'farThigh'],
    arrows: ['M120 62 V84'],
  },
  papillon: {
    front: true,
    h: [120, 70], n: [120, 84], p: [120, 128],
    e: [142, 108], w: [154, 120], E: [98, 108], W: [86, 120],
    k: [160, 118], f: [124, 138], K: [80, 118], F: [116, 138],
    accent: ['thigh', 'farThigh'],
    arrows: ['M176 104 V128', 'M64 104 V128'],
  },
  cossack: {
    front: true,
    h: [92, 58], n: [96, 72], p: [102, 114],
    e: [112, 92], w: [126, 86], E: [86, 94], W: [104, 86],
    k: [72, 110], f: [62, 140], K: [150, 126], F: [198, 136],
    accent: ['farThigh', 'farShin'],
    arrows: ['M60 70 V100'],
  },
  straddle_mur: {
    front: true, ground: false,
    props: [{ t: 'mat', x1: 30, x2: 210 }],
    h: [120, 146], n: [120, 132], p: [120, 96],
    e: [100, 140], w: [80, 142], E: [140, 140], W: [160, 142],
    k: [148, 66], f: [176, 34], K: [92, 66], F: [64, 34],
    accent: ['legs'],
    arrows: ['M196 52 Q206 72 196 92', 'M44 52 Q34 72 44 92'],
  },
  releve_adducteur: {
    h: [46, 118], n: [60, 128], p: [124, 132],
    e: [44, 130], w: [40, 114], E: [80, 140], W: [100, 140],
    K: [150, 112], F: [152, 140], k: [164, 124], f: [202, 114],
    accent: ['thigh', 'shin'],
    arrows: ['M212 136 V116'],
  },
  // ---------------------------------------------------------------- Hanches / rotateurs
  hanches_90_90: {
    h: [150, 84], n: [140, 98], p: [116, 132],
    e: [148, 120], w: [154, 140], E: [144, 120], W: [148, 140],
    k: [154, 134], f: [144, 140], K: [82, 134], F: [84, 108],
    accent: ['thigh'],
  },
  switches_90_90: {
    h: [120, 72], n: [118, 86], p: [116, 132],
    e: [140, 92], w: [160, 92], E: [136, 94], W: [156, 94],
    k: [154, 134], f: [144, 140], K: [82, 134], F: [84, 108],
    accent: ['thigh', 'farThigh'],
    arrows: ['M84 92 Q118 66 152 94'],
  },
  pigeon: {
    h: [158, 92], n: [146, 102], p: [116, 128],
    e: [150, 122], w: [152, 140], E: [146, 122], W: [148, 140],
    k: [150, 136], f: [126, 140], K: [80, 138], F: [44, 140],
    accent: ['thigh'],
  },
  pigeon_allonge: {
    ...supine,
    e: [120, 118], w: [142, 112],
    K: [146, 104], F: [160, 140], k: [158, 112], f: [140, 100],
    accent: ['thigh'],
  },
  shin_box: {
    h: [124, 40], n: [122, 54], p: [120, 98],
    e: [138, 72], w: [152, 64], E: [134, 74], W: [148, 66],
    k: [126, 138], f: [100, 140], K: [86, 138], F: [70, 128],
    accent: ['thigh', 'torso'],
    arrows: ['M164 110 V74'],
  },
  // ---------------------------------------------------------------- Fléchisseurs / kicks
  fente_basse: {
    h: [128, 54], n: [126, 68], p: [122, 112],
    e: [146, 92], w: [158, 106], E: [142, 94], W: [154, 108],
    k: [164, 110], f: [166, 140], K: [88, 140], F: [58, 138],
    accent: ['farThigh'],
    arrows: ['M104 122 H134'],
  },
  elevations_laterales: {
    front: true,
    props: [{ t: 'pole', x: 56, y1: 48 }],
    h: [118, 22], n: [118, 38], p: [122, 84],
    e: [138, 60], w: [146, 80], E: [90, 52], W: [60, 62],
    k: [164, 78], f: [182, 102], K: [124, 112], F: [124, 140],
    accent: ['thigh'],
    arrows: ['M192 70 Q198 52 178 46'],
  },
  elevations_frontales: {
    props: [{ t: 'pole', x: 74, y1: 50 }],
    h: [104, 22], n: [106, 38], p: [110, 84],
    e: [92, 56], w: [76, 62],
    k: [140, 72], f: [172, 64], K: [112, 112], F: [112, 140],
    noFarArm: true,
    accent: ['thigh', 'shin'],
    arrows: ['M186 92 Q196 74 186 56'],
  },
  kicks_ralenti: {
    props: [{ t: 'pole', x: 62, y1: 52 }],
    h: [84, 32], n: [94, 46], p: [116, 86],
    e: [80, 60], w: [64, 66],
    k: [150, 72], f: [186, 60], K: [114, 114], F: [112, 140],
    noFarArm: true,
    accent: ['thigh', 'shin'],
    arrows: ['M150 112 Q186 104 196 74'],
  },
};

/** En-têtes de séance : poses réutilisées, mises à l'échelle dans un cadre 360 × 140. */
export const seances = {
  A: { halo: 0.7, figures: [{ pose: 'inverted_row', x: 10, y: 22, scale: 0.75, opacity: 0.35 }, { pose: 'pullup_pronation', x: 168, y: -6, scale: 0.92 }] },
  B: { halo: 0.7, figures: [{ pose: 'pushup', x: 6, y: 30, scale: 0.72, opacity: 0.35 }, { pose: 'dips', x: 150, y: -8, scale: 0.92 }] },
  F: { halo: 0.5, figures: [{ pose: 'pullup_pronation', x: 0, y: -2, scale: 0.85, opacity: 0.5 }, { pose: 'dips', x: 110, y: -2, scale: 0.85 }, { pose: 'split_squat', x: 210, y: -2, scale: 0.85, opacity: 0.5 }] },
  abdos: { halo: 0.68, figures: [{ pose: 'side_plank', x: 0, y: 30, scale: 0.72, opacity: 0.35 }, { pose: 'hanging_knee_raise', x: 156, y: -4, scale: 0.9 }] },
  souplesse: { halo: 0.6, figures: [{ pose: 'fente_basse', x: 0, y: 24, scale: 0.75, opacity: 0.35 }, { pose: 'pancake', x: 140, y: 6, scale: 0.88 }] },
};
