import { describe, expect, it } from 'vitest';
import raw from './programme.json';
import { parseProgramme, ProgrammeError } from './programme';

describe('programme.json', () => {
  it('est valide et cohérent', () => {
    expect(() => parseProgramme(raw)).not.toThrow();
  });

  it('signale un exercice inconnu', () => {
    const broken = structuredClone(raw) as typeof raw;
    broken.phases[0]!.blocks[0]!.sessions.A.slots[0]!.exerciseId = 'traction_inexistante';
    expect(() => parseProgramme(broken)).toThrow(ProgrammeError);
  });

  it('signale une fourchette inversée', () => {
    const broken = structuredClone(raw) as typeof raw;
    (broken.phases[0]!.blocks[0]!.sessions.A.slots[0] as { reps: number[] }).reps = [8, 3];
    expect(() => parseProgramme(broken)).toThrow(ProgrammeError);
  });
});
