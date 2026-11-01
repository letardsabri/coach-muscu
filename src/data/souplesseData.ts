/**
 * Souplesse MMA / Muay Thaï (souplesse.json), validée au chargement : références d'exercices,
 * remplacements en mode cheville, zones, blocs et paramètres de chaque mode vérifiés.
 */
import { z } from 'zod';
import raw from './souplesse.json';

const id = z.string().regex(/^[a-z0-9_]+$/);
const kg = z.number().positive();

const schema = z.object({
  version: z.number().int(),
  settings: z.object({
    prepSec: z.number().int().min(0).max(30),
    hold: z.object({ baseSec: z.number().int().positive(), stepSec: z.number().int().min(0), maxSec: z.number().int().positive() }),
    maxLevel: z.number().int().min(0),
    easyToLevelUp: z.number().int().positive(),
    repsParNiveau: z.number().int().min(0),
    chargesKg: z.array(kg).min(1),
    pnf: z.object({
      cycles: z.number().int().positive(),
      settleSec: z.number().int().min(0),
      contractSec: z.number().int().positive(),
      relaxSec: z.number().int().positive(),
    }),
    weeklyTarget: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  }),
  zones: z.array(z.object({ id, label: z.string() })),
  blocs: z.array(z.object({ id, label: z.string() })),
  exercices: z.array(
    z.object({
      id,
      nom: z.string(),
      zone: id,
      cotes: z.boolean(),
      /** Consigne de contraction si l'exercice se fait en PNF. */
      pnf: z.string().optional(),
      charge: z.boolean().default(false),
      chargesKg: z.array(kg).optional(),
      /** Étiquette affichée : « attention cheville », « progression lente »… */
      alerte: z.string().optional(),
      description: z.string(),
      consigne: z.string(),
      erreur: z.string(),
      cheville: z.enum(['aucune', 'faible', 'forte']),
      remplacement: id.optional(),
      noteCheville: z.string().optional(),
    }),
  ),
  seances: z.array(
    z.object({
      id,
      nom: z.string(),
      /** Durée annoncée (min), pour vérification. */
      duree: z.number().int().positive(),
      elements: z
        .array(
          z.object({
            bloc: id,
            exercice: id,
            mode: z.enum(['temps', 'reps', 'pnf']),
            secondes: z.number().int().positive().optional(),
            progressif: z.boolean().default(false),
            reps: z.number().int().positive().optional(),
            tempo: z.number().int().positive().optional(),
            passages: z.number().int().positive().default(1),
          }),
        )
        .min(1),
    }),
  ),
  anciennesRoutines: z.record(z.string(), z.string()).default({}),
  tests: z.array(
    z.object({ id, nom: z.string(), unite: z.string(), plusEstMieux: z.boolean(), protocole: z.string(), archive: z.boolean().default(false) }),
  ),
});

export type SouplesseData = z.infer<typeof schema>;
export type SoupleExercise = SouplesseData['exercices'][number];
export type Seance = SouplesseData['seances'][number];
export type SeanceElement = Seance['elements'][number];

export function parseSouplesse(input: unknown): SouplesseData {
  const data = schema.parse(input);
  const fail = (msg: string) => {
    throw new Error(`souplesse.json : ${msg}`);
  };
  const ex = new Map(data.exercices.map((e) => [e.id, e]));
  const zones = new Set(data.zones.map((z) => z.id));
  const blocs = new Set(data.blocs.map((b) => b.id));
  for (const e of data.exercices) {
    if (!zones.has(e.zone)) fail(`zone inconnue « ${e.zone} » (${e.id})`);
    if (e.remplacement) {
      const r = ex.get(e.remplacement);
      if (!r) fail(`remplacement inconnu « ${e.remplacement} » (${e.id})`);
      else if (r.cheville === 'forte') fail(`le remplaçant de ${e.id} charge aussi la cheville`);
    }
    if (e.cheville === 'forte' && !e.remplacement) fail(`${e.id} charge la cheville sans remplaçant`);
  }
  for (const s of data.seances) {
    for (const el of s.elements) {
      const e = ex.get(el.exercice);
      if (!e) fail(`exercice inconnu « ${el.exercice} » (${s.id})`);
      if (!blocs.has(el.bloc)) fail(`bloc inconnu « ${el.bloc} » (${s.id})`);
      if (el.mode === 'temps' && !el.secondes) fail(`${s.id} / ${el.exercice} : « secondes » manquant`);
      if (el.mode === 'reps' && (!el.reps || !el.tempo)) fail(`${s.id} / ${el.exercice} : « reps » et « tempo » requis`);
      if (el.mode === 'pnf' && !e?.pnf) fail(`${s.id} / ${el.exercice} : exercice sans consigne PNF`);
      // En mode cheville, le remplaçant doit pouvoir se faire dans le même mode.
      const r = e?.remplacement ? ex.get(e.remplacement) : undefined;
      if (el.mode === 'pnf' && r && !r.pnf) fail(`${s.id} / ${el.exercice} : le remplaçant ${r.id} n'a pas de PNF`);
    }
  }
  return data;
}

export const souplesse = parseSouplesse(raw);
