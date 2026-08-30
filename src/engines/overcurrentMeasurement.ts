import type { CTConfiguration, DomainIssue, MeasurementResult } from '../types/overcurrent';

const issue = (code: DomainIssue['code'], path: string, detail: string): DomainIssue => ({ code, path, detail });

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} exceeded the supported numeric range.`);
  return value;
}

export function validatePrimaryCurrent(primaryCurrentA: number, path = 'primaryCurrentA'): DomainIssue[] {
  if (!Number.isFinite(primaryCurrentA)) {
    return [issue('NON_FINITE_INPUT', path, 'Primary current must be finite.')];
  }
  if (primaryCurrentA < 0) {
    return [issue('INVALID_SETTING_RANGE', path, 'Primary current must be >= 0 A.')];
  }
  return [];
}

export function validateCTConfiguration(ct: CTConfiguration, path = 'ct'): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const fields: Array<[number, string, string]> = [
    [ct.primaryRatedA, `${path}.primaryRatedA`, 'CT primary rating'],
    [ct.secondaryRatedA, `${path}.secondaryRatedA`, 'CT secondary rating'],
    [ct.ratioErrorPct, `${path}.ratioErrorPct`, 'CT ratio error'],
  ];

  for (const [value, fieldPath, label] of fields) {
    if (!Number.isFinite(value)) issues.push(issue('NON_FINITE_INPUT', fieldPath, `${label} must be finite.`));
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
      issues.push(issue('NUMERICAL_RANGE', `${path}.ratioErrorPct`, 'CT error factor exceeded the supported numeric range.'));
    } else if (errorFactor <= 0) {
      issues.push(issue('INVALID_SETTING_RANGE', `${path}.ratioErrorPct`, 'CT ratio error must keep the measurement factor > 0.'));
    }
  }
  return issues;
}

export function calculateCTMeasurement(primaryCurrentA: number, ct: CTConfiguration): MeasurementResult {
  const issues = [...validatePrimaryCurrent(primaryCurrentA), ...validateCTConfiguration(ct)];
  if (issues.length > 0) throw new RangeError(issues.map((entry) => entry.detail).join(' '));

  // Evaluate Isecondary = Iprimary * CTsecondary / CTprimary with more than
  // one algebraically equivalent ordering. Extreme finite inputs can make one
  // intermediate ratio underflow/overflow even when the final result remains
  // representable. Normal engineering values still take the ratio-first path,
  // preserving the transparent O01 CT convention.
  const idealSecondaryCurrentA = (() => {
    if (primaryCurrentA === 0) return 0;

    const candidates = [
      () => primaryCurrentA * (ct.secondaryRatedA / ct.primaryRatedA),
      () => (primaryCurrentA / ct.primaryRatedA) * ct.secondaryRatedA,
      () => (primaryCurrentA * ct.secondaryRatedA) / ct.primaryRatedA,
    ];

    for (const candidate of candidates) {
      const value = candidate();
      if (Number.isFinite(value) && value > 0) return value;
    }

    throw new RangeError('Ideal CT secondary current exceeded or underflowed outside the supported numeric range.');
  })();

  finite(idealSecondaryCurrentA, 'Ideal CT secondary current');

  const errorFactor = finite(1 + ct.ratioErrorPct / 100, 'CT error factor');
  const measuredSecondaryCurrentA = finite(idealSecondaryCurrentA * errorFactor, 'Measured CT secondary current');
  if (idealSecondaryCurrentA > 0 && measuredSecondaryCurrentA === 0) {
    throw new RangeError('Measured CT secondary current underflowed outside the supported numeric range.');
  }

  if (idealSecondaryCurrentA < 0 || measuredSecondaryCurrentA < 0) {
    throw new RangeError('CT measurement current must remain >= 0 A secondary.');
  }

  return {
    primaryCurrentA,
    idealSecondaryCurrentA,
    measuredSecondaryCurrentA,
  };
}
