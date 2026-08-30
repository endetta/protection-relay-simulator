import {
  evaluateCoordinationFaultCase,
  runOvercurrentCoordinationStudy,
} from '../engines/overcurrentCoordination';
import type {
  CoordinationAuditDimension,
  CoordinationPairResult,
  CoordinationViolation,
  DomainIssue,
  OperatingResult,
  OvercurrentCoordinationStudyResult,
  OvercurrentProtectionDevice,
  ProtectionDeviceId,
  StudySnapshot,
  TimelineEvent,
  TimelineSnapshot,
} from '../types/overcurrent';
import { evaluateActiveOvercurrentParameters, type ActiveOvercurrentParameterEvaluation } from '../utils/evaluateOvercurrentParameters';
import type { OvercurrentParameterState } from '../utils/overcurrentState';

export type AnalysisTone = 'normal' | 'info' | 'warning' | 'danger' | 'success';

export interface AnalysisStatusModel {
  readonly label: string;
  readonly detail: string;
  readonly tone: AnalysisTone;
}

export interface AnalysisOperatingOrderRow {
  readonly deviceId: ProtectionDeviceId;
  readonly deviceLabel: string;
  readonly role: 'PRIMARY' | 'BACKUP' | 'OTHER';
  readonly backupOrder: number | null;
  readonly selectedElement: '50' | '51' | null;
  readonly tripTimeSec: number | null;
}

export interface AnalysisMeasurementRow {
  readonly deviceId: ProtectionDeviceId;
  readonly deviceLabel: string;
  readonly primaryCurrentA: number;
  readonly relayCurrentASecondary: number;
  readonly currentMultiple: number | null;
  readonly selectedElement: '50' | '51' | null;
  readonly operateTimeSec: number | null;
}

export interface AnalysisCoordinationMarginRow extends CoordinationPairResult {
  readonly primaryDeviceId: ProtectionDeviceId;
  readonly primaryLabel: string;
  readonly backupDeviceId: ProtectionDeviceId;
  readonly backupLabel: string;
}

export interface AnalysisCheckRow {
  readonly dimension: CoordinationAuditDimension;
  readonly label: string;
  readonly status: 'PASS' | 'FAIL' | 'NOT_EVALUABLE';
  readonly violationCount: number;
}

export interface AnalysisViolationRow {
  readonly key: string;
  readonly type: CoordinationViolation['type'];
  readonly title: string;
  readonly detail: string;
  readonly tone: 'warning' | 'danger';
}

export interface SettingImpactItem {
  readonly key: string;
  readonly deviceId: ProtectionDeviceId | null;
  readonly parameter: string;
  readonly before: string;
  readonly after: string;
  readonly affects: readonly string[];
  readonly unchanged: readonly string[];
}

export interface AnalysisComparisonModel {
  readonly initialViolations: number;
  readonly currentViolations: number;
  readonly initialPassedCases: number;
  readonly currentPassedCases: number;
  readonly totalCases: number;
  readonly initialWorstCtiSurplusSec: number | null;
  readonly currentWorstCtiSurplusSec: number | null;
}

export interface OvercurrentAnalysisModel {
  readonly status: 'VALID' | 'INVALID';
  readonly headline: AnalysisStatusModel;
  readonly activeStudyLabel: string;
  readonly activeStudyDetail: string;
  readonly selectedDeviceId: ProtectionDeviceId | null;
  readonly operatingOrder: readonly AnalysisOperatingOrderRow[];
  readonly measurements: readonly AnalysisMeasurementRow[];
  readonly coordinationMargins: readonly AnalysisCoordinationMarginRow[];
  readonly checks: readonly AnalysisCheckRow[];
  readonly violations: readonly AnalysisViolationRow[];
  readonly worstCaseLabel: string | null;
  readonly settingImpacts: readonly SettingImpactItem[];
  readonly comparison: AnalysisComparisonModel | null;
  readonly hints: readonly string[];
  readonly calculationDetails: readonly string[];
  readonly events: readonly TimelineEvent[];
  readonly validationStatus: OvercurrentParameterState['validationState']['status'];
  readonly issues: readonly DomainIssue[];
}

function numberText(value: number | null | undefined, digits = 6): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Number(value.toPrecision(digits)).toString();
}

function deviceLabel(state: OvercurrentParameterState, deviceId: ProtectionDeviceId): string {
  return state.studyDefinition.devicesById[deviceId]?.label ?? deviceId;
}

function relayTimelineHeadline(state: OvercurrentParameterState, snapshot: TimelineSnapshot | null): AnalysisStatusModel | null {
  if (!snapshot || snapshot.faultCaseId !== state.activeFaultCaseId) return null;
  const isolated = snapshot.events.some((event) => event.type === 'FAULT_ISOLATED' && event.timeSec <= snapshot.engineeringTimeSec);
  if (isolated) return { label: 'FAULT ISOLATED', detail: `Engineering time ${numberText(snapshot.engineeringTimeSec)} s`, tone: 'success' };
  const selectedId = state.selectedDeviceId ?? state.topology.deviceIds[0];
  const relay = selectedId ? snapshot.relays[selectedId] : undefined;
  if (!relay) return null;
  switch (relay.state) {
    case '51_TIMING': return { label: '51 TIMING', detail: `${numberText(relay.operateProgress51 * 100)} % operate progress`, tone: 'warning' };
    case '50_TRIPPED': return { label: '50 INSTANTANEOUS TRIP', detail: 'Trip output asserted', tone: 'danger' };
    case '51_TRIPPED': return { label: '51 TRIP', detail: 'Trip output asserted', tone: 'danger' };
    case 'BREAKER_OPENING': return { label: 'BREAKER CLEARING', detail: 'Fault current persists until breaker opening', tone: 'warning' };
    case 'BREAKER_OPEN': return { label: 'BREAKER OPEN', detail: 'Selected breaker is open', tone: 'success' };
    case 'RESET': return { label: 'RESET', detail: '51 timing quantity returned to zero', tone: 'info' };
    case 'BELOW_PICKUP': return { label: 'NORMAL', detail: 'Relay remains below pickup', tone: 'normal' };
    case 'INVALID': return { label: 'INPUT INVALID / OUTPUT HELD', detail: 'Timeline result unavailable', tone: 'danger' };
  }
}

function staticHeadline(state: OvercurrentParameterState, selected: OperatingResult | undefined): AnalysisStatusModel {
  if (!selected) return { label: 'NORMAL', detail: 'No active relay result', tone: 'normal' };
  if (selected.selectedElement === '50') {
    return { label: '50 INSTANTANEOUS TRIP', detail: 'Predicted active element at the selected study current', tone: 'danger' };
  }
  if (selected.selectedElement === '51') {
    return { label: 'PICKUP', detail: `51 theoretical operate time ${numberText(selected.selectedTripTimeSec)} s`, tone: 'warning' };
  }
  const selectedId = state.selectedDeviceId ?? state.topology.deviceIds[0] ?? 'relay';
  return { label: 'NORMAL', detail: `${deviceLabel(state, selectedId)} below pickup`, tone: 'normal' };
}

function auditHeadline(result: OvercurrentCoordinationStudyResult): AnalysisStatusModel {
  if (result.audit.status === 'COORDINATED') {
    return {
      label: 'COORDINATED',
      detail: `${result.audit.passedCaseCount} / ${result.audit.totalCaseCount} study cases passed`,
      tone: 'success',
    };
  }
  if (result.audit.status === 'COORDINATION_INCOMPLETE') {
    return {
      label: 'COORDINATION INCOMPLETE',
      detail: `${result.audit.passedCaseCount} / ${result.audit.totalCaseCount} study cases passed`,
      tone: 'warning',
    };
  }
  return { label: 'NOT APPLICABLE', detail: 'No evaluable coordination cases', tone: 'normal' };
}

function checkLabel(dimension: CoordinationAuditDimension): string {
  switch (dimension) {
    case 'SENSITIVITY': return 'Sensitivity';
    case 'SELECTIVITY': return 'Selectivity';
    case 'TIME_GRADING': return 'Time grading';
    case 'INSTANTANEOUS_REACH': return '50 reach';
    case 'LOAD_SECURITY': return 'Load security';
    case 'BACKUP_AVAILABILITY': return 'Backup availability';
  }
}

function violationText(state: OvercurrentParameterState, violation: CoordinationViolation): Omit<AnalysisViolationRow, 'key'> {
  const pair = violation.pairId
    ? state.studyDefinition.coordinationPairs.find((candidate) => candidate.id === violation.pairId)
    : undefined;
  const pairText = pair ? `${deviceLabel(state, pair.primaryDeviceId)} → ${deviceLabel(state, pair.backupDeviceId)}` : '';
  const context = violation.faultCaseId ?? violation.loadCaseId ?? violation.profileId ?? 'configured study';
  switch (violation.type) {
    case 'TIME_GRADING':
      return { type: violation.type, title: 'TIME GRADING FAIL', detail: `${pairText || context}: CTI ${numberText(violation.observedValue)} s < ${numberText(violation.requiredValue)} s required.`, tone: 'danger' };
    case 'SELECTIVITY_FAIL':
      return { type: violation.type, title: 'SELECTIVITY FAIL', detail: `${pairText || context}: backup does not operate strictly later than its preceding primary.`, tone: 'danger' };
    case 'INSTANTANEOUS_OVERREACH':
      return { type: violation.type, title: 'INSTANTANEOUS OVERREACH', detail: `${violation.deviceId ? deviceLabel(state, violation.deviceId) : 'Backup'} 50 picks up for downstream ${context}.`, tone: 'danger' };
    case 'SENSITIVITY_RISK':
      return { type: violation.type, title: 'SENSITIVITY RISK', detail: `${violation.deviceId ? deviceLabel(state, violation.deviceId) : 'Primary'} 51 does not pick up for minimum-fault case ${context}.`, tone: 'warning' };
    case 'LOAD_SECURITY_FAIL':
      return { type: violation.type, title: 'LOAD SECURITY FAIL', detail: `${violation.deviceId ? deviceLabel(state, violation.deviceId) : 'Relay'} pickup has insufficient margin above ${context}.`, tone: 'danger' };
    case 'BACKUP_NOT_AVAILABLE':
      return { type: violation.type, title: 'BACKUP NOT AVAILABLE', detail: `${violation.deviceId ? deviceLabel(state, violation.deviceId) : 'Backup'} has no finite operation for ${context}.`, tone: 'warning' };
  }
}

function snapshotStudy(state: OvercurrentParameterState, snapshot: StudySnapshot) {
  return {
    ...state.studyDefinition,
    devicesById: snapshot.devicesById,
    coordinationRequirements: snapshot.coordinationRequirements,
  };
}

function comparisonModel(
  state: OvercurrentParameterState,
  current: OvercurrentCoordinationStudyResult | null,
): AnalysisComparisonModel | null {
  if (!state.modified || state.studyMode !== 'COORDINATION_LAB' || !state.initialSnapshot || !current) return null;
  const initial = runOvercurrentCoordinationStudy(snapshotStudy(state, state.initialSnapshot));
  if (initial.status === 'INVALID') return null;
  return {
    initialViolations: initial.value.audit.violations.length,
    currentViolations: current.audit.violations.length,
    initialPassedCases: initial.value.audit.passedCaseCount,
    currentPassedCases: current.audit.passedCaseCount,
    totalCases: current.audit.totalCaseCount,
    initialWorstCtiSurplusSec: initial.value.audit.worstCase?.surplusSec ?? null,
    currentWorstCtiSurplusSec: current.audit.worstCase?.surplusSec ?? null,
  };
}

function pushImpact(
  target: SettingImpactItem[],
  key: string,
  deviceId: ProtectionDeviceId | null,
  parameter: string,
  before: string | number | boolean,
  after: string | number | boolean,
  affects: readonly string[],
  unchanged: readonly string[],
) {
  if (String(before) === String(after)) return;
  target.push({ key, deviceId, parameter, before: String(before), after: String(after), affects, unchanged });
}

function deviceSettingImpacts(
  current: OvercurrentProtectionDevice,
  initial: OvercurrentProtectionDevice,
): SettingImpactItem[] {
  const result: SettingImpactItem[] = [];
  const id = current.id;
  pushImpact(result, `${id}:ct-primary`, id, `${current.label} CT primary`, initial.settings.ct.primaryRatedA, current.settings.ct.primaryRatedA,
    ['Relay secondary current', 'Current multiple', 'Pickup/operate result'], ['Configured primary study current']);
  pushImpact(result, `${id}:ct-secondary`, id, `${current.label} CT secondary`, initial.settings.ct.secondaryRatedA, current.settings.ct.secondaryRatedA,
    ['Relay secondary current', 'Current multiple', 'Pickup/operate result'], ['Configured primary study current']);
  pushImpact(result, `${id}:ct-error`, id, `${current.label} CT error`, `${initial.settings.ct.ratioErrorPct} %`, `${current.settings.ct.ratioErrorPct} %`,
    ['Measured relay current', 'Current multiple', 'Pickup/operate result'], ['Configured primary study current']);
  pushImpact(result, `${id}:pickup51`, id, `${current.label} 51 pickup`, `${initial.settings.phase51.pickupASecondary} A sec`, `${current.settings.phase51.pickupASecondary} A sec`,
    ['Pickup boundary', 'Current multiple', '51 operating time', 'Sensitivity margin'], ['Measured relay current']);
  pushImpact(result, `${id}:timing`, id, `${current.label} 51 timing mode`, initial.settings.phase51.timingMode, current.settings.phase51.timingMode,
    ['51 characteristic', 'Operating time', 'Coordination margin'], ['Pickup threshold', 'Measured relay current']);
  pushImpact(result, `${id}:curve`, id, `${current.label} curve`, initial.settings.phase51.inverseCurveId, current.settings.phase51.inverseCurveId,
    ['51 characteristic shape', 'Operating time', 'Coordination margin'], ['Pickup threshold', 'Measured relay current']);
  pushImpact(result, `${id}:time-scale`, id, `${current.label} ${current.settings.phase51.inverseCurveId.startsWith('IEC') ? 'TMS' : 'Time Dial'}`, initial.settings.phase51.timeScale, current.settings.phase51.timeScale,
    ['51 operating time', 'Primary/backup time margin'], ['Pickup threshold', 'Measured relay current']);
  pushImpact(result, `${id}:definite`, id, `${current.label} definite delay`, `${initial.settings.phase51.definiteDelaySec} s`, `${current.settings.phase51.definiteDelaySec} s`,
    ['Definite-time operation', 'Coordination margin when Definite mode is active'], ['Pickup threshold', 'Measured relay current']);
  pushImpact(result, `${id}:50-enable`, id, `${current.label} 50`, initial.settings.phase50.enabled ? 'ON' : 'OFF', current.settings.phase50.enabled ? 'ON' : 'OFF',
    ['Active-element arbitration', 'Instantaneous reach', 'High-current trip time'], ['51 pickup threshold']);
  pushImpact(result, `${id}:50-pickup`, id, `${current.label} I>>`, `${initial.settings.phase50.pickupASecondary} A sec`, `${current.settings.phase50.pickupASecondary} A sec`,
    ['50 reach boundary', 'Active-element arbitration'], ['51 curve settings', 'Measured relay current']);
  pushImpact(result, `${id}:breaker`, id, `${current.label} breaker clearing`, `${initial.settings.breaker.clearingTimeSec} s`, `${current.settings.breaker.clearingTimeSec} s`,
    ['Breaker-open timestamp', 'Fault-isolation sequence'], ['Relay trip-output time', 'CTI target unless CTI budget is edited']);
  return result;
}

function settingImpacts(state: OvercurrentParameterState): SettingImpactItem[] {
  if (!state.initialSnapshot) return [];
  const result: SettingImpactItem[] = [];
  for (const deviceId of state.topology.deviceIds) {
    const current = state.studyDefinition.devicesById[deviceId];
    const initial = state.initialSnapshot.devicesById[deviceId] as OvercurrentProtectionDevice | undefined;
    if (current && initial && current.kind === 'OVERCURRENT_50_51' && initial.kind === 'OVERCURRENT_50_51') {
      result.push(...deviceSettingImpacts(current, initial));
    }
  }
  for (const requirement of state.studyDefinition.coordinationRequirements) {
    const initial = state.initialSnapshot.coordinationRequirements.find((candidate) => candidate.id === requirement.id);
    if (!initial) continue;
    pushImpact(result, `${requirement.id}:cti`, null, 'Required CTI', `${initial.requiredCtiSec} s`, `${requirement.requiredCtiSec} s`,
      ['Coordination corridor', 'Time-grading PASS/FAIL threshold'], ['Relay operating times']);
  }
  return result;
}

function activeFaultResult(state: OvercurrentParameterState) {
  if (state.activeFaultCaseId === null) return null;
  const result = evaluateCoordinationFaultCase(state.studyDefinition, state.activeFaultCaseId);
  return result.status === 'VALID' ? result.value : null;
}

function measurementRows(
  state: OvercurrentParameterState,
  active: ActiveOvercurrentParameterEvaluation,
): AnalysisMeasurementRow[] {
  return state.topology.deviceIds.map((deviceId) => {
    const result = active.deviceResults[deviceId];
    return {
      deviceId,
      deviceLabel: deviceLabel(state, deviceId),
      primaryCurrentA: active.primaryCurrentAByDevice[deviceId],
      relayCurrentASecondary: result.measurement.measuredSecondaryCurrentA,
      currentMultiple: result.element51.currentMultiple,
      selectedElement: result.selectedElement,
      operateTimeSec: result.selectedTripTimeSec,
    };
  });
}

export function buildOvercurrentAnalysisModel(
  state: OvercurrentParameterState,
  timelineSnapshot: TimelineSnapshot | null = null,
): OvercurrentAnalysisModel {
  const active = evaluateActiveOvercurrentParameters(state);
  if (active.status === 'INVALID') {
    return {
      status: 'INVALID',
      headline: { label: 'INPUT INVALID / OUTPUT HELD', detail: active.issues[0]?.detail ?? 'Engineering result unavailable.', tone: 'danger' },
      activeStudyLabel: 'Output held', activeStudyDetail: 'Correct invalid input before running a study.', selectedDeviceId: state.selectedDeviceId,
      operatingOrder: [], measurements: [], coordinationMargins: [], checks: [], violations: [], worstCaseLabel: null,
      settingImpacts: settingImpacts(state), comparison: null, hints: [], calculationDetails: [], events: timelineSnapshot?.events ?? [],
      validationStatus: state.validationState.status, issues: active.issues,
    };
  }

  const coordination = state.studyMode === 'COORDINATION_LAB'
    ? runOvercurrentCoordinationStudy(state.studyDefinition)
    : null;
  const coordinationValue = coordination?.status === 'VALID' ? coordination.value : null;
  const activeCase = activeFaultResult(state);
  const selectedId = state.selectedDeviceId ?? state.topology.deviceIds[0] ?? null;
  const timelineHeadline = relayTimelineHeadline(state, timelineSnapshot);
  const headline = timelineHeadline
    ?? (coordinationValue ? auditHeadline(coordinationValue) : staticHeadline(state, selectedId ? active.value.deviceResults[selectedId] : undefined));

  const operatingOrder: AnalysisOperatingOrderRow[] = activeCase
    ? activeCase.operatingOrder.map((entry) => ({ ...entry, deviceLabel: deviceLabel(state, entry.deviceId) }))
    : state.topology.deviceIds.map((deviceId) => {
        const result = active.value.deviceResults[deviceId];
        return { deviceId, deviceLabel: deviceLabel(state, deviceId), role: 'OTHER' as const, backupOrder: null, selectedElement: result.selectedElement, tripTimeSec: result.selectedTripTimeSec };
      });

  const coordinationMargins: AnalysisCoordinationMarginRow[] = (activeCase?.pairResults ?? []).map((pairResult) => {
    const pair = state.studyDefinition.coordinationPairs.find((candidate) => candidate.id === pairResult.pairId);
    return {
      ...pairResult,
      primaryDeviceId: pair?.primaryDeviceId ?? 'UNKNOWN',
      primaryLabel: pair ? deviceLabel(state, pair.primaryDeviceId) : 'Unknown primary',
      backupDeviceId: pair?.backupDeviceId ?? 'UNKNOWN',
      backupLabel: pair ? deviceLabel(state, pair.backupDeviceId) : 'Unknown backup',
    };
  });

  const violations = (coordinationValue?.audit.violations ?? activeCase?.violations ?? []).map((violation, index) => ({
    key: `${violation.type}:${violation.faultCaseId ?? violation.loadCaseId ?? violation.profileId ?? ''}:${violation.pairId ?? violation.deviceId ?? ''}:${index}`,
    ...violationText(state, violation),
  }));
  const worst = coordinationValue?.audit.worstCase;
  const worstCaseLabel = worst
    ? `${worst.faultCaseId} · ${worst.pairId} · CTI surplus ${numberText(worst.surplusSec)} s`
    : null;

  const source = active.value.source;
  const calculationDetails = state.topology.deviceIds.map((deviceId) => {
    const result = active.value.deviceResults[deviceId];
    return `${deviceLabel(state, deviceId)}: Ipri ${numberText(result.measurement.primaryCurrentA)} A → Irelay ${numberText(result.measurement.measuredSecondaryCurrentA)} A sec → M ${numberText(result.element51.currentMultiple)} → ${result.selectedElement ?? 'NO TRIP'} ${numberText(result.selectedTripTimeSec)} s`;
  });

  return {
    status: 'VALID',
    headline,
    activeStudyLabel: source?.label ?? 'No active study current',
    activeStudyDetail: source
      ? `${source.kind.replace('_', ' ')} · ${source.category}${source.locationId ? ` · ${source.locationId}` : ''}`
      : 'Select a load or fault study case.',
    selectedDeviceId: selectedId,
    operatingOrder,
    measurements: measurementRows(state, active.value),
    coordinationMargins,
    checks: (coordinationValue?.audit.dimensions ?? []).map((dimension) => ({ ...dimension, label: checkLabel(dimension.dimension) })),
    violations,
    worstCaseLabel,
    settingImpacts: settingImpacts(state),
    comparison: comparisonModel(state, coordinationValue),
    hints: state.guidanceMode === 'GUIDED' ? (state.studyDefinition.learning?.hints ?? []).map((hint) => hint.text) : [],
    calculationDetails,
    events: timelineSnapshot?.faultCaseId === state.activeFaultCaseId ? timelineSnapshot.events : [],
    validationStatus: state.validationState.status,
    issues: coordination?.status === 'INVALID' ? coordination.issues : [],
  };
}
