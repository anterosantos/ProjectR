import { describe, it, expect } from 'vitest';
import {
  classifyReadinessState,
  computeRecentFatigueAvg,
  type ClassifyReadinessInput,
  type FatigueDimensions,
} from '@/lib/readiness/snapshot';

describe('classifyReadinessState', () => {
  it('returns neutral when dataSufficient=false, regardless of other inputs', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'alert',
      recentFatigueAvg: 1.0,
      attendanceRate: 0.2,
      dataSufficient: false,
    };
    expect(classifyReadinessState(input)).toBe('neutral');
  });

  it('returns alert when acwrState is alert', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'alert',
      recentFatigueAvg: 3.5,
      attendanceRate: null,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('alert');
  });

  it('returns alert when recentFatigueAvg <= 2.0', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'ready',
      recentFatigueAvg: 2.0,
      attendanceRate: null,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('alert');
  });

  it('returns alert when attendanceRate < 0.5', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'ready',
      recentFatigueAvg: 3.5,
      attendanceRate: 0.4,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('alert');
  });

  it('ignores null attendanceRate', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'ready',
      recentFatigueAvg: 3.5,
      attendanceRate: null,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('ready');
  });

  it('returns caution when acwrState is caution', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'caution',
      recentFatigueAvg: 3.5,
      attendanceRate: null,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('caution');
  });

  it('returns caution when recentFatigueAvg is 2.1-2.8', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'ready',
      recentFatigueAvg: 2.5,
      attendanceRate: null,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('caution');
  });

  it('returns caution when attendanceRate 0.5-0.7', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'ready',
      recentFatigueAvg: 3.5,
      attendanceRate: 0.6,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('caution');
  });

  it('returns ready when all conditions are met', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'ready',
      recentFatigueAvg: 3.5,
      attendanceRate: null,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('ready');
  });

  it('returns ready when acwrState is ready with high fatigue', () => {
    const input: ClassifyReadinessInput = {
      acwrState: 'ready',
      recentFatigueAvg: 4.5,
      attendanceRate: 0.9,
      dataSufficient: true,
    };
    expect(classifyReadinessState(input)).toBe('ready');
  });

  it('prioritizes alert over caution over ready', () => {
    const alertInput: ClassifyReadinessInput = {
      acwrState: 'alert',
      recentFatigueAvg: 2.5, // would be caution alone
      attendanceRate: 0.6, // would be caution alone
      dataSufficient: true,
    };
    expect(classifyReadinessState(alertInput)).toBe('alert');

    const cautionInput: ClassifyReadinessInput = {
      acwrState: 'caution',
      recentFatigueAvg: 3.5, // > 2.8
      attendanceRate: 0.8, // > 0.7
      dataSufficient: true,
    };
    expect(classifyReadinessState(cautionInput)).toBe('caution');
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
