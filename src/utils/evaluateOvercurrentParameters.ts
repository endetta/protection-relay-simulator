import {
  validate50Settings,
  validate51Settings,
  validateBreakerConfiguration,
} from '../engines/overcurrent';
import { validateCTConfiguration } from '../engines/overcurrentMeasurement';
import {
  resolveFaultCaseCurrents,
  resolveFaultLocationStudy,
  resolveLoadCaseCurrents,
  validateOvercurrentStudyDefinition,
} from '../studies/overcurrentStudy';
import type {
  DevicePrimaryCurrentMap,
  DomainEvaluation,
  DomainIssue,
  OperatingResult,
  ProtectionDeviceId,
} from '../types/overcurrent';
import { evaluateOvercurrentDevice } from './evaluateOvercurrentDevice';
import type { OvercurrentParameterState } from './overcurrentState';

export interface ActiveOvercurrentParameterEvaluation {
  readonly source: {
    readonly kind: 'LOAD' | 'FAULT' | 'FAULT_PROFILE';
    readonly id: string;
    readonly label: string;
    readonly category: string;
    readonly normalizedPosition?: number;
    readonly locationId?: string | null;
    readonly protectionChain?: {
      readonly primaryDeviceId: ProtectionDeviceId;
      readonly backupDeviceIds: readonly ProtectionDeviceId[];
    } | null;
  } | null;
  readonly primaryCurrentAByDevice: DevicePrimaryCurrentMap;
  readonly deviceResults: Readonly<Record<ProtectionDeviceId, OperatingResult>>;
}

function issue(code: DomainIssue['code'], path: string, detail: string): DomainIssue {
  return { code, path, detail };
}

function prefixIssues(issues: readonly DomainIssue[], prefix: string): DomainIssue[] {
  return issues.map((entry) => ({
    ...entry,
    path: entry.path ? `${prefix}.${entry.path}` : prefix,
  }));
}

function collectCurrentMaps(state: OvercurrentParameterState): Array<{
  path: string;
  map: DevicePrimaryCurrentMap;
}> {
  const maps: Array<{ path: string; map: DevicePrimaryCurrentMap }> = [];
  for (const loadCase of state.studyDefinition.loadCases) {
    if (loadCase.current.kind === 'STATIC') {
      maps.push({ path: `loadCases.${loadCase.id}.current`, map: loadCase.current.primaryCurrentAByDevice });
    }
  }
  for (const faultCase of state.studyDefinition.faultCases) {
    if (faultCase.current.kind === 'STATIC') {
      maps.push({ path: `faultCases.${faultCase.id}.current`, map: faultCase.current.primaryCurrentAByDevice });
    }
  }
  for (const profile of state.studyDefinition.currentProfiles) {
    profile.samples.forEach((sample, index) => {
      maps.push({ path: `currentProfiles.${profile.id}.samples.${index}`, map: sample.primaryCurrentAByDevice });
    });
  }
  for (const profile of state.studyDefinition.faultLocationProfiles) {
    profile.samples.forEach((sample, index) => {
      maps.push({ path: `faultLocationProfiles.${profile.id}.samples.${index}`, map: sample.primaryCurrentAByDevice });
    });
  }
  return maps;
}

/**
 * O08 validation boundary. Structural study checks and every editable device
 * setting are validated before a run is permitted. Configured current vectors
 * are also evaluated through the approved O03/O04 device engine so finite
 * inputs that overflow only after CT scaling cannot reach playback.
 */
export function validateOvercurrentParameterState(
  state: OvercurrentParameterState,
): DomainEvaluation<OvercurrentParameterState> {
  const issues: DomainIssue[] = [];
  const structural = validateOvercurrentStudyDefinition(state.studyDefinition);
  if (structural.status === 'INVALID') issues.push(...structural.issues);

  if (state.studyPresetId !== state.studyDefinition.id) {
    issues.push(issue('MISSING_REFERENCE', 'studyPresetId', 'Parameter state and study definition use different preset IDs.'));
  }
  if (state.studyMode !== state.studyDefinition.mode) {
    issues.push(issue('INVALID_TOPOLOGY', 'studyMode', 'Parameter state and study definition use different study modes.'));
  }
  if (state.guidanceMode !== state.studyDefinition.guidance) {
    issues.push(issue('INVALID_TOPOLOGY', 'guidanceMode', 'Parameter state and study definition use different guidance modes.'));
  }
  if (state.devicesById !== state.studyDefinition.devicesById) {
    issues.push(issue('MISSING_REFERENCE', 'devicesById', 'Parameter state must reference the current study device registry.'));
  }
  if (state.coordinationRequirements !== state.studyDefinition.coordinationRequirements) {
    issues.push(issue('MISSING_REFERENCE', 'coordinationRequirements', 'Parameter state must reference the current study CTI requirements.'));
  }
  if (state.selectedDeviceId !== null && !state.topology.deviceIds.includes(state.selectedDeviceId)) {
    issues.push(issue('MISSING_REFERENCE', 'selectedDeviceId', `Unknown selected device ${state.selectedDeviceId}.`));
  }
  if (state.activeLoadCaseId !== null && !state.studyDefinition.loadCases.some((item) => item.id === state.activeLoadCaseId)) {
    issues.push(issue('MISSING_REFERENCE', 'activeLoadCaseId', `Unknown active load case ${state.activeLoadCaseId}.`));
  }
  if (state.activeFaultCaseId !== null && !state.studyDefinition.faultCases.some((item) => item.id === state.activeFaultCaseId)) {
    issues.push(issue('MISSING_REFERENCE', 'activeFaultCaseId', `Unknown active fault case ${state.activeFaultCaseId}.`));
  }
  if (state.activeFaultCaseId !== null && state.faultLocationSelection !== null) {
    issues.push(issue('INVALID_PROFILE', 'faultLocationSelection', 'A discrete fault case and a fault-location profile point cannot be active together.'));
  }
  if (state.faultLocationSelection !== null) {
    const resolved = resolveFaultLocationStudy(
      state.studyDefinition,
      state.faultLocationSelection.profileId,
      state.faultLocationSelection.normalizedPosition,
    );
    if (resolved.status === 'INVALID') {
      issues.push(...prefixIssues(resolved.issues, 'faultLocationSelection'));
    }
  }

  const deviceHasSettingIssue = new Set<ProtectionDeviceId>();
  for (const deviceId of state.topology.deviceIds) {
    const device = state.studyDefinition.devicesById[deviceId];
    if (!device) continue;
    const settingIssues = [
      ...validateCTConfiguration(device.settings.ct, `devicesById.${deviceId}.settings.ct`),
      ...validate51Settings(device.settings.phase51, `devicesById.${deviceId}.settings.phase51`),
      ...validate50Settings(device.settings.phase50, `devicesById.${deviceId}.settings.phase50`),
      ...validateBreakerConfiguration(device.settings.breaker, `devicesById.${deviceId}.settings.breaker`),
    ];
    if (settingIssues.length > 0) deviceHasSettingIssue.add(deviceId);
    issues.push(...settingIssues);
  }

  if (structural.status === 'VALID') {
    for (const configured of collectCurrentMaps(state)) {
      for (const deviceId of state.topology.deviceIds) {
        if (deviceHasSettingIssue.has(deviceId)) continue;
        const device = state.studyDefinition.devicesById[deviceId];
        const primaryCurrentA = configured.map[deviceId];
        if (!device || primaryCurrentA === undefined) continue;
        const evaluated = evaluateOvercurrentDevice(primaryCurrentA, device);
        if (evaluated.status === 'INVALID') {
          issues.push(...prefixIssues(evaluated.issues, `${configured.path}.${deviceId}`));
        }
      }
    }
  }

  return issues.length > 0
    ? { status: 'INVALID', issues }
    : { status: 'VALID', value: state };
}

export function evaluateActiveOvercurrentParameters(
  state: OvercurrentParameterState,
): DomainEvaluation<ActiveOvercurrentParameterEvaluation> {
  const validState = validateOvercurrentParameterState(state);
  if (validState.status === 'INVALID') return validState;

  let source: ActiveOvercurrentParameterEvaluation['source'] = null;
  let currentEvaluation: DomainEvaluation<DevicePrimaryCurrentMap> = { status: 'VALID', value: {} };

  const profileSelection = state.faultLocationSelection;
  if (profileSelection !== null) {
    const profile = state.studyDefinition.faultLocationProfiles.find((item) => item.id === profileSelection.profileId);
    const resolved = resolveFaultLocationStudy(
      state.studyDefinition,
      profileSelection.profileId,
      profileSelection.normalizedPosition,
    );
    if (!profile || resolved.status === 'INVALID') {
      return resolved.status === 'INVALID'
        ? resolved
        : {
            status: 'INVALID',
            issues: [issue('MISSING_REFERENCE', 'faultLocationSelection.profileId', `Unknown fault-location profile ${profileSelection.profileId}.`)],
          };
    }
    source = {
      kind: 'FAULT_PROFILE',
      id: profile.id,
      label: profile.label,
      category: 'CUSTOM',
      normalizedPosition: resolved.value.normalizedPosition,
      locationId: resolved.value.locationId,
      protectionChain: resolved.value.protectionChain,
    };
    currentEvaluation = { status: 'VALID', value: resolved.value.primaryCurrentAByDevice };
  }

  const faultCase = state.activeFaultCaseId === null
    ? undefined
    : state.studyDefinition.faultCases.find((item) => item.id === state.activeFaultCaseId);
  const loadCase = state.activeLoadCaseId === null
    ? undefined
    : state.studyDefinition.loadCases.find((item) => item.id === state.activeLoadCaseId);

  if (profileSelection !== null) {
    // The configured profile point above is authoritative in Explore mode.
  } else if (faultCase) {
    source = {
      kind: 'FAULT',
      id: faultCase.id,
      label: faultCase.label,
      category: faultCase.category,
      locationId: faultCase.locationId,
      protectionChain: faultCase.protectionChain,
    };
    currentEvaluation = resolveFaultCaseCurrents(state.studyDefinition, faultCase.id);
  } else if (loadCase) {
    source = { kind: 'LOAD', id: loadCase.id, label: loadCase.label, category: loadCase.category };
    currentEvaluation = resolveLoadCaseCurrents(state.studyDefinition, loadCase.id);
  }

  if (currentEvaluation.status === 'INVALID') return currentEvaluation;

  const deviceResults: Record<ProtectionDeviceId, OperatingResult> = {};
  for (const deviceId of state.topology.deviceIds) {
    const device = state.studyDefinition.devicesById[deviceId];
    const primaryCurrentA = currentEvaluation.value[deviceId];
    if (!device || primaryCurrentA === undefined) {
      return {
        status: 'INVALID',
        issues: [issue('MISSING_REFERENCE', `activeCurrent.${deviceId}`, `Active study current is missing for ${deviceId}.`)],
      };
    }
    const evaluated = evaluateOvercurrentDevice(primaryCurrentA, device);
    if (evaluated.status === 'INVALID') return evaluated;
    deviceResults[deviceId] = evaluated.value;
  }

  return {
    status: 'VALID',
    value: {
      source,
      primaryCurrentAByDevice: currentEvaluation.value,
      deviceResults,
    },
  };
}

export function canBeginOvercurrentFaultRun(state: OvercurrentParameterState): boolean {
  if (state.activeFaultCaseId === null || state.faultLocationSelection !== null || state.playbackState !== 'IDLE') return false;
  return validateOvercurrentParameterState(state).status === 'VALID';
}
