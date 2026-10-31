import { describe, expect, it } from 'vitest';
import { programme as p } from '../data/programme';
import type { MmaSession, Profile, ScheduleOverride, Session } from '../db/models';
import { addDays } from '../lib/dates';
import { rollingAverage, weightTrend } from './body';
import { e1rm, effectiveLoad } from './performance';
import { buildCalendar, weekStart, weeklyLoadUnits } from './schedule';

describe('poids (§12)', () => {
  it('moyenne glissante 7 jours', () => {
    const avg = rollingAverage([
      { day: '2026-11-01', value: 86 },
      { day: '2026-11-03', value: 85 },
      { day: '2026-11-09', value: 84 }, // 6 jours après le 3 : encore dans la fenêtre
      { day: '2026-11-10', value: 84 }, // 7 jours après le 3 : le 3 sort de la fenêtre
    ]);
    expect(avg.map((a) => a.value)).toEqual([86, 85.5, 84.5, 84]);
  });

  it('signale une perte trop rapide', () => {
    const pts = Array.from({ length: 29 }, (_, i) => ({ day: addDays('2026-11-01', i), value: 86 - i * 0.15 }));
    const t = weightTrend(pts, p, 78)!;
    expect(t.weeklyPct).toBeLessThan(-1);
    expect(t.message?.tone).toBe('warn');
  });

  it('perte dans la zone conseillée', () => {
    const pts = Array.from({ length: 29 }, (_, i) => ({ day: addDays('2026-11-01', i), value: 86 - i * 0.06 }));
    expect(weightTrend(pts, p, 78)!.message).toMatchObject({ tone: 'ok' });
  });
});

describe('performance (R5)', () => {
  it('charge effective : poids du corps × fraction × coef + lest', () => {
    expect(effectiveLoad(p, 'pullup_pronation', 'strict', 86, 0)).toBe(86);
    expect(effectiveLoad(p, 'pullup_pronation', 'weighted', 86, 5)).toBe(91);
    expect(effectiveLoad(p, 'pushup', 'feet_elevated', 80, 0)).toBeCloseTo(80 * 0.64 * 1.2);
    expect(effectiveLoad(p, 'curl', 'tempo', 86, 10)).toBeCloseTo(11);
  });

  it('perdre du poids à reps égales fait baisser la charge mais lest + reps compensent', () => {
    const before = e1rm(effectiveLoad(p, 'pullup_pronation', 'strict', 86, 0), 6, 2, 30);
    const after = e1rm(effectiveLoad(p, 'pullup_pronation', 'strict', 82, 0), 8, 2, 30);
    expect(after).toBeGreaterThan(before);
  });
});

const profile = {
  sessionsPerWeek: 3,
  trainingDays: [1, 3, 5],
} as Profile;

const session = (day: string, type: Session['type']): Session =>
  ({ id: day, day, type, status: 'completed', plan: [], results: [] }) as unknown as Session;

describe('calendrier', () => {
  const base = { programme: p, profile, overrides: [] as ScheduleOverride[], sessions: [] as Session[], mma: [] as MmaSession[] };

  it('semaine ISO commençant le lundi', () => {
    expect(weekStart('2026-11-05')).toBe('2026-11-02');
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
  });

  it('alterne A/B sur les jours prévus à partir d’aujourd’hui', () => {
    const days = buildCalendar({ ...base, nextSessionType: 'A', from: '2026-11-02', to: '2026-11-15', today: '2026-11-02' });
    const planned = days.filter((d) => d.planned).map((d) => `${d.day.slice(8)}${d.planned}`);
    expect(planned).toEqual(['02A', '04B', '06A', '09B', '11A', '13B']);
  });

  it('séance manquée : marquée, pas rattrapée', () => {
    const days = buildCalendar({ ...base, nextSessionType: 'A', from: '2026-11-02', to: '2026-11-08', today: '2026-11-05' });
    expect(days[0]!.missed).toBe(true);
    expect(days[2]!.missed).toBe(true);
    expect(days[4]!.planned).toBe('A');
  });

  it('les jours avant la première utilisation ne sont pas « manqués »', () => {
    const days = buildCalendar({ ...base, nextSessionType: 'A', from: '2026-11-02', to: '2026-11-08', today: '2026-11-07', trackingSince: '2026-11-05' });
    expect(days.filter((d) => d.missed).map((d) => d.day)).toEqual(['2026-11-06']);
  });

  it('décaler et annuler', () => {
    const overrides: ScheduleOverride[] = [
      { id: '1', day: '2026-11-03', action: 'move', fromDay: '2026-11-02', createdAt: 1 },
      { id: '2', day: '2026-11-06', action: 'skip', createdAt: 2 },
    ];
    const days = buildCalendar({ ...base, overrides, nextSessionType: 'A', from: '2026-11-02', to: '2026-11-08', today: '2026-11-02' });
    const planned = days.filter((d) => d.planned).map((d) => `${d.day.slice(8)}${d.planned}`);
    expect(planned).toEqual(['03A', '04B']);
    expect(days[1]!.movedFrom).toBe('2026-11-02');
  });

  it('avertit pour deux séances identiques à moins de 48 h et pour un tirage la veille d’un MMA intense', () => {
    const overrides: ScheduleOverride[] = [{ id: '1', day: '2026-11-03', action: 'add', sessionType: 'A', createdAt: 1 }];
    const mma: MmaSession[] = [{ id: 'm', day: '2026-11-05', kind: 'intense', durationMin: 60, done: false, createdAt: 0 }];
    const days = buildCalendar({ ...base, overrides, mma, nextSessionType: 'A', from: '2026-11-02', to: '2026-11-08', today: '2026-11-02' });
    expect(days[1]!.warnings.join()).toContain('48 h');
    // 02 A, 03 A (ajout), 04 B : trois jours d'affilée
    expect(days[2]!.warnings.join()).toContain("d'affilée");
  });

  it('les séances déjà faites comptent dans le calendrier', () => {
    const days = buildCalendar({
      ...base,
      sessions: [session('2026-11-02', 'A')],
      nextSessionType: 'B',
      from: '2026-11-02',
      to: '2026-11-08',
      today: '2026-11-03',
    });
    expect(days[0]!.done).toHaveLength(1);
    expect(days[0]!.missed).toBe(false);
    expect(days[2]!.planned).toBe('B');
  });

  it('unités de charge hebdomadaires', () => {
    const mma: MmaSession[] = [
      { id: 'a', day: '2026-11-03', kind: 'technique', durationMin: 60, done: true, createdAt: 0 },
      { id: 'b', day: '2026-11-05', kind: 'intense', durationMin: 60, done: true, createdAt: 0 },
    ];
    expect(weeklyLoadUnits(p, [session('2026-11-02', 'A'), session('2026-11-04', 'MIN')], mma)).toBe(1 + 0.5 + 1 + 2);
  });
});
