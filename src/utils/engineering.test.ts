import { describe, expect, it } from 'vitest';
import { formatFrequencyHz, formatPerUnitDroop, parseEngineeringDraft, validateRange } from './engineering';

describe('engineering input validation', () => {
  it('rejects empty and non-finite drafts', () => {
    expect(parseEngineeringDraft('').valid).toBe(false);
    expect(parseEngineeringDraft('Infinity').valid).toBe(false);
    expect(parseEngineeringDraft('NaN').valid).toBe(false);
  });

  it('does not accept values outside a hard range', () => {
    expect(parseEngineeringDraft('0', 1, 10000).valid).toBe(false);
    expect(parseEngineeringDraft('1000', 1, 10000)).toEqual({ value: 1000, valid: true });
  });

  it('supports one-sided ranges', () => {
    expect(validateRange(0, 0)).toBe(true);
    expect(validateRange(-1, 0)).toBe(false);
  });
});

describe('underfrequency formatters', () => {
  it('formatFrequencyHz uses a fixed number of decimals', () => {
    expect(formatFrequencyHz(50)).toBe('50.00');
    expect(formatFrequencyHz(49.8630762209037)).toBe('49.86');
    expect(formatFrequencyHz(48.5, 3)).toBe('48.500');
  });

  it('formatFrequencyHz returns a placeholder for non-finite values', () => {
    expect(formatFrequencyHz(Number.NaN)).toBe('—');
    expect(formatFrequencyHz(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('formatPerUnitDroop renders a droop as a percentage', () => {
    expect(formatPerUnitDroop(0.05)).toBe('5.0 %');
    expect(formatPerUnitDroop(0.04)).toBe('4.0 %');
    expect(formatPerUnitDroop(Number.NaN)).toBe('—');
  });
});
