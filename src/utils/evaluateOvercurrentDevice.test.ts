import { describe, expect, it } from 'vitest';
import type { OvercurrentProtectionDevice } from '../types/overcurrent';
import { evaluateOvercurrentDevice } from './evaluateOvercurrentDevice';

const device: OvercurrentProtectionDevice = {
  id: 'R1', label: 'R1', order: 1, kind: 'OVERCURRENT_50_51',
  settings: {
    ct: { primaryRatedA: 1000, secondaryRatedA: 1, ratioErrorPct: 0 },
    phase51: {
      enabled: true, pickupASecondary: 0.8, timingMode: 'INVERSE', inverseCurveId: 'IEC_SI', timeScale: 0.1, definiteDelaySec: 0.5,
    },
    phase50: { enabled: false, pickupASecondary: 3 },
    breaker: { clearingTimeSec: 0.1 },
  },
};

describe('safe Overcurrent static evaluator', () => {
  it('returns a structured VALID result', () => {
    const evaluation = evaluateOvercurrentDevice(1600, device);
    expect(evaluation.status).toBe('VALID');
    if (evaluation.status === 'VALID') expect(evaluation.value.selectedElement).toBe('51');
  });

  it('returns structured issues for invalid inputs instead of throwing', () => {
    expect(evaluateOvercurrentDevice(Number.POSITIVE_INFINITY, device).status).toBe('INVALID');
    expect(evaluateOvercurrentDevice(1000, {
      ...device,
      settings: { ...device.settings, ct: { ...device.settings.ct, primaryRatedA: 0 } },
    }).status).toBe('INVALID');
  });

  it('catches finite-input derived overflow as NUMERICAL_RANGE', () => {
    const evaluation = evaluateOvercurrentDevice(1e308, {
      ...device,
      settings: {
        ...device.settings,
        ct: { primaryRatedA: 1, secondaryRatedA: 1e308, ratioErrorPct: 0 },
      },
    });
    expect(evaluation.status).toBe('INVALID');
    if (evaluation.status === 'INVALID') expect(evaluation.issues.some((entry) => entry.code === 'NUMERICAL_RANGE')).toBe(true);
  });
  it('rejects negative/non-finite breaker clearing times before timeline phases consume them', () => {
    const negative = evaluateOvercurrentDevice(1000, {
      ...device,
      settings: { ...device.settings, breaker: { clearingTimeSec: -0.01 } },
    });
    expect(negative.status).toBe('INVALID');

    const nonFinite = evaluateOvercurrentDevice(1000, {
      ...device,
      settings: { ...device.settings, breaker: { clearingTimeSec: Number.POSITIVE_INFINITY } },
    });
    expect(nonFinite.status).toBe('INVALID');

    const zero = evaluateOvercurrentDevice(1000, {
      ...device,
      settings: { ...device.settings, breaker: { clearingTimeSec: 0 } },
    });
    expect(zero.status).toBe('VALID');
  });

});
