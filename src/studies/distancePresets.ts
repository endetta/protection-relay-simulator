/**
 * Distance Relay preset registry (D03).
 *
 * Authoritative source of distance study presets. Mirrors the O05
 * Overcurrent registry contract: presets are immutable `DistanceStudyPreset`
 * data; the study-state reducer edits a copy and never mutates the
 * registry. Validation (D01 § 11) is enforced at construction time so
 * the UI cannot select a preset that the engine will reject.
 *
 * Canonical preset IDs and scenarios are defined in
 * `docs/engineering-specs/distance-relay.md` § 10.
 */

import type {
  DistanceDeviceSettings,
  DistanceStudyPreset,
  DistanceStudyPresetId,
  DistanceSystemData,
  DistanceLineData,
  DistanceZoneSettings,
  DistanceLoadEncroachmentSettings,
  DistanceFaultType,
} from '../types/distance';
import { validateDistanceDeviceSettings } from '../engines/distanceMeasurement';

// ──────────────── Default settings (DIST-01 reference, D01 § 10) ───────────

const DEFAULT_ZONE1: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 7.0, thetaCharDeg: 80, timeDelaySec: 0 };
const DEFAULT_ZONE2: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 13.0, thetaCharDeg: 80, timeDelaySec: 0.3 };
const DEFAULT_ZONE3: DistanceZoneSettings = { enabled: true, reachOhmSecondary: 13.1, thetaCharDeg: 80, timeDelaySec: 0.6 };
const DEFAULT_LOAD: DistanceLoadEncroachmentSettings = { enabled: true, rMinLoadOhmSecondary: 5, thetaLoadDeg: 25 };

function baseSettings(overrides: Partial<DistanceDeviceSettings> = {}): DistanceDeviceSettings {
  return {
    ct: { primaryRatedA: 600, secondaryRatedA: 1, ratioErrorPct: 0 },
    vt: { primaryRatedKv: 110, secondaryRatedV: 110, ratioErrorPct: 0 },
    zone1: DEFAULT_ZONE1,
    zone2: DEFAULT_ZONE2,
    zone3: DEFAULT_ZONE3,
    loadEncroachment: DEFAULT_LOAD,
    rArcOhmPrimary: 0,
    breaker: { clearingTimeSec: 0.10 },
    ...overrides,
  };
}

const SYSTEM_110: DistanceSystemData = { vLLKvPrimary: 110, fHz: 50 };
const LINE_100KM: DistanceLineData = { lengthKm: 100, z1OhmPerKmPrimary: 0.4, z1AngleDeg: 80, z0OhmPerKmPrimary: 1.2 };

/**
 * Build and validate a preset. Construction throws on invalid data so the
 * registry never exposes a preset the engine will reject; this keeps the
 * UI ↔ engine contract symmetric with the O05 / O08 pattern.
 */
function preset(
  id: DistanceStudyPresetId,
  label: string,
  description: string,
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
    throw new Error(`Invalid Distance preset ${id}: ${issues.map((issue) => issue.detail).join(' ')}`);
  }
  return {
    id,
    label,
    description,
    system,
    line,
    settings,
    faultCurrentA,
    faultType,
    k0,
    faultPct,
  };
}

// ──────────────── Canonical presets (D01 § 10) ─────────────────────────────

/**
 * DIST-01 — Zone 1 internal fault, 3-phase, no arc, mid-line.
 * Expected outcome: Z1 pickup → ZONE1_INSTANT trip.
 */
export const DIST_01_ZONE1_INTERNAL: DistanceStudyPreset = preset(
  'DIST-01',
  'Zone 1 Internal Fault',
  'Three-phase mid-line fault inside Zone 1; expect instantaneous Z1 trip.',
  SYSTEM_110,
  LINE_100KM,
  baseSettings(),
  5000,
  'THREE_PHASE',
  0,
  50,
);

/**
 * DIST-02 — Zone 2 external fault, 3-phase, no arc, near remote bus.
 * Expected outcome: Z1 not picked, Z2 pickup → ZONE2_TIMED trip at 0.30 s.
 */
export const DIST_02_ZONE2_EXTERNAL: DistanceStudyPreset = preset(
  'DIST-02',
  'Zone 2 External Fault',
  'Three-phase near-remote-bus fault inside Zone 2 only; expect Z2 timed trip.',
  SYSTEM_110,
  LINE_100KM,
  baseSettings(),
  5000,
  'THREE_PHASE',
  0,
  95,
);

/**
 * DIST-03 — Outside reach, 3-phase, near remote bus.
 * Expected outcome: No zone contains the apparent impedance → RESTRAIN.
 */
export const DIST_03_OUT_OF_REACH: DistanceStudyPreset = preset(
  'DIST-03',
  'Out of Reach',
  'Three-phase at remote bus, outside all enabled zones; expect RESTRAIN.',
  SYSTEM_110,
  LINE_100KM,
  baseSettings(),
  5000,
  'THREE_PHASE',
  0,
  100,
);

/**
 * DIST-04 — Single-line-to-ground fault with k_0 = 0.5.
 * Expected outcome: Z1 (or Z2/Z3 depending on compensation) trip.
 */
export const DIST_04_SLG_COMPENSATED: DistanceStudyPreset = preset(
  'DIST-04',
  'SLG with k₀',
  'Single-line-to-ground mid-line fault, k₀ = 0.5; expect Z1 trip after compensation.',
  SYSTEM_110,
  LINE_100KM,
  baseSettings(),
  5000,
  'SINGLE_LINE_GROUND',
  0.5,
  50,
);

/**
 * DIST-05 — Load encroachment scenario (no fault current is used; the
 * apparent impedance is forced into the load region by raising the load
 * current and disabling the fault).
 */
export const DIST_05_LOAD_ENCROACHMENT: DistanceStudyPreset = preset(
  'DIST-05',
  'Load Encroachment',
  'Heavy pre-fault load drives the apparent impedance into the load region; all zones must be suppressed.',
  SYSTEM_110,
  LINE_100KM,
  baseSettings({
    loadEncroachment: { enabled: true, rMinLoadOhmSecondary: 3, thetaLoadDeg: 25 },
  }),
  1500, // heavy pre-fault current, drives impedance toward the load region
  'THREE_PHASE',
  0,
  0,
);

/**
 * DIST-06 — Arc-resistance blind-spot warning.
 * R_arc = 20 Ω primary with fault_pct = 90 may push the apparent
 * impedance out of Zone 1 even though the fault is on the line.
 * Expected outcome: arc-resistance warning, R/X-plane point likely
 * outside Z1 / Z2 / Z3 → RESTRAIN.
 */
export const DIST_06_ARC_BLINDSPOT: DistanceStudyPreset = preset(
  'DIST-06',
  'Arc-Resistance Blind Spot',
  'Three-phase near remote bus with R_arc = 20 Ω primary; expect R/X-plane point near the edge of Zone 1 and amber blind-spot warning.',
  SYSTEM_110,
  LINE_100KM,
  baseSettings({ rArcOhmPrimary: 20 }),
  5000,
  'THREE_PHASE',
  0,
  90,
);

// ──────────────── Public registry API ───────────────────────────────────────

/**
 * The canonical, immutable registry of distance presets. Order is stable
 * so the UI menu is deterministic; new presets must be appended, not
 * reordered, to preserve preset IDs across versions.
 */
export const DISTANCE_STUDY_PRESETS: readonly DistanceStudyPreset[] = Object.freeze([
  DIST_01_ZONE1_INTERNAL,
  DIST_02_ZONE2_EXTERNAL,
  DIST_03_OUT_OF_REACH,
  DIST_04_SLG_COMPENSATED,
  DIST_05_LOAD_ENCROACHMENT,
  DIST_06_ARC_BLINDSPOT,
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
