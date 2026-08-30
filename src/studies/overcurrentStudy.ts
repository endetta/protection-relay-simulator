import type {
  CoordinationPair,
  CoordinationRequirement,
  CurrentProfile,
  DevicePrimaryCurrentMap,
  DomainEvaluation,
  DomainIssue,
  FaultCase,
  FaultCaseId,
  FaultLocationProfile,
  FaultLocationProfileSegment,
  FaultLocationProfileId,
  LoadCase,
  LoadCaseId,
  OvercurrentSimulatorState,
  OvercurrentStudyDefinition,
  ProtectionChain,
  ProtectionDevice,
  ProtectionDeviceId,
  StudyCurrentDefinition,
  StudyLocationId,
  StudySnapshot,
} from '../types/overcurrent';

const EPS = 1e-12;
const CTI_EPS = 1e-9;

export interface ResolvedFaultLocationStudy {
  readonly normalizedPosition: number;
  readonly primaryCurrentAByDevice: DevicePrimaryCurrentMap;
  readonly locationId: StudyLocationId | null;
  readonly protectionChain: ProtectionChain | null;
}

function issue(code: DomainIssue['code'], path: string, detail: string): DomainIssue {
  return { code, path, detail };
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function unique<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

function mapIssues(
  map: DevicePrimaryCurrentMap,
  deviceIds: readonly ProtectionDeviceId[],
  path: string,
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const expected = new Set(deviceIds);

  for (const deviceId of deviceIds) {
    if (!(deviceId in map)) {
      issues.push(issue('MISSING_REFERENCE', `${path}.${deviceId}`, `Missing configured primary current for ${deviceId}.`));
      continue;
    }
    const value = map[deviceId];
    if (!finiteNonNegative(value)) {
      issues.push(issue('NON_FINITE_INPUT', `${path}.${deviceId}`, `Primary current must be finite and >= 0 A; received ${String(value)}.`));
    }
  }

  for (const deviceId of Object.keys(map)) {
    if (!expected.has(deviceId)) {
      issues.push(issue('MISSING_REFERENCE', `${path}.${deviceId}`, `Current map references device ${deviceId} outside the study topology.`));
    }
  }

  return issues;
}

function validateCurrentDefinition(
  current: StudyCurrentDefinition,
  profileIds: ReadonlySet<string>,
  deviceIds: readonly ProtectionDeviceId[],
  path: string,
): DomainIssue[] {
  if (current.kind === 'STATIC') return mapIssues(current.primaryCurrentAByDevice, deviceIds, `${path}.primaryCurrentAByDevice`);
  if (!profileIds.has(current.profileId)) {
    return [issue('MISSING_REFERENCE', `${path}.profileId`, `Unknown current profile ${current.profileId}.`)];
  }
  return [];
}

function validateChain(
  chain: ProtectionChain,
  topologyDeviceIds: readonly ProtectionDeviceId[],
  path: string,
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const deviceSet = new Set(topologyDeviceIds);
  if (!deviceSet.has(chain.primaryDeviceId)) {
    issues.push(issue('MISSING_REFERENCE', `${path}.primaryDeviceId`, `Unknown primary device ${chain.primaryDeviceId}.`));
    return issues;
  }
  if (!unique(chain.backupDeviceIds)) {
    issues.push(issue('INVALID_TOPOLOGY', `${path}.backupDeviceIds`, 'Backup device IDs must be unique.'));
  }
  if (chain.backupDeviceIds.includes(chain.primaryDeviceId)) {
    issues.push(issue('INVALID_TOPOLOGY', `${path}.backupDeviceIds`, 'Primary device cannot also be a backup device.'));
  }

  const primaryIndex = topologyDeviceIds.indexOf(chain.primaryDeviceId);
  let previousIndex = primaryIndex;
  chain.backupDeviceIds.forEach((backupId, index) => {
    const backupIndex = topologyDeviceIds.indexOf(backupId);
    if (!deviceSet.has(backupId)) {
      issues.push(issue('MISSING_REFERENCE', `${path}.backupDeviceIds.${index}`, `Unknown backup device ${backupId}.`));
    } else if (backupIndex >= previousIndex) {
      issues.push(issue(
        'INVALID_TOPOLOGY',
        `${path}.backupDeviceIds.${index}`,
        'Radial backup chain must proceed nearest-to-farthest upstream.',
      ));
    }
    previousIndex = backupIndex;
  });
  return issues;
}

function validateProfiles(study: OvercurrentStudyDefinition): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const deviceIds = study.topology.deviceIds;

  if (!unique(study.currentProfiles.map((profile) => profile.id))) {
    issues.push(issue('INVALID_PROFILE', 'currentProfiles', 'Current profile IDs must be unique.'));
  }

  for (const profile of study.currentProfiles) {
    const path = `currentProfiles.${profile.id}`;
    if (profile.samples.length === 0) {
      issues.push(issue('INVALID_PROFILE', `${path}.samples`, 'Current profile must contain at least one sample.'));
      continue;
    }
    let previous = -Infinity;
    profile.samples.forEach((sample, index) => {
      if (!finiteNonNegative(sample.timeSec) || sample.timeSec <= previous) {
        issues.push(issue('INVALID_PROFILE', `${path}.samples.${index}.timeSec`, 'Profile sample times must be finite, >= 0, and strictly increasing.'));
      }
      previous = sample.timeSec;
      issues.push(...mapIssues(sample.primaryCurrentAByDevice, deviceIds, `${path}.samples.${index}.primaryCurrentAByDevice`));
    });
  }

  if (!unique(study.faultLocationProfiles.map((profile) => profile.id))) {
    issues.push(issue('INVALID_PROFILE', 'faultLocationProfiles', 'Fault-location profile IDs must be unique.'));
  }

  const locationIds = new Set(study.topology.locations.map((location) => location.id));
  for (const profile of study.faultLocationProfiles) {
    const path = `faultLocationProfiles.${profile.id}`;
    if (profile.samples.length < 2) {
      issues.push(issue('INVALID_PROFILE', `${path}.samples`, 'Fault-location profile requires at least two interpolation samples.'));
      continue;
    }
    let previous = -Infinity;
    profile.samples.forEach((sample, index) => {
      if (!Number.isFinite(sample.normalizedPosition) || sample.normalizedPosition < 0 || sample.normalizedPosition > 1 || sample.normalizedPosition <= previous) {
        issues.push(issue('INVALID_PROFILE', `${path}.samples.${index}.normalizedPosition`, 'Fault-location samples must be finite, within [0,1], and strictly increasing.'));
      }
      previous = sample.normalizedPosition;
      issues.push(...mapIssues(sample.primaryCurrentAByDevice, deviceIds, `${path}.samples.${index}.primaryCurrentAByDevice`));
    });

    if (profile.segments) {
      if (profile.segments.length === 0) {
        issues.push(issue('INVALID_PROFILE', `${path}.segments`, 'Configured segment list cannot be empty.'));
      } else {
        let previousEnd: number | null = null;
        profile.segments.forEach((segment, index) => {
          const segPath = `${path}.segments.${index}`;
          if (!Number.isFinite(segment.startPosition) || !Number.isFinite(segment.endPosition)
            || segment.startPosition < 0 || segment.endPosition > 1 || segment.endPosition <= segment.startPosition) {
            issues.push(issue('INVALID_PROFILE', segPath, 'Fault-location segment bounds must be finite and satisfy 0 <= start < end <= 1.'));
          }
          if (previousEnd !== null && Math.abs(segment.startPosition - previousEnd) > EPS) {
            issues.push(issue('INVALID_PROFILE', segPath, 'Fault-location segments must be contiguous and ordered.'));
          }
          previousEnd = segment.endPosition;
          if (!locationIds.has(segment.locationId)) {
            issues.push(issue('MISSING_REFERENCE', `${segPath}.locationId`, `Unknown location ${segment.locationId}.`));
          }
          issues.push(...validateChain(segment.protectionChain, deviceIds, `${segPath}.protectionChain`));
        });
        const firstSample = profile.samples[0]?.normalizedPosition;
        const lastSample = profile.samples[profile.samples.length - 1]?.normalizedPosition;
        const firstSegment = profile.segments[0];
        const lastSegment = profile.segments[profile.segments.length - 1];
        if (firstSegment && lastSegment && firstSample !== undefined && lastSample !== undefined
          && (firstSegment.startPosition > firstSample + EPS || lastSegment.endPosition < lastSample - EPS)) {
          issues.push(issue('INVALID_PROFILE', `${path}.segments`, 'Fault-location segments must cover the configured interpolation sample range.'));
        }
      }
    }
  }
  return issues;
}

export function validateOvercurrentStudyDefinition(study: OvercurrentStudyDefinition): DomainEvaluation<OvercurrentStudyDefinition> {
  const issues: DomainIssue[] = [];
  const topologyDeviceIds = study.topology.deviceIds;
  const deviceIds = Object.keys(study.devicesById);
  const topologyLocationIds = study.topology.locations.map((location) => location.id);

  if (!study.id.trim()) issues.push(issue('MISSING_REFERENCE', 'id', 'Study preset ID is required.'));
  if (!study.label.trim()) issues.push(issue('MISSING_REFERENCE', 'label', 'Study label is required.'));
  if (topologyDeviceIds.length === 0 || !unique(topologyDeviceIds)) {
    issues.push(issue('INVALID_TOPOLOGY', 'topology.deviceIds', 'Topology must reference one or more unique devices.'));
  }
  if (!unique(topologyLocationIds)) {
    issues.push(issue('INVALID_TOPOLOGY', 'topology.locations', 'Study location IDs must be unique.'));
  }

  if (study.topology.kind === 'SINGLE_RELAY_FEEDER' && topologyDeviceIds.length !== 1) {
    issues.push(issue('INVALID_TOPOLOGY', 'topology.deviceIds', 'SINGLE_RELAY_FEEDER requires exactly one protection device.'));
  }
  if (study.topology.kind === 'RADIAL_FEEDER' && topologyDeviceIds.length < 2) {
    issues.push(issue('INVALID_TOPOLOGY', 'topology.deviceIds', 'RADIAL_FEEDER requires at least two protection devices.'));
  }

  for (const deviceId of topologyDeviceIds) {
    const device = study.devicesById[deviceId];
    if (!device) {
      issues.push(issue('MISSING_REFERENCE', `devicesById.${deviceId}`, `Topology references missing device ${deviceId}.`));
      continue;
    }
    if (device.id !== deviceId) {
      issues.push(issue('INVALID_TOPOLOGY', `devicesById.${deviceId}.id`, 'Device record key must equal device.id.'));
    }
  }
  for (const deviceId of deviceIds) {
    if (!topologyDeviceIds.includes(deviceId)) {
      issues.push(issue('INVALID_TOPOLOGY', `devicesById.${deviceId}`, `Device ${deviceId} is not present in topology.deviceIds.`));
    }
  }

  const orderValues = topologyDeviceIds
    .map((id) => study.devicesById[id]?.order)
    .filter((value): value is number => value !== undefined);
  if (!unique(orderValues) || orderValues.some((value) => !Number.isFinite(value))) {
    issues.push(issue('INVALID_TOPOLOGY', 'devicesById.*.order', 'Device order values must be finite and unique.'));
  }

  for (const location of study.topology.locations) {
    if (!location.label.trim()) issues.push(issue('INVALID_TOPOLOGY', `topology.locations.${location.id}.label`, 'Location label is required.'));
    if (location.normalizedPosition !== undefined
      && (!Number.isFinite(location.normalizedPosition) || location.normalizedPosition < 0 || location.normalizedPosition > 1)) {
      issues.push(issue('INVALID_TOPOLOGY', `topology.locations.${location.id}.normalizedPosition`, 'Normalized location position must be within [0,1].'));
    }
  }

  issues.push(...validateProfiles(study));
  const currentProfileIds = new Set(study.currentProfiles.map((profile) => profile.id));
  const locationIds = new Set(topologyLocationIds);

  if (!unique(study.loadCases.map((loadCase) => loadCase.id))) {
    issues.push(issue('INVALID_PROFILE', 'loadCases', 'Load case IDs must be unique.'));
  }
  for (const loadCase of study.loadCases) {
    issues.push(...validateCurrentDefinition(loadCase.current, currentProfileIds, topologyDeviceIds, `loadCases.${loadCase.id}.current`));
  }

  if (!unique(study.faultCases.map((faultCase) => faultCase.id))) {
    issues.push(issue('INVALID_PROFILE', 'faultCases', 'Fault case IDs must be unique.'));
  }
  for (const faultCase of study.faultCases) {
    const path = `faultCases.${faultCase.id}`;
    if (!locationIds.has(faultCase.locationId)) {
      issues.push(issue('MISSING_REFERENCE', `${path}.locationId`, `Unknown fault location ${faultCase.locationId}.`));
    }
    issues.push(...validateCurrentDefinition(faultCase.current, currentProfileIds, topologyDeviceIds, `${path}.current`));
    issues.push(...validateChain(faultCase.protectionChain, topologyDeviceIds, `${path}.protectionChain`));
    if (faultCase.allowedBackupInstantaneousDeviceIds) {
      if (!unique(faultCase.allowedBackupInstantaneousDeviceIds)) {
        issues.push(issue('INVALID_PROFILE', `${path}.allowedBackupInstantaneousDeviceIds`, 'Allowed backup instantaneous device IDs must be unique.'));
      }
      for (const deviceId of faultCase.allowedBackupInstantaneousDeviceIds) {
        if (!faultCase.protectionChain.backupDeviceIds.includes(deviceId)) {
          issues.push(issue(
            'INVALID_PROFILE',
            `${path}.allowedBackupInstantaneousDeviceIds`,
            `Instantaneous exception ${deviceId} must reference an explicit backup device for this fault.`,
          ));
        }
      }
    }
    if (faultCase.externalClearTimeSec !== undefined && !finiteNonNegative(faultCase.externalClearTimeSec)) {
      issues.push(issue('INVALID_PROFILE', `${path}.externalClearTimeSec`, 'External clear time must be finite and >= 0 s.'));
    }
    if (faultCase.postFaultProfileId && !currentProfileIds.has(faultCase.postFaultProfileId)) {
      issues.push(issue('MISSING_REFERENCE', `${path}.postFaultProfileId`, `Unknown post-fault profile ${faultCase.postFaultProfileId}.`));
    }
  }

  if (!unique(study.coordinationPairs.map((pair) => pair.id))) {
    issues.push(issue('INVALID_COORDINATION_PAIR', 'coordinationPairs', 'Coordination pair IDs must be unique.'));
  }
  const pairIds = new Set(study.coordinationPairs.map((pair) => pair.id));
  for (const pair of study.coordinationPairs) {
    const path = `coordinationPairs.${pair.id}`;
    if (!locationIds.has(pair.locationId)) issues.push(issue('MISSING_REFERENCE', `${path}.locationId`, `Unknown location ${pair.locationId}.`));
    if (!topologyDeviceIds.includes(pair.primaryDeviceId)) issues.push(issue('MISSING_REFERENCE', `${path}.primaryDeviceId`, `Unknown primary ${pair.primaryDeviceId}.`));
    if (!topologyDeviceIds.includes(pair.backupDeviceId)) issues.push(issue('MISSING_REFERENCE', `${path}.backupDeviceId`, `Unknown backup ${pair.backupDeviceId}.`));
    if (pair.primaryDeviceId === pair.backupDeviceId || !Number.isInteger(pair.backupOrder) || pair.backupOrder < 1) {
      issues.push(issue('INVALID_COORDINATION_PAIR', path, 'Coordination pair requires distinct devices and backupOrder >= 1.'));
    }
    const matchingFault = study.faultCases.find((faultCase) => {
      if (faultCase.locationId !== pair.locationId) return false;
      const orderedChain = [faultCase.protectionChain.primaryDeviceId, ...faultCase.protectionChain.backupDeviceIds];
      return orderedChain[pair.backupOrder - 1] === pair.primaryDeviceId
        && orderedChain[pair.backupOrder] === pair.backupDeviceId;
    });
    if (!matchingFault) {
      issues.push(issue('INVALID_COORDINATION_PAIR', path, 'Pair must match one adjacent tier of an explicit fault-case protection chain at the same location.'));
    }
  }

  if (!unique(study.coordinationRequirements.map((requirement) => requirement.id))) {
    issues.push(issue('INVALID_COORDINATION_PAIR', 'coordinationRequirements', 'Coordination requirement IDs must be unique.'));
  }
  const requirementPairIds = new Set<string>();
  for (const requirement of study.coordinationRequirements) {
    const path = `coordinationRequirements.${requirement.id}`;
    if (!pairIds.has(requirement.pairId)) issues.push(issue('MISSING_REFERENCE', `${path}.pairId`, `Unknown coordination pair ${requirement.pairId}.`));
    if (requirementPairIds.has(requirement.pairId)) issues.push(issue('INVALID_COORDINATION_PAIR', `${path}.pairId`, `Only one authoritative requirement is permitted per pair.`));
    requirementPairIds.add(requirement.pairId);
    if (!finiteNonNegative(requirement.requiredCtiSec)) {
      issues.push(issue('INVALID_SETTING_RANGE', `${path}.requiredCtiSec`, 'Required CTI must be finite and >= 0 s.'));
    }
    if (requirement.budget) {
      const parts = [requirement.budget.breakerAllowanceSec, requirement.budget.relayTimingAllowanceSec, requirement.budget.studySafetyMarginSec];
      if (parts.some((value) => !finiteNonNegative(value))) {
        issues.push(issue('INVALID_SETTING_RANGE', `${path}.budget`, 'CTI budget components must be finite and >= 0 s.'));
      } else {
        const sum = parts.reduce((total, value) => total + value, 0);
        const tolerance = CTI_EPS * Math.max(1, Math.abs(sum), Math.abs(requirement.requiredCtiSec));
        if (Math.abs(sum - requirement.requiredCtiSec) > tolerance) {
          issues.push(issue('INVALID_SETTING_RANGE', `${path}.budget`, 'CTI budget must reconcile to requiredCtiSec.'));
        }
      }
    }
  }

  for (const pair of study.coordinationPairs) {
    if (!requirementPairIds.has(pair.id)) {
      issues.push(issue(
        'MISSING_REFERENCE',
        `coordinationRequirements.${pair.id}`,
        `Coordination pair ${pair.id} requires one authoritative CTI requirement.`,
      ));
    }
  }

  const faultIds = new Set(study.faultCases.map((faultCase) => faultCase.id));
  if (!unique(study.validationCaseIds) || study.validationCaseIds.some((id) => !faultIds.has(id))) {
    issues.push(issue('MISSING_REFERENCE', 'validationCaseIds', 'Validation case IDs must be unique and reference configured fault cases.'));
  }
  const loadIds = new Set(study.loadCases.map((loadCase) => loadCase.id));
  if (!unique(study.loadSecurityCaseIds) || study.loadSecurityCaseIds.some((id) => !loadIds.has(id))) {
    issues.push(issue('MISSING_REFERENCE', 'loadSecurityCaseIds', 'Load-security IDs must be unique and reference configured load cases.'));
  }

  if (study.defaultSelectedDeviceId && !topologyDeviceIds.includes(study.defaultSelectedDeviceId)) {
    issues.push(issue('MISSING_REFERENCE', 'defaultSelectedDeviceId', `Unknown default device ${study.defaultSelectedDeviceId}.`));
  }
  if (study.defaultLoadCaseId && !loadIds.has(study.defaultLoadCaseId)) {
    issues.push(issue('MISSING_REFERENCE', 'defaultLoadCaseId', `Unknown default load case ${study.defaultLoadCaseId}.`));
  }
  if (study.defaultFaultCaseId && !faultIds.has(study.defaultFaultCaseId)) {
    issues.push(issue('MISSING_REFERENCE', 'defaultFaultCaseId', `Unknown default fault case ${study.defaultFaultCaseId}.`));
  }

  if (study.learning) {
    for (const [index, hint] of study.learning.hints.entries()) {
      const path = `learning.hints.${index}`;
      if (!hint.text.trim()) issues.push(issue('MISSING_REFERENCE', `${path}.text`, 'Hint text cannot be empty.'));
      if (hint.faultCaseId && !faultIds.has(hint.faultCaseId)) issues.push(issue('MISSING_REFERENCE', `${path}.faultCaseId`, `Unknown fault case ${hint.faultCaseId}.`));
      if (hint.pairId && !pairIds.has(hint.pairId)) issues.push(issue('MISSING_REFERENCE', `${path}.pairId`, `Unknown pair ${hint.pairId}.`));
      if (hint.deviceId && !topologyDeviceIds.includes(hint.deviceId)) issues.push(issue('MISSING_REFERENCE', `${path}.deviceId`, `Unknown device ${hint.deviceId}.`));
    }
  }

  return issues.length > 0 ? { status: 'INVALID', issues } : { status: 'VALID', value: study };
}

function profileById(study: OvercurrentStudyDefinition, profileId: string): CurrentProfile | undefined {
  return study.currentProfiles.find((profile) => profile.id === profileId);
}

function interpolateMap(a: DevicePrimaryCurrentMap, b: DevicePrimaryCurrentMap, ratio: number): DevicePrimaryCurrentMap {
  const output: Record<string, number> = {};
  for (const deviceId of Object.keys(a)) {
    output[deviceId] = a[deviceId] + (b[deviceId] - a[deviceId]) * ratio;
  }
  return output;
}

export function resolveCurrentProfileAtTime(
  profile: CurrentProfile,
  engineeringTimeSec: number,
): DomainEvaluation<DevicePrimaryCurrentMap> {
  if (!finiteNonNegative(engineeringTimeSec)) {
    return { status: 'INVALID', issues: [issue('NON_FINITE_INPUT', 'engineeringTimeSec', 'Engineering time must be finite and >= 0 s.')] };
  }
  if (profile.samples.length === 0) {
    return { status: 'INVALID', issues: [issue('INVALID_PROFILE', `currentProfiles.${profile.id}.samples`, 'Profile has no samples.')] };
  }
  const first = profile.samples[0];
  const last = profile.samples[profile.samples.length - 1];
  if (engineeringTimeSec <= first.timeSec) return { status: 'VALID', value: first.primaryCurrentAByDevice };
  if (engineeringTimeSec >= last.timeSec) return { status: 'VALID', value: last.primaryCurrentAByDevice };

  for (let index = 1; index < profile.samples.length; index += 1) {
    const right = profile.samples[index];
    // STEP profiles are right-continuous at a configured sample timestamp:
    // between samples the left/latest value applies, while the new sample owns
    // its exact engineering timestamp. This is required by O07 event ordering.
    if (engineeringTimeSec >= right.timeSec) continue;
    const left = profile.samples[index - 1];
    if (profile.interpolation === 'STEP') return { status: 'VALID', value: left.primaryCurrentAByDevice };
    const ratio = (engineeringTimeSec - left.timeSec) / (right.timeSec - left.timeSec);
    return { status: 'VALID', value: interpolateMap(left.primaryCurrentAByDevice, right.primaryCurrentAByDevice, ratio) };
  }
  return { status: 'VALID', value: last.primaryCurrentAByDevice };
}

function resolveStudyCurrent(
  study: OvercurrentStudyDefinition,
  current: StudyCurrentDefinition,
  engineeringTimeSec: number,
  path: string,
): DomainEvaluation<DevicePrimaryCurrentMap> {
  if (current.kind === 'STATIC') return { status: 'VALID', value: current.primaryCurrentAByDevice };
  const profile = profileById(study, current.profileId);
  if (!profile) return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', path, `Unknown current profile ${current.profileId}.`)] };
  return resolveCurrentProfileAtTime(profile, engineeringTimeSec);
}

export function getStudyDevice(study: OvercurrentStudyDefinition, deviceId: ProtectionDeviceId): ProtectionDevice | undefined {
  return study.devicesById[deviceId];
}

export function getFaultCase(study: OvercurrentStudyDefinition, faultCaseId: FaultCaseId): FaultCase | undefined {
  return study.faultCases.find((faultCase) => faultCase.id === faultCaseId);
}

export function getLoadCase(study: OvercurrentStudyDefinition, loadCaseId: LoadCaseId): LoadCase | undefined {
  return study.loadCases.find((loadCase) => loadCase.id === loadCaseId);
}

export function getCoordinationPairsForLocation(
  study: OvercurrentStudyDefinition,
  locationId: StudyLocationId,
): readonly CoordinationPair[] {
  return study.coordinationPairs
    .filter((pair) => pair.locationId === locationId)
    .slice()
    .sort((a, b) => a.backupOrder - b.backupOrder);
}

export function getCoordinationRequirementForPair(
  study: OvercurrentStudyDefinition,
  pairId: string,
): CoordinationRequirement | undefined {
  return study.coordinationRequirements.find((requirement) => requirement.pairId === pairId);
}

export function resolveFaultCaseCurrents(
  study: OvercurrentStudyDefinition,
  faultCaseId: FaultCaseId,
  engineeringTimeSec = 0,
): DomainEvaluation<DevicePrimaryCurrentMap> {
  const faultCase = getFaultCase(study, faultCaseId);
  if (!faultCase) return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', 'faultCaseId', `Unknown fault case ${faultCaseId}.`)] };
  return resolveStudyCurrent(study, faultCase.current, engineeringTimeSec, `faultCases.${faultCaseId}.current`);
}

export function resolveLoadCaseCurrents(
  study: OvercurrentStudyDefinition,
  loadCaseId: LoadCaseId,
  engineeringTimeSec = 0,
): DomainEvaluation<DevicePrimaryCurrentMap> {
  const loadCase = getLoadCase(study, loadCaseId);
  if (!loadCase) return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', 'loadCaseId', `Unknown load case ${loadCaseId}.`)] };
  return resolveStudyCurrent(study, loadCase.current, engineeringTimeSec, `loadCases.${loadCaseId}.current`);
}

function profileSegmentAt(
  profile: FaultLocationProfile,
  normalizedPosition: number,
): FaultLocationProfileSegment | null {
  const segments = profile.segments;
  if (!segments || segments.length === 0) return null;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    if (normalizedPosition >= segment.startPosition - EPS
      && (normalizedPosition < segment.endPosition - EPS || (isLast && normalizedPosition <= segment.endPosition + EPS))) {
      return segment;
    }
  }
  return null;
}


export function resolveFaultLocationStudy(
  study: OvercurrentStudyDefinition,
  profileId: FaultLocationProfileId,
  normalizedPosition: number,
): DomainEvaluation<ResolvedFaultLocationStudy> {
  if (!Number.isFinite(normalizedPosition)) {
    return { status: 'INVALID', issues: [issue('NON_FINITE_INPUT', 'normalizedPosition', 'Fault position must be finite.')] };
  }
  const profile = study.faultLocationProfiles.find((item) => item.id === profileId);
  if (!profile) return { status: 'INVALID', issues: [issue('MISSING_REFERENCE', 'faultLocationProfileId', `Unknown fault-location profile ${profileId}.`)] };
  if (profile.samples.length < 2) return { status: 'INVALID', issues: [issue('INVALID_PROFILE', `faultLocationProfiles.${profileId}.samples`, 'At least two samples are required.')] };
  const first = profile.samples[0];
  const last = profile.samples[profile.samples.length - 1];
  if (normalizedPosition < first.normalizedPosition - EPS || normalizedPosition > last.normalizedPosition + EPS) {
    return { status: 'INVALID', issues: [issue('INVALID_PROFILE', 'normalizedPosition', `Fault position must remain within configured profile range ${first.normalizedPosition}..${last.normalizedPosition}.`)] };
  }

  let currents = first.primaryCurrentAByDevice;
  if (normalizedPosition >= last.normalizedPosition - EPS) {
    currents = last.primaryCurrentAByDevice;
  } else if (normalizedPosition > first.normalizedPosition + EPS) {
    for (let index = 1; index < profile.samples.length; index += 1) {
      const right = profile.samples[index];
      if (normalizedPosition > right.normalizedPosition) continue;
      const left = profile.samples[index - 1];
      const ratio = (normalizedPosition - left.normalizedPosition) / (right.normalizedPosition - left.normalizedPosition);
      currents = interpolateMap(left.primaryCurrentAByDevice, right.primaryCurrentAByDevice, ratio);
      break;
    }
  }

  const segment = profileSegmentAt(profile, normalizedPosition);
  return {
    status: 'VALID',
    value: {
      normalizedPosition,
      primaryCurrentAByDevice: currents,
      locationId: segment?.locationId ?? null,
      protectionChain: segment?.protectionChain ?? null,
    },
  };
}

function makeInitialSnapshot(study: OvercurrentStudyDefinition, selectedFaultCaseId?: FaultCaseId): StudySnapshot {
  return {
    id: `${study.id}:INITIAL`,
    label: 'Initial Settings',
    devicesById: study.devicesById,
    coordinationRequirements: study.coordinationRequirements,
    selectedFaultCaseId,
  };
}

export function initializeOvercurrentSimulatorState(
  study: OvercurrentStudyDefinition,
): DomainEvaluation<OvercurrentSimulatorState> {
  const validated = validateOvercurrentStudyDefinition(study);
  if (validated.status === 'INVALID') return validated;

  const selectedDeviceId = study.defaultSelectedDeviceId ?? study.topology.deviceIds[0] ?? null;
  const activeLoadCaseId = study.defaultLoadCaseId ?? study.loadCases[0]?.id ?? null;
  const activeFaultCaseId = study.defaultFaultCaseId ?? null;

  return {
    status: 'VALID',
    value: {
      studyMode: study.mode,
      guidanceMode: study.guidance,
      studyPresetId: study.id,
      topology: study.topology,
      selectedDeviceId,
      activeLoadCaseId,
      activeFaultCaseId,
      simulationSpeed: 1,
      playbackState: 'IDLE',
      devicesById: study.devicesById,
      coordinationRequirements: study.coordinationRequirements,
      initialSnapshot: makeInitialSnapshot(study, activeFaultCaseId ?? undefined),
      comparisonSnapshot: null,
      validationState: { status: 'IDLE' },
      uiSectionState: {},
    },
  };
}
