import { describe, expect, it } from 'vitest';
import type { Overcurrent51Settings, OvercurrentProtectionDevice } from '../types/overcurrent';
import {
  calculateOvercurrent50,
  calculateOvercurrent51,
  calculateOvercurrentDevice,
  inverseOperateTimeSec,
  nearlyEqual,
} from './overcurrent';

const inverse51: Overcurrent51Settings = {
  enabled: true,
  pickupASecondary: 1,
  timingMode: 'INVERSE',
  inverseCurveId: 'IEC_SI',
  timeScale: 0.1,
  definiteDelaySec: 0.5,
};

const baseDevice: OvercurrentProtectionDevice = {
  id: 'R1',
  label: 'R1',
  order: 1,
  kind: 'OVERCURRENT_50_51',
  settings: {
    ct: { primaryRatedA: 1000, secondaryRatedA: 1, ratioErrorPct: 0 },
    phase51: { ...inverse51, pickupASecondary: 0.8 },
    phase50: { enabled: false, pickupASecondary: 3 },
    breaker: { clearingTimeSec: 0.1 },
  },
};

const referenceVectors = [
  ['IEC_SI', 2, 1.002902702], ['IEC_SI', 5, 0.427972007], ['IEC_SI', 10, 0.297059862],
  ['IEC_VI', 2, 1.35], ['IEC_VI', 5, 0.3375], ['IEC_VI', 10, 0.15],
  ['IEC_EI', 2, 2.666666667], ['IEC_EI', 5, 0.333333333], ['IEC_EI', 10, 0.080808081],
  ['IEEE_MI', 2, 0.380324923], ['IEEE_MI', 5, 0.16883256], ['IEEE_MI', 10, 0.120675592],
  ['IEEE_VI', 2, 0.702766667], ['IEEE_VI', 5, 0.130808333], ['IEEE_VI', 10, 0.068908081],
  ['IEEE_EI', 2, 0.95217], ['IEEE_EI', 5, 0.12967], ['IEEE_EI', 10, 0.040654848],
] as const;

describe('Overcurrent inverse curves', () => {
  for (const [curveId, multiple, expected] of referenceVectors) {
    it(`${curveId} at M=${multiple}`, () => {
      expect(inverseOperateTimeSec(multiple, curveId, 0.1)).toBeCloseTo(expected, 8);
    });
  }

  it('returns no inverse time at and below pickup', () => {
    expect(inverseOperateTimeSec(1, 'IEC_SI', 0.1)).toBeNull();
    expect(inverseOperateTimeSec(0.9, 'IEC_SI', 0.1)).toBeNull();
  });

  it('stays finite immediately above pickup when representable', () => {
    const t = inverseOperateTimeSec(1.000001, 'IEC_SI', 0.1);
    expect(t).not.toBeNull();
    expect(Number.isFinite(t)).toBe(true);
    expect(t!).toBeGreaterThan(0);
  });
});

describe('51 element', () => {
  it('uses strict > at the exact pickup boundary', () => {
    const equal = calculateOvercurrent51(1, inverse51);
    expect(equal.status).toBe('BELOW_PICKUP');
    expect(equal.operateTimeSec).toBeNull();

    const above = calculateOvercurrent51(1.01, inverse51);
    expect(above.status).toBe('PICKUP');
    expect(above.operateTimeSec).not.toBeNull();
  });

  it('supports definite-time magnitude independence', () => {
    const definite: Overcurrent51Settings = { ...inverse51, timingMode: 'DEFINITE', definiteDelaySec: 0.5 };
    expect(calculateOvercurrent51(2, definite).operateTimeSec).toBe(0.5);
    expect(calculateOvercurrent51(8, definite).operateTimeSec).toBe(0.5);
  });

  it('exposes an explicit disabled state', () => {
    const disabled = calculateOvercurrent51(10, { ...inverse51, enabled: false });
    expect(disabled.status).toBe('DISABLED');
    expect(disabled.operateTimeSec).toBeNull();
  });
});

describe('50 element and arbitration', () => {
  it('uses strict > at the high-set boundary', () => {
    expect(calculateOvercurrent50(5, { enabled: true, pickupASecondary: 5 }).status).toBe('BELOW_PICKUP');
    expect(calculateOvercurrent50(5.01, { enabled: true, pickupASecondary: 5 })).toEqual({ status: 'PICKUP', operateTimeSec: 0 });
  });

  it('gives 50 priority while retaining the 51 theoretical result', () => {
    const result = calculateOvercurrentDevice(4000, {
      ...baseDevice,
      settings: { ...baseDevice.settings, phase50: { enabled: true, pickupASecondary: 3 } },
    });
    expect(result.element51.status).toBe('PICKUP');
    expect(result.element51.operateTimeSec).toBeCloseTo(0.427972007, 8);
    expect(result.element50.status).toBe('PICKUP');
    expect(result.selectedElement).toBe('50');
    expect(result.selectedTripTimeSec).toBe(0);
  });
});

describe('O01 canonical device vectors', () => {
  it('OVC-01 Normal Load remains below pickup', () => {
    const result = calculateOvercurrentDevice(600, baseDevice);
    expect(result.measurement.measuredSecondaryCurrentA).toBeCloseTo(0.6, 12);
    expect(result.element51.status).toBe('BELOW_PICKUP');
    expect(result.selectedElement).toBeNull();
  });

  it('OVC-02 Near Pickup matches the reference time', () => {
    const result = calculateOvercurrentDevice(808, baseDevice);
    expect(result.element51.currentMultiple).toBeCloseTo(1.01, 12);
    expect(result.element51.operateTimeSec).toBeCloseTo(70.3424198, 6);
  });

  it('OVC-03 Moderate Overcurrent matches the reference time', () => {
    const result = calculateOvercurrentDevice(1600, baseDevice);
    expect(result.element51.currentMultiple).toBeCloseTo(2, 12);
    expect(result.element51.operateTimeSec).toBeCloseTo(1.002902702, 8);
  });

  it('OVC-08 CT error can move a current across pickup', () => {
    const result = calculateOvercurrentDevice(780, {
      ...baseDevice,
      settings: { ...baseDevice.settings, ct: { primaryRatedA: 1000, secondaryRatedA: 1, ratioErrorPct: 5 } },
    });
    expect(result.measurement.idealSecondaryCurrentA).toBeCloseTo(0.78, 12);
    expect(result.measurement.measuredSecondaryCurrentA).toBeCloseTo(0.819, 12);
    expect(result.element51.currentMultiple).toBeCloseTo(1.02375, 12);
    expect(result.element51.operateTimeSec).toBeCloseTo(29.81531555, 6);
  });

  it('nearlyEqual implements the O01 scale-aware boundary', () => {
    expect(nearlyEqual(1, 1 + 5e-13)).toBe(true);
    expect(nearlyEqual(1, 1 + 2e-12)).toBe(false);
  });
});
