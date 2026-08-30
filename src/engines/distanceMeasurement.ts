/**
 * Distance Relay measurement + characteristic engine (D02).
 *
 * Pure, UI-independent, React-free. Conforms to D01 Engineering
 * Specification § 5 (mho characteristic), § 6 (CT/VT measurement),
 * § 7 (operating logic), and § 8 (load encroachment).
 *
 * Layered for hardening (D04): non-throwing `evaluateDistanceDevice`
 * boundary, finite/overflow guards, and explicit `INVALID` display status
 * matching the R07 Differential / O03 Overcurrent pattern.
 */

import type {
  DistanceCTConfiguration,
  DistanceDeviceSettings,
  DistanceDisplayStatus,
  DistanceFaultType,
  DistanceImpedanceResult,
  DistanceLoadEncroachmentSettings,
  DistanceOperatingResult,
  DistanceTripReason,
  DistanceVTConfiguration,
  DistanceZoneId,
  DistanceZoneOperatingResult,
  DistanceZoneSettings,
  DomainIssue,
} from '../types/distance';

// ──────────────────────────── numeric guard helpers ────────────────────────

const NUMERIC_TOLERANCE = 1e-9;
const KV_TO_VOLTS = 1000;
const SQRT3 = Math.sqrt(3);

/** Half-circle diameter tolerance (Ω secondary) for boundary flicker suppression. */
const MHO_BOUNDARY_EPSILON_OHM = 1e-9;

function issue(
  code: DomainIssue['code'],
  path: string,
  detail: string,
): DomainIssue {
  return { code, path, detail };
}

function requireFinite(value: number, label: string, path: string): DomainIssue[] {
  if (!Number.isFinite(value)) {
    return [issue('NON_FINITE_INPUT', path, `${label} must be finite.`)];
  }
  return [];
}

// ──────────────────────── CT / VT validation (D01 § 6) ─────────────────────

export function validateDistanceCTConfiguration(
  ct: DistanceCTConfiguration,
  path = 'settings.ct',
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  for (const [value, fieldPath, label] of [
    [ct.primaryRatedA, `${path}.primaryRatedA`, 'CT primary rating'],
    [ct.secondaryRatedA, `${path}.secondaryRatedA`, 'CT secondary rating'],
    [ct.ratioErrorPct, `${path}.ratioErrorPct`, 'CT ratio error'],
  ] as Array<[number, string, string]>) {
    issues.push(...requireFinite(value, label, fieldPath));
  }
  if (Number.isFinite(ct.primaryRatedA) && ct.primaryRatedA <= 0) {
    issues.push(issue('NON_POSITIVE_CT_RATIO', `${path}.primaryRatedA`, 'CT primary rating must be > 0 A.'));
  }
  if (Number.isFinite(ct.secondaryRatedA) && ct.secondaryRatedA <= 0) {
    issues.push(issue('NON_POSITIVE_CT_RATIO', `${path}.secondaryRatedA`, 'CT secondary rating must be > 0 A.'));
  }
  if (Number.isFinite(ct.ratioErrorPct)) {
    const errorFactor = 1 + ct.ratioErrorPct / 100;
    if (!Number.isFinite(errorFactor)) {
      issues.push(issue('NUMERICAL_RANGE', `${path}.ratioErrorPct`, 'CT error factor overflowed outside the supported numeric range.'));
    } else if (errorFactor <= 0) {
      issues.push(issue('INVALID_SETTING_RANGE', `${path}.ratioErrorPct`, 'CT ratio error must keep the measurement factor > 0.'));
    }
  }
  return issues;
}

export function validateDistanceVTConfiguration(
  vt: DistanceVTConfiguration,
  path = 'settings.vt',
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  for (const [value, fieldPath, label] of [
    [vt.primaryRatedKv, `${path}.primaryRatedKv`, 'VT primary rating'],
    [vt.secondaryRatedV, `${path}.secondaryRatedV`, 'VT secondary rating'],
    [vt.ratioErrorPct, `${path}.ratioErrorPct`, 'VT ratio error'],
  ] as Array<[number, string, string]>) {
    issues.push(...requireFinite(value, label, fieldPath));
  }
  if (Number.isFinite(vt.primaryRatedKv) && vt.primaryRatedKv <= 0) {
    issues.push(issue('NON_POSITIVE_VT_RATIO', `${path}.primaryRatedKv`, 'VT primary rating must be > 0 kV.'));
  }
  if (Number.isFinite(vt.secondaryRatedV) && vt.secondaryRatedV <= 0) {
    issues.push(issue('NON_POSITIVE_VT_RATIO', `${path}.secondaryRatedV`, 'VT secondary rating must be > 0 V.'));
  }
  if (Number.isFinite(vt.ratioErrorPct)) {
    const errorFactor = 1 + vt.ratioErrorPct / 100;
    if (!Number.isFinite(errorFactor)) {
      issues.push(issue('NUMERICAL_RANGE', `${path}.ratioErrorPct`, 'VT error factor overflowed outside the supported numeric range.'));
    } else if (errorFactor <= 0) {
      issues.push(issue('INVALID_SETTING_RANGE', `${path}.ratioErrorPct`, 'VT ratio error must keep the measurement factor > 0.'));
    }
  }
  return issues;
}

// ────────────────────── Per-zone validation (D01 § 5.2) ───────────────────

export function validateDistanceZoneSettings(
  zone: DistanceZoneSettings,
  path: string,
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  for (const [value, fieldPath, label] of [
    [zone.reachOhmSecondary, `${path}.reachOhmSecondary`, 'Zone reach'],
    [zone.thetaCharDeg, `${path}.thetaCharDeg`, 'Characteristic angle'],
    [zone.timeDelaySec, `${path}.timeDelaySec`, 'Zone time delay'],
  ] as Array<[number, string, string]>) {
    issues.push(...requireFinite(value, label, fieldPath));
  }
  if (Number.isFinite(zone.reachOhmSecondary) && zone.reachOhmSecondary <= 0) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.reachOhmSecondary`, 'Zone reach must be > 0 Ω secondary.'));
  }
  if (Number.isFinite(zone.thetaCharDeg) && (zone.thetaCharDeg < 0 || zone.thetaCharDeg > 90)) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.thetaCharDeg`, 'Characteristic angle must be within 0–90°.'));
  }
  if (Number.isFinite(zone.timeDelaySec) && zone.timeDelaySec < 0) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.timeDelaySec`, 'Zone time delay must be ≥ 0 s.'));
  }
  return issues;
}

export function validateDistanceLoadEncroachment(
  load: DistanceLoadEncroachmentSettings,
  path: string,
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  issues.push(...requireFinite(load.rMinLoadOhmSecondary, 'Load encroachment R_min', `${path}.rMinLoadOhmSecondary`));
  issues.push(...requireFinite(load.thetaLoadDeg, 'Load encroachment angle', `${path}.thetaLoadDeg`));
  if (Number.isFinite(load.rMinLoadOhmSecondary) && load.rMinLoadOhmSecondary < 0) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.rMinLoadOhmSecondary`, 'R_min must be ≥ 0 Ω secondary.'));
  }
  if (Number.isFinite(load.thetaLoadDeg) && (load.thetaLoadDeg < 0 || load.thetaLoadDeg > 90)) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.thetaLoadDeg`, 'Load slope angle must be within 0–90°.'));
  }
  return issues;
}

export function validateDistanceDeviceSettings(settings: DistanceDeviceSettings): DomainIssue[] {
  return [
    ...validateDistanceCTConfiguration(settings.ct),
    ...validateDistanceVTConfiguration(settings.vt),
    ...validateDistanceZoneSettings(settings.zone1, 'settings.zone1'),
    ...validateDistanceZoneSettings(settings.zone2, 'settings.zone2'),
    ...validateDistanceZoneSettings(settings.zone3, 'settings.zone3'),
    ...validateDistanceLoadEncroachment(settings.loadEncroachment, 'settings.loadEncroachment'),
    ...requireFinite(settings.rArcOhmPrimary, 'Arc resistance', 'settings.rArcOhmPrimary'),
  ];
}

// ──────────── CT / VT secondary conversion (D01 § 6.1 / § 5.5) ────────────

/**
 * Convert primary current (A) to CT secondary current (A) using the scalar
 * ratio + signed percentage error. Tries multiple algebraically equivalent
 * operation orderings to preserve extreme finite results (D04 hardening
 * pattern, consistent with the O03 CT measurement).
 */
export function calculateCTSecondary(
  primaryCurrentA: number,
  ct: DistanceCTConfiguration,
): { secondaryCurrentA: number; issues: DomainIssue[] } {
  const issues = [
    ...requireFinite(primaryCurrentA, 'Primary current', 'primaryCurrentA'),
    ...validateDistanceCTConfiguration(ct),
  ];
  if (issues.length > 0) return { secondaryCurrentA: Number.NaN, issues };

  if (primaryCurrentA === 0) {
    return { secondaryCurrentA: 0, issues: [] };
  }

  // Try the canonical ratio-first form, then a secondary-first variant and
  // a quotient-first variant. Engineering values resolve on the first
  // candidate; extreme finite inputs may need a different ordering.
  const candidates = [
    () => primaryCurrentA * (ct.secondaryRatedA / ct.primaryRatedA),
    () => (primaryCurrentA / ct.primaryRatedA) * ct.secondaryRatedA,
    () => (primaryCurrentA * ct.secondaryRatedA) / ct.primaryRatedA,
  ];

  let idealSecondary = Number.NaN;
  for (const candidate of candidates) {
    const value = candidate();
    if (Number.isFinite(value)) {
      idealSecondary = value;
      break;
    }
  }
  if (!Number.isFinite(idealSecondary)) {
    return {
      secondaryCurrentA: Number.NaN,
      issues: [issue('NUMERICAL_RANGE', 'primaryCurrentA', 'Ideal CT secondary current overflowed the supported numeric range.')],
    };
  }

  const errorFactor = 1 + ct.ratioErrorPct / 100;
  if (!Number.isFinite(errorFactor)) {
    return {
      secondaryCurrentA: Number.NaN,
      issues: [issue('NUMERICAL_RANGE', `${'settings.ct'}.ratioErrorPct`, 'CT error factor overflowed the supported numeric range.')],
    };
  }
  const measured = idealSecondary * errorFactor;
  if (!Number.isFinite(measured)) {
    return {
      secondaryCurrentA: Number.NaN,
      issues: [issue('NUMERICAL_RANGE', 'primaryCurrentA', 'Measured CT secondary current overflowed the supported numeric range.')],
    };
  }
  return { secondaryCurrentA: measured, issues: [] };
}

/**
 * Convert primary line-to-line kV to VT secondary phase-to-ground V,
 * applying the user-supplied voltage factor `K_v` and the scalar
 * ratio/percentage error. Returns `{ secondaryVoltsV, issues }`.
 */
export function calculateVTSecondary(
  vLLKvPrimary: number,
  vt: DistanceVTConfiguration,
  kv: number,
): { secondaryVoltsV: number; issues: DomainIssue[] } {
  const issues: DomainIssue[] = [];
  issues.push(...requireFinite(vLLKvPrimary, 'System voltage', 'vLLKvPrimary'));
  issues.push(...requireFinite(kv, 'Voltage factor', 'kv'));
  issues.push(...validateDistanceVTConfiguration(vt));
  if (issues.length > 0) return { secondaryVoltsV: Number.NaN, issues };

  const vPhPrimary = (vLLKvPrimary * KV_TO_VOLTS) / SQRT3; // V phase-to-ground, primary
  const ratio = vt.primaryRatedKv * KV_TO_VOLTS / SQRT3 / vt.secondaryRatedV;
  // Use algebraically equivalent orderings (D04 hardening).
  const candidates = [
    () => (vPhPrimary * kv) / ratio * (1 + vt.ratioErrorPct / 100),
    () => (vPhPrimary / ratio) * kv * (1 + vt.ratioErrorPct / 100),
    () => ((vPhPrimary * kv) * (1 + vt.ratioErrorPct / 100)) / ratio,
  ];
  for (const candidate of candidates) {
    const value = candidate();
    if (Number.isFinite(value)) return { secondaryVoltsV: value, issues: [] };
  }
  return {
    secondaryVoltsV: Number.NaN,
    issues: [issue('NUMERICAL_RANGE', 'vLLKvPrimary', 'VT secondary voltage overflowed the supported numeric range.')],
  };
}

// ──────────── Voltage factor and zero-sequence compensation (D01 § 5.5) ──

/**
 * Returns the D01 § 5.5 voltage factor for a study fault type.
 * The simulator does not enforce default `k_0`; that value is passed in
 * explicitly so the contract is auditable.
 */
export function voltageFactorForFaultType(faultType: DistanceFaultType): number {
  switch (faultType) {
    case 'THREE_PHASE':
      return 1.0;
    case 'PHASE_PHASE':
      return SQRT3 / 2;
    case 'SINGLE_LINE_GROUND':
      return 1.0;
  }
}

// ──────────────────── Apparent-impedance calculation (D01 § 5.5) ───────────

export interface ApparentImpedanceInput {
  readonly vLLKvPrimary: number;
  readonly faultCurrentA: number;
  readonly faultType: DistanceFaultType;
  /** User-entered study compensation factor (used for SLG; default 0). */
  readonly k0: number;
  /** User-entered arc resistance in primary Ω. */
  readonly rArcOhmPrimary: number;
  readonly vt: DistanceVTConfiguration;
  readonly ct: DistanceCTConfiguration;
  /**
   * Positive-sequence line impedance angle (degrees) defining the
   * orientation of the apparent impedance vector in the R/X plane.
   */
  readonly z1AngleDeg: number;
  /**
   * Fault location along the line (0 = local bus, 100 = remote bus).
   * The apparent impedance at the relay terminals scales linearly with
   * the fault location: Z_app = (fault_pct / 100) × (V / I). This is
   * the study approximation specified in D01 § 9.
   */
  readonly faultPct: number;
}

/**
 * Compute the apparent impedance in secondary Ω. Applies `K_v` for the
 * fault type, the per-zone VT/CT errors, the arc resistance bias, and
 * (for SLG) the zero-sequence compensation `1 / (1 + k_0)`.
 *
 * Returns a complex impedance in rectangular form plus a list of
 * validation issues. The caller is responsible for treating any non-empty
 * `issues` as `INVALID` and suppressing active-trip semantics.
 */
export function calculateApparentImpedance(
  input: ApparentImpedanceInput,
): { impedance: DistanceImpedanceResult; issues: DomainIssue[] } {
  const issues: DomainIssue[] = [];
  if (!Number.isFinite(input.k0)) {
    issues.push(issue('NON_FINITE_INPUT', 'k0', 'k_0 must be finite.'));
  }
  if (!Number.isFinite(input.rArcOhmPrimary)) {
    issues.push(issue('NON_FINITE_INPUT', 'rArcOhmPrimary', 'Arc resistance must be finite.'));
  }
  if (!Number.isFinite(input.z1AngleDeg) || input.z1AngleDeg < -90 || input.z1AngleDeg > 90) {
    issues.push(issue('INVALID_SETTING_RANGE', 'z1AngleDeg', 'Line impedance angle must be finite and within -90° to 90°.'));
  }
  if (input.faultCurrentA <= 0) {
    // Restrained: zero / negative current means no fault current → apparent
    // impedance is undefined and the relay cannot operate.
    return {
      impedance: { magnitudeOhmSecondary: Number.POSITIVE_INFINITY, angleDeg: 0, rOhmSecondary: Number.POSITIVE_INFINITY, xOhmSecondary: 0 },
      issues: [issue('INVALID_SETTING_RANGE', 'faultCurrentA', 'Fault current must be > 0 A for impedance evaluation.')],
    };
  }
  const { secondaryCurrentA: iSec, issues: iIssues } = calculateCTSecondary(input.faultCurrentA, input.ct);
  const kv = voltageFactorForFaultType(input.faultType);
  const { secondaryVoltsV: vSec, issues: vIssues } = calculateVTSecondary(input.vLLKvPrimary, input.vt, kv);
  issues.push(...iIssues, ...vIssues);
  if (issues.length > 0 || !Number.isFinite(iSec) || !Number.isFinite(vSec) || iSec === 0) {
    return {
      impedance: { magnitudeOhmSecondary: Number.NaN, angleDeg: 0, rOhmSecondary: Number.NaN, xOhmSecondary: Number.NaN },
      issues: issues.length > 0 ? issues : [issue('NUMERICAL_RANGE', 'faultCurrentA', 'Could not resolve CT/VT secondary values.')],
    };
  }

  // Apparent impedance magnitude (V / I) scaled by fault location.
  // The relay sees Z_app = (faultPct / 100) × |V / I|, where |V / I|
  // is the total line impedance as secondary ohms (D01 § 9).
  const zMagTotal = vSec / iSec;
  if (!Number.isFinite(zMagTotal)) {
    return {
      impedance: { magnitudeOhmSecondary: Number.NaN, angleDeg: 0, rOhmSecondary: Number.NaN, xOhmSecondary: Number.NaN },
      issues: [issue('NUMERICAL_RANGE', 'vLLKvPrimary', 'Apparent impedance overflowed the supported numeric range.')],
    };
  }
  const locationFactor = Math.max(0, Math.min(100, input.faultPct)) / 100;
  const zMag = zMagTotal * locationFactor;
  if (!Number.isFinite(zMag)) {
    return {
      impedance: { magnitudeOhmSecondary: Number.NaN, angleDeg: 0, rOhmSecondary: Number.NaN, xOhmSecondary: Number.NaN },
      issues: [issue('NUMERICAL_RANGE', 'vLLKvPrimary', 'Apparent impedance overflowed the supported numeric range.')],
    };
  }

  // Decompose into R/X using the positive-sequence line impedance angle.
  // Z_app = |Z| × exp(j × θ_line) so that the impedance vector is
  // oriented correctly in the R/X plane for mho containment (D01 § 5.5).
  const thetaLineRad = (input.z1AngleDeg * Math.PI) / 180;
  let rSec = zMag * Math.cos(thetaLineRad);
  let xSec = zMag * Math.sin(thetaLineRad);

  // Arc resistance is added in series on the R-axis before compensation
  // (D01 § 5.5 study approximation).
  rSec = rSec + input.rArcOhmPrimary;
  if (input.faultType === 'SINGLE_LINE_GROUND') {
    const denom = 1 + input.k0;
    if (!Number.isFinite(denom) || denom === 0) {
      return {
        impedance: { magnitudeOhmSecondary: Number.NaN, angleDeg: 0, rOhmSecondary: Number.NaN, xOhmSecondary: Number.NaN },
        issues: [issue('NUMERICAL_RANGE', 'k0', 'SLG compensation denominator 1 + k_0 is non-finite or zero.')],
      };
    }
    rSec = rSec / denom;
    xSec = xSec / denom;
  }
  const magnitude = Math.sqrt(rSec * rSec + xSec * xSec);
  const angleDeg = magnitude === 0 ? 0 : (Math.atan2(xSec, rSec) * 180) / Math.PI;
  return {
    impedance: {
      magnitudeOhmSecondary: magnitude,
      angleDeg,
      rOhmSecondary: rSec,
      xOhmSecondary: xSec,
    },
    issues: [],
  };
}

// ──────────────────── Mho characteristic containment (D01 § 5.1) ──────────

/**
 * Test whether the apparent impedance (R, X) is inside the mho circle
 * defined by diameter `Z_reach` at characteristic angle `thetaCharDeg`.
 * The boundary is treated as OPERATE (consistent with conventional
 * protective-relay decision logic). Uses an exact vector-norm test;
 * no approximation is permitted.
 */
export function isInsideMhoCharacteristic(
  rOhmSecondary: number,
  xOhmSecondary: number,
  reachOhmSecondary: number,
  thetaCharDeg: number,
): boolean {
  if (!Number.isFinite(rOhmSecondary) || !Number.isFinite(xOhmSecondary)) return false;
  if (!Number.isFinite(reachOhmSecondary) || reachOhmSecondary <= 0) return false;
  if (!Number.isFinite(thetaCharDeg)) return false;

  const thetaRad = (thetaCharDeg * Math.PI) / 180;
  const cx = (reachOhmSecondary * Math.cos(thetaRad)) / 2;
  const cy = (reachOhmSecondary * Math.sin(thetaRad)) / 2;
  const dx = rOhmSecondary - cx;
  const dy = xOhmSecondary - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const radius = reachOhmSecondary / 2;
  return distance <= radius + MHO_BOUNDARY_EPSILON_OHM;
}

// ───────────────────── Load encroachment check (D01 § 8) ───────────────────

/**
 * Single-line inclined load-encroachment boundary through the origin with
 * slope `m_load = tan(thetaLoadDeg)`. The apparent impedance is in the
 * load region iff R_app ≥ R_min_load AND X_app ≥ m_load · R_app.
 * Returns `false` when load encroachment is disabled.
 */
export function isInLoadRegion(
  rOhmSecondary: number,
  xOhmSecondary: number,
  load: DistanceLoadEncroachmentSettings,
): boolean {
  if (!load.enabled) return false;
  if (!Number.isFinite(rOhmSecondary) || !Number.isFinite(xOhmSecondary)) return false;
  if (rOhmSecondary < load.rMinLoadOhmSecondary) return false;
  if (load.thetaLoadDeg < 0 || load.thetaLoadDeg > 90) return false;
  const slope = Math.tan((load.thetaLoadDeg * Math.PI) / 180);
  if (!Number.isFinite(slope)) return false;
  return xOhmSecondary >= slope * rOhmSecondary;
}

// ──────────────────── Zone operating-result factory (D01 § 7.1) ────────────

function buildZoneResult(
  zoneId: DistanceZoneId,
  zone: DistanceZoneSettings,
  inZone: boolean,
): DistanceZoneOperatingResult {
  if (!zone.enabled || !inZone) {
    return { zoneId, inZone: false, timeToTripSec: null };
  }
  return {
    zoneId,
    inZone: true,
    timeToTripSec: Math.max(0, zone.timeDelaySec),
  };
}

// ──────────────────── Public evaluation boundary (D01 § 7) ─────────────────

export interface EvaluateDistanceInput {
  readonly vLLKvPrimary: number;
  readonly faultCurrentA: number;
  readonly faultType: DistanceFaultType;
  readonly k0: number;
  readonly rArcOhmPrimary: number;
  /** Positive-sequence line impedance angle (deg). */
  readonly z1AngleDeg: number;
  readonly settings: DistanceDeviceSettings;
  /** Fault location 0–100% along the line. */
  readonly faultPct: number;
}

/**
 * Non-throwing distance-relay evaluation. Returns a complete
 * `DistanceOperatingResult` whose `displayStatus` is `INVALID` whenever any
 * input is non-finite, out of range, or the evaluation overflows. The
 * previous valid result is held by the caller (consistent with R07).
 */
export function evaluateDistanceDevice(input: EvaluateDistanceInput): DistanceOperatingResult {
  // Per-device settings validation (CT/VT/zones/load-encroachment/arc).
  const settingsIssues = validateDistanceDeviceSettings(input.settings);
  for (const v of [
    input.vLLKvPrimary,
    input.faultCurrentA,
    input.k0,
    input.rArcOhmPrimary,
  ]) {
    if (!Number.isFinite(v)) {
      settingsIssues.push(issue('NON_FINITE_INPUT', 'input', 'A non-finite value was supplied to the distance evaluator.'));
    }
  }
  if (input.faultCurrentA < 0) {
    settingsIssues.push(issue('INVALID_SETTING_RANGE', 'faultCurrentA', 'Fault current must be ≥ 0 A.'));
  }
  if (input.faultType === 'SINGLE_LINE_GROUND' && (!Number.isFinite(input.k0) || input.k0 < -1)) {
    settingsIssues.push(issue('INVALID_SETTING_RANGE', 'k0', 'k_0 must be ≥ -1 to keep 1 + k_0 > 0.'));
  }

  // Empty operating result (Restrained + Invalid) used for early return.
  const emptyZones: readonly DistanceZoneOperatingResult[] = [
    buildZoneResult('Z1', input.settings.zone1, false),
    buildZoneResult('Z2', input.settings.zone2, false),
    buildZoneResult('Z3', input.settings.zone3, false),
  ];
  if (settingsIssues.length > 0) {
    return {
      faultType: input.faultType,
      kvApplied: voltageFactorForFaultType(input.faultType),
      k0Applied: input.k0,
      rArcAppliedOhmPrimary: input.rArcOhmPrimary,
      impedance: { magnitudeOhmSecondary: Number.NaN, angleDeg: 0, rOhmSecondary: Number.NaN, xOhmSecondary: Number.NaN },
      loadRegion: false,
      zones: emptyZones,
      tripZone: null,
      tripReason: null,
      displayStatus: 'INVALID',
      issues: settingsIssues,
    };
  }

  // Compute apparent impedance.
  const { impedance, issues: zIssues } = calculateApparentImpedance({
    vLLKvPrimary: input.vLLKvPrimary,
    faultCurrentA: input.faultCurrentA,
    faultType: input.faultType,
    k0: input.k0,
    rArcOhmPrimary: input.rArcOhmPrimary,
    vt: input.settings.vt,
    ct: input.settings.ct,
    z1AngleDeg: input.z1AngleDeg,
    faultPct: input.faultPct,
  });
  if (zIssues.length > 0 || !Number.isFinite(impedance.rOhmSecondary) || !Number.isFinite(impedance.xOhmSecondary)) {
    return {
      faultType: input.faultType,
      kvApplied: voltageFactorForFaultType(input.faultType),
      k0Applied: input.k0,
      rArcAppliedOhmPrimary: input.rArcOhmPrimary,
      impedance: { magnitudeOhmSecondary: Number.NaN, angleDeg: 0, rOhmSecondary: Number.NaN, xOhmSecondary: Number.NaN },
      loadRegion: false,
      zones: emptyZones,
      tripZone: null,
      tripReason: null,
      displayStatus: 'INVALID',
      issues: zIssues,
    };
  }

  // Per-zone containment.
  const inZone1 = input.settings.zone1.enabled
    && isInsideMhoCharacteristic(
      impedance.rOhmSecondary,
      impedance.xOhmSecondary,
      input.settings.zone1.reachOhmSecondary,
      input.settings.zone1.thetaCharDeg,
    );
  const inZone2 = input.settings.zone2.enabled
    && isInsideMhoCharacteristic(
      impedance.rOhmSecondary,
      impedance.xOhmSecondary,
      input.settings.zone2.reachOhmSecondary,
      input.settings.zone2.thetaCharDeg,
    );
  const inZone3 = input.settings.zone3.enabled
    && isInsideMhoCharacteristic(
      impedance.rOhmSecondary,
      impedance.xOhmSecondary,
      input.settings.zone3.reachOhmSecondary,
      input.settings.zone3.thetaCharDeg,
    );

  // Load encroachment suppresses all zones (D01 § 8).
  const loadRegion = isInLoadRegion(
    impedance.rOhmSecondary,
    impedance.xOhmSecondary,
    input.settings.loadEncroachment,
  );
  const effectiveInZone1 = inZone1 && !loadRegion;
  const effectiveInZone2 = inZone2 && !loadRegion;
  const effectiveInZone3 = inZone3 && !loadRegion;

  const zones: readonly DistanceZoneOperatingResult[] = [
    buildZoneResult('Z1', input.settings.zone1, effectiveInZone1),
    buildZoneResult('Z2', input.settings.zone2, effectiveInZone2),
    buildZoneResult('Z3', input.settings.zone3, effectiveInZone3),
  ];

  // Zone arbitration: lowest-numbered operated zone wins.
  let tripZone: DistanceZoneId | null = null;
  let tripReason: DistanceTripReason = null;
  let displayStatus: DistanceDisplayStatus = 'RESTRAIN';
  if (effectiveInZone1) {
    tripZone = 'Z1';
    tripReason = 'ZONE1_INSTANT';
    displayStatus = 'OPERATE';
  } else if (effectiveInZone2) {
    tripZone = 'Z2';
    tripReason = 'ZONE2_TIMED';
    displayStatus = 'OPERATE';
  } else if (effectiveInZone3) {
    tripZone = 'Z3';
    tripReason = 'ZONE3_TIMED';
    displayStatus = 'OPERATE';
  }

  return {
    faultType: input.faultType,
    kvApplied: voltageFactorForFaultType(input.faultType),
    k0Applied: input.k0,
    rArcAppliedOhmPrimary: input.rArcOhmPrimary,
    impedance,
    loadRegion,
    zones,
    tripZone,
    tripReason,
    displayStatus,
    issues: [],
  };
}

// Re-export the numeric tolerance so tests / callers can mirror the
// characteristic containment boundary without re-declaring it.
export { NUMERIC_TOLERANCE };
