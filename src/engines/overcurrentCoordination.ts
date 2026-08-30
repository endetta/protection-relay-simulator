import { evaluateOvercurrentDevice } from '../utils/evaluateOvercurrentDevice';
import {
  getCoordinationPairsForLocation,
  getCoordinationRequirementForPair,
  getFaultCase,
  resolveFaultCaseCurrents,
  resolveFaultLocationStudy,
  resolveLoadCaseCurrents,
  validateOvercurrentStudyDefinition,
} from '../studies/overcurrentStudy';
import type {
  CoordinationAuditDimension,
  CoordinationAuditDimensionResult,
  CoordinationAuditResult,
  CoordinationEnvelopePairPoint,
  CoordinationEnvelopePoint,
  CoordinationEnvelopeResult,
  CoordinationFaultCaseResult,
  CoordinationPair,
  CoordinationPairResult,
  CoordinationRequirement,
  CoordinationViolation,
  DevicePrimaryCurrentMap,
  DomainEvaluation,
  DomainIssue,
  FaultCase,
  FaultCaseId,
  FaultLocationProfile,
  LoadCaseId,
  LoadSecurityCaseResult,
  LoadSecurityDeviceResult,
  OperatingResult,
  OvercurrentCoordinationStudyResult,
  OvercurrentStudyDefinition,
  ProtectionChain,
  ProtectionDeviceId,
} from '../types/overcurrent';

const TIME_EPS_FACTOR = 1e-9;
const VALUE_EPS_FACTOR = 1e-12;

function issue(code: DomainIssue['code'], path: string, detail: string): DomainIssue {
  return { code, path, detail };
}

function timeTolerance(...values: readonly number[]): number {
  return TIME_EPS_FACTOR * Math.max(1, ...values.map((value) => Math.abs(value)));
}

function valueTolerance(...values: readonly number[]): number {
  return VALUE_EPS_FACTOR * Math.max(1, ...values.map((value) => Math.abs(value)));
}

function approximatelyGreater(a: number, b: number): boolean {
  return a - b > timeTolerance(a, b);
}

function atLeastWithTolerance(a: number, b: number): boolean {
  return a + timeTolerance(a, b) >= b;
}

function strictlyBelowWithTolerance(a: number, b: number): boolean {
  return b - a > valueTolerance(a, b);
}

function finiteOrNull(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function evaluateDevices(
  study: OvercurrentStudyDefinition,
  currents: DevicePrimaryCurrentMap,
  path: string,
): DomainEvaluation<Readonly<Record<ProtectionDeviceId, OperatingResult>>> {
  const results: Record<string, OperatingResult> = {};
  const issues: DomainIssue[] = [];

  for (const deviceId of study.topology.deviceIds) {
    const device = study.devicesById[deviceId];
    if (!device) {
      issues.push(issue('MISSING_REFERENCE', `${path}.${deviceId}`, `Missing protection device ${deviceId}.`));
      continue;
    }
    const current = currents[deviceId];
    if (!Number.isFinite(current) || current < 0) {
      issues.push(issue('NON_FINITE_INPUT', `${path}.${deviceId}`, `Primary current for ${deviceId} must be finite and >= 0 A.`));
      continue;
    }
    const evaluated = evaluateOvercurrentDevice(current, device);
    if (evaluated.status === 'INVALID') {
      issues.push(...evaluated.issues.map((entry) => ({
        ...entry,
        path: `${path}.${deviceId}.${entry.path ?? 'evaluation'}`,
      })));
      continue;
    }
    results[deviceId] = evaluated.value;
  }

  return issues.length > 0 ? { status: 'INVALID', issues } : { status: 'VALID', value: results };
}

export function evaluateCoordinationPair(
  pair: CoordinationPair,
  requirement: CoordinationRequirement,
  primaryResult: OperatingResult,
  backupResult: OperatingResult,
): CoordinationPairResult {
  const primaryTripTimeSec = primaryResult.selectedTripTimeSec;
  const backupTripTimeSec = backupResult.selectedTripTimeSec;

  if (!finiteOrNull(primaryTripTimeSec) || !finiteOrNull(backupTripTimeSec)) {
    return {
      pairId: pair.id,
      primaryTripTimeSec,
      backupTripTimeSec,
      observedCtiSec: null,
      requiredCtiSec: requirement.requiredCtiSec,
      surplusSec: null,
      status: 'NOT_EVALUABLE',
    };
  }

  const observedCtiSec = backupTripTimeSec - primaryTripTimeSec;
  const surplusSec = observedCtiSec - requirement.requiredCtiSec;
  return {
    pairId: pair.id,
    primaryTripTimeSec,
    backupTripTimeSec,
    observedCtiSec,
    requiredCtiSec: requirement.requiredCtiSec,
    surplusSec,
    status: atLeastWithTolerance(observedCtiSec, requirement.requiredCtiSec) ? 'PASS' : 'FAIL',
  };
}

function operatingRole(
  deviceId: ProtectionDeviceId,
  chain: ProtectionChain,
): { role: 'PRIMARY' | 'BACKUP' | 'OTHER'; backupOrder: number | null } {
  if (deviceId === chain.primaryDeviceId) return { role: 'PRIMARY', backupOrder: null };
  const index = chain.backupDeviceIds.indexOf(deviceId);
  if (index >= 0) return { role: 'BACKUP', backupOrder: index + 1 };
  return { role: 'OTHER', backupOrder: null };
}

function buildOperatingOrder(
  study: OvercurrentStudyDefinition,
  chain: ProtectionChain,
  deviceResults: Readonly<Record<ProtectionDeviceId, OperatingResult>>,
) {
  return study.topology.deviceIds
    .map((deviceId) => {
      const result = deviceResults[deviceId];
      const role = operatingRole(deviceId, chain);
      return {
        deviceId,
        role: role.role,
        backupOrder: role.backupOrder,
        selectedElement: result.selectedElement,
        tripTimeSec: result.selectedTripTimeSec,
        deviceOrder: study.devicesById[deviceId]?.order ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => {
      const at = a.tripTimeSec;
      const bt = b.tripTimeSec;
      if (at === null && bt !== null) return 1;
      if (at !== null && bt === null) return -1;
      if (at !== null && bt !== null && Math.abs(at - bt) > timeTolerance(at, bt)) return at - bt;
      return a.deviceOrder - b.deviceOrder;
    })
    .map(({ deviceOrder: _deviceOrder, ...entry }) => entry);
}

function pairViolationSet(
  faultContext: Pick<FaultCase, 'id' | 'allowedBackupInstantaneousDeviceIds'>,
  pair: CoordinationPair,
  pairResult: CoordinationPairResult,
  primaryResult: OperatingResult,
  backupResult: OperatingResult,
): CoordinationViolation[] {
  const violations: CoordinationViolation[] = [];

  if (primaryResult.selectedTripTimeSec === null) {
    // Sensitivity is formally scored on MIN fault cases. At other cases this
    // remains non-evaluable rather than being silently transformed into a CTI.
    return violations;
  }

  if (backupResult.selectedTripTimeSec === null) {
    violations.push({
      type: 'BACKUP_NOT_AVAILABLE',
      faultCaseId: faultContext.id,
      pairId: pair.id,
      deviceId: pair.backupDeviceId,
    });
    return violations;
  }

  if (!approximatelyGreater(backupResult.selectedTripTimeSec, primaryResult.selectedTripTimeSec)) {
    violations.push({
      type: 'SELECTIVITY_FAIL',
      faultCaseId: faultContext.id,
      pairId: pair.id,
      observedValue: pairResult.observedCtiSec ?? undefined,
      requiredValue: 0,
      unit: 's',
    });
  }

  if (pairResult.status === 'FAIL') {
    violations.push({
      type: 'TIME_GRADING',
      faultCaseId: faultContext.id,
      pairId: pair.id,
      observedValue: pairResult.observedCtiSec ?? undefined,
      requiredValue: pairResult.requiredCtiSec,
      unit: 's',
    });
  }

  const allowed = faultContext.allowedBackupInstantaneousDeviceIds ?? [];
  if (backupResult.element50.status === 'PICKUP' && !allowed.includes(pair.backupDeviceId)) {
    violations.push({
      type: 'INSTANTANEOUS_OVERREACH',
      faultCaseId: faultContext.id,
      pairId: pair.id,
      deviceId: pair.backupDeviceId,
      observedValue: backupResult.measurement.measuredSecondaryCurrentA,
      unit: 'A sec',
    });
  }

  return violations;
}

export function evaluateCoordinationFaultCase(
  study: OvercurrentStudyDefinition,
  faultCaseId: FaultCaseId,
): DomainEvaluation<CoordinationFaultCaseResult> {
  const faultCase = getFaultCase(study, faultCaseId);
  if (!faultCase) {
    return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', 'faultCaseId', `Unknown fault case ${faultCaseId}.`)] };
  }
  const resolved = resolveFaultCaseCurrents(study, faultCaseId, 0);
  if (resolved.status === 'INVALID') return resolved;
  const evaluated = evaluateDevices(study, resolved.value, `faultCases.${faultCaseId}.current`);
  if (evaluated.status === 'INVALID') return evaluated;
  const deviceResults = evaluated.value;
  const violations: CoordinationViolation[] = [];

  // O01 §19.1: minimum-fault sensitivity is explicitly a 51 pickup check.
  if (faultCase.category === 'MIN') {
    const primaryResult = deviceResults[faultCase.protectionChain.primaryDeviceId];
    if (!primaryResult || primaryResult.element51.status !== 'PICKUP') {
      violations.push({
        type: 'SENSITIVITY_RISK',
        faultCaseId,
        deviceId: faultCase.protectionChain.primaryDeviceId,
        observedValue: primaryResult?.measurement.measuredSecondaryCurrentA,
        requiredValue: study.devicesById[faultCase.protectionChain.primaryDeviceId]?.settings.phase51.pickupASecondary,
        unit: 'A sec',
      });
    }
  }

  const pairs = getCoordinationPairsForLocation(study, faultCase.locationId);
  const pairResults: CoordinationPairResult[] = [];
  for (const pair of pairs) {
    const requirement = getCoordinationRequirementForPair(study, pair.id);
    if (!requirement) {
      return {
        status: 'INVALID',
        issues: [issue('MISSING_REFERENCE', `coordinationRequirements.${pair.id}`, `Missing coordination requirement for pair ${pair.id}.`)],
      };
    }
    const primaryResult = deviceResults[pair.primaryDeviceId];
    const backupResult = deviceResults[pair.backupDeviceId];
    if (!primaryResult || !backupResult) {
      return {
        status: 'INVALID',
        issues: [issue('MISSING_REFERENCE', `coordinationPairs.${pair.id}`, 'Coordination pair device result is missing.')],
      };
    }
    const pairResult = evaluateCoordinationPair(pair, requirement, primaryResult, backupResult);
    pairResults.push(pairResult);
    violations.push(...pairViolationSet(faultCase, pair, pairResult, primaryResult, backupResult));
  }

  // A minimum-fault backup that has no coverage is a separate availability failure.
  if (faultCase.category === 'MIN') {
    for (const backupDeviceId of faultCase.protectionChain.backupDeviceIds) {
      const backupResult = deviceResults[backupDeviceId];
      if (!backupResult || backupResult.selectedTripTimeSec === null) {
        const matchingPair = pairs.find((pair) => pair.backupDeviceId === backupDeviceId);
        if (!violations.some((entry) => entry.type === 'BACKUP_NOT_AVAILABLE' && entry.deviceId === backupDeviceId)) {
          violations.push({
            type: 'BACKUP_NOT_AVAILABLE',
            faultCaseId,
            pairId: matchingPair?.id,
            deviceId: backupDeviceId,
          });
        }
      }
    }
  }

  return {
    status: 'VALID',
    value: {
      faultCaseId,
      locationId: faultCase.locationId,
      category: faultCase.category,
      deviceResults,
      operatingOrder: buildOperatingOrder(study, faultCase.protectionChain, deviceResults),
      pairResults,
      violations,
      status: violations.length === 0 ? 'PASS' : 'FAIL',
    },
  };
}

export function evaluateLoadSecurityCase(
  study: OvercurrentStudyDefinition,
  loadCaseId: LoadCaseId,
): DomainEvaluation<LoadSecurityCaseResult> {
  const resolved = resolveLoadCaseCurrents(study, loadCaseId, 0);
  if (resolved.status === 'INVALID') return resolved;
  const evaluated = evaluateDevices(study, resolved.value, `loadCases.${loadCaseId}.current`);
  if (evaluated.status === 'INVALID') return evaluated;

  const deviceResults: LoadSecurityDeviceResult[] = [];
  const violations: CoordinationViolation[] = [];
  for (const deviceId of study.topology.deviceIds) {
    const device = study.devicesById[deviceId];
    const operating = evaluated.value[deviceId];
    if (!device || !operating) {
      return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', `loadCases.${loadCaseId}.${deviceId}`, 'Missing load-security device result.')] };
    }
    const current = operating.measurement.measuredSecondaryCurrentA;
    const pickup51 = device.settings.phase51.enabled ? device.settings.phase51.pickupASecondary : null;
    const pickup50 = device.settings.phase50.enabled ? device.settings.phase50.pickupASecondary : null;
    const margin51 = pickup51 === null ? null : pickup51 - current;
    const margin50 = pickup50 === null ? null : pickup50 - current;
    const secure51 = pickup51 === null || strictlyBelowWithTolerance(current, pickup51);
    const secure50 = pickup50 === null || strictlyBelowWithTolerance(current, pickup50);
    const status = secure51 && secure50 ? 'PASS' : 'FAIL';
    deviceResults.push({
      deviceId,
      relayCurrentASecondary: current,
      pickup51ASecondary: pickup51,
      pickup50ASecondary: pickup50,
      margin51ASecondary: margin51,
      margin50ASecondary: margin50,
      status,
    });
    if (!secure51 || !secure50) {
      violations.push({
        type: 'LOAD_SECURITY_FAIL',
        loadCaseId,
        deviceId,
        observedValue: current,
        requiredValue: !secure51 ? pickup51 ?? undefined : pickup50 ?? undefined,
        unit: 'A sec',
      });
    }
  }

  return {
    status: 'VALID',
    value: {
      loadCaseId,
      deviceResults,
      violations,
      status: violations.length === 0 ? 'PASS' : 'FAIL',
    },
  };
}

function syntheticProfileFaultContext(profileId: string): Pick<FaultCase, 'id' | 'allowedBackupInstantaneousDeviceIds'> {
  return { id: `${profileId}:SCAN`, allowedBackupInstantaneousDeviceIds: [] };
}

function envelopePoint(
  study: OvercurrentStudyDefinition,
  profile: FaultLocationProfile,
  normalizedPosition: number,
): DomainEvaluation<CoordinationEnvelopePoint> {
  const resolved = resolveFaultLocationStudy(study, profile.id, normalizedPosition);
  if (resolved.status === 'INVALID') return resolved;
  const evaluated = evaluateDevices(study, resolved.value.primaryCurrentAByDevice, `faultLocationProfiles.${profile.id}@${normalizedPosition}`);
  if (evaluated.status === 'INVALID') return evaluated;

  const violations: CoordinationViolation[] = [];
  const pairPoints: CoordinationEnvelopePairPoint[] = [];
  const pairs = resolved.value.locationId ? getCoordinationPairsForLocation(study, resolved.value.locationId) : [];

  for (const pair of pairs) {
    const requirement = getCoordinationRequirementForPair(study, pair.id);
    if (!requirement) {
      return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', `coordinationRequirements.${pair.id}`, `Missing coordination requirement for pair ${pair.id}.`)] };
    }
    const primaryResult = evaluated.value[pair.primaryDeviceId];
    const backupResult = evaluated.value[pair.backupDeviceId];
    if (!primaryResult || !backupResult) {
      return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', `coordinationPairs.${pair.id}`, 'Envelope device result is missing.')] };
    }
    const pairResult = evaluateCoordinationPair(pair, requirement, primaryResult, backupResult);
    const instantaneousOverreach = backupResult.element50.status === 'PICKUP';
    const minimumBackupTimeSec = pairResult.primaryTripTimeSec === null
      ? null
      : pairResult.primaryTripTimeSec + requirement.requiredCtiSec;
    pairPoints.push({
      pairId: pair.id,
      primaryTripTimeSec: pairResult.primaryTripTimeSec,
      backupTripTimeSec: pairResult.backupTripTimeSec,
      minimumBackupTimeSec,
      observedCtiSec: pairResult.observedCtiSec,
      requiredCtiSec: pairResult.requiredCtiSec,
      surplusSec: pairResult.surplusSec,
      status: pairResult.status,
      instantaneousOverreach,
    });

    const baseViolations = pairViolationSet(
      syntheticProfileFaultContext(profile.id),
      pair,
      pairResult,
      primaryResult,
      backupResult,
    ).map((entry) => ({
      ...entry,
      faultCaseId: undefined,
      profileId: profile.id,
      normalizedPosition,
    }));
    violations.push(...baseViolations);
  }

  return {
    status: 'VALID',
    value: {
      normalizedPosition,
      locationId: resolved.value.locationId,
      protectionChain: resolved.value.protectionChain,
      primaryCurrentAByDevice: resolved.value.primaryCurrentAByDevice,
      pairPoints,
      violations,
    },
  };
}

function deterministicScanPositions(profile: FaultLocationProfile, pointsPerSegment: number): number[] {
  const first = profile.samples[0].normalizedPosition;
  const last = profile.samples[profile.samples.length - 1].normalizedPosition;
  const positions = new Set<number>(profile.samples.map((sample) => sample.normalizedPosition));
  for (const segment of profile.segments ?? []) {
    positions.add(segment.startPosition);
    positions.add(segment.endPosition);
  }
  const count = Math.max(2, Math.floor(pointsPerSegment));
  if (profile.segments && profile.segments.length > 0) {
    for (const segment of profile.segments) {
      for (let index = 0; index < count; index += 1) {
        const ratio = index / (count - 1);
        positions.add(segment.startPosition + (segment.endPosition - segment.startPosition) * ratio);
      }
    }
  } else {
    for (let index = 0; index < count; index += 1) {
      const ratio = index / (count - 1);
      positions.add(first + (last - first) * ratio);
    }
  }
  return [...positions]
    .filter((value) => value >= first - VALUE_EPS_FACTOR && value <= last + VALUE_EPS_FACTOR)
    .sort((a, b) => a - b);
}

export function scanCoordinationEnvelope(
  study: OvercurrentStudyDefinition,
  profileId: string,
  pointsPerSegment = 41,
): DomainEvaluation<CoordinationEnvelopeResult> {
  const profile = study.faultLocationProfiles.find((item) => item.id === profileId);
  if (!profile) {
    return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', 'profileId', `Unknown fault-location profile ${profileId}.`)] };
  }
  if (!Number.isFinite(pointsPerSegment) || pointsPerSegment < 2) {
    return { status: 'INVALID', issues: [issue('INVALID_PROFILE', 'pointsPerSegment', 'Envelope scan requires at least two finite points per segment.')] };
  }

  const points: CoordinationEnvelopePoint[] = [];
  let worstPoint: CoordinationEnvelopeResult['worstPoint'];
  for (const position of deterministicScanPositions(profile, pointsPerSegment)) {
    const evaluated = envelopePoint(study, profile, position);
    if (evaluated.status === 'INVALID') return evaluated;
    points.push(evaluated.value);
    for (const pairPoint of evaluated.value.pairPoints) {
      if (pairPoint.surplusSec === null || pairPoint.observedCtiSec === null) continue;
      if (!worstPoint || pairPoint.surplusSec < worstPoint.surplusSec - timeTolerance(pairPoint.surplusSec, worstPoint.surplusSec)) {
        worstPoint = {
          normalizedPosition: position,
          locationId: evaluated.value.locationId,
          pairId: pairPoint.pairId,
          observedCtiSec: pairPoint.observedCtiSec,
          requiredCtiSec: pairPoint.requiredCtiSec,
          surplusSec: pairPoint.surplusSec,
        };
      }
    }
  }

  return { status: 'VALID', value: { profileId: profile.id, points, worstPoint } };
}

function dimensionResult(
  dimension: CoordinationAuditDimension,
  violations: readonly CoordinationViolation[],
  relevant: boolean,
  types: readonly CoordinationViolation['type'][],
): CoordinationAuditDimensionResult {
  if (!relevant) return { dimension, status: 'NOT_EVALUABLE', violationCount: 0 };
  const count = violations.filter((entry) => types.includes(entry.type)).length;
  return { dimension, status: count === 0 ? 'PASS' : 'FAIL', violationCount: count };
}

function buildAudit(
  study: OvercurrentStudyDefinition,
  faultResults: readonly CoordinationFaultCaseResult[],
  loadResults: readonly LoadSecurityCaseResult[],
): CoordinationAuditResult {
  const violations = [...faultResults.flatMap((result) => result.violations), ...loadResults.flatMap((result) => result.violations)];
  const hasMinFault = faultResults.some((result) => result.category === 'MIN');
  const hasPairs = study.coordinationPairs.length > 0;
  const hasBackups = study.faultCases.some((faultCase) => faultCase.protectionChain.backupDeviceIds.length > 0);
  const hasLoadCases = loadResults.length > 0;

  const dimensions: CoordinationAuditDimensionResult[] = [
    dimensionResult('SENSITIVITY', violations, hasMinFault, ['SENSITIVITY_RISK']),
    dimensionResult('SELECTIVITY', violations, hasPairs, ['SELECTIVITY_FAIL']),
    dimensionResult('TIME_GRADING', violations, hasPairs, ['TIME_GRADING']),
    dimensionResult('INSTANTANEOUS_REACH', violations, hasBackups, ['INSTANTANEOUS_OVERREACH']),
    dimensionResult('LOAD_SECURITY', violations, hasLoadCases, ['LOAD_SECURITY_FAIL']),
    dimensionResult('BACKUP_AVAILABILITY', violations, hasPairs, ['BACKUP_NOT_AVAILABLE']),
  ];

  let worstCase: CoordinationAuditResult['worstCase'];
  for (const faultResult of faultResults) {
    for (const pairResult of faultResult.pairResults) {
      if (pairResult.surplusSec === null || pairResult.observedCtiSec === null) continue;
      if (!worstCase || pairResult.surplusSec < worstCase.surplusSec - timeTolerance(pairResult.surplusSec, worstCase.surplusSec)) {
        worstCase = {
          faultCaseId: faultResult.faultCaseId,
          pairId: pairResult.pairId,
          observedCtiSec: pairResult.observedCtiSec,
          requiredCtiSec: pairResult.requiredCtiSec,
          surplusSec: pairResult.surplusSec,
        };
      }
    }
  }

  const applicable = dimensions.filter((entry) => entry.status !== 'NOT_EVALUABLE');
  const anyFail = applicable.some((entry) => entry.status === 'FAIL');
  const passedCaseCount = faultResults.filter((entry) => entry.status === 'PASS').length;
  const totalCaseCount = faultResults.length;
  return {
    status: applicable.length === 0
      ? 'NOT_EVALUABLE'
      : anyFail || loadResults.some((entry) => entry.status === 'FAIL')
        ? 'COORDINATION_INCOMPLETE'
        : 'COORDINATED',
    passedCaseCount,
    totalCaseCount,
    dimensions,
    violations,
    worstCase,
  };
}

export function runOvercurrentCoordinationStudy(
  study: OvercurrentStudyDefinition,
  envelopePointsPerSegment = 41,
): DomainEvaluation<OvercurrentCoordinationStudyResult> {
  const validated = validateOvercurrentStudyDefinition(study);
  if (validated.status === 'INVALID') return validated;

  const faultCaseResults: CoordinationFaultCaseResult[] = [];
  for (const faultCaseId of study.validationCaseIds) {
    const evaluated = evaluateCoordinationFaultCase(study, faultCaseId);
    if (evaluated.status === 'INVALID') return evaluated;
    faultCaseResults.push(evaluated.value);
  }

  const loadSecurityResults: LoadSecurityCaseResult[] = [];
  for (const loadCaseId of study.loadSecurityCaseIds) {
    const evaluated = evaluateLoadSecurityCase(study, loadCaseId);
    if (evaluated.status === 'INVALID') return evaluated;
    loadSecurityResults.push(evaluated.value);
  }

  const envelopes: CoordinationEnvelopeResult[] = [];
  for (const profile of study.faultLocationProfiles) {
    const evaluated = scanCoordinationEnvelope(study, profile.id, envelopePointsPerSegment);
    if (evaluated.status === 'INVALID') return evaluated;
    envelopes.push(evaluated.value);
  }

  return {
    status: 'VALID',
    value: {
      audit: buildAudit(study, faultCaseResults, loadSecurityResults),
      faultCaseResults,
      loadSecurityResults,
      envelopes,
    },
  };
}
