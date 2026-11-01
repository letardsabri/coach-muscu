import { describe, expect, it } from 'vitest';
import { nutritionConfig as cfg } from '../data/nutritionData';
import type { WaterEntry } from '../db/models';
import { defaultHydrationSettings, lastEntryOfDay, waterByDay, waterGoal } from './hydration';

const s = defaultHydrationSettings(cfg);

describe('objectif d’hydratation', () => {
  it('2,5 L un jour de repos', () => {
    expect(waterGoal(s, { strength: false, mma: null })).toMatchObject({ ml: 2500, bonusMl: 0, detail: '2,5 L' });
  });
  it('majoré les jours de séance et de MMA', () => {
    expect(waterGoal(s, { strength: true, mma: null }).ml).toBe(3000);
    expect(waterGoal(s, { strength: false, mma: 'technique' }).ml).toBe(3250);
    const both = waterGoal(s, { strength: true, mma: 'intense' });
    expect(both.ml).toBe(4000);
    expect(both.detail).toBe('2,5 L + 0,5 L (séance) + 1 L (MMA intense)');
  });
  it('respecte les réglages personnels', () => {
    expect(waterGoal({ ...s, baseMl: 3000, strengthBonusMl: 0 }, { strength: true, mma: null }).ml).toBe(3000);
  });
});

describe('historique', () => {
  const e = (id: string, day: string, ml: number, createdAt: number): WaterEntry => ({ id, day, ml, createdAt });
  const list = [e('a', '2026-11-02', 250, 1), e('b', '2026-11-02', 500, 3), e('c', '2026-11-03', 250, 2)];
  it('total par jour', () => {
    expect(waterByDay(list).get('2026-11-02')).toBe(750);
  });
  it('dernière saisie du jour', () => {
    expect(lastEntryOfDay(list, '2026-11-02')?.id).toBe('b');
    expect(lastEntryOfDay(list, '2026-11-04')).toBeUndefined();
  });
});
