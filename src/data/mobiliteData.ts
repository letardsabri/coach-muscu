/**
 * Étirements et mobilité (mobilite.json), validés au chargement : références d'exercices,
 * remplacements en mode cheville et zones vérifiés.
 */
import { z } from 'zod';
import raw from './mobilite.json';

const id = z.string().regex(/^[a-z0-9_]+$/);

const schema = z.object({
  version: z.number().int(),
  settings: z.object({
    prepSec: z.number().int().min(0).max(30),
    levelStepSec: z.number().int().min(0),
    maxHoldSec: z.number().int().positive(),
    maxLevel: z.number().int().min(0),
    easyToLevelUp: z.number().int().positive(),
    pnf: z.object({ stretchSec: z.number().int().positive(), contractSec: z.number().int().positive(), relaxSec: z.number().int().positive() }),
    weeklyTarget: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  }),
  zones: z.array(z.object({ id, label: z.string() })),
  exercices: z.array(
    z.object({
      id,
      nom: z.string(),
      zone: id,
      type: z.enum(['statique', 'dynamique']),
      cotes: z.boolean(),
      pnf: z.boolean().default(false),
      description: z.string(),
      consigne: z.string(),
      erreur: z.string(),
      cheville: z.enum(['aucune', 'faible', 'forte']),
      remplacement: id.optional(),
      noteCheville: z.string().optional(),
    }),
  ),
  routines: z.array(
    z.object({
      id,
      nom: z.string(),
      quand: z.string(),
      type: z.enum(['echauffement', 'souplesse', 'recuperation']),
      elements: z.array(z.object({ exercice: id, secondes: z.number().int().positive(), passages: z.number().int().positive().default(1) })).min(1),
    }),
  ),
  tests: z.array(z.object({ id, nom: z.string(), unite: z.string(), plusEstMieux: z.boolean(), protocole: z.string() })),
});

export type MobiliteData = z.infer<typeof schema>;
export type MobilityExercise = MobiliteData['exercices'][number];
export type Routine = MobiliteData['routines'][number];

export function parseMobilite(input: unknown): MobiliteData {
  const data = schema.parse(input);
  const ex = new Map(data.exercices.map((e) => [e.id, e]));
  const zones = new Set(data.zones.map((z) => z.id));
  for (const e of data.exercices) {
    if (!zones.has(e.zone)) throw new Error(`mobilite.json : zone inconnue « ${e.zone} » (${e.id})`);
    if (e.remplacement) {
      const r = ex.get(e.remplacement);
      if (!r) throw new Error(`mobilite.json : remplacement inconnu « ${e.remplacement} » (${e.id})`);
      if (r.cheville === 'forte') throw new Error(`mobilite.json : le remplaçant de ${e.id} charge aussi la cheville`);
    }
    if (e.cheville === 'forte' && !e.remplacement) throw new Error(`mobilite.json : ${e.id} charge la cheville sans remplaçant`);
  }
  for (const r of data.routines) {
    for (const el of r.elements) if (!ex.has(el.exercice)) throw new Error(`mobilite.json : exercice inconnu « ${el.exercice} » (${r.id})`);
  }
  return data;
}

export const mobilite = parseMobilite(raw);
