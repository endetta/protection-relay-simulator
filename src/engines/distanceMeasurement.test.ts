import { describe, it, expect } from 'vitest';
import {
  evaluateDistanceDevice,
  isInsideMhoCharacteristic,
  isInLoadRegion,
  calculateCTSecondary,
  calculateVTSecondary,
} from './distanceMeasurement';
import type {
  DistanceDeviceSettings,
} from '../types/distance';
import { getDistanceStudyPreset } from '../studies/distancePresets';

// ──────────────────── Mho containment (D01 § 11.2) ────────────────────────

describe('isInsideMhoCharacteristic', () => {
  const reach = 20;
  const theta = 80;

  it('inside for D01 § 11.2 reference point', () => {
    // D01 § 11.2: Z = 6 + j4, θ = 80°, reach = 20 → inside.
    expect(isInsideMhoCharacteristic(6, 4, reach, theta)).toBe(true);
  });

  it('inside for origin (boundary)', () => {
    // Origin is on the circle boundary.
    expect(isInsideMhoCharacteristic(0, 0, reach, theta)).toBe(true);
  });

  it('inside for point near the end of diameter', () => {
    const thetaRad = (80 * Math.PI) / 180;
    const xEnd = reach * Math.cos(thetaRad);
    const yEnd = reach * Math.sin(thetaRad);
    expect(isInsideMhoCharacteristic(xEnd, yEnd, reach, theta)).toBe(true);
  });

  it('outside for D01 § 11.5 reference point', () => {
    // D01 § 11.5: Z = 100 + j0, θ = 80°, reach = 20 → outside.
    expect(isInsideMhoCharacteristic(100, 0, reach, theta)).toBe(false);
  });

  it('outside for point on the negative R-axis', () => {
    expect(isInsideMhoCharacteristic(-10, 0, reach, theta)).toBe(false);
  });

  it('returns false for non-finite input', () => {
    expect(isInsideMhoCharacteristic(NaN, 0, reach, theta)).toBe(false);
    expect(isInsideMhoCharacteristic(0, Infinity, reach, theta)).toBe(false);
    expect(isInsideMhoCharacteristic(0, 0, NaN, theta)).toBe(false);
  });

  it('returns false for non-positive reach', () => {
    expect(isInsideMhoCharacteristic(1, 1, 0, theta)).toBe(false);
    expect(isInsideMhoCharacteristic(1, 1, -5, theta)).toBe(false);
  });
});

// ──────────────────── Load encroachment (D01 § 11.4) ──────────────────────

describe('isInLoadRegion', () => {
  const load = { enabled: true, rMinLoadOhmSecondary: 5, thetaLoadDeg: 25 };

  it('inside for D01 § 11.4 reference point', () => {
    // D01 § 11.4: R = 8, X = 4, θ_load = 25°, R_min = 5.
    expect(isInLoadRegion(8, 4, load)).toBe(true);
  });

  it('outside for R below R_min', () => {
    expect(isInLoadRegion(4, 4, load)).toBe(false);
  });

  it('outside for X below the load line', () => {
    // R = 8, X = 2 < tan(25°)·8 ≈ 3.73.
    expect(isInLoadRegion(8, 2, load)).toBe(false);
  });

  it('returns false when disabled', () => {
    expect(isInLoadRegion(100, 100, { ...load, enabled: false })).toBe(false);
  });

  it('returns false for non-finite input', () => {
    expect(isInLoadRegion(NaN, 0, load)).toBe(false);
    expect(isInLoadRegion(0, Infinity, load)).toBe(false);
  });
});

// ──────────────────── CT secondary (D01 § 6) ───────────────────────────────

describe('calculateCTSecondary', () => {
  it('basic conversion without error', () => {
    const ct = { primaryRatedA: 600, secondaryRatedA: 1, ratioErrorPct: 0 };
    const result = calculateCTSecondary(5000, ct);
    expect(result.secondaryCurrentA).toBeCloseTo(5000 / 600, 6);
    expect(result.issues).toHaveLength(0);
  });

  it('conversion with error', () => {
    const ct = { primaryRatedA: 600, secondaryRatedA: 1, ratioErrorPct: 5 };
    const result = calculateCTSecondary(600, ct);
    expect(result.secondaryCurrentA).toBeCloseTo(1 * 1.05, 6);
    expect(result.issues).toHaveLength(0);
  });

  it('returns issues for non-finite primary current', () => {
    const ct = { primaryRatedA: 600, secondaryRatedA: 1, ratioErrorPct: 0 };
    const result = calculateCTSecondary(NaN, ct);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('returns issues for non-positive CT', () => {
    const ct = { primaryRatedA: 0, secondaryRatedA: 1, ratioErrorPct: 0 };
    const result = calculateCTSecondary(500, ct);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

// ──────────────────── VT secondary (D01 § 6) ───────────────────────────────

describe('calculateVTSecondary', () => {
  it('basic conversion without error', () => {
    const vt = { primaryRatedKv: 110, secondaryRatedV: 110, ratioErrorPct: 0 };
    const result = calculateVTSecondary(110, vt, 1.0);
    expect(result.issues).toHaveLength(0);
    // V_LL = 110 kV, phase V = 110kV/√3 ≈ 63.5kV. VT_ratio ≈ 577. V_sec = 63.5kV/577 ≈ 110V.
    expect(result.secondaryVoltsV).toBeCloseTo(110, 0);
  });

  it('returns issues for non-finite voltage', () => {
    const vt = { primaryRatedKv: 110, secondaryRatedV: 110, ratioErrorPct: 0 };
    const result = calculateVTSecondary(NaN, vt, 1.0);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

// ──────────────── Full device evaluation (D01 § 7) ────────────────────────

describe('evaluateDistanceDevice', () => {
  const baseSettings: DistanceDeviceSettings = {
    ct: { primaryRatedA: 600, secondaryRatedA: 1, ratioErrorPct: 0 },
    vt: { primaryRatedKv: 110, secondaryRatedV: 110, ratioErrorPct: 0 },
    zone1: { enabled: true, reachOhmSecondary: 7.0, thetaCharDeg: 80, timeDelaySec: 0 },
    zone2: { enabled: true, reachOhmSecondary: 13.0, thetaCharDeg: 80, timeDelaySec: 0.3 },
    zone3: { enabled: true, reachOhmSecondary: 13.1, thetaCharDeg: 80, timeDelaySec: 0.6 },
    loadEncroachment: { enabled: true, rMinLoadOhmSecondary: 5, thetaLoadDeg: 25 },
    rArcOhmPrimary: 0,
    breaker: { clearingTimeSec: 0.1 },
  };

  it('DIST-01: Zone 1 internal fault → ZONE1_INSTANT', () => {
    const preset = getDistanceStudyPreset('DIST-01');
    const result = evaluateDistanceDevice({
      vLLKvPrimary: preset.system.vLLKvPrimary,
      faultCurrentA: preset.faultCurrentA,
      faultType: preset.faultType,
      k0: preset.k0,
      rArcOhmPrimary: preset.settings.rArcOhmPrimary,
      z1AngleDeg: preset.line.z1AngleDeg,
      settings: preset.settings,
      faultPct: preset.faultPct,
    });
    expect(result.displayStatus).toBe('OPERATE');
    expect(result.tripZone).toBe('Z1');
    expect(result.tripReason).toBe('ZONE1_INSTANT');
    expect(result.zones[0].inZone).toBe(true);
  });

  it('DIST-02: Zone 2 external fault → ZONE2_TIMED', () => {
    const preset = getDistanceStudyPreset('DIST-02');
    const result = evaluateDistanceDevice({
      vLLKvPrimary: preset.system.vLLKvPrimary,
      faultCurrentA: preset.faultCurrentA,
      faultType: preset.faultType,
      k0: preset.k0,
      rArcOhmPrimary: preset.settings.rArcOhmPrimary,
      z1AngleDeg: preset.line.z1AngleDeg,
      settings: preset.settings,
      faultPct: preset.faultPct,
    });
    expect(result.displayStatus).toBe('OPERATE');
    expect(result.tripZone).toBe('Z2');
    expect(result.tripReason).toBe('ZONE2_TIMED');
  });

  it('DIST-03: Out of reach → RESTRAIN', () => {
    const preset = getDistanceStudyPreset('DIST-03');
    const result = evaluateDistanceDevice({
      vLLKvPrimary: preset.system.vLLKvPrimary,
      faultCurrentA: preset.faultCurrentA,
      faultType: preset.faultType,
      k0: preset.k0,
      rArcOhmPrimary: preset.settings.rArcOhmPrimary,
      z1AngleDeg: preset.line.z1AngleDeg,
      settings: preset.settings,
      faultPct: preset.faultPct,
    });
    expect(result.displayStatus).toBe('RESTRAIN');
    expect(result.tripZone).toBeNull();
  });

  it('returns INVALID for bad CT', () => {
    const result = evaluateDistanceDevice({
      vLLKvPrimary: 110,
      faultCurrentA: 5000,
      faultType: 'THREE_PHASE',
      k0: 0,
      rArcOhmPrimary: 0,
      z1AngleDeg: 80,
      faultPct: 50,
      settings: {
        ...baseSettings,
        ct: { primaryRatedA: 0, secondaryRatedA: 1, ratioErrorPct: 0 },
      },
    });
    expect(result.displayStatus).toBe('INVALID');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('returns INVALID for bad VT', () => {
    const result = evaluateDistanceDevice({
      vLLKvPrimary: 110,
      faultCurrentA: 5000,
      faultType: 'THREE_PHASE',
      k0: 0,
      rArcOhmPrimary: 0,
      z1AngleDeg: 80,
      faultPct: 50,
      settings: {
        ...baseSettings,
        vt: { primaryRatedKv: 110, secondaryRatedV: 0, ratioErrorPct: 0 },
      },
    });
    expect(result.displayStatus).toBe('INVALID');
  });

  it('load region suppresses all zones', () => {
    // Pre-fault current with aggressive load encroachment covering the
    // apparent impedance: Z_app at faultPct=50 with line angle 80° lies
    // outside the mho circle but inside the load wedge.
    const result = evaluateDistanceDevice({
      vLLKvPrimary: 110,
      faultCurrentA: 5000,
      faultType: 'THREE_PHASE',
      k0: 0,
      rArcOhmPrimary: 0,
      z1AngleDeg: 80,
      faultPct: 50,
      settings: {
        ...baseSettings,
        zone1: { enabled: false, reachOhmSecondary: 8, thetaCharDeg: 80, timeDelaySec: 0 },
        zone2: { enabled: false, reachOhmSecondary: 14, thetaCharDeg: 80, timeDelaySec: 0.3 },
        zone3: { enabled: false, reachOhmSecondary: 18, thetaCharDeg: 80, timeDelaySec: 0.6 },
        // Aggressive load encroachment that covers the apparent impedance.
        loadEncroachment: { enabled: true, rMinLoadOhmSecondary: 1, thetaLoadDeg: 5 },
      },
    });
    expect(result.loadRegion).toBe(true);
    expect(result.tripZone).toBeNull();
  });
});
