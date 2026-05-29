import { describe, it, expect } from 'vitest';
import {
  classifyReadinessState,
  computeRecentFatigueAvg,
  type ClassifyReadinessInput,
  type FatigueDimensions,
} from '@/lib/readiness/snapshot';

// Helper: base input with enough fatigue responses and ACWR data
function base(overrides: Partial<ClassifyReadinessInput> = {}): ClassifyReadinessInput {
  return {
    acwrState: 'ready',
    recentFatigueAvg: 3.5,
    attendanceRate: null,
    acwrSufficient: true,
    fatigueResponseCount: 4,
    ...overrides,
  };
}

describe('classifyReadinessState — data sufficiency', () => {
  it('returns neutral when fatigueResponseCount = 0', () => {
    expect(classifyReadinessState(base({ fatigueResponseCount: 0 }))).toBe('neutral');
  });

  it('returns neutral when fatigueResponseCount = 1', () => {
    expect(classifyReadinessState(base({ fatigueResponseCount: 1, acwrState: 'alert', recentFatigueAvg: 1.0 }))).toBe('neutral');
  });

  it('returns non-neutral once fatigueResponseCount >= 2, regardless of acwrSufficient', () => {
    // 2 responses, no ACWR history → still gets a state from fatigue avg
    expect(classifyReadinessState(base({
      fatigueResponseCount: 2,
      acwrSufficient: false,
      recentFatigueAvg: 3.5,
    }))).toBe('ready');
  });

  it('ignores ACWR alert when acwrSufficient=false', () => {
    // ACWR says alert but history is insufficient → only fatigue avg counts
    expect(classifyReadinessState(base({
      fatigueResponseCount: 2,
      acwrSufficient: false,
      acwrState: 'alert',
      recentFatigueAvg: 3.5,
    }))).toBe('ready');
  });

  it('ignores ACWR caution when acwrSufficient=false', () => {
    expect(classifyReadinessState(base({
      fatigueResponseCount: 3,
      acwrSufficient: false,
      acwrState: 'caution',
      recentFatigueAvg: 3.5,
    }))).toBe('ready');
  });

  it('returns alert from fatigue avg when acwrSufficient=false but fatigueResponseCount >= 2', () => {
    expect(classifyReadinessState(base({
      fatigueResponseCount: 2,
      acwrSufficient: false,
      acwrState: 'neutral',
      recentFatigueAvg: 1.5,
    }))).toBe('alert');
  });

  it('returns caution from fatigue avg when acwrSufficient=false but fatigueResponseCount >= 2', () => {
    expect(classifyReadinessState(base({
      fatigueResponseCount: 2,
      acwrSufficient: false,
      acwrState: 'neutral',
      recentFatigueAvg: 2.5,
    }))).toBe('caution');
  });
});

describe('classifyReadinessState — ACWR signals (acwrSufficient=true)', () => {
  it('returns alert when acwrState is alert', () => {
    expect(classifyReadinessState(base({ acwrState: 'alert', recentFatigueAvg: 3.5 }))).toBe('alert');
  });

  it('returns alert when recentFatigueAvg <= 2.0', () => {
    expect(classifyReadinessState(base({ acwrState: 'ready', recentFatigueAvg: 2.0 }))).toBe('alert');
  });

  it('returns alert when attendanceRate < 0.5', () => {
    expect(classifyReadinessState(base({ acwrState: 'ready', recentFatigueAvg: 3.5, attendanceRate: 0.4 }))).toBe('alert');
  });

  it('ignores null attendanceRate', () => {
    expect(classifyReadinessState(base({ acwrState: 'ready', recentFatigueAvg: 3.5, attendanceRate: null }))).toBe('ready');
  });

  it('returns caution when acwrState is caution', () => {
    expect(classifyReadinessState(base({ acwrState: 'caution', recentFatigueAvg: 3.5 }))).toBe('caution');
  });

  it('returns caution when recentFatigueAvg is 2.1-2.8', () => {
    expect(classifyReadinessState(base({ acwrState: 'ready', recentFatigueAvg: 2.5 }))).toBe('caution');
  });

  it('returns caution when attendanceRate 0.5-0.7', () => {
    expect(classifyReadinessState(base({ acwrState: 'ready', recentFatigueAvg: 3.5, attendanceRate: 0.6 }))).toBe('caution');
  });

  it('returns ready when all conditions are met', () => {
    expect(classifyReadinessState(base({ acwrState: 'ready', recentFatigueAvg: 3.5, attendanceRate: null }))).toBe('ready');
  });

  it('returns ready when acwrState is ready with high fatigue', () => {
    expect(classifyReadinessState(base({ acwrState: 'ready', recentFatigueAvg: 4.5, attendanceRate: 0.9 }))).toBe('ready');
  });

  it('prioritizes alert over caution over ready', () => {
    expect(classifyReadinessState(base({
      acwrState: 'alert',
      recentFatigueAvg: 2.5,
      attendanceRate: 0.6,
    }))).toBe('alert');

    expect(classifyReadinessState(base({
      acwrState: 'caution',
      recentFatigueAvg: 3.5,
      attendanceRate: 0.8,
    }))).toBe('caution');
  });
});

describe('computeRecentFatigueAvg', () => {
  it('returns null for empty array', () => {
    expect(computeRecentFatigueAvg([])).toBeNull();
  });

  it('computes average correctly for single response', () => {
    const responses: FatigueDimensions[] = [
      {
        dim_energy: 4,
        dim_focus: 3,
        dim_sleep: 5,
        dim_soreness: 2,
        dim_mood: 4,
      },
    ];
    const result = computeRecentFatigueAvg(responses);
    expect(result).toBeCloseTo(3.6, 1);
  });

  it('computes average correctly for multiple responses', () => {
    const responses: FatigueDimensions[] = [
      {
        dim_energy: 2,
        dim_focus: 2,
        dim_sleep: 2,
        dim_soreness: 2,
        dim_mood: 2,
      },
      {
        dim_energy: 4,
        dim_focus: 4,
        dim_sleep: 4,
        dim_soreness: 4,
        dim_mood: 4,
      },
    ];
    const result = computeRecentFatigueAvg(responses);
    // (2+2+2+2+2 + 4+4+4+4+4) / 10 = 30 / 10 = 3.0
    expect(result).toBeCloseTo(3.0, 1);
  });

  it('handles decimal values', () => {
    const responses: FatigueDimensions[] = [
      {
        dim_energy: 1.5,
        dim_focus: 2.5,
        dim_sleep: 3.5,
        dim_soreness: 4.5,
        dim_mood: 5.0,
      },
    ];
    const result = computeRecentFatigueAvg(responses);
    // (1.5+2.5+3.5+4.5+5.0) / 5 = 17.0 / 5 = 3.4
    expect(result).toBeCloseTo(3.4, 1);
  });

  it('handles edge case: all zeros', () => {
    const responses: FatigueDimensions[] = [
      {
        dim_energy: 0,
        dim_focus: 0,
        dim_sleep: 0,
        dim_soreness: 0,
        dim_mood: 0,
      },
    ];
    expect(computeRecentFatigueAvg(responses)).toBe(0);
  });

  it('handles edge case: all max values (5)', () => {
    const responses: FatigueDimensions[] = [
      {
        dim_energy: 5,
        dim_focus: 5,
        dim_sleep: 5,
        dim_soreness: 5,
        dim_mood: 5,
      },
    ];
    expect(computeRecentFatigueAvg(responses)).toBe(5);
  });

  it('correctly flattens multiple response dimensions', () => {
    const responses: FatigueDimensions[] = [
      {
        dim_energy: 1,
        dim_focus: 2,
        dim_sleep: 3,
        dim_soreness: 4,
        dim_mood: 5,
      },
      {
        dim_energy: 5,
        dim_focus: 4,
        dim_sleep: 3,
        dim_soreness: 2,
        dim_mood: 1,
      },
    ];
    // (1+2+3+4+5 + 5+4+3+2+1) / 10 = 30 / 10 = 3.0
    const result = computeRecentFatigueAvg(responses);
    expect(result).toBeCloseTo(3.0, 1);
  });
});
