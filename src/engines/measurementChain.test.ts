import { describe, expect, it } from 'vitest';
import { applyCT, ctSecondary, validateCTConfig, type CTConfig } from './measurementChain';

const base: CTConfig = { priRated: 1000, secRated: 1, errorPct: 0 };

describe('Measurement Chain (CT scaling model)', () => {
  it('converts primary to secondary by CT ratio', () => {
    expect(ctSecondary(1000, base)).toBeCloseTo(1, 6);
    expect(ctSecondary(600, base)).toBeCloseTo(0.6, 6);
  });

  it('preserves signed-current direction', () => {
    expect(ctSecondary(-1000, base)).toBeCloseTo(-1, 6);
  });

  it('applies ratio error to the secondary current', () => {
    expect(applyCT(1000, { priRated: 1000, secRated: 1, errorPct: 4 })).toBeCloseTo(1.04, 6);
    expect(applyCT(1000, { priRated: 1000, secRated: 1, errorPct: -4 })).toBeCloseTo(0.96, 6);
  });

  it('handles zero primary current', () => {
    expect(applyCT(0, base)).toBe(0);
  });

  it('rejects zero or non-finite CT ratings instead of producing Infinity/NaN', () => {
    const zeroPrimary = { priRated: 0, secRated: 1, errorPct: 0 };
    expect(validateCTConfig(zeroPrimary)).not.toHaveLength(0);
    expect(() => applyCT(1000, zeroPrimary)).toThrow(RangeError);
    expect(() => applyCT(Number.NaN, base)).toThrow(RangeError);
  });
});

describe('measurement numeric overflow hardening', () => {
  it('rejects finite inputs whose CT scaling overflows', () => {
    expect(() => applyCT(1e308, { priRated: 1, secRated: 5, errorPct: 10 })).toThrow(RangeError);
  });
});
