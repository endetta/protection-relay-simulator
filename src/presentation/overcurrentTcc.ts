import {
  evaluateCoordinationPair,
  runOvercurrentCoordinationStudy,
} from '../engines/overcurrentCoordination';
import {
  calculateOvercurrent51,
  OVERCURRENT_INVERSE_CURVES,
} from '../engines/overcurrent';
import { calculateCTMeasurement } from '../engines/overcurrentMeasurement';
import type {
  DomainIssue,
  OperatingResult,
  OvercurrentProtectionDevice,
  ProtectionChain,
  ProtectionDeviceId,
  TCCCurrentDomain,
  TCCLayer,
} from '../types/overcurrent';
import {
  evaluateActiveOvercurrentParameters,
  validateOvercurrentParameterState,
} from '../utils/evaluateOvercurrentParameters';
import { evaluateOvercurrentDevice } from '../utils/evaluateOvercurrentDevice';
import type { OvercurrentParameterState } from '../utils/overcurrentState';

const CHARACTERISTIC_X_MULTIPLE_MIN = 0.5;
const CHARACTERISTIC_X_MULTIPLE_MAX = 20;
const CHARACTERISTIC_TIME_MIN_SEC = 0.01;
const CHARACTERISTIC_TIME_MAX_SEC = 100;
const CURVE_SAMPLE_COUNT = 181;

export type TccScaleMode = 'CHARACTERISTIC' | 'FIT_POINT';
export type TccOffScaleDirection = 'LOW' | 'HIGH' | null;

export interface TccAxisModel {
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly unit: string;
  readonly ticks: readonly number[];
}

export interface TccCurvePoint {
  readonly x: number;
  readonly operateTimeSec: number;
}

export interface TccCurveSeries {
  readonly layerId: string;
  readonly deviceId: ProtectionDeviceId;
  readonly deviceLabel: string;
  readonly seriesIndex: number;
  readonly selected: boolean;
  readonly ghost: boolean;
  readonly timingMode: OvercurrentProtectionDevice['settings']['phase51']['timingMode'];
  readonly curveId: OvercurrentProtectionDevice['settings']['phase51']['inverseCurveId'];
  readonly curveLabel: string;
  readonly timeScale: number;
  readonly definiteDelaySec: number;
  readonly pickupASecondary: number;
  readonly pickupX: number | null;
  readonly points: readonly TccCurvePoint[];
}

export interface TccVerticalBoundary {
  readonly layerId: string;
  readonly kind: 'PICKUP' | 'INSTANTANEOUS';
  readonly deviceId: ProtectionDeviceId;
  readonly deviceLabel: string;
  readonly seriesIndex: number;
  readonly x: number;
  readonly offScale: TccOffScaleDirection;
}

export interface TccStudyReference {
  readonly layerId: string;
  readonly kind: 'FAULT_CURRENT' | 'MINIMUM_FAULT' | 'MAXIMUM_FAULT';
  readonly label: string;
  readonly x: number;
  readonly offScale: TccOffScaleDirection;
}

export interface TccLoadRegion {
  readonly layerId: string;
  readonly label: string;
  readonly minX: number;
  readonly maxX: number;
}

export interface TccOperatingPoint {
  readonly layerId: string;
  readonly deviceId: ProtectionDeviceId;
  readonly deviceLabel: string;
  readonly seriesIndex: number;
  readonly selected: boolean;
  readonly role: 'PRIMARY' | 'BACKUP' | 'OTHER';
  readonly backupOrder: number | null;
  readonly primaryCurrentA: number;
  readonly relayCurrentASecondary: number;
  readonly currentMultiple: number;
  readonly selectedElement: OperatingResult['selectedElement'];
  readonly selectedTripTimeSec: number | null;
  readonly reference51TimeSec: number | null;
  /** O06 adjacent-tier pair evaluation for a backup at the active study point. */
  readonly coordinationPairId: string | null;
  readonly precedingDeviceId: ProtectionDeviceId | null;
  readonly ctiToPreviousSec: number | null;
  readonly requiredCtiSec: number | null;
  readonly ctiStatus: 'PASS' | 'FAIL' | 'NOT_EVALUABLE' | null;
  readonly x: number;
  readonly plottedX: number;
  readonly plottedTimeSec: number;
  readonly xOffScale: TccOffScaleDirection;
  readonly timeOffScale: TccOffScaleDirection;
}


export interface TccCoordinationBracket {
  readonly layerId: string;
  readonly pairId: string;
  readonly label: string;
  readonly primaryDeviceId: ProtectionDeviceId;
  readonly backupDeviceId: ProtectionDeviceId;
  readonly primaryTripTimeSec: number;
  readonly backupTripTimeSec: number;
  readonly observedCtiSec: number;
  readonly requiredCtiSec: number;
  readonly status: 'PASS' | 'FAIL';
}

export interface TccCoordinationPoint {
  readonly x: number;
  readonly actualBackupTimeSec: number;
  readonly minimumBackupTimeSec: number;
  readonly status: 'PASS' | 'FAIL';
}

export interface TccCoordinationBand {
  readonly corridorLayerId: string;
  readonly violationLayerId: string | null;
  readonly pairId: string;
  readonly label: string;
  readonly primaryDeviceId: ProtectionDeviceId;
  readonly backupDeviceId: ProtectionDeviceId;
  readonly requiredCtiSec: number;
  readonly points: readonly TccCoordinationPoint[];
}

export interface OvercurrentTccModel {
  readonly status: 'VALID' | 'INVALID';
  readonly currentDomain: Exclude<TCCCurrentDomain, 'SECONDARY_A'>;
  readonly scaleMode: TccScaleMode;
  readonly showComparison: boolean;
  readonly xAxis: TccAxisModel;
  readonly yAxis: TccAxisModel;
  readonly layers: readonly TCCLayer[];
  readonly curves: readonly TccCurveSeries[];
  readonly boundaries: readonly TccVerticalBoundary[];
  readonly studyReferences: readonly TccStudyReference[];
  readonly loadRegion: TccLoadRegion | null;
  readonly operatingPoints: readonly TccOperatingPoint[];
  readonly coordinationBrackets: readonly TccCoordinationBracket[];
  readonly coordinationBands: readonly TccCoordinationBand[];
  readonly issues: readonly DomainIssue[];
}

export interface BuildOvercurrentTccOptions {
  readonly currentDomain?: Exclude<TCCCurrentDomain, 'SECONDARY_A'>;
  readonly scaleMode?: TccScaleMode;
  readonly showComparison?: boolean;
  /** Override axis bounds for pan/zoom — when provided, curves and ticks are generated in this range. */
  readonly axisBoundsOverride?: { xMin: number; xMax: number; yMin: number; yMax: number };
}

function issue(code: DomainIssue['code'], path: string, detail: string): DomainIssue {
  return { code, path, detail };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

function logSamples(min: number, max: number, count = CURVE_SAMPLE_COUNT): number[] {
  if (!isPositiveFinite(min) || !isPositiveFinite(max) || max <= min || count < 2) return [];
  const start = Math.log(min);
  const span = Math.log(max) - start;
  return Array.from({ length: count }, (_value, index) => (
    Math.exp(start + span * (index / (count - 1)))
  ));
}

function logTicks(min: number, max: number): number[] {
  if (!isPositiveFinite(min) || !isPositiveFinite(max) || max <= min) return [];
  const ticks: number[] = [];
  const startExponent = Math.floor(Math.log10(min)) - 1;
  const endExponent = Math.ceil(Math.log10(max)) + 1;
  for (let exponent = startExponent; exponent <= endExponent; exponent += 1) {
    const decade = 10 ** exponent;
    for (const multiplier of [1, 2, 5]) {
      const value = multiplier * decade;
      if (value >= min * (1 - 1e-12) && value <= max * (1 + 1e-12) && Number.isFinite(value)) {
        ticks.push(value);
      }
    }
  }
  return ticks;
}

function niceLogDown(value: number): number {
  if (!isPositiveFinite(value)) return 1;
  const exponent = Math.floor(Math.log10(value));
  const decade = 10 ** exponent;
  const normalized = value / decade;
  const multiplier = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  const result = multiplier * decade;
  return isPositiveFinite(result) ? result : value;
}

function niceLogUp(value: number): number {
  if (!isPositiveFinite(value)) return 10;
  const exponent = Math.floor(Math.log10(value));
  const decade = 10 ** exponent;
  const normalized = value / decade;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const result = multiplier * decade;
  return isPositiveFinite(result) ? result : value;
}

function primaryCurrentForRelaySecondary(
  device: OvercurrentProtectionDevice,
  relayCurrentASecondary: number,
): number | null {
  try {
    const rated = calculateCTMeasurement(device.settings.ct.primaryRatedA, device.settings.ct);
    const relayAtRated = rated.measuredSecondaryCurrentA;
    if (!isPositiveFinite(relayAtRated)) return null;
    const primary = device.settings.ct.primaryRatedA * (relayCurrentASecondary / relayAtRated);
    return isPositiveFinite(primary) ? primary : null;
  } catch {
    return null;
  }
}

function xForRelaySecondary(
  device: OvercurrentProtectionDevice,
  relayCurrentASecondary: number,
  domain: OvercurrentTccModel['currentDomain'],
): number | null {
  return domain === 'CURRENT_MULTIPLE'
    ? relayCurrentASecondary / device.settings.phase51.pickupASecondary
    : primaryCurrentForRelaySecondary(device, relayCurrentASecondary);
}

function collectConfiguredPrimaryCurrents(state: OvercurrentParameterState): number[] {
  const values: number[] = [];
  const collect = (map: Readonly<Record<string, number>>) => {
    state.topology.deviceIds.forEach((deviceId) => {
      const value = map[deviceId];
      if (isPositiveFinite(value)) values.push(value);
    });
  };
  state.studyDefinition.loadCases.forEach((studyCase) => {
    if (studyCase.current.kind === 'STATIC') collect(studyCase.current.primaryCurrentAByDevice);
  });
  state.studyDefinition.faultCases.forEach((studyCase) => {
    if (studyCase.current.kind === 'STATIC') collect(studyCase.current.primaryCurrentAByDevice);
  });
  state.studyDefinition.currentProfiles.forEach((profile) => profile.samples.forEach((sample) => collect(sample.primaryCurrentAByDevice)));
  state.studyDefinition.faultLocationProfiles.forEach((profile) => profile.samples.forEach((sample) => collect(sample.primaryCurrentAByDevice)));
  return values;
}

function roleForDevice(
  chain: ProtectionChain | null | undefined,
  deviceId: ProtectionDeviceId,
): Pick<TccOperatingPoint, 'role' | 'backupOrder'> {
  if (!chain) return { role: 'OTHER', backupOrder: null };
  if (chain.primaryDeviceId === deviceId) return { role: 'PRIMARY', backupOrder: null };
  const index = chain.backupDeviceIds.indexOf(deviceId);
  return index >= 0
    ? { role: 'BACKUP', backupOrder: index + 1 }
    : { role: 'OTHER', backupOrder: null };
}


function adjacentCoordinationPair(
  state: OvercurrentParameterState,
  chain: ProtectionChain | null | undefined,
  locationId: string | null | undefined,
  backupDeviceId: ProtectionDeviceId,
) {
  if (!chain || !locationId) return null;
  const backupIndex = chain.backupDeviceIds.indexOf(backupDeviceId);
  if (backupIndex < 0) return null;
  const precedingDeviceId = backupIndex === 0
    ? chain.primaryDeviceId
    : chain.backupDeviceIds[backupIndex - 1];
  const pair = state.studyDefinition.coordinationPairs.find((candidate) => (
    candidate.locationId === locationId
    && candidate.primaryDeviceId === precedingDeviceId
    && candidate.backupDeviceId === backupDeviceId
  ));
  if (!pair) return null;
  const requirement = state.studyDefinition.coordinationRequirements.find((candidate) => candidate.pairId === pair.id);
  if (!requirement) return null;
  return { pair, requirement, precedingDeviceId };
}

function curvePointAt(
  device: OvercurrentProtectionDevice,
  domain: OvercurrentTccModel['currentDomain'],
  x: number,
): TccCurvePoint | null {
  try {
    if (domain === 'CURRENT_MULTIPLE') {
      const relayCurrent = x * device.settings.phase51.pickupASecondary;
      const result = calculateOvercurrent51(relayCurrent, device.settings.phase51);
      return isPositiveFinite(result.operateTimeSec) ? { x, operateTimeSec: result.operateTimeSec } : null;
    }
    const evaluated = evaluateOvercurrentDevice(x, device);
    if (evaluated.status === 'INVALID') return null;
    const time = evaluated.value.element51.operateTimeSec;
    return isPositiveFinite(time) ? { x, operateTimeSec: time } : null;
  } catch {
    return null;
  }
}

function sampleCurve(
  device: OvercurrentProtectionDevice,
  domain: OvercurrentTccModel['currentDomain'],
  xMin: number,
  xMax: number,
): readonly TccCurvePoint[] {
  if (!device.settings.phase51.enabled) return [];
  const pickupX = xForRelaySecondary(device, device.settings.phase51.pickupASecondary, domain);
  if (!isPositiveFinite(pickupX)) return [];
  const start = Math.max(xMin, pickupX * (1 + 1e-8));
  if (start >= xMax) return [];
  return logSamples(start, xMax)
    .map((x) => curvePointAt(device, domain, x))
    .filter((point): point is TccCurvePoint => point !== null);
}

function deviceSettingsChanged(
  current: OvercurrentProtectionDevice,
  initial: OvercurrentProtectionDevice | undefined,
): boolean {
  return !initial || JSON.stringify(current.settings) !== JSON.stringify(initial.settings);
}

function activeOperatingX(
  domain: OvercurrentTccModel['currentDomain'],
  primaryCurrentA: number,
  result: OperatingResult,
): number | null {
  if (domain === 'PRIMARY_A') return isPositiveFinite(primaryCurrentA) ? primaryCurrentA : null;
  return isPositiveFinite(result.element51.currentMultiple) ? result.element51.currentMultiple : null;
}

function axisBounds(
  state: OvercurrentParameterState,
  domain: OvercurrentTccModel['currentDomain'],
  scaleMode: TccScaleMode,
  rawOperatingPoints: readonly {
    x: number;
    selectedTripTimeSec: number | null;
    reference51TimeSec: number | null;
  }[],
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  let xMin: number;
  let xMax: number;
  if (domain === 'CURRENT_MULTIPLE') {
    xMin = CHARACTERISTIC_X_MULTIPLE_MIN;
    xMax = CHARACTERISTIC_X_MULTIPLE_MAX;
  } else {
    const configured = collectConfiguredPrimaryCurrents(state);
    for (const deviceId of state.topology.deviceIds) {
      const device = state.studyDefinition.devicesById[deviceId];
      if (!device) continue;
      const pickup = primaryCurrentForRelaySecondary(device, device.settings.phase51.pickupASecondary);
      const instantaneous = device.settings.phase50.enabled
        ? primaryCurrentForRelaySecondary(device, device.settings.phase50.pickupASecondary)
        : null;
      if (isPositiveFinite(pickup)) configured.push(pickup);
      if (isPositiveFinite(instantaneous)) configured.push(instantaneous);
    }
    const minimum = configured.length > 0 ? Math.min(...configured) : 100;
    const maximum = configured.length > 0 ? Math.max(...configured) : 10_000;
    xMin = niceLogDown(minimum * 0.5);
    xMax = niceLogUp(maximum * 1.5);
  }

  let yMin = CHARACTERISTIC_TIME_MIN_SEC;
  let yMax = CHARACTERISTIC_TIME_MAX_SEC;

  if (scaleMode === 'FIT_POINT') {
    const xs = rawOperatingPoints.map((point) => point.x).filter(isPositiveFinite);
    const times = rawOperatingPoints
      .flatMap((point) => [point.selectedTripTimeSec, point.reference51TimeSec])
      .filter(isPositiveFinite);
    if (xs.length > 0) {
      xMin = niceLogDown(Math.min(xMin, ...xs) * 0.8);
      xMax = niceLogUp(Math.max(xMax, ...xs) * 1.2);
    }
    if (times.length > 0) {
      yMin = niceLogDown(Math.min(yMin, ...times) * 0.8);
      yMax = niceLogUp(Math.max(yMax, ...times) * 1.2);
    }
  }

  if (!isPositiveFinite(xMin) || !isPositiveFinite(xMax) || xMax <= xMin) {
    xMin = domain === 'CURRENT_MULTIPLE' ? 0.5 : 1;
    xMax = domain === 'CURRENT_MULTIPLE' ? 20 : 10;
  }
  if (!isPositiveFinite(yMin) || !isPositiveFinite(yMax) || yMax <= yMin) {
    yMin = CHARACTERISTIC_TIME_MIN_SEC;
    yMax = CHARACTERISTIC_TIME_MAX_SEC;
  }
  return { xMin, xMax, yMin, yMax };
}

function offScale(value: number, min: number, max: number): TccOffScaleDirection {
  if (value < min) return 'LOW';
  if (value > max) return 'HIGH';
  return null;
}

function selectedDeviceReferenceX(
  state: OvercurrentParameterState,
  domain: OvercurrentTccModel['currentDomain'],
  primaryCurrentA: number,
): number | null {
  const deviceId = state.selectedDeviceId ?? state.topology.deviceIds[0];
  const device = deviceId ? state.studyDefinition.devicesById[deviceId] : undefined;
  if (!device || !isPositiveFinite(primaryCurrentA)) return null;
  if (domain === 'PRIMARY_A') return primaryCurrentA;
  const evaluated = evaluateOvercurrentDevice(primaryCurrentA, device);
  return evaluated.status === 'VALID' && isPositiveFinite(evaluated.value.element51.currentMultiple)
    ? evaluated.value.element51.currentMultiple
    : null;
}

function studyReferences(
  state: OvercurrentParameterState,
  domain: OvercurrentTccModel['currentDomain'],
  xMin: number,
  xMax: number,
): { references: TccStudyReference[]; loadRegion: TccLoadRegion | null; layers: TCCLayer[] } {
  const references: TccStudyReference[] = [];
  const layers: TCCLayer[] = [];
  const selectedDeviceId = state.selectedDeviceId ?? state.topology.deviceIds[0];
  const activeEvaluation = evaluateActiveOvercurrentParameters(state);

  if (activeEvaluation.status === 'VALID' && selectedDeviceId) {
    const activePrimary = activeEvaluation.value.primaryCurrentAByDevice[selectedDeviceId];
    const x = selectedDeviceReferenceX(state, domain, activePrimary);
    if (isPositiveFinite(x) && activeEvaluation.value.source?.kind !== 'LOAD') {
      const layerId = `TCC:FAULT:${activeEvaluation.value.source?.id ?? 'ACTIVE'}:${selectedDeviceId}`;
      references.push({ layerId, kind: 'FAULT_CURRENT', label: 'Active fault current', x, offScale: offScale(x, xMin, xMax) });
      layers.push({
        id: layerId,
        kind: 'FAULT_CURRENT_LINE',
        label: 'Active fault current',
        visible: true,
        zIndex: 50,
        faultCaseId: state.activeFaultCaseId ?? activeEvaluation.value.source?.id ?? 'PROFILE',
        primaryCurrentA: activePrimary,
      });
    }
  }

  const activeLocationId = activeEvaluation.status === 'VALID'
    ? activeEvaluation.value.source?.locationId
    : null;
  if (activeLocationId && selectedDeviceId) {
    for (const category of ['MIN', 'MAX'] as const) {
      const studyCase = state.studyDefinition.faultCases.find((faultCase) => (
        faultCase.locationId === activeLocationId && faultCase.category === category && faultCase.current.kind === 'STATIC'
      ));
      if (!studyCase || studyCase.current.kind !== 'STATIC') continue;
      const primaryCurrentA = studyCase.current.primaryCurrentAByDevice[selectedDeviceId];
      const x = selectedDeviceReferenceX(state, domain, primaryCurrentA);
      if (!isPositiveFinite(x)) continue;
      const kind = category === 'MIN' ? 'MINIMUM_FAULT' : 'MAXIMUM_FAULT';
      const layerId = `TCC:${kind}:${studyCase.id}:${selectedDeviceId}`;
      references.push({
        layerId,
        kind,
        label: category === 'MIN' ? 'Minimum fault' : 'Maximum fault',
        x,
        offScale: offScale(x, xMin, xMax),
      });
      layers.push({
        id: layerId,
        kind: category === 'MIN' ? 'MINIMUM_FAULT_REFERENCE' : 'MAXIMUM_FAULT_REFERENCE',
        label: category === 'MIN' ? 'Minimum fault reference' : 'Maximum fault reference',
        visible: true,
        zIndex: 20,
        minCurrent: x,
        maxCurrent: x,
        unit: domain === 'PRIMARY_A' ? 'A_PRIMARY' : 'MULTIPLE',
      });
    }
  }

  let loadRegion: TccLoadRegion | null = null;
  if (selectedDeviceId) {
    const loadValues = state.studyDefinition.loadCases.flatMap((loadCase) => {
      if (loadCase.current.kind !== 'STATIC') return [];
      const primaryCurrentA = loadCase.current.primaryCurrentAByDevice[selectedDeviceId];
      const x = selectedDeviceReferenceX(state, domain, primaryCurrentA);
      return isPositiveFinite(x) ? [x] : [];
    });
    if (loadValues.length > 0) {
      const maxX = Math.max(...loadValues);
      const layerId = `TCC:LOAD:${selectedDeviceId}`;
      loadRegion = {
        layerId,
        label: 'Configured load region',
        minX: xMin,
        maxX: clamp(maxX, xMin, xMax),
      };
      layers.push({
        id: layerId,
        kind: 'LOAD_REGION',
        label: 'Configured load region',
        visible: true,
        zIndex: 5,
        minCurrent: xMin,
        maxCurrent: maxX,
        unit: domain === 'PRIMARY_A' ? 'A_PRIMARY' : 'MULTIPLE',
      });
    }
  }

  return { references, loadRegion, layers };
}

function coordinationBands(
  state: OvercurrentParameterState,
  domain: OvercurrentTccModel['currentDomain'],
): { bands: TccCoordinationBand[]; layers: TCCLayer[] } {
  if (domain !== 'PRIMARY_A' || state.studyMode !== 'COORDINATION_LAB') return { bands: [], layers: [] };
  const activeEvaluation = evaluateActiveOvercurrentParameters(state);
  const activeLocationId = activeEvaluation.status === 'VALID' ? activeEvaluation.value.source?.locationId : null;
  if (!activeLocationId || state.studyDefinition.faultLocationProfiles.length === 0) return { bands: [], layers: [] };
  const evaluated = runOvercurrentCoordinationStudy(state.studyDefinition);
  if (evaluated.status === 'INVALID') return { bands: [], layers: [] };

  const bands: TccCoordinationBand[] = [];
  const layers: TCCLayer[] = [];
  const activePairs = state.studyDefinition.coordinationPairs.filter((pair) => pair.locationId === activeLocationId);
  for (const pair of activePairs) {
    const requirement = state.studyDefinition.coordinationRequirements.find((item) => item.pairId === pair.id);
    if (!requirement) continue;
    const collected: TccCoordinationPoint[] = [];
    for (const envelope of evaluated.value.envelopes) {
      for (const point of envelope.points) {
        if (point.locationId !== activeLocationId) continue;
        const pairPoint = point.pairPoints.find((item) => item.pairId === pair.id);
        const x = point.primaryCurrentAByDevice[pair.backupDeviceId];
        if (!pairPoint || !isPositiveFinite(x) || !isPositiveFinite(pairPoint.backupTripTimeSec) || !isPositiveFinite(pairPoint.minimumBackupTimeSec)) continue;
        collected.push({
          x,
          actualBackupTimeSec: pairPoint.backupTripTimeSec,
          minimumBackupTimeSec: pairPoint.minimumBackupTimeSec,
          status: pairPoint.status === 'PASS' ? 'PASS' : 'FAIL',
        });
      }
    }
    collected.sort((left, right) => left.x - right.x);
    const points = collected.filter((point, index) => index === 0 || Math.abs(point.x - collected[index - 1].x) > 1e-9);
    if (points.length === 0) continue;
    const corridorLayerId = `TCC:CORRIDOR:${pair.id}`;
    const hasViolation = points.some((point) => point.status === 'FAIL');
    const violationLayerId = hasViolation ? `TCC:VIOLATION:${pair.id}` : null;
    bands.push({
      corridorLayerId,
      violationLayerId,
      pairId: pair.id,
      label: `${pair.primaryDeviceId} → ${pair.backupDeviceId}`,
      primaryDeviceId: pair.primaryDeviceId,
      backupDeviceId: pair.backupDeviceId,
      requiredCtiSec: requirement.requiredCtiSec,
      points,
    });
    layers.push({
      id: corridorLayerId,
      kind: 'COORDINATION_CORRIDOR',
      label: `${pair.primaryDeviceId} → ${pair.backupDeviceId} minimum backup boundary`,
      visible: true,
      zIndex: 30,
      pairId: pair.id,
      requiredCtiSec: requirement.requiredCtiSec,
    });
    if (violationLayerId) {
      layers.push({
        id: violationLayerId,
        kind: 'COORDINATION_VIOLATION_ENVELOPE',
        label: `${pair.primaryDeviceId} → ${pair.backupDeviceId} configured-profile violation`,
        visible: true,
        zIndex: 35,
        pairId: pair.id,
        requiredCtiSec: requirement.requiredCtiSec,
      });
    }
  }
  return { bands, layers };
}

function invalidModel(
  currentDomain: OvercurrentTccModel['currentDomain'],
  scaleMode: TccScaleMode,
  showComparison: boolean,
  issues: readonly DomainIssue[],
): OvercurrentTccModel {
  return {
    status: 'INVALID',
    currentDomain,
    scaleMode,
    showComparison,
    xAxis: {
      min: currentDomain === 'CURRENT_MULTIPLE' ? 0.5 : 100,
      max: currentDomain === 'CURRENT_MULTIPLE' ? 20 : 10_000,
      label: currentDomain === 'CURRENT_MULTIPLE' ? 'Current Multiple' : 'Primary Current',
      unit: currentDomain === 'CURRENT_MULTIPLE' ? '× pickup' : 'A primary',
      ticks: [],
    },
    yAxis: { min: 0.01, max: 100, label: 'Operating Time', unit: 's', ticks: [] },
    layers: [],
    curves: [],
    boundaries: [],
    studyReferences: [],
    loadRegion: null,
    operatingPoints: [],
    coordinationBrackets: [],
    coordinationBands: [],
    issues,
  };
}

/**
 * Pure O10 presentation model. It samples O03/O04 engine functions and consumes
 * O05/O06/O08 results; no relay or coordination equation is implemented here.
 */
export function buildOvercurrentTccModel(
  state: OvercurrentParameterState,
  options: BuildOvercurrentTccOptions = {},
): OvercurrentTccModel {
  const currentDomain = options.currentDomain
    ?? (state.studyMode === 'SINGLE_RELAY' ? 'CURRENT_MULTIPLE' : 'PRIMARY_A');
  const scaleMode = options.scaleMode ?? 'CHARACTERISTIC';
  const showComparison = options.showComparison ?? state.modified;
  const validated = validateOvercurrentParameterState(state);
  if (validated.status === 'INVALID') return invalidModel(currentDomain, scaleMode, showComparison, validated.issues);

  const active = evaluateActiveOvercurrentParameters(state);
  if (active.status === 'INVALID') return invalidModel(currentDomain, scaleMode, showComparison, active.issues);

  const rawOperatingPoints = state.topology.deviceIds.flatMap((deviceId) => {
    const result = active.value.deviceResults[deviceId];
    const primaryCurrentA = active.value.primaryCurrentAByDevice[deviceId];
    if (!result || primaryCurrentA === undefined) return [];
    const x = activeOperatingX(currentDomain, primaryCurrentA, result);
    if (!isPositiveFinite(x)) return [];
    return [{
      deviceId,
      primaryCurrentA,
      result,
      x,
      selectedTripTimeSec: result.selectedTripTimeSec,
      reference51TimeSec: result.element51.operateTimeSec,
    }];
  });

  const bounds = options.axisBoundsOverride ?? axisBounds(state, currentDomain, scaleMode, rawOperatingPoints);
  const xAxis: TccAxisModel = {
    min: bounds.xMin,
    max: bounds.xMax,
    label: currentDomain === 'CURRENT_MULTIPLE' ? 'Current Multiple' : 'Primary Current',
    unit: currentDomain === 'CURRENT_MULTIPLE' ? '× pickup' : 'A primary',
    ticks: logTicks(bounds.xMin, bounds.xMax),
  };
  const yAxis: TccAxisModel = {
    min: bounds.yMin,
    max: bounds.yMax,
    label: 'Operating Time',
    unit: 's',
    ticks: logTicks(bounds.yMin, bounds.yMax),
  };

  const layers: TCCLayer[] = [];
  const curves: TccCurveSeries[] = [];
  const boundaries: TccVerticalBoundary[] = [];

  state.topology.deviceIds.forEach((deviceId, seriesIndex) => {
    const device = state.studyDefinition.devicesById[deviceId];
    if (!device) return;
    const pickupX = xForRelaySecondary(device, device.settings.phase51.pickupASecondary, currentDomain);
    const layerId = `TCC:CURVE:${deviceId}`;
    const points = sampleCurve(device, currentDomain, xAxis.min, xAxis.max);
    const definition = OVERCURRENT_INVERSE_CURVES[device.settings.phase51.inverseCurveId];
    layers.push({
      id: layerId,
      kind: 'RELAY_CURVE',
      label: `${device.label} ${device.settings.phase51.timingMode === 'INVERSE' ? definition.displayName : 'Definite Time'}`,
      visible: device.settings.phase51.enabled,
      zIndex: 40,
      deviceId,
    });
    curves.push({
      layerId,
      deviceId,
      deviceLabel: device.label,
      seriesIndex,
      selected: state.selectedDeviceId === deviceId,
      ghost: false,
      timingMode: device.settings.phase51.timingMode,
      curveId: device.settings.phase51.inverseCurveId,
      curveLabel: device.settings.phase51.timingMode === 'INVERSE' ? definition.displayName : 'Definite Time',
      timeScale: device.settings.phase51.timeScale,
      definiteDelaySec: device.settings.phase51.definiteDelaySec,
      pickupASecondary: device.settings.phase51.pickupASecondary,
      pickupX,
      points,
    });

    if (isPositiveFinite(pickupX)) {
      const boundaryId = `TCC:PICKUP:${deviceId}`;
      boundaries.push({
        layerId: boundaryId,
        kind: 'PICKUP',
        deviceId,
        deviceLabel: device.label,
        seriesIndex,
        x: pickupX,
        offScale: offScale(pickupX, xAxis.min, xAxis.max),
      });
      layers.push({
        id: boundaryId,
        kind: 'PICKUP_BOUNDARY',
        label: `${device.label} 51 pickup`,
        visible: true,
        zIndex: 15,
        minCurrent: pickupX,
        maxCurrent: pickupX,
        unit: currentDomain === 'PRIMARY_A' ? 'A_PRIMARY' : 'MULTIPLE',
      });
    }

    if (device.settings.phase50.enabled) {
      const instantaneousX = xForRelaySecondary(device, device.settings.phase50.pickupASecondary, currentDomain);
      if (isPositiveFinite(instantaneousX)) {
        const boundaryId = `TCC:50:${deviceId}`;
        boundaries.push({
          layerId: boundaryId,
          kind: 'INSTANTANEOUS',
          deviceId,
          deviceLabel: device.label,
          seriesIndex,
          x: instantaneousX,
          offScale: offScale(instantaneousX, xAxis.min, xAxis.max),
        });
        layers.push({
          id: boundaryId,
          kind: 'INSTANTANEOUS_BOUNDARY',
          label: `${device.label} 50 high-set`,
          visible: true,
          zIndex: 45,
          deviceId,
          pickupASecondary: device.settings.phase50.pickupASecondary,
        });
      }
    }

    const initial = state.initialSnapshot?.devicesById[deviceId] as OvercurrentProtectionDevice | undefined;
    if (showComparison && initial && deviceSettingsChanged(device, initial)) {
      const ghostLayerId = `TCC:GHOST:${deviceId}`;
      const initialDefinition = OVERCURRENT_INVERSE_CURVES[initial.settings.phase51.inverseCurveId];
      layers.push({
        id: ghostLayerId,
        kind: 'INITIAL_SETTING_GHOST',
        label: `${initial.label} initial setting`,
        visible: true,
        zIndex: 25,
        deviceId,
      });
      curves.push({
        layerId: ghostLayerId,
        deviceId,
        deviceLabel: initial.label,
        seriesIndex,
        selected: state.selectedDeviceId === deviceId,
        ghost: true,
        timingMode: initial.settings.phase51.timingMode,
        curveId: initial.settings.phase51.inverseCurveId,
        curveLabel: initial.settings.phase51.timingMode === 'INVERSE' ? initialDefinition.displayName : 'Definite Time',
        timeScale: initial.settings.phase51.timeScale,
        definiteDelaySec: initial.settings.phase51.definiteDelaySec,
        pickupASecondary: initial.settings.phase51.pickupASecondary,
        pickupX: xForRelaySecondary(initial, initial.settings.phase51.pickupASecondary, currentDomain),
        points: sampleCurve(initial, currentDomain, xAxis.min, xAxis.max),
      });
    }
  });

  const operatingPoints: TccOperatingPoint[] = rawOperatingPoints.map((raw, seriesIndex) => {
    const device = state.studyDefinition.devicesById[raw.deviceId];
    const role = roleForDevice(active.value.source?.protectionChain, raw.deviceId);
    const selectedTime = raw.selectedTripTimeSec;
    const plottedTime = isPositiveFinite(selectedTime) ? selectedTime : yAxis.min;
    const xDirection = offScale(raw.x, xAxis.min, xAxis.max);
    const timeDirection: TccOffScaleDirection = selectedTime === null
      ? null
      : selectedTime === 0
        ? 'LOW'
        : offScale(selectedTime, yAxis.min, yAxis.max);
    const currentMultiple = raw.result.element51.currentMultiple;
    const safeMultiple = isPositiveFinite(currentMultiple)
      ? currentMultiple
      : raw.result.measurement.measuredSecondaryCurrentA / (device?.settings.phase51.pickupASecondary ?? 1);
    const adjacent = role.role === 'BACKUP'
      ? adjacentCoordinationPair(
        state,
        active.value.source?.protectionChain,
        active.value.source?.locationId,
        raw.deviceId,
      )
      : null;
    const precedingResult = adjacent
      ? active.value.deviceResults[adjacent.precedingDeviceId]
      : undefined;
    const cti = adjacent && precedingResult
      ? evaluateCoordinationPair(adjacent.pair, adjacent.requirement, precedingResult, raw.result)
      : null;
    const layerId = `TCC:POINT:${raw.deviceId}:${active.value.source?.id ?? 'ACTIVE'}`;
    if (selectedTime !== null) {
      layers.push({
        id: layerId,
        kind: 'OPERATING_POINT',
        label: `${device?.label ?? raw.deviceId} operating point`,
        visible: true,
        zIndex: 60,
        deviceId: raw.deviceId,
        faultCaseId: state.activeFaultCaseId ?? undefined,
        primaryCurrentA: raw.primaryCurrentA,
        secondaryCurrentA: raw.result.measurement.measuredSecondaryCurrentA,
        currentMultiple: safeMultiple,
        operateTimeSec: selectedTime,
        role: role.role === 'OTHER' ? undefined : role.role,
      });
    } else {
      layers.push({
        id: layerId,
        kind: 'STUDY_MARKER',
        label: `${device?.label ?? raw.deviceId} below pickup`,
        visible: true,
        zIndex: 55,
        minCurrent: raw.x,
        maxCurrent: raw.x,
        unit: currentDomain === 'PRIMARY_A' ? 'A_PRIMARY' : 'MULTIPLE',
      });
    }
    return {
      layerId,
      deviceId: raw.deviceId,
      deviceLabel: device?.label ?? raw.deviceId,
      seriesIndex,
      selected: state.selectedDeviceId === raw.deviceId,
      role: role.role,
      backupOrder: role.backupOrder,
      primaryCurrentA: raw.primaryCurrentA,
      relayCurrentASecondary: raw.result.measurement.measuredSecondaryCurrentA,
      currentMultiple: safeMultiple,
      selectedElement: raw.result.selectedElement,
      selectedTripTimeSec: selectedTime,
      reference51TimeSec: raw.reference51TimeSec,
      coordinationPairId: adjacent?.pair.id ?? null,
      precedingDeviceId: adjacent?.precedingDeviceId ?? null,
      ctiToPreviousSec: cti?.observedCtiSec ?? null,
      requiredCtiSec: cti?.requiredCtiSec ?? null,
      ctiStatus: cti?.status ?? null,
      x: raw.x,
      plottedX: clamp(raw.x, xAxis.min, xAxis.max),
      plottedTimeSec: clamp(plottedTime, yAxis.min, yAxis.max),
      xOffScale: xDirection,
      timeOffScale: timeDirection,
    };
  });

  const coordinationBrackets: TccCoordinationBracket[] = operatingPoints
    .filter((point) => point.role === 'BACKUP')
    .sort((left, right) => (left.backupOrder ?? Number.MAX_SAFE_INTEGER) - (right.backupOrder ?? Number.MAX_SAFE_INTEGER))
    .flatMap((backupPoint) => {
    if (
      backupPoint.role !== 'BACKUP'
      || !backupPoint.coordinationPairId
      || !backupPoint.precedingDeviceId
      || !isPositiveFinite(backupPoint.selectedTripTimeSec)
      || backupPoint.ctiToPreviousSec === null
      || backupPoint.requiredCtiSec === null
      || (backupPoint.ctiStatus !== 'PASS' && backupPoint.ctiStatus !== 'FAIL')
    ) return [];
    const primaryPoint = operatingPoints.find((point) => point.deviceId === backupPoint.precedingDeviceId);
    if (!primaryPoint || !isPositiveFinite(primaryPoint.selectedTripTimeSec)) return [];
    const layerId = `TCC:BRACKET:${backupPoint.coordinationPairId}`;
    layers.push({
      id: layerId,
      kind: 'COORDINATION_BRACKET',
      label: `${primaryPoint.deviceLabel} → ${backupPoint.deviceLabel} active coordination margin`,
      visible: true,
      zIndex: 58,
      pairId: backupPoint.coordinationPairId,
      requiredCtiSec: backupPoint.requiredCtiSec,
    });
    return [{
      layerId,
      pairId: backupPoint.coordinationPairId,
      label: `${primaryPoint.deviceLabel} → ${backupPoint.deviceLabel}`,
      primaryDeviceId: primaryPoint.deviceId,
      backupDeviceId: backupPoint.deviceId,
      primaryTripTimeSec: primaryPoint.selectedTripTimeSec,
      backupTripTimeSec: backupPoint.selectedTripTimeSec,
      observedCtiSec: backupPoint.ctiToPreviousSec,
      requiredCtiSec: backupPoint.requiredCtiSec,
      status: backupPoint.ctiStatus,
    }];
    });

  const references = studyReferences(state, currentDomain, xAxis.min, xAxis.max);
  const coordination = coordinationBands(state, currentDomain);
  layers.push(...references.layers, ...coordination.layers);
  layers.sort((left, right) => left.zIndex - right.zIndex || left.id.localeCompare(right.id));

  if (curves.filter((curve) => !curve.ghost && curve.points.length > 0).length === 0) {
    return invalidModel(currentDomain, scaleMode, showComparison, [
      issue('NUMERICAL_RANGE', 'tcc.curves', 'No finite 51 characteristic point can be represented in the current graph domain.'),
    ]);
  }

  return {
    status: 'VALID',
    currentDomain,
    scaleMode,
    showComparison,
    xAxis,
    yAxis,
    layers,
    curves,
    boundaries,
    studyReferences: references.references,
    loadRegion: references.loadRegion,
    operatingPoints,
    coordinationBrackets,
    coordinationBands: coordination.bands,
    issues: [],
  };
}
