import {
  evaluateOvercurrentTimeline,
  evaluateOvercurrentTimelineFrame,
} from '../engines/overcurrentTimeline';
import type {
  DomainEvaluation,
  DomainIssue,
  OperatingResult,
  OvercurrentPlaybackState,
  OvercurrentRelayTimelineState,
  ProtectionChain,
  ProtectionDeviceId,
  TimelineEvent,
  TimelineSnapshot,
} from '../types/overcurrent';
import { evaluateActiveOvercurrentParameters } from '../utils/evaluateOvercurrentParameters';
import type { OvercurrentParameterState } from '../utils/overcurrentState';

export type OperatingSequenceRole = 'PRIMARY' | 'BACKUP' | 'OTHER';
export type OperatingSequenceTone = 'normal' | 'info' | 'warning' | 'danger' | 'success';

export interface OperatingSequencePlan {
  readonly faultCaseId: string;
  readonly faultLabel: string;
  readonly protectionChain: ProtectionChain;
  readonly completedTimeline: TimelineSnapshot;
  readonly deviceResults: Readonly<Record<ProtectionDeviceId, OperatingResult>>;
}

export interface OperatingSequenceRow {
  readonly deviceId: ProtectionDeviceId;
  readonly deviceLabel: string;
  readonly role: OperatingSequenceRole;
  readonly backupOrder: number | null;
  readonly selected: boolean;
  readonly state: OvercurrentRelayTimelineState;
  readonly stateLabel: string;
  readonly tone: OperatingSequenceTone;
  readonly selectedElement: OperatingResult['selectedElement'];
  readonly relayCurrentASecondary: number;
  readonly currentMultiple: number | null;
  readonly operateProgress51: number;
  readonly expectedOperateTimeSec: number | null;
  readonly actualTripOutputTimeSec: number | null;
  readonly breakerOpenTimeSec: number | null;
}

export interface OperatingSequenceMilestone {
  readonly eventId: string;
  readonly timeSec: number;
  readonly label: string;
  readonly deviceId: ProtectionDeviceId | null;
  readonly tone: OperatingSequenceTone;
}

export interface OvercurrentOperatingSequenceModel {
  readonly status: 'READY' | 'VALID' | 'INVALID';
  readonly playbackState: OvercurrentPlaybackState;
  readonly engineeringTimeSec: number;
  readonly totalEngineeringTimeSec: number;
  readonly progress: number;
  readonly faultCaseId: string | null;
  readonly faultLabel: string;
  readonly globalStatusLabel: string;
  readonly globalTone: OperatingSequenceTone;
  readonly faultIsolated: boolean;
  readonly clearingDeviceId: ProtectionDeviceId | null;
  readonly rows: readonly OperatingSequenceRow[];
  readonly milestones: readonly OperatingSequenceMilestone[];
  readonly visibleEvents: readonly TimelineEvent[];
  readonly snapshot: TimelineSnapshot | null;
  readonly issues: readonly DomainIssue[];
}

function issue(code: DomainIssue['code'], path: string, detail: string): DomainIssue {
  return { code, path, detail };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roleForDevice(chain: ProtectionChain, deviceId: ProtectionDeviceId): {
  role: OperatingSequenceRole;
  backupOrder: number | null;
} {
  if (deviceId === chain.primaryDeviceId) return { role: 'PRIMARY', backupOrder: null };
  const backupIndex = chain.backupDeviceIds.indexOf(deviceId);
  if (backupIndex >= 0) return { role: 'BACKUP', backupOrder: backupIndex + 1 };
  return { role: 'OTHER', backupOrder: null };
}

function statePresentation(state: OvercurrentRelayTimelineState): {
  label: string;
  tone: OperatingSequenceTone;
} {
  switch (state) {
    case 'BELOW_PICKUP': return { label: 'NORMAL', tone: 'normal' };
    case '51_TIMING': return { label: '51 TIMING', tone: 'warning' };
    case '50_TRIPPED': return { label: '50 INSTANTANEOUS TRIP', tone: 'danger' };
    case '51_TRIPPED': return { label: '51 TRIP', tone: 'danger' };
    case 'BREAKER_OPENING': return { label: 'BREAKER CLEARING', tone: 'warning' };
    case 'BREAKER_OPEN': return { label: 'BREAKER OPEN', tone: 'success' };
    case 'RESET': return { label: 'RESET', tone: 'info' };
    case 'INVALID': return { label: 'INPUT INVALID', tone: 'danger' };
  }
}

function eventPresentation(event: TimelineEvent, deviceLabel: string | null): OperatingSequenceMilestone {
  const prefix = deviceLabel ? `${deviceLabel} · ` : '';
  switch (event.type) {
    case 'FAULT_APPLIED': return { eventId: event.id, timeSec: event.timeSec, label: 'FAULT APPLIED', deviceId: null, tone: 'danger' };
    case 'CURRENT_PROFILE_CHANGED': return { eventId: event.id, timeSec: event.timeSec, label: 'CURRENT PROFILE CHANGED', deviceId: null, tone: 'info' };
    case '51_PICKUP': return { eventId: event.id, timeSec: event.timeSec, label: `${prefix}51 PICKUP`, deviceId: event.deviceId, tone: 'warning' };
    case '50_TRIP': return { eventId: event.id, timeSec: event.timeSec, label: `${prefix}50 TRIP OUTPUT`, deviceId: event.deviceId, tone: 'danger' };
    case '51_TRIP': return { eventId: event.id, timeSec: event.timeSec, label: `${prefix}51 TRIP OUTPUT`, deviceId: event.deviceId, tone: 'danger' };
    case 'BREAKER_OPENING': return { eventId: event.id, timeSec: event.timeSec, label: `${prefix}BREAKER CLEARING`, deviceId: event.deviceId, tone: 'warning' };
    case 'BREAKER_OPEN': return { eventId: event.id, timeSec: event.timeSec, label: `${prefix}BREAKER OPEN`, deviceId: event.deviceId, tone: 'success' };
    case 'FAULT_ISOLATED': return { eventId: event.id, timeSec: event.timeSec, label: 'FAULT ISOLATED', deviceId: event.clearingDeviceId ?? null, tone: 'success' };
    case '51_RESET': return { eventId: event.id, timeSec: event.timeSec, label: `${prefix}51 RESET`, deviceId: event.deviceId, tone: 'info' };
  }
}

function globalPresentation(snapshot: TimelineSnapshot, totalTimeSec: number): {
  label: string;
  tone: OperatingSequenceTone;
  faultIsolated: boolean;
  clearingDeviceId: ProtectionDeviceId | null;
} {
  const isolated = [...snapshot.events].reverse().find((event) => event.type === 'FAULT_ISOLATED');
  if (isolated?.type === 'FAULT_ISOLATED') {
    return {
      label: 'FAULT ISOLATED',
      tone: 'success',
      faultIsolated: true,
      clearingDeviceId: isolated.clearingDeviceId ?? null,
    };
  }
  const opening = [...snapshot.events].reverse().find((event) => event.type === 'BREAKER_OPENING');
  if (opening) return { label: 'BREAKER CLEARING', tone: 'warning', faultIsolated: false, clearingDeviceId: null };
  const trip = [...snapshot.events].reverse().find((event) => event.type === '50_TRIP' || event.type === '51_TRIP');
  if (trip) return { label: 'TRIP OUTPUT', tone: 'danger', faultIsolated: false, clearingDeviceId: null };
  const pickup = snapshot.events.some((event) => event.type === '51_PICKUP');
  if (pickup) return { label: 'PICKUP / TIMING', tone: 'warning', faultIsolated: false, clearingDeviceId: null };
  if (snapshot.events.some((event) => event.type === 'FAULT_APPLIED')) {
    return {
      label: totalTimeSec === 0 ? 'FAULT APPLIED · NO OPERATION' : 'FAULT ACTIVE',
      tone: totalTimeSec === 0 ? 'normal' : 'danger',
      faultIsolated: false,
      clearingDeviceId: null,
    };
  }
  return { label: 'NORMAL', tone: 'normal', faultIsolated: false, clearingDeviceId: null };
}

export function createOvercurrentOperatingSequencePlan(
  state: OvercurrentParameterState,
): DomainEvaluation<OperatingSequencePlan> {
  if (state.activeFaultCaseId === null) {
    return {
      status: 'INVALID',
      issues: [issue(
        'MISSING_REFERENCE',
        'activeFaultCaseId',
        state.faultLocationSelection
          ? 'Operating Sequence requires a discrete fault case; configured fault-location profile points are Explore-only.'
          : 'Select a discrete fault case before running Operating Sequence.',
      )],
    };
  }
  const faultCase = state.studyDefinition.faultCases.find((candidate) => candidate.id === state.activeFaultCaseId);
  if (!faultCase) {
    return {
      status: 'INVALID',
      issues: [issue('MISSING_REFERENCE', 'activeFaultCaseId', `Unknown fault case ${state.activeFaultCaseId}.`)],
    };
  }
  const active = evaluateActiveOvercurrentParameters(state);
  if (active.status === 'INVALID') return active;
  const completed = evaluateOvercurrentTimeline({
    study: state.studyDefinition,
    faultCaseId: faultCase.id,
    playbackSpeed: state.simulationSpeed,
  });
  if (completed.status === 'INVALID') return completed;
  return {
    status: 'VALID',
    value: {
      faultCaseId: faultCase.id,
      faultLabel: faultCase.label,
      protectionChain: faultCase.protectionChain,
      completedTimeline: completed.value,
      deviceResults: active.value.deviceResults,
    },
  };
}

export function buildOvercurrentOperatingSequenceModel(
  state: OvercurrentParameterState,
  engineeringTimeSec: number,
  planEvaluation: DomainEvaluation<OperatingSequencePlan> = createOvercurrentOperatingSequencePlan(state),
): OvercurrentOperatingSequenceModel {
  if (state.activeFaultCaseId === null) {
    return {
      status: 'READY',
      playbackState: state.playbackState,
      engineeringTimeSec: 0,
      totalEngineeringTimeSec: 0,
      progress: 0,
      faultCaseId: null,
      faultLabel: state.faultLocationSelection ? 'Explore profile point' : 'No fault selected',
      globalStatusLabel: 'SELECT DISCRETE FAULT CASE',
      globalTone: 'normal',
      faultIsolated: false,
      clearingDeviceId: null,
      rows: [],
      milestones: [],
      visibleEvents: [],
      snapshot: null,
      issues: [],
    };
  }
  if (planEvaluation.status === 'INVALID') {
    return {
      status: 'INVALID',
      playbackState: 'INVALID',
      engineeringTimeSec: 0,
      totalEngineeringTimeSec: 0,
      progress: 0,
      faultCaseId: state.activeFaultCaseId,
      faultLabel: 'Output held',
      globalStatusLabel: 'INPUT INVALID · OUTPUT HELD',
      globalTone: 'danger',
      faultIsolated: false,
      clearingDeviceId: null,
      rows: [],
      milestones: [],
      visibleEvents: [],
      snapshot: null,
      issues: planEvaluation.issues,
    };
  }

  const plan = planEvaluation.value;
  const totalTimeSec = plan.completedTimeline.engineeringTimeSec;

  if (state.playbackState === 'IDLE') {
    const chainOrder = [plan.protectionChain.primaryDeviceId, ...plan.protectionChain.backupDeviceIds];
    const rowIds = [
      ...chainOrder,
      ...state.topology.deviceIds.filter((deviceId) => !chainOrder.includes(deviceId)),
    ];
    const rows = rowIds.map((deviceId): OperatingSequenceRow => {
      const device = state.studyDefinition.devicesById[deviceId];
      const result = plan.deviceResults[deviceId];
      const role = roleForDevice(plan.protectionChain, deviceId);
      return {
        deviceId,
        deviceLabel: device?.label ?? deviceId,
        role: role.role,
        backupOrder: role.backupOrder,
        selected: state.selectedDeviceId === deviceId,
        state: 'BELOW_PICKUP',
        stateLabel: 'NORMAL',
        tone: 'normal',
        selectedElement: result?.selectedElement ?? null,
        relayCurrentASecondary: result?.measurement.measuredSecondaryCurrentA ?? 0,
        currentMultiple: result?.element51.currentMultiple ?? null,
        operateProgress51: 0,
        expectedOperateTimeSec: result?.selectedTripTimeSec ?? null,
        actualTripOutputTimeSec: null,
        breakerOpenTimeSec: null,
      };
    });
    return {
      status: 'VALID',
      playbackState: 'IDLE',
      engineeringTimeSec: 0,
      totalEngineeringTimeSec: totalTimeSec,
      progress: 0,
      faultCaseId: plan.faultCaseId,
      faultLabel: plan.faultLabel,
      globalStatusLabel: 'READY TO APPLY FAULT',
      globalTone: 'normal',
      faultIsolated: false,
      clearingDeviceId: null,
      rows,
      milestones: [],
      visibleEvents: [],
      snapshot: null,
      issues: [],
    };
  }

  const requestedTimeSec = state.playbackState === 'COMPLETE'
    ? totalTimeSec
    : Math.max(0, Math.min(engineeringTimeSec, totalTimeSec));
  const frame = evaluateOvercurrentTimelineFrame({
    study: state.studyDefinition,
    faultCaseId: plan.faultCaseId,
    playbackSpeed: state.simulationSpeed,
    engineeringTimeSec: requestedTimeSec,
    playbackState: state.playbackState === 'INVALID' ? 'IDLE' : state.playbackState,
  });
  if (frame.status === 'INVALID') {
    return {
      status: 'INVALID',
      playbackState: 'INVALID',
      engineeringTimeSec: requestedTimeSec,
      totalEngineeringTimeSec: totalTimeSec,
      progress: totalTimeSec > 0 ? clamp01(requestedTimeSec / totalTimeSec) : 1,
      faultCaseId: plan.faultCaseId,
      faultLabel: plan.faultLabel,
      globalStatusLabel: 'INPUT INVALID · OUTPUT HELD',
      globalTone: 'danger',
      faultIsolated: false,
      clearingDeviceId: null,
      rows: [],
      milestones: [],
      visibleEvents: [],
      snapshot: null,
      issues: frame.issues,
    };
  }

  const snapshot = frame.value;
  const chainOrder = [plan.protectionChain.primaryDeviceId, ...plan.protectionChain.backupDeviceIds];
  const rowIds = [
    ...chainOrder,
    ...state.topology.deviceIds.filter((deviceId) => !chainOrder.includes(deviceId)),
  ];
  const rows = rowIds.map((deviceId): OperatingSequenceRow => {
    const device = state.studyDefinition.devicesById[deviceId];
    const result = plan.deviceResults[deviceId];
    const relay = snapshot.relays[deviceId];
    const role = roleForDevice(plan.protectionChain, deviceId);
    const presentation = statePresentation(relay?.state ?? 'INVALID');
    return {
      deviceId,
      deviceLabel: device?.label ?? deviceId,
      role: role.role,
      backupOrder: role.backupOrder,
      selected: state.selectedDeviceId === deviceId,
      state: relay?.state ?? 'INVALID',
      stateLabel: presentation.label,
      tone: presentation.tone,
      selectedElement: result?.selectedElement ?? null,
      relayCurrentASecondary: result?.measurement.measuredSecondaryCurrentA ?? 0,
      currentMultiple: result?.element51.currentMultiple ?? null,
      operateProgress51: relay?.operateProgress51 ?? 0,
      expectedOperateTimeSec: result?.selectedTripTimeSec ?? null,
      actualTripOutputTimeSec: relay?.tripOutputTimeSec ?? null,
      breakerOpenTimeSec: relay?.breakerOpenTimeSec ?? null,
    };
  });
  const global = globalPresentation(snapshot, totalTimeSec);
  const milestones = snapshot.events.map((event) => eventPresentation(
    event,
    'deviceId' in event ? state.studyDefinition.devicesById[event.deviceId]?.label ?? event.deviceId : null,
  ));

  return {
    status: 'VALID',
    playbackState: snapshot.playbackState,
    engineeringTimeSec: snapshot.engineeringTimeSec,
    totalEngineeringTimeSec: totalTimeSec,
    progress: totalTimeSec > 0 ? clamp01(snapshot.engineeringTimeSec / totalTimeSec) : 1,
    faultCaseId: plan.faultCaseId,
    faultLabel: plan.faultLabel,
    globalStatusLabel: global.label,
    globalTone: global.tone,
    faultIsolated: global.faultIsolated,
    clearingDeviceId: global.clearingDeviceId,
    rows,
    milestones,
    visibleEvents: snapshot.events,
    snapshot,
    issues: [],
  };
}
