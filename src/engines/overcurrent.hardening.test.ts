import { describe, expect, it } from 'vitest';
import type { OvercurrentInverseCurveId, OvercurrentProtectionDevice } from '../types/overcurrent';
import {
  OVERCURRENT_INVERSE_CURVES,
  calculateOvercurrent51,
  inverseOperateTimeSec,
} from './overcurrent';
import { calculateCTMeasurement } from './overcurrentMeasurement';
import { evaluateOvercurrentDevice } from '../utils/evaluateOvercurrentDevice';

const curves = Object.keys(OVERCURRENT_INVERSE_CURVES) as OvercurrentInverseCurveId[];

let seed = 0x51_50_2026;
function random(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x1_0000_0000;
}

const baseDevice: OvercurrentProtectionDevice = {
  id: 'R-HARDEN', label: 'R-HARDEN', order: 1, kind: 'OVERCURRENT_50_51',
  settings: {
    ct: { primaryRatedA: 1000, secondaryRatedA: 1, ratioErrorPct: 0 },
    phase51: {
      enabled: true, pickupASecondary: 1, timingMode: 'INVERSE', inverseCurveId: 'IEC_SI', timeScale: 0.1, definiteDelaySec: 0.5,
    },
    phase50: { enabled: false, pickupASecondary: 5 },
    breaker: { clearingTimeSec: 0.1 },
  },
};

describe('Overcurrent O04 numerical hardening', () => {
  it('keeps every supported inverse curve positive and monotonically decreasing above pickup', () => {
    for (const curve of curves) {
      let previous = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 5000; i += 1) {
        const exponent = -11.5 + (18.5 * i) / 4999;
        const multiple = 1 + 10 ** exponent;
        const time = inverseOperateTimeSec(multiple, curve, 0.1);
        expect(time).not.toBeNull();
        expect(Number.isFinite(time!)).toBe(true);
        expect(time!).toBeGreaterThan(0);
        expect(time!).toBeLessThanOrEqual(previous * (1 + 1e-12));
        previous = time!;
      }
    }
  });

  it('keeps inverse time exactly proportional to the normalized time scale', () => {
    for (const curve of curves) {
      for (const multiple of [1.00001, 1.01, 1.1, 2, 5, 10, 100, 1e6]) {
        const low = inverseOperateTimeSec(multiple, curve, 0.1)!;
        const high = inverseOperateTimeSec(multiple, curve, 1)!;
        expect(high / low).toBeCloseTo(10, 10);
      }
    }
  });

  it('honors the scale-aware pickup boundary over wide pickup magnitudes', () => {
    for (let i = 0; i < 5000; i += 1) {
      const pickup = 10 ** (-9 + random() * 18);
      const epsilon = 1e-12 * Math.max(1, pickup);
      const settings = { ...baseDevice.settings.phase51, pickupASecondary: pickup };
      expect(calculateOvercurrent51(pickup + 0.5 * epsilon, settings).status).toBe('BELOW_PICKUP');
      expect(calculateOvercurrent51(pickup + 2.5 * epsilon, settings).status).toBe('PICKUP');
    }
  });

  it('never lets the safe evaluator throw across broad deterministic finite study inputs', () => {
    for (let i = 0; i < 20_000; i += 1) {
      const curve = curves[Math.floor(random() * curves.length)];
      const device: OvercurrentProtectionDevice = {
        ...baseDevice,
        id: `R-${i}`,
        settings: {
          ct: {
            primaryRatedA: 10 ** (-2 + random() * 9),
            secondaryRatedA: 10 ** (-2 + random() * 6),
            ratioErrorPct: -80 + random() * 180,
          },
          phase51: {
            enabled: random() > 0.1,
            pickupASecondary: 10 ** (-3 + random() * 6),
            timingMode: random() > 0.25 ? 'INVERSE' : 'DEFINITE',
            inverseCurveId: curve,
            timeScale: 0.05 + random() * 14.95,
            definiteDelaySec: 1e-4 + random() * 100,
          },
          phase50: {
            enabled: random() > 0.5,
            pickupASecondary: 10 ** (-3 + random() * 6),
          },
          breaker: { clearingTimeSec: random() * 2 },
        },
      };
      const current = 10 ** (-3 + random() * 12);
      const evaluation = evaluateOvercurrentDevice(current, device);
      if (evaluation.status === 'VALID') {
        const result = evaluation.value;
        expect(Number.isFinite(result.measurement.measuredSecondaryCurrentA)).toBe(true);
        expect(result.measurement.measuredSecondaryCurrentA).toBeGreaterThanOrEqual(0);
        if (result.element50.status === 'PICKUP') expect(result.selectedElement).toBe('50');
        if (result.selectedElement === '50') expect(result.selectedTripTimeSec).toBe(0);
        if (result.selectedElement === null) expect(result.selectedTripTimeSec).toBeNull();
      }
    }
  });

  it('keeps CT scaling finite and non-negative across broad deterministic ratios', () => {
    for (let i = 0; i < 10_000; i += 1) {
      const primaryRatedA = 10 ** (-3 + random() * 10);
      const secondaryRatedA = 10 ** (-3 + random() * 7);
      const primaryCurrentA = 10 ** (-6 + random() * 13);
      const ratioErrorPct = -90 + random() * 190;
      const result = calculateCTMeasurement(primaryCurrentA, { primaryRatedA, secondaryRatedA, ratioErrorPct });
      expect(Number.isFinite(result.idealSecondaryCurrentA)).toBe(true);
      expect(Number.isFinite(result.measuredSecondaryCurrentA)).toBe(true);
      expect(result.idealSecondaryCurrentA).toBeGreaterThan(0);
      expect(result.measuredSecondaryCurrentA).toBeGreaterThan(0);
    }
  });
});
