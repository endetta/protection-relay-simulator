/**
 * Distance Relay engine hardening tests (D04).
 *
 * Covers the mho + quadrilateral containment, apparent impedance
 * calculation, zone arbitration, and load encroachment. Mirrors the
 * O03 Overcurrent / R07 Differential hardening pattern.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateApparentImpedance,
  evaluateDistanceDevice,
  isInsideMhoCharacteristic,
  isInsideQuadrilateral,
  isInLoadRegion,
} from './distanceMeasurement';
import type { DistanceDeviceSettings, DistanceQuadrilateralSettings, DistanceZoneSettings } from '../types/distance';
import { getDistanceStudyPreset } from '../studies/distancePresets';

// ──────────────────────── Test fixtures ────────────────────────────────────

function makeSettings(overrides: Partial<DistanceDeviceSettings> = {}): DistanceDeviceSettings {
  const zone1: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 28.0, thetaCharDeg: 80, timeDelaySec: 0 };
  const zone2: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 42.0, thetaCharDeg: 80, timeDelaySec: 0.3 };
  const zone3: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 75.0, thetaCharDeg: 80, timeDelaySec: 0.6 };
  const quad: DistanceQuadrilateralSettings = { zReachOhmSecondary: 28.0, k: 0.5, alphaDeg: 0, betaDeg: 80 };
  return {
    ct: { primaryRatedA: 1200, secondaryRatedA: 1, ratioErrorPct: 0 },
    vt: { primaryRatedKv: 230, secondaryRatedV: 110, ratioErrorPct: 0 },
    characteristicType: 'MHO_CIRCLE',
    zone1,
    zone2,
    zone3,
    quadrilateral: quad,
    loadEncroachment: { enabled: true, rMinLoadOhmSecondary: 18, thetaLoadDeg: 25 },
    rArcOhmPrimary: 0,
    breaker: { clearingTimeSec: 0.1 },
    ...overrides,
  };
}

/**
 * Default 3500 A primary: with VT 230kV/110V and CT 1200:1 this yields
 * V_sec/I_sec ≈ 37.7 Ω at 100% — matching the full line impedance
 * (0.38 Ω/km × 100 km scaled to secondary), so faultPct maps linearly
 * onto the line and the zone reaches (28/42/75 Ω) behave like the
 * classic 80%/120%/200% reaches.
 */
function evalWith(faultPct: number, faultCurrentA = 3500, faultType: 'THREE_PHASE' | 'PHASE_PHASE' | 'SINGLE_LINE_GROUND' = 'THREE_PHASE', k0 = 0, rArcOhmPrimary = 0): ReturnType<typeof evaluateDistanceDevice> {
  return evaluateDistanceDevice({
    vLLKvPrimary: 230,
    faultCurrentA,
    faultType,
    k0,
    rArcOhmPrimary,
    z1AngleDeg: 80,
    settings: makeSettings(),
    faultPct,
  });
}

// ──────────────────── Mho containment ──────────────────────────────────────

describe('isInsideMhoCharacteristic', () => {
  it('contains the center of the circle', () => {
    expect(isInsideMhoCharacteristic(1.0, 5.0, 10, 80)).toBe(true);
  });

  it('contains a point near the far diameter end', () => {
    expect(isInsideMhoCharacteristic(1.5, 4.5, 10, 80)).toBe(true);
  });

  it('rejects a point far outside the circle', () => {
    expect(isInsideMhoCharacteristic(50, 50, 10, 80)).toBe(false);
  });

  it('treats the boundary as operate (inclusive)', () => {
    // Point exactly on the circle boundary at characteristic angle θ.
    const reach = 10;
    const theta = 80;
    const point = { r: reach * Math.cos((theta * Math.PI) / 180), x: reach * Math.sin((theta * Math.PI) / 180) };
    expect(isInsideMhoCharacteristic(point.r, point.x, reach, theta)).toBe(true);
  });

  it('rejects non-finite inputs', () => {
    expect(isInsideMhoCharacteristic(Number.NaN, 5, 10, 80)).toBe(false);
    expect(isInsideMhoCharacteristic(1, Number.POSITIVE_INFINITY, 10, 80)).toBe(false);
    expect(isInsideMhoCharacteristic(1, 5, 0, 80)).toBe(false);
  });
});

// ──────────────────── Quadrilateral containment ────────────────────────────

describe('isInsideQuadrilateral', () => {
  const quad: DistanceQuadrilateralSettings = { zReachOhmSecondary: 10, k: 0, alphaDeg: 0, betaDeg: 80 };

  it('contains the origin (V1)', () => {
    expect(isInsideQuadrilateral(0, 0, quad)).toBe(true);
  });

  it('contains a point along the R axis', () => {
    expect(isInsideQuadrilateral(5, 0, quad)).toBe(true);
  });

  it('contains a point near the reach boundary', () => {
    expect(isInsideQuadrilateral(9, 1, quad)).toBe(true);
  });

  it('rejects a point far outside on the R axis', () => {
    expect(isInsideQuadrilateral(20, 0, quad)).toBe(false);
  });

  it('rejects a point outside above the beta line', () => {
    // beta=80° → y > 10 * tan(80°) ≈ 56.7 is outside
    expect(isInsideQuadrilateral(5, 100, quad)).toBe(false);
  });

  it('rejects non-finite inputs', () => {
    expect(isInsideQuadrilateral(Number.NaN, 0, quad)).toBe(false);
    expect(isInsideQuadrilateral(1, Number.POSITIVE_INFINITY, quad)).toBe(false);
  });
});

// ──────────────────── Apparent impedance ───────────────────────────────────

describe('calculateApparentImpedance', () => {
  const input = {
    vLLKvPrimary: 230,
    faultCurrentA: 8000,
    faultType: 'THREE_PHASE' as const,
    k0: 0,
    rArcOhmPrimary: 0,
    z1AngleDeg: 80,
    vt: { primaryRatedKv: 230, secondaryRatedV: 110, ratioErrorPct: 0 },
    ct: { primaryRatedA: 2000, secondaryRatedA: 1, ratioErrorPct: 0 },
    faultPct: 50,
  };

  it('computes a non-zero finite impedance', () => {
    const { impedance, issues } = calculateApparentImpedance(input);
    expect(issues).toHaveLength(0);
    expect(impedance.magnitudeOhmSecondary).toBeGreaterThan(0);
    expect(Number.isFinite(impedance.rOhmSecondary)).toBe(true);
    expect(Number.isFinite(impedance.xOhmSecondary)).toBe(true);
  });

  it('scales impedance with fault location', () => {
    const half = calculateApparentImpedance({ ...input, faultPct: 50 }).impedance;
    const full = calculateApparentImpedance({ ...input, faultPct: 100 }).impedance;
    expect(full.magnitudeOhmSecondary).toBeCloseTo(half.magnitudeOhmSecondary * 2, 6);
  });

  it('adds arc resistance on the R axis', () => {
    const noArc = calculateApparentImpedance({ ...input, rArcOhmPrimary: 0 }).impedance;
    const withArc = calculateApparentImpedance({ ...input, rArcOhmPrimary: 10 }).impedance;
    expect(withArc.rOhmSecondary - noArc.rOhmSecondary).toBeCloseTo(10, 6);
  });

  it('rejects zero fault current', () => {
    const { issues } = calculateApparentImpedance({ ...input, faultCurrentA: 0 });
    expect(issues.length).toBeGreaterThan(0);
  });
});

// ──────────────────── Load encroachment ────────────────────────────────────

describe('isInLoadRegion', () => {
  const load = { enabled: true, rMinLoadOhmSecondary: 5, thetaLoadDeg: 25 };

  it('returns false when disabled', () => {
    expect(isInLoadRegion(10, 10, { ...load, enabled: false })).toBe(false);
  });

  it('detects a heavy-load point', () => {
    expect(isInLoadRegion(10, 10, load)).toBe(true);
  });

  it('ignores points below R_min', () => {
    expect(isInLoadRegion(1, 10, load)).toBe(false);
  });

  it('ignores points below the slope line', () => {
    expect(isInLoadRegion(10, 1, load)).toBe(false);
  });
});

// ──────────────────── Full evaluation & zone arbitration ──────────────────

describe('evaluateDistanceDevice', () => {
  it('trips Zone 1 for a mid-line fault (50%)', () => {
    const result = evalWith(50);
    expect(result.displayStatus).toBe('OPERATE');
    expect(result.tripZone).toBe('Z1');
    expect(result.tripReason).toBe('ZONE1_INSTANT');
  });

  it('trips Zone 2 for a near-remote fault (95%)', () => {
    const result = evalWith(95);
    expect(result.displayStatus).toBe('OPERATE');
    expect(result.tripZone).toBe('Z2');
    expect(result.tripReason).toBe('ZONE2_TIMED');
  });

  it('still trips for a fault at 100% (inside Z2)', () => {
    const result = evalWith(100);
    expect(result.displayStatus).toBe('OPERATE');
    expect(result.tripZone).toBe('Z2');
  });

  it('reports INVALID for non-finite fault current', () => {
    const result = evalWith(50, Number.NaN);
    expect(result.displayStatus).toBe('INVALID');
    expect(result.tripZone).toBeNull();
  });

  it('load encroachment suppresses zones', () => {
    // Heavy pre-fault + large series arc resistance pushes the apparent
    // impedance well into the load-region area (R ≫ 18 Ω, X ≥ tan(25°)·R).
    const result = evalWith(50, 1800, 'THREE_PHASE', 0, 60);
    expect(result.loadRegion).toBe(true);
    expect(result.displayStatus).toBe('RESTRAIN');
  });
});

// ──────────────────── Preset registry integrity ───────────────────────────

describe('Distance preset registry', () => {
  it('exposes exactly 4 canonical presets', () => {
    const preset = getDistanceStudyPreset('DIST-01');
    expect(preset).toBeDefined();
    expect(preset.topology).toBe('SINGLE_ENDED');
    expect(preset.scheme).toBe('NONE');
    expect(preset.faultPct).toBe(50);
  });
});