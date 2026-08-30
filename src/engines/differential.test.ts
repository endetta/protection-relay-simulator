import { describe, expect, it } from 'vitest';
import {
  calculateDifferential,
  operateLimit,
  validateDifferentialInputs,
  type DifferentialSettings,
} from './differential';

const settings: DifferentialSettings = {
  iSet: 0.2,
  biasBreakpoint1: 0.5,
  slope1: 25,
  biasBreakpoint2: 2,
  slope2: 50,
  characteristicMode: 'dual',
  biasBreakpoint3: 5,
  slope3: 80,
};

describe('Differential Relay Engine', () => {
  it('No-load: Idiff=0, Ibias=0, RESTRAIN', () => {
    const result = calculateDifferential({ i1: 0, i2: 0, ...settings });
    expect(result.iDiff).toBe(0);
    expect(result.iBias).toBe(0);
    expect(result.iOpLimit).toBeCloseTo(0.2, 8);
    expect(result.decision).toBe('RESTRAIN');
  });

  it('holds Iset horizontal through breakpoint 1', () => {
    expect(operateLimit(0, settings)).toBeCloseTo(0.2, 8);
    expect(operateLimit(0.25, settings)).toBeCloseTo(0.2, 8);
    expect(operateLimit(0.5, settings)).toBeCloseTo(0.2, 8);
  });

  it('is continuous at breakpoint 1 and breakpoint 2', () => {
    const eps = 1e-7;
    const bp1 = settings.biasBreakpoint1;
    const bp2 = settings.biasBreakpoint2;
    expect(operateLimit(bp1 - eps, settings)).toBeCloseTo(operateLimit(bp1 + eps, settings), 5);
    expect(operateLimit(bp2 - eps, settings)).toBeCloseTo(operateLimit(bp2 + eps, settings), 5);
    expect(operateLimit(bp2, settings)).toBeCloseTo(0.575, 8);
  });

  it('supports a continuous optional third slope', () => {
    const multi: DifferentialSettings = { ...settings, characteristicMode: 'multi' };
    const eps = 1e-7;
    expect(operateLimit(multi.biasBreakpoint3 - eps, multi)).toBeCloseTo(operateLimit(multi.biasBreakpoint3 + eps, multi), 5);
    expect(operateLimit(5, multi)).toBeCloseTo(2.075, 8);
    expect(operateLimit(6, multi)).toBeCloseTo(2.875, 8);
  });

  it('External fault (balanced): Idiff=0 and RESTRAIN', () => {
    const result = calculateDifferential({ i1: 4, i2: -4, ...settings });
    expect(result.iDiff).toBe(0);
    expect(result.iBias).toBe(4);
    expect(result.decision).toBe('RESTRAIN');
  });

  it('Internal fault: equal in-zone currents OPERATE', () => {
    const result = calculateDifferential({ i1: 2, i2: 2, ...settings });
    expect(result.iDiff).toBe(4);
    expect(result.iBias).toBe(2);
    expect(result.decision).toBe('OPERATE');
  });

  it('uses strict > at the exact decision boundary', () => {
    const boundary: DifferentialSettings = {
      ...settings,
      iSet: 0.2,
      slope1: 0,
      slope2: 0,
      slope3: 0,
    };
    const equal = calculateDifferential({ i1: 0.1, i2: 0.1, ...boundary });
    expect(equal.iDiff).toBeCloseTo(0.2, 8);
    expect(equal.iOpLimit).toBeCloseTo(0.2, 8);
    expect(equal.decision).toBe('RESTRAIN');

    const above = calculateDifferential({ i1: 0.1001, i2: 0.1001, ...boundary });
    expect(above.decision).toBe('OPERATE');
  });

  it('rejects non-finite currents instead of returning a relay decision', () => {
    const invalid = { i1: Number.POSITIVE_INFINITY, i2: 0, ...settings };
    expect(validateDifferentialInputs(invalid)).not.toHaveLength(0);
    expect(() => calculateDifferential(invalid)).toThrow(RangeError);
  });

  it('rejects invalid turning-point ordering and negative settings', () => {
    expect(() => calculateDifferential({ i1: 0, i2: 0, ...settings, biasBreakpoint2: 0.4 })).toThrow(RangeError);
    expect(() => calculateDifferential({ i1: 0, i2: 0, ...settings, iSet: -0.1 })).toThrow(RangeError);
    expect(() => calculateDifferential({ i1: 0, i2: 0, ...settings, slope1: -1 })).toThrow(RangeError);
    expect(() => calculateDifferential({ i1: 0, i2: 0, ...settings, characteristicMode: 'multi', biasBreakpoint3: 1.9 })).toThrow(RangeError);
  });
});

describe('numeric overflow hardening', () => {
  it('avoids avoidable Ibias overflow for very large opposing currents', () => {
    const result = calculateDifferential({ i1: 1e308, i2: -1e308, ...settings });
    expect(result.iBias).toBe(1e308);
    expect(result.iDiff).toBe(0);
  });

  it('rejects true differential-current overflow rather than returning Infinity', () => {
    expect(() => calculateDifferential({ i1: 1e308, i2: 1e308, ...settings })).toThrow(RangeError);
  });

  it('preserves large finite thresholds and rejects a genuinely overflowing operate threshold', () => {
    const extreme: DifferentialSettings = { ...settings, slope2: 1e308 };
    // 10 A bias produces 8e306 A, which is huge but still finite. The former
    // test incorrectly expected this vector to overflow. Use an actually
    // overflowing bias current to exercise the numeric guard without changing
    // frozen Differential production behavior.
    expect(operateLimit(10, extreme)).toBe(8e306);
    expect(() => operateLimit(1e308, extreme)).toThrow(RangeError);
  });
});
