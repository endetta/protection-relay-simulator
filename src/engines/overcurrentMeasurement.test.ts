import { describe, expect, it } from 'vitest';
import { calculateCTMeasurement, validateCTConfiguration } from './overcurrentMeasurement';

const ct = { primaryRatedA: 1000, secondaryRatedA: 1, ratioErrorPct: 0 } as const;

describe('Overcurrent CT measurement', () => {
  it('scales primary current into CT-secondary amperes', () => {
    expect(calculateCTMeasurement(4000, ct)).toEqual({
      primaryCurrentA: 4000,
      idealSecondaryCurrentA: 4,
      measuredSecondaryCurrentA: 4,
    });
  });

  it('applies the signed O01 ratio-error convention', () => {
    const measured = calculateCTMeasurement(4000, { ...ct, ratioErrorPct: 2 });
    expect(measured.idealSecondaryCurrentA).toBeCloseTo(4, 12);
    expect(measured.measuredSecondaryCurrentA).toBeCloseTo(4.08, 12);
  });

  it('rejects zero CT rating and an error factor <= 0', () => {
    expect(validateCTConfiguration({ ...ct, primaryRatedA: 0 })).not.toHaveLength(0);
    expect(validateCTConfiguration({ ...ct, ratioErrorPct: -100 })).not.toHaveLength(0);
    expect(() => calculateCTMeasurement(1000, { ...ct, secondaryRatedA: 0 })).toThrow(RangeError);
  });

  it('rejects negative/non-finite primary current', () => {
    expect(() => calculateCTMeasurement(-1, ct)).toThrow(RangeError);
    expect(() => calculateCTMeasurement(Number.POSITIVE_INFINITY, ct)).toThrow(RangeError);
  });

  it('rejects derived overflow rather than returning Infinity', () => {
    expect(() => calculateCTMeasurement(1e308, { primaryRatedA: 1, secondaryRatedA: 1e308, ratioErrorPct: 0 })).toThrow(RangeError);
  });
  it('preserves representable extreme CT results when ratio-first arithmetic would underflow', () => {
    const measured = calculateCTMeasurement(1e308, {
      primaryRatedA: 1e308,
      secondaryRatedA: 1e-308,
      ratioErrorPct: 0,
    });
    expect(measured.idealSecondaryCurrentA).toBe(1e-308);
    expect(measured.measuredSecondaryCurrentA).toBe(1e-308);
  });

  it('preserves representable extreme CT results when current/rating-first arithmetic would underflow', () => {
    const measured = calculateCTMeasurement(1e-308, {
      primaryRatedA: 1e308,
      secondaryRatedA: 1e308,
      ratioErrorPct: 0,
    });
    expect(measured.idealSecondaryCurrentA).toBe(1e-308);
    expect(measured.measuredSecondaryCurrentA).toBe(1e-308);
  });

});
