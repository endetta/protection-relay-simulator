import { describe, expect, it } from 'vitest';
import { parseEngineeringDraft, validateRange } from './engineering';

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
