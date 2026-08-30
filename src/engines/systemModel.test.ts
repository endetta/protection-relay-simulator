import { describe, expect, it } from 'vitest';
import { calculateSystemDerived, resolvePrimaryCurrents, validateLoadDrivenSystem } from './systemModel';
import { DEFAULT_SYSTEM } from '../utils/presets';

describe('Load-driven system model', () => {
  it('derives apparent power, loading, and both terminal currents from MW, PF, MVA and kV', () => {
    const result = calculateSystemDerived(DEFAULT_SYSTEM);
    expect(result.apparentLoadMVA).toBeCloseTo(15, 8);
    expect(result.loadingPct).toBeCloseTo(60, 8);
    expect(result.ratedI1A).toBeCloseTo(96.2250449, 6);
    expect(result.ratedI2A).toBeCloseTo(721.6878365, 6);
    expect(result.loadI1A).toBeCloseTo(57.7350269, 6);
    expect(result.loadI2A).toBeCloseTo(433.0127019, 6);
  });

  it('uses opposing signs for through-load and through-fault current', () => {
    const load = resolvePrimaryCurrents(DEFAULT_SYSTEM, { kind: 'load', currentMultiple: 1 });
    const external = resolvePrimaryCurrents(DEFAULT_SYSTEM, { kind: 'external-fault', currentMultiple: 5 });
    expect(load.i1p).toBeGreaterThan(0);
    expect(load.i2p).toBeLessThan(0);
    expect(external.i1p).toBeGreaterThan(0);
    expect(external.i2p).toBeLessThan(0);
  });

  it('uses both positive signed currents for an internal fault', () => {
    const internal = resolvePrimaryCurrents(DEFAULT_SYSTEM, { kind: 'internal-fault', currentMultiple: 5 });
    expect(internal.i1p).toBeGreaterThan(0);
    expect(internal.i2p).toBeGreaterThan(0);
  });

  it('rejects invalid power factor and voltage', () => {
    expect(validateLoadDrivenSystem({ ...DEFAULT_SYSTEM, powerFactor: 0 })).not.toHaveLength(0);
    expect(() => calculateSystemDerived({ ...DEFAULT_SYSTEM, side1KV: 0 })).toThrow(RangeError);
  });
});

describe('system numeric overflow hardening', () => {
  it('rejects finite system inputs whose derived apparent load overflows', () => {
    expect(() => calculateSystemDerived({ ...DEFAULT_SYSTEM, activeLoadMW: 1e308, powerFactor: 0.1 })).toThrow(RangeError);
  });

  it('rejects an overflowing fault current', () => {
    expect(() => resolvePrimaryCurrents(DEFAULT_SYSTEM, { kind: 'internal-fault', currentMultiple: 1e308 })).toThrow(RangeError);
  });
});
