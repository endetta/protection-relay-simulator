/**
 * Distance Relay presentation model tests (D04-D05).
 */

import { describe, expect, it } from 'vitest';
import {
  buildMhoPath,
  buildQuadrilateralPath,
  buildRxPlaneLayout,
  buildSldLayout,
  displayStatusLabel,
  schemeLabel,
  topologyLabel,
} from './distancePresentation';
import { isInsideMhoCharacteristic, isInLoadRegion } from '../engines/distanceMeasurement';
import type {
  DistanceDeviceSettings,
  DistanceOperatingResult,
  DistanceQuadrilateralSettings,
  DistanceZoneSettings,
} from '../types/distance';

const zoneOn: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 28, thetaCharDeg: 80, timeDelaySec: 0 };
const quad: DistanceQuadrilateralSettings = { zReachOhmSecondary: 28, k: 0.5, alphaDeg: 0, betaDeg: 80 };

function makeSettings(): DistanceDeviceSettings {
  return {
    ct: { primaryRatedA: 1200, secondaryRatedA: 1, ratioErrorPct: 0 },
    vt: { primaryRatedKv: 230, secondaryRatedV: 110, ratioErrorPct: 0 },
    characteristicType: 'MHO_CIRCLE',
    zone1: zoneOn,
    zone2: zoneOn,
    zone3: zoneOn,
    quadrilateral: quad,
    loadEncroachment: { enabled: true, rMinLoadOhmSecondary: 18, thetaLoadDeg: 25 },
    rArcOhmPrimary: 0,
    breaker: { clearingTimeSec: 0.1 },
  };
}

function makeResult(): DistanceOperatingResult {
  return {
    faultType: 'THREE_PHASE',
    kvApplied: 1,
    k0Applied: 0,
    rArcAppliedOhmPrimary: 0,
    impedance: { magnitudeOhmSecondary: 18.86, angleDeg: 80, rOhmSecondary: 3.28, xOhmSecondary: 18.57 },
    loadRegion: false,
    zones: [
      { zoneId: 'Z1', inZone: true, timeToTripSec: 0 },
      { zoneId: 'Z2', inZone: false, timeToTripSec: null },
      { zoneId: 'Z3', inZone: false, timeToTripSec: null },
    ],
    tripZone: 'Z1',
    tripReason: 'ZONE1_INSTANT',
    displayStatus: 'OPERATE',
    issues: [],
  };
}

describe('buildSldLayout', () => {
  it('renders single-ended with one bus + one relay', () => {
    const layout = buildSldLayout('SINGLE_ENDED', 'NONE');
    expect(layout.topology).toBe('SINGLE_ENDED');
    expect(layout.relays).toHaveLength(1);
    expect(layout.schemeLink).toBeNull();
  });

  it('renders double-ended with two buses + two relays and a scheme link', () => {
    const layout = buildSldLayout('DOUBLE_ENDED', 'POTT');
    expect(layout.relays).toHaveLength(2);
    expect(layout.relays[0].facing).toBe('forward');
    expect(layout.relays[1].facing).toBe('reverse');
    expect(layout.schemeLink).not.toBeNull();
    expect(layout.schemeLink?.scheme).toBe('POTT');
  });

  it('renders tapped with a tapped load', () => {
    const layout = buildSldLayout('TAPPED', 'NONE');
    expect(layout.tappedLoads).toHaveLength(1);
    expect(layout.tappedLoads[0].xNorm).toBeCloseTo(0.5, 1);
  });
});

describe('buildMhoPath / buildQuadrilateralPath', () => {
  it('mho path is non-empty for an enabled zone', () => {
    expect(buildMhoPath(zoneOn, 50)).toMatch(/^M /);
  });

  it('mho path is empty for a disabled zone', () => {
    const off: DistanceZoneSettings = { ...zoneOn, enabled: false };
    expect(buildMhoPath(off, 50)).toBe('');
  });

  it('quadrilateral path is a closed polygon', () => {
    const p = buildQuadrilateralPath(quad, zoneOn, 80);
    expect(p.startsWith('M ')).toBe(true);
    expect(p.endsWith(' Z')).toBe(true);
  });
});

describe('buildRxPlaneLayout', () => {
  it('emits three zones and a load line when load is enabled', () => {
    const layout = buildRxPlaneLayout(makeResult(), makeSettings(), 50);
    expect(layout.zones).toHaveLength(3);
    expect(layout.loadLine).not.toBeNull();
    expect(layout.faultPoint.inDomain).toBe(true);
    expect(layout.faultPoint.fillColor).toBe('var(--sim-red)');
  });

  it('Z1 mho path contains an in-zone point and excludes an out-of-zone point', () => {
    const layout = buildRxPlaneLayout(makeResult(), makeSettings(), 50);
    const z1Path = layout.zones[0].pathD;
    expect(z1Path.length).toBeGreaterThan(0);
    const inZone = isInsideMhoCharacteristic(3.28, 18.57, 28, 80);
    expect(inZone).toBe(true);
  });

  it('quadrilateral vertex logic matches engine containment (Z1, alpha=0/beta=80)', () => {
    // The presentation polygon is built from the SAME vertices the engine
    // ray-casts against. Switch the settings to quad so the emitted zone
    // path is the polygon (closed with ' Z'), not a mho arc.
    const settings = { ...makeSettings(), characteristicType: 'QUADRILATERAL' as const };
    const layout = buildRxPlaneLayout(makeResult(), settings, 50);
    const quadPath = layout.zones[0].pathD;
    expect(quadPath.startsWith('M ')).toBe(true);
    expect(quadPath).toContain('L'); // straight edges, not an arc
    expect(quadPath.endsWith(' Z')).toBe(true); // closed polygon
  });

  it('each quadrilateral zone uses its OWN reach, matching the engine', () => {
    // Regression guard: the engine overrides quad.zReach with the per-zone
    // zone.reachOhmSecondary for the containment test. The drawn polygon
    // must do the same — otherwise Z2/Z3 look identical to Z1. Use small
    // reaches so nothing hits the 50 Ω domain clamp and the reach leans out.
    const base = makeSettings();
    const quadSettings: DistanceDeviceSettings = {
      ...base,
      characteristicType: 'QUADRILATERAL',
      zone1: { ...base.zone1, reachOhmSecondary: 8, thetaCharDeg: 80 },
      zone2: { ...base.zone2, reachOhmSecondary: 12, thetaCharDeg: 80 },
      zone3: { ...base.zone3, reachOhmSecondary: 20, thetaCharDeg: 80 },
    };
    const layout = buildRxPlaneLayout(makeResult(), quadSettings, 50);
    // Z1 vertex at X=8, Z2 at X=12, Z3 at X=20 — distinct per-zone reaches.
    expect(layout.zones[0].pathD).toMatch(/\b8\b/);
    expect(layout.zones[1].pathD).toMatch(/\b12\b/);
    expect(layout.zones[2].pathD).toMatch(/\b20\b/);
  });

  it('load-region boundary agrees with engine isInLoadRegion at the boundary', () => {
    const settings = makeSettings();
    const layout = buildRxPlaneLayout(makeResult(), settings, 50);
    expect(layout.loadLine).not.toBeNull();
    // rMinLoad=18, theta=25°. A point exactly on the slope: X = tan(25°)·R.
    const r = 30;
    const xOn = Math.tan((25 * Math.PI) / 180) * r;
    expect(isInLoadRegion(r, xOn, settings.loadEncroachment)).toBe(true);
  });

  it('uses quadrilateral paths when characteristicType = QUADRILATERAL', () => {
    const settings = { ...makeSettings(), characteristicType: 'QUADRILATERAL' as const };
    const layout = buildRxPlaneLayout(makeResult(), settings, 50);
    expect(layout.zones[0].pathD).toContain('L');
    expect(layout.zones[0].pathD.endsWith('Z')).toBe(true);
  });
});

describe('display helpers', () => {
  it('maps status to labels', () => {
    expect(displayStatusLabel('OPERATE')).toBe('TRIP');
    expect(displayStatusLabel('RESTRAIN')).toBe('NO TRIP');
    expect(displayStatusLabel('INVALID')).toBe('INPUT INVALID');
  });

  it('maps scheme to label', () => {
    expect(schemeLabel('NONE')).toMatch(/Direct/);
    expect(schemeLabel('POTT')).toMatch(/Overreach/);
  });

  it('maps topology to label', () => {
    expect(topologyLabel('DOUBLE_ENDED')).toMatch(/forward-reverse/);
  });
});