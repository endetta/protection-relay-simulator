import type {
  DomainIssue,
  OperatingResult,
  Overcurrent50OperatingResult,
  Overcurrent50Settings,
  BreakerConfiguration,
  Overcurrent51OperatingResult,
  Overcurrent51Settings,
  OvercurrentInverseCurveId,
  OvercurrentProtectionDevice,
} from '../types/overcurrent';
import { calculateCTMeasurement, validateCTConfiguration, validatePrimaryCurrent } from './overcurrentMeasurement';

export interface InverseCurveDefinition {
  readonly id: OvercurrentInverseCurveId;
  readonly displayName: string;
  readonly family: 'IEC' | 'IEEE';
  readonly k: number;
  readonly c: number;
  readonly alpha: number;
}

export const OVERCURRENT_INVERSE_CURVES: Readonly<Record<OvercurrentInverseCurveId, InverseCurveDefinition>> = {
  IEC_SI: { id: 'IEC_SI', displayName: 'IEC Standard Inverse', family: 'IEC', k: 0.14, c: 0, alpha: 0.02 },
  IEC_VI: { id: 'IEC_VI', displayName: 'IEC Very Inverse', family: 'IEC', k: 13.5, c: 0, alpha: 1 },
  IEC_EI: { id: 'IEC_EI', displayName: 'IEC Extremely Inverse', family: 'IEC', k: 80, c: 0, alpha: 2 },
  IEEE_MI: { id: 'IEEE_MI', displayName: 'IEEE Moderately Inverse', family: 'IEEE', k: 0.0515, c: 0.114, alpha: 0.02 },
  IEEE_VI: { id: 'IEEE_VI', displayName: 'IEEE Very Inverse', family: 'IEEE', k: 19.61, c: 0.491, alpha: 2 },
  IEEE_EI: { id: 'IEEE_EI', displayName: 'IEEE Extremely Inverse', family: 'IEEE', k: 28.2, c: 0.1217, alpha: 2 },
};

const issue = (code: DomainIssue['code'], path: string, detail: string): DomainIssue => ({ code, path, detail });

export function nearlyEqual(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
}

function finiteResult(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} exceeded the supported numeric range.`);
  return value;
}

function isKnownCurveId(value: string): value is OvercurrentInverseCurveId {
  return Object.prototype.hasOwnProperty.call(OVERCURRENT_INVERSE_CURVES, value);
}

export function validate51Settings(settings: Overcurrent51Settings, path = 'phase51'): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const finiteFields: Array<[number, string, string]> = [
    [settings.pickupASecondary, `${path}.pickupASecondary`, '51 pickup'],
    [settings.timeScale, `${path}.timeScale`, '51 time scale'],
    [settings.definiteDelaySec, `${path}.definiteDelaySec`, '51 definite delay'],
  ];

  for (const [value, fieldPath, label] of finiteFields) {
    if (!Number.isFinite(value)) issues.push(issue('NON_FINITE_INPUT', fieldPath, `${label} must be finite.`));
  }

  if (Number.isFinite(settings.pickupASecondary) && settings.pickupASecondary <= 0) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.pickupASecondary`, '51 pickup must be > 0 A secondary.'));
  }
  if (Number.isFinite(settings.timeScale) && (settings.timeScale < 0.05 || settings.timeScale > 15)) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.timeScale`, '51 time scale must be within the supported 0.05 to 15.00 range.'));
  }
  if (Number.isFinite(settings.definiteDelaySec) && settings.definiteDelaySec <= 0) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.definiteDelaySec`, '51 definite delay must be > 0 s.'));
  }
  if (settings.timingMode !== 'INVERSE' && settings.timingMode !== 'DEFINITE') {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.timingMode`, '51 timing mode must be INVERSE or DEFINITE.'));
  }
  if (!isKnownCurveId(settings.inverseCurveId)) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.inverseCurveId`, '51 inverse curve is not supported by O01.'));
  }
  return issues;
}

export function validate50Settings(settings: Overcurrent50Settings, path = 'phase50'): DomainIssue[] {
  const issues: DomainIssue[] = [];
  if (!Number.isFinite(settings.pickupASecondary)) {
    issues.push(issue('NON_FINITE_INPUT', `${path}.pickupASecondary`, '50 pickup must be finite.'));
  } else if (settings.enabled && settings.pickupASecondary <= 0) {
    issues.push(issue('INVALID_SETTING_RANGE', `${path}.pickupASecondary`, 'Enabled 50 pickup must be > 0 A secondary.'));
  }
  return issues;
}

export function validateRelayCurrent(relayCurrentASecondary: number, path = 'relayCurrentASecondary'): DomainIssue[] {
  if (!Number.isFinite(relayCurrentASecondary)) {
    return [issue('NON_FINITE_INPUT', path, 'Relay current must be finite.')];
  }
  if (relayCurrentASecondary < 0) {
    return [issue('INVALID_SETTING_RANGE', path, 'Relay current must be >= 0 A secondary.')];
  }
  return [];
}

export function validateBreakerConfiguration(breaker: BreakerConfiguration, path = 'breaker'): DomainIssue[] {
  if (!Number.isFinite(breaker.clearingTimeSec)) {
    return [issue('NON_FINITE_INPUT', `${path}.clearingTimeSec`, 'Breaker clearing time must be finite.')];
  }
  if (breaker.clearingTimeSec < 0) {
    return [issue('INVALID_SETTING_RANGE', `${path}.clearingTimeSec`, 'Breaker clearing time must be >= 0 s.')];
  }
  return [];
}

export function inverseOperateTimeSec(
  currentMultiple: number,
  curveId: OvercurrentInverseCurveId,
  timeScale: number,
): number | null {
  if (!Number.isFinite(currentMultiple) || currentMultiple < 0) {
    throw new RangeError('Current multiple must be finite and >= 0.');
  }
  if (!Number.isFinite(timeScale) || timeScale < 0.05 || timeScale > 15) {
    throw new RangeError('51 time scale must be within the supported 0.05 to 15.00 range.');
  }
  const curve = OVERCURRENT_INVERSE_CURVES[curveId];
  if (!curve) throw new RangeError('Unsupported inverse curve.');

  if (currentMultiple < 1 || nearlyEqual(currentMultiple, 1)) return null;

  const logM = finiteResult(Math.log(currentMultiple), 'Inverse-curve logarithm');
  const exponent = finiteResult(curve.alpha * logM, 'Inverse-curve exponent');

  // Evaluate 1/(exp(exponent)-1) without forcing exp(exponent) to overflow.
  // For very large exponent, exp(-exponent) is the stable representation.
  let inverseDenominator: number;
  if (exponent < 700) {
    const denominator = Math.expm1(exponent);
    if (!Number.isFinite(denominator) || denominator <= 0) {
      throw new RangeError('Inverse-curve denominator exceeded the supported numeric range.');
    }
    inverseDenominator = 1 / denominator;
  } else {
    const expNegative = Math.exp(-exponent);
    inverseDenominator = expNegative === 0 ? 0 : expNegative / (1 - expNegative);
  }

  const operateTime = finiteResult(timeScale * (curve.k * inverseDenominator + curve.c), '51 inverse operating time');
  if (operateTime <= 0) throw new RangeError('51 inverse operating time must be > 0 s.');
  return operateTime;
}

export function calculateOvercurrent51(
  relayCurrentASecondary: number,
  settings: Overcurrent51Settings,
): Overcurrent51OperatingResult {
  const issues = [...validateRelayCurrent(relayCurrentASecondary), ...validate51Settings(settings)];
  if (issues.length > 0) throw new RangeError(issues.map((entry) => entry.detail).join(' '));

  if (!settings.enabled) {
    return {
      status: 'DISABLED',
      currentMultiple: null,
      operateTimeSec: null,
      timingMode: settings.timingMode,
    };
  }

  const currentMultiple = finiteResult(relayCurrentASecondary / settings.pickupASecondary, '51 current multiple');
  const pickedUp = relayCurrentASecondary > settings.pickupASecondary && !nearlyEqual(relayCurrentASecondary, settings.pickupASecondary);

  if (!pickedUp) {
    return {
      status: 'BELOW_PICKUP',
      currentMultiple,
      operateTimeSec: null,
      timingMode: settings.timingMode,
    };
  }

  const operateTimeSec = settings.timingMode === 'DEFINITE'
    ? settings.definiteDelaySec
    : inverseOperateTimeSec(currentMultiple, settings.inverseCurveId, settings.timeScale);

  if (operateTimeSec === null || !Number.isFinite(operateTimeSec)) {
    throw new RangeError('51 operating time could not be represented for a picked-up element.');
  }

  return {
    status: 'PICKUP',
    currentMultiple,
    operateTimeSec,
    timingMode: settings.timingMode,
  };
}

export function calculateOvercurrent50(
  relayCurrentASecondary: number,
  settings: Overcurrent50Settings,
): Overcurrent50OperatingResult {
  const issues = [...validateRelayCurrent(relayCurrentASecondary), ...validate50Settings(settings)];
  if (issues.length > 0) throw new RangeError(issues.map((entry) => entry.detail).join(' '));

  if (!settings.enabled) return { status: 'DISABLED', operateTimeSec: null };

  const pickedUp = relayCurrentASecondary > settings.pickupASecondary && !nearlyEqual(relayCurrentASecondary, settings.pickupASecondary);
  return pickedUp
    ? { status: 'PICKUP', operateTimeSec: 0 }
    : { status: 'BELOW_PICKUP', operateTimeSec: null };
}

export function calculateOvercurrentDevice(
  primaryCurrentA: number,
  device: OvercurrentProtectionDevice,
): OperatingResult {
  const measurement = calculateCTMeasurement(primaryCurrentA, device.settings.ct);
  const relayCurrent = measurement.measuredSecondaryCurrentA;
  const element51 = calculateOvercurrent51(relayCurrent, device.settings.phase51);
  const element50 = calculateOvercurrent50(relayCurrent, device.settings.phase50);

  const selectedElement = element50.status === 'PICKUP'
    ? '50'
    : element51.status === 'PICKUP'
      ? '51'
      : null;

  const selectedTripTimeSec = selectedElement === '50'
    ? 0
    : selectedElement === '51'
      ? element51.operateTimeSec
      : null;

  if (selectedTripTimeSec !== null && !Number.isFinite(selectedTripTimeSec)) {
    throw new RangeError('Selected relay trip time exceeded the supported numeric range.');
  }

  return {
    deviceId: device.id,
    measurement,
    element51,
    element50,
    selectedElement,
    selectedTripTimeSec,
  };
}

export function validateStaticDeviceInput(
  primaryCurrentA: number,
  device: OvercurrentProtectionDevice,
): DomainIssue[] {
  return [
    ...validatePrimaryCurrent(primaryCurrentA),
    ...validateCTConfiguration(device.settings.ct, 'settings.ct'),
    ...validate51Settings(device.settings.phase51, 'settings.phase51'),
    ...validate50Settings(device.settings.phase50, 'settings.phase50'),
    ...validateBreakerConfiguration(device.settings.breaker, 'settings.breaker'),
  ];
}
