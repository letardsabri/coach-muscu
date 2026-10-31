/**
 * Chargement et validation du programme.
 *
 * Au-delà du schéma Zod (forme des données), on vérifie ici la cohérence interne :
 * chaque référence à un exercice, une variante ou un test doit exister.
 */
import raw from './programme.json';
import { programmeSchema, type Programme, type SessionTemplate } from './programmeSchema';

export class ProgrammeError extends Error {
  constructor(public readonly issues: string[]) {
    super(`programme.json invalide :\n- ${issues.join('\n- ')}`);
    this.name = 'ProgrammeError';
  }
}

export function parseProgramme(input: unknown): Programme {
  const result = programmeSchema.safeParse(input);
  if (!result.success) {
    throw new ProgrammeError(result.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`));
  }
  const issues = checkReferences(result.data);
  if (issues.length > 0) throw new ProgrammeError(issues);
  return result.data;
}

function checkReferences(p: Programme): string[] {
  const issues: string[] = [];
  const exerciseIds = new Set(Object.keys(p.exercises));
  const testIds = new Set(p.tests.map((t) => t.id));

  for (const [exId, ex] of Object.entries(p.exercises)) {
    const variantIds = ex.variants.map((v) => v.id);
    if (!variantIds.includes(ex.defaultVariant)) {
      issues.push(`exercises.${exId}.defaultVariant "${ex.defaultVariant}" n'est pas une variante de l'exercice`);
    }
    if (new Set(variantIds).size !== variantIds.length) {
      issues.push(`exercises.${exId} : identifiants de variantes en double`);
    }
  }

  const checkExercise = (where: string, exId: string, variant?: string) => {
    const ex = p.exercises[exId];
    if (!ex) {
      issues.push(`${where} : exercice inconnu "${exId}"`);
      return;
    }
    if (variant && !ex.variants.some((v) => v.id === variant)) {
      issues.push(`${where} : variante "${variant}" inconnue pour "${exId}"`);
    }
  };

  const checkSession = (where: string, s: SessionTemplate) => {
    s.slots.forEach((slot, i) => {
      const at = `${where}.slots[${i}]`;
      if (slot.exerciseId) checkExercise(at, slot.exerciseId, slot.variantHint);
      slot.pick?.forEach((opt) => checkExercise(`${at}.pick`, opt.exerciseId));
      slot.alternatives.forEach((alt) => checkExercise(`${at}.alternatives`, alt));
      if (!slot.pick?.some((o) => o.when === 'default') && slot.pick) {
        issues.push(`${at}.pick : une option "default" est obligatoire`);
      }
    });
  };

  p.phases.forEach((phase, i) => {
    if (phase.number !== i + 1) issues.push(`phases[${i}] : numéro ${phase.number} attendu ${i + 1}`);
    phase.blocks.forEach((b) => {
      checkSession(`phase ${phase.number}.${b.id}.A`, b.sessions.A);
      checkSession(`phase ${phase.number}.${b.id}.B`, b.sessions.B);
    });
  });
  checkSession('commonSessions.F', p.commonSessions.F);
  checkSession('commonSessions.MIN', p.commonSessions.MIN);

  // Les créneaux « phase » doivent retrouver le même exercice dans A ou B de chaque phase.
  const phaseRefSlots = [...p.commonSessions.F.slots, ...p.commonSessions.MIN.slots].filter(
    (s) => s.reps === 'phase' || s.rir === 'phase',
  );
  for (const phase of p.phases) {
    for (const block of phase.blocks) {
      const all = [...block.sessions.A.slots, ...block.sessions.B.slots];
      for (const s of phaseRefSlots) {
        if (!all.some((x) => x.exerciseId === s.exerciseId)) {
          issues.push(`"${s.exerciseId}" (séance F/MIN) absent des séances de la phase ${phase.number}.${block.id}`);
        }
      }
    }
  }

  for (const t of p.tests) checkExercise(`tests.${t.id}`, t.exerciseId, t.variant);
  for (const tr of p.phaseTransitions) {
    const walk = (c: Programme['phaseTransitions'][number]['criteria'][number]): void => {
      if (c.type === 'test' && !testIds.has(c.test)) issues.push(`phaseTransitions : test inconnu "${c.test}"`);
      if (c.type === 'sessionTopReached' && !exerciseIds.has(c.exerciseId)) {
        issues.push(`phaseTransitions : exercice inconnu "${c.exerciseId}"`);
      }
      if (c.type === 'atLeast' || c.type === 'anyOf') c.items.forEach(walk);
    };
    tr.criteria.forEach(walk);
  }

  if (p.cycle.deloadWeek > p.cycle.weeks) issues.push('cycle.deloadWeek dépasse cycle.weeks');
  return issues;
}

/** Programme validé, chargé une seule fois. Une erreur ici bloque le démarrage avec un message clair. */
export const programme: Programme = parseProgramme(raw);
