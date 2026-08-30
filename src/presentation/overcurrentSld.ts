import { resolveFaultLocationStudy } from '../studies/overcurrentStudy';
import type {
  DomainIssue,
  FaultCase,
  FaultCaseId,
  ProtectionChain,
  ProtectionDeviceId,
  StudyLocationId,
  TimelineSnapshot,
} from '../types/overcurrent';
import { evaluateActiveOvercurrentParameters } from '../utils/evaluateOvercurrentParameters';
import type { OvercurrentParameterState } from '../utils/overcurrentState';

const CURRENT_EPSILON_A = 1e-12;

export type SldBreakerState = 'CLOSED' | 'OPENING' | 'OPEN';
export type SldProtectionRole = 'PRIMARY' | 'BACKUP' | 'OTHER';

export interface OvercurrentSldDeviceNode {
  readonly id: ProtectionDeviceId;
  readonly label: string;
  readonly normalizedPosition: number;
  readonly selected: boolean;
  readonly role: SldProtectionRole;
  readonly backupOrder: number | null;
  readonly primaryCurrentA: number | null;
  readonly carriesCurrent: boolean;
  readonly breakerState: SldBreakerState;
  readonly timelineState: string | null;
}

export interface OvercurrentSldFaultNode {
  readonly id: StudyLocationId;
  readonly label: string;
  readonly normalizedPosition: number;
  readonly active: boolean;
  readonly selectableFaultCaseId: FaultCaseId | null;
}

export interface OvercurrentSldScrubberModel {
  readonly profileId: string;
  readonly label: string;
  readonly minPosition: number;
  readonly maxPosition: number;
  readonly normalizedPosition: number;
  readonly active: boolean;
}

export interface OvercurrentSldModel {
  readonly status: 'VALID' | 'INVALID';
  readonly topologyLabel: string;
  readonly sourceLabel: string;
  readonly activeLocationId: StudyLocationId | null;
  readonly activeFaultPosition: number | null;
  readonly protectionChain: ProtectionChain | null;
  readonly faultIsolated: boolean;
  readonly currentPathActive: boolean;
  readonly currentPathEnd: number;
  readonly devices: readonly OvercurrentSldDeviceNode[];
  readonly faults: readonly OvercurrentSldFaultNode[];
  readonly scrubber: OvercurrentSldScrubberModel | null;
  readonly issues: readonly DomainIssue[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizedLocationPositions(state: OvercurrentParameterState): Map<StudyLocationId, number> {
  const locations = state.topology.locations;
  const result = new Map<StudyLocationId, number>();
  locations.forEach((location, index) => {
    const configured = location.normalizedPosition;
    result.set(
      location.id,
      configured !== undefined && Number.isFinite(configured)
        ? clamp01(configured)
        : (index + 1) / (locations.length + 1),
    );
  });
  return result;
}

function normalizedDevicePositions(
  state: OvercurrentParameterState,
  locationPositions: ReadonlyMap<StudyLocationId, number>,
): Map<ProtectionDeviceId, number> {
  const result = new Map<ProtectionDeviceId, number>();
  const locationCoordinates = state.topology.locations.map((location) => locationPositions.get(location.id) ?? 1);
  const hasOneLocationPerDevice = locationCoordinates.length >= state.topology.deviceIds.length;

  state.topology.deviceIds.forEach((deviceId, index) => {
    if (hasOneLocationPerDevice) {
      const right = locationCoordinates[index];
      const left = index === 0 ? 0 : locationCoordinates[index - 1];
      result.set(deviceId, clamp01(left + (right - left) * 0.55));
      return;
    }
    result.set(deviceId, (index + 1) / (state.topology.deviceIds.length + 1));
  });

  return result;
}

function activeFaultCase(state: OvercurrentParameterState): FaultCase | null {
  if (state.activeFaultCaseId === null) return null;
  return state.studyDefinition.faultCases.find((faultCase) => faultCase.id === state.activeFaultCaseId) ?? null;
}

function activeProfileContext(state: OvercurrentParameterState): {
  readonly position: number;
  readonly locationId: StudyLocationId | null;
  readonly protectionChain: ProtectionChain | null;
} | null {
  const selection = state.faultLocationSelection;
  if (selection === null) return null;
  const resolved = resolveFaultLocationStudy(
    state.studyDefinition,
    selection.profileId,
    selection.normalizedPosition,
  );
  if (resolved.status === 'INVALID') return null;
  return {
    position: resolved.value.normalizedPosition,
    locationId: resolved.value.locationId,
    protectionChain: resolved.value.protectionChain,
  };
}

function protectionRole(
  chain: ProtectionChain | null,
  deviceId: ProtectionDeviceId,
): Pick<OvercurrentSldDeviceNode, 'role' | 'backupOrder'> {
  if (!chain) return { role: 'OTHER', backupOrder: null };
  if (chain.primaryDeviceId === deviceId) return { role: 'PRIMARY', backupOrder: null };
  const backupIndex = chain.backupDeviceIds.indexOf(deviceId);
  return backupIndex >= 0
    ? { role: 'BACKUP', backupOrder: backupIndex + 1 }
    : { role: 'OTHER', backupOrder: null };
}

function breakerState(snapshot: TimelineSnapshot | null, deviceId: ProtectionDeviceId): SldBreakerState {
  const state = snapshot?.relays[deviceId]?.state;
  if (state === 'BREAKER_OPEN') return 'OPEN';
  if (state === 'BREAKER_OPENING') return 'OPENING';
  return 'CLOSED';
}

function faultIsolated(snapshot: TimelineSnapshot | null): boolean {
  if (!snapshot) return false;
  return snapshot.events.some((event) => (
    event.type === 'FAULT_ISOLATED' && event.timeSec <= snapshot.engineeringTimeSec
  ));
}

/**
 * Selects a configured fault case for an SLD location without inventing a
 * current. The active MIN/NOMINAL/MAX category is preserved when that category
 * exists at the new location; otherwise registry order is authoritative.
 */
export function chooseFaultCaseForLocation(
  state: OvercurrentParameterState,
  locationId: StudyLocationId,
): FaultCaseId | null {
  const candidates = state.studyDefinition.faultCases.filter((faultCase) => faultCase.locationId === locationId);
  if (candidates.length === 0) return null;
  const active = activeFaultCase(state);
  if (active?.locationId === locationId) return active.id;
  const sameCategory = active && candidates.find((faultCase) => faultCase.category === active.category);
  return sameCategory?.id ?? candidates[0].id;
}

function scrubberModel(
  state: OvercurrentParameterState,
  activePosition: number | null,
): OvercurrentSldScrubberModel | null {
  const selectedProfileId = state.faultLocationSelection?.profileId;
  const profile = state.studyDefinition.faultLocationProfiles.find((item) => item.id === selectedProfileId)
    ?? state.studyDefinition.faultLocationProfiles[0];
  if (!profile || profile.samples.length < 2) return null;
  const minPosition = profile.samples[0].normalizedPosition;
  const maxPosition = profile.samples[profile.samples.length - 1].normalizedPosition;
  const preferred = state.faultLocationSelection?.normalizedPosition ?? activePosition ?? minPosition;
  const normalizedPosition = Math.max(minPosition, Math.min(maxPosition, preferred));
  return {
    profileId: profile.id,
    label: profile.label,
    minPosition,
    maxPosition,
    normalizedPosition,
    active: state.faultLocationSelection?.profileId === profile.id,
  };
}

export function buildOvercurrentSldModel(
  state: OvercurrentParameterState,
  snapshot: TimelineSnapshot | null = null,
): OvercurrentSldModel {
  const effectiveSnapshot = snapshot && state.activeFaultCaseId !== null
    && snapshot.faultCaseId === state.activeFaultCaseId
    ? snapshot
    : null;
  const locations = normalizedLocationPositions(state);
  const devicePositions = normalizedDevicePositions(state, locations);
  const discreteFault = activeFaultCase(state);
  const profile = activeProfileContext(state);
  const activeLocationId = profile?.locationId ?? discreteFault?.locationId ?? null;
  const activeFaultPosition = profile?.position
    ?? (activeLocationId ? locations.get(activeLocationId) ?? null : null);
  const chain = profile?.protectionChain ?? discreteFault?.protectionChain ?? null;
  const evaluation = evaluateActiveOvercurrentParameters(state);
  const isolated = faultIsolated(effectiveSnapshot);
  const currentMap = evaluation.status === 'VALID'
    ? evaluation.value.primaryCurrentAByDevice
    : {};
  const hasCurrent = state.topology.deviceIds.some((deviceId) => (
    (currentMap[deviceId] ?? 0) > CURRENT_EPSILON_A
  ));
  const sourceKind = evaluation.status === 'VALID' ? evaluation.value.source?.kind : null;
  const pathEnd = sourceKind === 'LOAD'
    ? 1
    : activeFaultPosition ?? (sourceKind ? 1 : 0);

  const devices = state.topology.deviceIds.map((deviceId): OvercurrentSldDeviceNode => {
    const device = state.studyDefinition.devicesById[deviceId];
    const current = evaluation.status === 'VALID' ? currentMap[deviceId] : undefined;
    const role = protectionRole(chain, deviceId);
    return {
      id: deviceId,
      label: device?.label ?? deviceId,
      normalizedPosition: devicePositions.get(deviceId) ?? 0.5,
      selected: state.selectedDeviceId === deviceId,
      role: role.role,
      backupOrder: role.backupOrder,
      primaryCurrentA: current ?? null,
      carriesCurrent: !isolated && current !== undefined && current > CURRENT_EPSILON_A,
      breakerState: breakerState(effectiveSnapshot, deviceId),
      timelineState: effectiveSnapshot?.relays[deviceId]?.state ?? null,
    };
  });

  const faults = state.topology.locations.map((location): OvercurrentSldFaultNode => ({
    id: location.id,
    label: location.label,
    normalizedPosition: locations.get(location.id) ?? 0.5,
    active: activeLocationId === location.id,
    selectableFaultCaseId: chooseFaultCaseForLocation(state, location.id),
  }));

  return {
    status: evaluation.status,
    topologyLabel: state.topology.label,
    sourceLabel: evaluation.status === 'VALID' ? evaluation.value.source?.label ?? 'No active study current' : 'Output held',
    activeLocationId,
    activeFaultPosition,
    protectionChain: chain,
    faultIsolated: isolated,
    currentPathActive: !isolated && hasCurrent,
    currentPathEnd: clamp01(pathEnd),
    devices,
    faults,
    scrubber: scrubberModel(state, activeFaultPosition),
    issues: evaluation.status === 'INVALID' ? evaluation.issues : [],
  };
}
