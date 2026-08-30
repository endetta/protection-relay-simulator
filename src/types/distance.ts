/**
 * Distance Relay domain contracts (D01, per distance-relay.md).
 *
 * These types are intentionally UI-independent and calculation-free.
 * They encode the vocabulary and data relationships locked by the
 * authoritative Distance D01 Engineering Specification.
 */

// ─────────────────────────────── ID aliases ────────────────────────────────

export type DistanceZoneId = 'Z1' | 'Z2' | 'Z3';
export type DistanceStudyPresetId = string;
export type DistanceFaultCaseId = string;

// ────────────────────────── Enumeration / union types ──────────────────────

/** D01 § 5.5 — study fault type. */
export type DistanceFaultType =
  | 'THREE_PHASE'
  | 'PHASE_PHASE'
  | 'SINGLE_LINE_GROUND';

/** D01 § 3.1 — characteristic is mho circle only in v1. */
export type DistanceCharacteristicType = 'MHO_CIRCLE';

/** D01 § 7.2 — evaluation display status. */
export type DistanceDisplayStatus = 'OPERATE' | 'RESTRAIN' | 'INVALID';

/** D01 § 7.3 — trip-reason discrimination. */
export type DistanceTripReason =
  | 'ZONE1_INSTANT'
  | 'ZONE2_TIMED'
  | 'ZONE3_TIMED'
  | null;

// ─────────────────── Domain evaluation (shared O02 pattern) ────────────────

export type DomainIssueCode =
  | 'NON_FINITE_INPUT'
  | 'NUMERICAL_RANGE'
  | 'NON_POSITIVE_CT_RATIO'
  | 'NON_POSITIVE_VT_RATIO'
  | 'INVALID_SETTING_RANGE'
  | 'MISSING_REFERENCE'
  | 'INVALID_TOPOLOGY'
  | 'INVALID_COORDINATION_PAIR';

export interface DomainIssue {
  readonly code: DomainIssueCode;
  readonly path?: string;
  readonly detail?: string;
}

export type DomainEvaluation<T> =
  | { readonly status: 'VALID'; readonly value: T }
  | { readonly status: 'INVALID'; readonly issues: readonly DomainIssue[] };

// ──────────────── Per-zone settings (D01 § 5.2 / § 4.1) ──────────────────

export interface DistanceZoneSettings {
  readonly enabled: boolean;
  /** Circle diameter in secondary Ω. */
  readonly reachOhmSecondary: number;
  /** Characteristic angle in degrees (0–90). */
  readonly thetaCharDeg: number;
  /** Trip time delay in seconds. Zone 1 typically 0. */
  readonly timeDelaySec: number;
}

// ──────────────── Load encroachment (D01 § 8) ─────────────────────────────

export interface DistanceLoadEncroachmentSettings {
  readonly enabled: boolean;
  /** Minimum resistive load reach in secondary Ω. */
  readonly rMinLoadOhmSecondary: number;
  /** Slope angle in degrees (typically 20°–30°). */
  readonly thetaLoadDeg: number;
}

// ──────────────── CT / VT measurement model (D01 § 6) ────────────────────

export interface DistanceCTConfiguration {
  readonly primaryRatedA: number;
  readonly secondaryRatedA: number;
  readonly ratioErrorPct: number;
}

export interface DistanceVTConfiguration {
  /** Rated primary line-to-line kV of the VT. */
  readonly primaryRatedKv: number;
  /** Rated secondary phase-to-ground voltage (V). */
  readonly secondaryRatedV: number;
  readonly ratioErrorPct: number;
}

// ──────────────── Device settings bundle (D01 § 7 / § 8) ──────────────────

export interface DistanceBreakerConfiguration {
  /** Intentional study-model breaker clearing interval after trip output. */
  readonly clearingTimeSec: number;
}

export interface DistanceDeviceSettings {
  readonly ct: DistanceCTConfiguration;
  readonly vt: DistanceVTConfiguration;
  readonly zone1: DistanceZoneSettings;
  readonly zone2: DistanceZoneSettings;
  readonly zone3: DistanceZoneSettings;
  readonly loadEncroachment: DistanceLoadEncroachmentSettings;
  /** Study arc resistance in primary Ω. */
  readonly rArcOhmPrimary: number;
  /** Breaker clearing time after trip output. */
  readonly breaker: DistanceBreakerConfiguration;
}

// ──────────────── Line / system study data ─────────────────────────────────

export interface DistanceLineData {
  /** Line length in km. */
  readonly lengthKm: number;
  /** Positive-sequence impedance per km, primary Ω/km. */
  readonly z1OhmPerKmPrimary: number;
  /**
   * Positive-sequence line impedance angle in degrees. The apparent
   * impedance is a complex quantity `Z_app = |Z| × exp(j × z1AngleDeg)`,
   * so the line angle is required for mho containment (D01 § 5.5).
   */
  readonly z1AngleDeg: number;
  /** Zero-sequence impedance per km, primary Ω/km (used for SLG compensation). */
  readonly z0OhmPerKmPrimary: number;
}

export interface DistanceSystemData {
  /** System line-to-line voltage in primary kV. */
  readonly vLLKvPrimary: number;
  /** System frequency in Hz (display label only; does not change impedance equations). */
  readonly fHz: 50 | 60;
}

// ──────────────── Operating result (D01 § 7.1) ────────────────────────────

export interface DistanceZoneOperatingResult {
  readonly zoneId: DistanceZoneId;
  readonly inZone: boolean;
  /** Theoretical zone trip time; null when not in zone or disabled. */
  readonly timeToTripSec: number | null;
}

export interface DistanceImpedanceResult {
  /** Apparent impedance magnitude in secondary Ω. */
  readonly magnitudeOhmSecondary: number;
  /** Apparent impedance angle in degrees from positive R axis. */
  readonly angleDeg: number;
  /** Apparent resistance in secondary Ω. */
  readonly rOhmSecondary: number;
  /** Apparent reactance in secondary Ω. */
  readonly xOhmSecondary: number;
}

export interface DistanceOperatingResult {
  readonly faultType: DistanceFaultType;
  readonly kvApplied: number;
  readonly k0Applied: number;
  /** Applied arc resistance in primary Ω. */
  readonly rArcAppliedOhmPrimary: number;
  /** Full apparent impedance result. */
  readonly impedance: DistanceImpedanceResult;
  /** Whether the apparent impedance falls in the load region. */
  readonly loadRegion: boolean;
  /** Per-zone evaluation results (always 3 zones in v1). */
  readonly zones: readonly DistanceZoneOperatingResult[];
  /** The first zone that trips, in priority order. */
  readonly tripZone: DistanceZoneId | null;
  /** Detailed reason for the trip. */
  readonly tripReason: DistanceTripReason;
  /** Final display status. */
  readonly displayStatus: DistanceDisplayStatus;
  /** Any domain issues found during evaluation. */
  readonly issues: readonly DomainIssue[];
}

// ──────────────── Study preset (D01 § 10) ─────────────────────────────────

export interface DistanceStudyPreset {
  readonly id: DistanceStudyPresetId;
  readonly label: string;
  readonly description: string;
  readonly system: DistanceSystemData;
  readonly line: DistanceLineData;
  readonly settings: DistanceDeviceSettings;
  /** Primary fault current in A (study input). */
  readonly faultCurrentA: number;
  /** Fault type for this preset. */
  readonly faultType: DistanceFaultType;
  /** Zero-sequence compensation factor (used only for SLG). */
  readonly k0: number;
  /** Fault location along the line (0–100%). */
  readonly faultPct: number;
}

// ──────────────── Snapshot (for time-domain playback state) ────────────────

export interface DistanceZoneTimerState {
  readonly zoneId: DistanceZoneId;
  /** Whether the apparent impedance is currently inside this zone. */
  readonly inZone: boolean;
  /** Accumulated timer in engineering seconds (resets if impedance leaves zone). */
  readonly elapsedSec: number;
  /** Theoretical trip time; null when not in zone. */
  readonly tripTimeSec: number | null;
  /** Whether this zone has already tripped during this play session. */
  readonly tripped: boolean;
}

/** Unified per-zone timer state map keyed by zone ID. */
export type DistanceZoneTimers = Record<DistanceZoneId, DistanceZoneTimerState>;

// ──────────────── Study definition (consolidated editable source) ──────────

export interface DistanceStudyDefinition {
  readonly system: DistanceSystemData;
  readonly line: DistanceLineData;
  readonly settings: DistanceDeviceSettings;
  /** Primary fault current in A (study input). */
  readonly faultCurrentA: number;
  readonly faultType: DistanceFaultType;
  /** Zero-sequence compensation factor (explicit even for non-SLG). */
  readonly k0: number;
  /** Fault location along the line (0–100%). */
  readonly faultPct: number;
  /** Study identifier for the source preset. */
  readonly presetId: DistanceStudyPresetId | null;
}
