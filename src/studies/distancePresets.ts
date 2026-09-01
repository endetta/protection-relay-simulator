/**
 * Distance Relay preset registry (D03).
 *
 * Authoritative source of distance study presets. Presets are immutable
 * `DistanceStudyPreset` data; the study-state reducer edits a copy and
 * never mutates the registry. Validation is enforced at construction
 * time so the UI cannot select a preset that the engine will reject.
 */

import type {
  DistanceDeviceSettings,
  DistanceFaultType,
  DistanceLineData,
  DistanceLoadEncroachmentSettings,
  DistanceQuadrilateralSettings,
  DistanceStudyPreset,
  DistanceStudyPresetId,
  DistanceSystemData,
  DistanceZoneSettings,
} from '../types/distance';
import { validateDistanceDeviceSettings } from '../engines/distanceMeasurement';

// ──────────────── Default settings (DIST-01 reference) ───────────────────────

const DEFAULT_ZONE1: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 28.0, thetaCharDeg: 80, timeDelaySec: 0 };
const DEFAULT_ZONE2: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 42.0, thetaCharDeg: 80, timeDelaySec: 0.3 };
const DEFAULT_ZONE3: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 75.0, thetaCharDeg: 80, timeDelaySec: 0.6 };
const DEFAULT_LOAD: DistanceLoadEncroachmentSettings = { enabled: true, rMinLoadOhmSecondary: 18, thetaLoadDeg: 25 };
const DEFAULT_QUAD: DistanceQuadrilateralSettings = { zReachOhmSecondary: 28.0, k: 0.5, alphaDeg: 0, betaDeg: 80 };

function baseSettings(overrides: Partial<DistanceDeviceSettings> = {}): DistanceDeviceSettings {
  return {
    ct: { primaryRatedA: 1200, secondaryRatedA: 1, ratioErrorPct: 0 },
    vt: { primaryRatedKv: 230, secondaryRatedV: 110, ratioErrorPct: 0 },
    characteristicType: 'MHO_CIRCLE',
    zone1: DEFAULT_ZONE1,
    zone2: DEFAULT_ZONE2,
    zone3: DEFAULT_ZONE3,
    quadrilateral: DEFAULT_QUAD,
    loadEncroachment: DEFAULT_LOAD,
    rArcOhmPrimary: 0,
    breaker: { clearingTimeSec: 0.1 },
    ...overrides,
  };
}

const SYSTEM_230: DistanceSystemData = { vLLKvPrimary: 230, fHz: 50 };
const SYSTEM_500: DistanceSystemData = { vLLKvPrimary: 500, fHz: 60 };
const LINE_100KM: DistanceLineData = { lengthKm: 100, z1OhmPerKmPrimary: 0.38, z1AngleDeg: 80, z0OhmPerKmPrimary: 1.14 };

function preset(
  id: DistanceStudyPresetId,
  label: string,
  description: string,
  topology: 'SINGLE_ENDED' | 'DOUBLE_ENDED' | 'TAPPED',
  scheme: 'PUTT' | 'POTT' | 'DCB' | 'DTT' | 'NONE',
  system: DistanceSystemData,
  line: DistanceLineData,
  settings: DistanceDeviceSettings,
  faultCurrentA: number,
  faultType: DistanceFaultType,
  k0: number,
  faultPct: number,
): DistanceStudyPreset {
  const issues = validateDistanceDeviceSettings(settings);
  if (issues.length > 0) {
    throw new Error(`Invalid Distance preset ${id}: ${issues.map((i) => i.detail).join(' ')}`);
  }
  return {
    id,
    label,
    description,
    topology,
    scheme,
    system,
    line,
    settings,
    faultCurrentA,
    faultType,
    k0,
    faultPct,
  };
}

// ──────────────── Canonical presets (D01 § 10) ───────────────────────────────

/**
 * DIST-01 — Single-ended, Zone 1 internal fault.
 * Expected outcome: Z1 pickup → ZONE1_INSTANT trip.
 */
export const DIST_01_ZONE1_INTERNAL: DistanceStudyPreset = preset(
  'DIST-01',
  'Zone 1 Internal Fault',
  'Single-ended, three-phase mid-line fault inside Zone 1; expect instantaneous Z1 trip.',
  'SINGLE_ENDED',
  'NONE',
  SYSTEM_230,
  LINE_100KM,
  baseSettings(),
  8000,
  'THREE_PHASE',
  0,
  50,
);

/**
 * DIST-02 — Double-ended, Zone 2 external fault.
 * Forward-reverse scheme: relay sees fault through remote source.
 * Expected outcome: Z1 restrained, Z2 timed trip at 0.3s.
 */
export const DIST_02_DOUBLE_ENDED_Z2: DistanceStudyPreset = preset(
  'DIST-02',
  'Double-Ended Z2 Fault',
  'Double-ended forward-reverse scheme; three-phase near-remote-bus fault in Zone 2 only; expect Z2 timed trip.',
  'DOUBLE_ENDED',
  'POTT',
  SYSTEM_500,
  LINE_100KM,
  baseSettings(),
  12000,
  'THREE_PHASE',
  0,
  95,
);

/**
 * DIST-03 — Tapped load, SLG fault with k₀ compensation.
 * Expected outcome: Z1 trip after zero-sequence compensation.
 */
export const DIST_03_TAPPED_SLG: DistanceStudyPreset = preset(
  'DIST-03',
  'Tapped SLG Fault',
  'Tapped-load topology with single-line-to-ground mid-line, k₀ = 0.6; expect Z1 trip after compensation.',
  'TAPPED',
  'DCB',
  SYSTEM_230,
  LINE_100KM,
  baseSettings(),
  5000,
  'SINGLE_LINE_GROUND',
  0.6,
  50,
);

/**
 * DIST-04 — Load encroachment scenario.
 * Expected outcome: all zones suppressed, RESTRAIN.
 */
export const DIST_04_LOAD_ENCROACHMENT: DistanceStudyPreset = preset(
  'DIST-04',
  'Load Encroachment',
  'Heavy pre-fault load drives the apparent impedance into the load region; all zones must be suppressed.',
  'SINGLE_ENDED',
  'NONE',
  SYSTEM_230,
  LINE_100KM,
  baseSettings({ loadEncroachment: { enabled: true, rMinLoadOhmSecondary: 3, thetaLoadDeg: 25 } }),
  1800,
  'THREE_PHASE',
  0,
  0,
);

// ──────────────── Public registry API ────────────────────────────────────────

export const DISTANCE_STUDY_PRESETS: readonly DistanceStudyPreset[] = Object.freeze([
  DIST_01_ZONE1_INTERNAL,
  DIST_02_DOUBLE_ENDED_Z2,
  DIST_03_TAPPED_SLG,
  DIST_04_LOAD_ENCROACHMENT,
]);

export const DEFAULT_DISTANCE_PRESET_ID: DistanceStudyPresetId = 'DIST-01';

export function getDistanceStudyPreset(id: DistanceStudyPresetId): DistanceStudyPreset {
  const found = DISTANCE_STUDY_PRESETS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown Distance preset: ${id}`);
  return found;
}

export function listDistanceStudyPresets(): readonly DistanceStudyPreset[] {
  return DISTANCE_STUDY_PRESETS;
}
