import { describe, expect, it } from 'vitest';
import { calculateOvercurrent51 } from '../engines/overcurrent';
import { runOvercurrentCoordinationStudy } from '../engines/overcurrentCoordination';
import { getOvercurrentStudyPreset } from '../studies/overcurrentPresets';
import { initializeOvercurrentSimulatorState } from '../studies/overcurrentStudy';
import type {
  OvercurrentProtectionDevice,
  OvercurrentStudyDefinition,
} from '../types/overcurrent';
import { evaluateOvercurrentDevice } from '../utils/evaluateOvercurrentDevice';
import {
  createInitialOvercurrentParameterState,
  overcurrentParameterReducer,
  type OvercurrentParameterState,
} from '../utils/overcurrentState';
import { buildOvercurrentTccModel } from './overcurrentTcc';

function reduce(
  state: OvercurrentParameterState,
  action: Parameters<typeof overcurrentParameterReducer>[1],
): OvercurrentParameterState {
  return overcurrentParameterReducer(state, action);
}

function fourRelayState(): OvercurrentParameterState {
  const base = getOvercurrentStudyPreset('OVC-04')!.devicesById.R1 as OvercurrentProtectionDevice;
  const ids = ['UPSTREAM', 'MID_A', 'MID_B', 'FEEDER'];
  const devices = ids.map((id, index): OvercurrentProtectionDevice => ({
    ...base,
    id,
    label: id,
    order: index + 1,
    settings: {
      ...base.settings,
      phase51: { ...base.settings.phase51, timeScale: 0.1 + index * 0.05 },
    },
  }));
  const study: OvercurrentStudyDefinition = {
    id: 'O10-FOUR',
    label: 'Four Relay TCC Contract',
    mode: 'COORDINATION_LAB',
    guidance: 'FREE',
    topology: {
      id: 'O10-FOUR:TOPOLOGY',
      label: 'Four Relay Radial Feeder',
      kind: 'RADIAL_FEEDER',
      deviceIds: ids,
      locations: [{ id: 'F4', label: 'Downstream Fault', normalizedPosition: 0.9 }],
    },
    devicesById: Object.fromEntries(devices.map((device) => [device.id, device])),
    loadCases: [],
    faultCases: [{
      id: 'O10-FOUR:F4',
      label: 'F4 Fault',
      locationId: 'F4',
      category: 'CUSTOM',
      current: { kind: 'STATIC', primaryCurrentAByDevice: Object.fromEntries(ids.map((id) => [id, 2000])) },
      protectionChain: { primaryDeviceId: 'FEEDER', backupDeviceIds: ['MID_B', 'MID_A', 'UPSTREAM'] },
    }],
    currentProfiles: [],
    faultLocationProfiles: [],
    coordinationPairs: [
      { id: 'O10-FOUR:F4:FEEDER-MID_B', locationId: 'F4', primaryDeviceId: 'FEEDER', backupDeviceId: 'MID_B', backupOrder: 1 },
      { id: 'O10-FOUR:F4:MID_B-MID_A', locationId: 'F4', primaryDeviceId: 'MID_B', backupDeviceId: 'MID_A', backupOrder: 2 },
      { id: 'O10-FOUR:F4:MID_A-UPSTREAM', locationId: 'F4', primaryDeviceId: 'MID_A', backupDeviceId: 'UPSTREAM', backupOrder: 3 },
    ],
    coordinationRequirements: [
      { id: 'REQ:FEEDER-MID_B', pairId: 'O10-FOUR:F4:FEEDER-MID_B', requiredCtiSec: 0.01 },
      { id: 'REQ:MID_B-MID_A', pairId: 'O10-FOUR:F4:MID_B-MID_A', requiredCtiSec: 0.01 },
      { id: 'REQ:MID_A-UPSTREAM', pairId: 'O10-FOUR:F4:MID_A-UPSTREAM', requiredCtiSec: 0.01 },
    ],
    validationCaseIds: ['O10-FOUR:F4'],
    loadSecurityCaseIds: [],
    defaultSelectedDeviceId: 'FEEDER',
    defaultFaultCaseId: 'O10-FOUR:F4',
  };
  const initialized = initializeOvercurrentSimulatorState(study);
  if (initialized.status === 'INVALID') throw new Error(JSON.stringify(initialized.issues));
  return {
    ...initialized.value,
    studyDefinition: study,
    faultLocationSelection: null,
    modified: false,
    guidedChallengeProgress: { revealedHintCount: 0 },
  };
}

describe('O10 Overcurrent TCC presentation model', () => {
  it('samples the canonical single-relay curve directly from the O03 engine', () => {
    const state = createInitialOvercurrentParameterState('OVC-03');
    const model = buildOvercurrentTccModel(state);

    expect(model.status).toBe('VALID');
    expect(model.currentDomain).toBe('CURRENT_MULTIPLE');
    expect(model.xAxis).toMatchObject({ min: 0.5, max: 20, unit: '× pickup' });
    expect(model.yAxis).toMatchObject({ min: 0.01, max: 100, unit: 's' });
    expect(model.curves).toHaveLength(1);
    const curve = model.curves[0];
    const device = state.studyDefinition.devicesById.R1;
    expect(curve.points.length).toBeGreaterThan(150);
    [0, 45, 90, curve.points.length - 1].forEach((index) => {
      const point = curve.points[index];
      const engine = calculateOvercurrent51(
        point.x * device.settings.phase51.pickupASecondary,
        device.settings.phase51,
      );
      expect(engine.operateTimeSec).not.toBeNull();
      expect(point.operateTimeSec).toBeCloseTo(engine.operateTimeSec!, 12);
    });
    const active = model.operatingPoints[0];
    expect(active.currentMultiple).toBeCloseTo(2, 12);
    expect(active.selectedTripTimeSec).toBeCloseTo(1.002902702, 8);
    expect(model.layers.some((layer) => layer.kind === 'RELAY_CURVE')).toBe(true);
    expect(model.layers.some((layer) => layer.kind === 'OPERATING_POINT')).toBe(true);
  });

  it('uses a common primary-current domain and preserves explicit F3 relay roles', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const model = buildOvercurrentTccModel(state);

    expect(model.currentDomain).toBe('PRIMARY_A');
    expect(model.xAxis.unit).toBe('A primary');
    expect(model.curves.filter((curve) => !curve.ghost)).toHaveLength(3);
    expect(model.operatingPoints.map((point) => [point.deviceId, point.role, point.backupOrder, point.x])).toEqual([
      ['R1', 'BACKUP', 2, 6000],
      ['R2', 'BACKUP', 1, 6000],
      ['R3', 'PRIMARY', null, 6000],
    ]);
    model.operatingPoints.forEach((point) => {
      const engine = evaluateOvercurrentDevice(
        point.primaryCurrentA,
        state.studyDefinition.devicesById[point.deviceId],
      );
      expect(engine.status).toBe('VALID');
      if (engine.status === 'VALID') {
        expect(point.relayCurrentASecondary).toBeCloseTo(engine.value.measurement.measuredSecondaryCurrentA, 12);
        expect(point.selectedTripTimeSec).toBeCloseTo(engine.value.selectedTripTimeSec!, 12);
      }
    });
  });

  it('takes active-point CTI and configured-profile corridors from the O06 coordination engine', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const model = buildOvercurrentTccModel(state);
    const study = runOvercurrentCoordinationStudy(state.studyDefinition);
    expect(study.status).toBe('VALID');
    if (study.status !== 'VALID') throw new Error('Expected valid O06 coordination study.');
    const active = study.value.faultCaseResults.find((result) => result.faultCaseId === state.activeFaultCaseId);
    expect(active).toBeDefined();

    const r2 = model.operatingPoints.find((point) => point.deviceId === 'R2')!;
    const pair = active!.pairResults.find((result) => result.pairId === 'COORD-02:F3:R3-R2')!;
    expect(r2.coordinationPairId).toBe('COORD-02:F3:R3-R2');
    expect(r2.precedingDeviceId).toBe('R3');
    expect(r2.ctiToPreviousSec).toBeCloseTo(pair.observedCtiSec!, 12);
    expect(r2.requiredCtiSec).toBe(pair.requiredCtiSec);
    expect(r2.ctiStatus).toBe(pair.status);
    expect(model.coordinationBands.map((band) => band.pairId)).toEqual([
      'COORD-02:F3:R3-R2',
      'COORD-02:F3:R2-R1',
    ]);
    const r1 = model.operatingPoints.find((point) => point.deviceId === 'R1')!;
    const r1Pair = active!.pairResults.find((result) => result.pairId === 'COORD-02:F3:R2-R1')!;
    expect(r1.coordinationPairId).toBe('COORD-02:F3:R2-R1');
    expect(r1.precedingDeviceId).toBe('R2');
    expect(r1.ctiToPreviousSec).toBeCloseTo(r1Pair.observedCtiSec!, 12);
    expect(model.coordinationBrackets.map((bracket) => bracket.pairId)).toEqual([
      'COORD-02:F3:R3-R2',
      'COORD-02:F3:R2-R1',
    ]);
    expect(model.layers.filter((layer) => layer.kind === 'COORDINATION_BRACKET')).toHaveLength(2);
    expect(model.coordinationBands.every((band) => band.points.length > 0)).toBe(true);
    expect(model.layers.filter((layer) => layer.kind === 'COORDINATION_CORRIDOR')).toHaveLength(2);
    expect(model.layers.some((layer) => layer.kind === 'COORDINATION_VIOLATION_ENVELOPE')).toBe(true);
  });

  it('keeps below-pickup markers distinct from finite off-scale operating points', () => {
    const state = createInitialOvercurrentParameterState('OVC-01');
    const model = buildOvercurrentTccModel(state, { scaleMode: 'CHARACTERISTIC' });
    const point = model.operatingPoints[0];
    expect(point.selectedTripTimeSec).toBeNull();
    expect(point.selectedElement).toBeNull();
    expect(point.timeOffScale).toBeNull();
  });

  it('represents 50 as a high-set boundary and an exact zero-second off-scale point', () => {
    const state = createInitialOvercurrentParameterState('OVC-05');
    const model = buildOvercurrentTccModel(state);
    const point = model.operatingPoints[0];
    const highSet = model.boundaries.find((boundary) => boundary.kind === 'INSTANTANEOUS');

    expect(point.selectedElement).toBe('50');
    expect(point.selectedTripTimeSec).toBe(0);
    expect(point.timeOffScale).toBe('LOW');
    expect(point.reference51TimeSec).toBeGreaterThan(0);
    expect(highSet?.x).toBeCloseTo(3.75, 12);
    expect(model.layers.some((layer) => layer.kind === 'INSTANTANEOUS_BOUNDARY')).toBe(true);

    const fit = buildOvercurrentTccModel(state, { scaleMode: 'FIT_POINT' });
    expect(fit.operatingPoints[0].selectedTripTimeSec).toBe(0);
    expect(fit.operatingPoints[0].timeOffScale).toBe('LOW');
  });

  it('renders definite-time 51 as an engine-derived horizontal characteristic', () => {
    const state = createInitialOvercurrentParameterState('OVC-06');
    const model = buildOvercurrentTccModel(state);
    const curve = model.curves[0];
    expect(curve.timingMode).toBe('DEFINITE');
    expect(curve.points.length).toBeGreaterThan(150);
    expect(new Set(curve.points.map((point) => point.operateTimeSec))).toEqual(new Set([0.5]));
    expect(model.operatingPoints[0].selectedTripTimeSec).toBe(0.5);
  });

  it('holds the characteristic scale near pickup and expands deterministically only in Fit Point', () => {
    let state = createInitialOvercurrentParameterState('OVC-02');
    state = reduce(state, {
      type: 'SET_CASE_CURRENT',
      caseKind: 'FAULT',
      caseId: state.activeFaultCaseId!,
      deviceId: 'R1',
      valueA: 800.08,
    });
    const characteristic = buildOvercurrentTccModel(state, { scaleMode: 'CHARACTERISTIC' });
    const fit = buildOvercurrentTccModel(state, { scaleMode: 'FIT_POINT' });

    expect(characteristic.yAxis.max).toBe(100);
    expect(characteristic.operatingPoints[0].timeOffScale).toBe('HIGH');
    expect(characteristic.operatingPoints[0].selectedTripTimeSec).toBeGreaterThan(100);
    expect(fit.yAxis.max).toBeGreaterThan(characteristic.operatingPoints[0].selectedTripTimeSec!);
    expect(fit.operatingPoints[0].timeOffScale).toBeNull();
    expect(buildOvercurrentTccModel(state, { scaleMode: 'FIT_POINT' }).yAxis).toEqual(fit.yAxis);
  });

  it('adds an initial-setting ghost only after an approved setting mutation', () => {
    const initial = createInitialOvercurrentParameterState('OVC-03');
    expect(buildOvercurrentTccModel(initial).curves.some((curve) => curve.ghost)).toBe(false);
    const changed = reduce(initial, {
      type: 'SET_DEVICE_51_TIME_SCALE',
      deviceId: 'R1',
      value: 0.2,
    });
    const model = buildOvercurrentTccModel(changed);
    const current = model.curves.find((curve) => !curve.ghost)!;
    const ghost = model.curves.find((curve) => curve.ghost)!;
    expect(changed.modified).toBe(true);
    expect(ghost.layerId).toBe('TCC:GHOST:R1');
    expect(ghost.timeScale).toBe(0.1);
    expect(current.timeScale).toBe(0.2);
    expect(current.points[80].operateTimeSec).toBeCloseTo(ghost.points[80].operateTimeSec * 2, 11);
    expect(buildOvercurrentTccModel(changed, { showComparison: false }).curves.some((curve) => curve.ghost)).toBe(false);
  });

  it('uses the configured O09 profile point without inventing network calculations', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, {
      type: 'SET_FAULT_LOCATION_POSITION',
      profileId: 'COORD-02:SCRUBBER',
      normalizedPosition: 0.8,
    });
    const model = buildOvercurrentTccModel(state);
    expect(model.operatingPoints.map((point) => point.primaryCurrentA)).toEqual([6200, 6200, 6200]);
    expect(model.operatingPoints.map((point) => point.role)).toEqual(['BACKUP', 'BACKUP', 'PRIMARY']);
    expect(model.studyReferences.some((reference) => reference.kind === 'FAULT_CURRENT' && reference.x === 6200)).toBe(true);
    expect(model.operatingPoints.find((point) => point.deviceId === 'R2')?.ctiToPreviousSec).not.toBeNull();
    expect(model.operatingPoints.find((point) => point.deviceId === 'R1')?.ctiToPreviousSec).not.toBeNull();
  });

  it('supports a generic four-relay topology without device-specific TCC logic', () => {
    const model = buildOvercurrentTccModel(fourRelayState());
    expect(model.status).toBe('VALID');
    expect(model.curves.filter((curve) => !curve.ghost).map((curve) => curve.deviceId)).toEqual([
      'UPSTREAM', 'MID_A', 'MID_B', 'FEEDER',
    ]);
    expect(model.operatingPoints.map((point) => point.role)).toEqual(['BACKUP', 'BACKUP', 'BACKUP', 'PRIMARY']);
    expect(model.layers.filter((layer) => layer.kind === 'RELAY_CURVE')).toHaveLength(4);
    expect(model.coordinationBrackets).toHaveLength(3);
    expect(model.coordinationBrackets.map((bracket) => bracket.pairId)).toEqual([
      'O10-FOUR:F4:FEEDER-MID_B',
      'O10-FOUR:F4:MID_B-MID_A',
      'O10-FOUR:F4:MID_A-UPSTREAM',
    ]);
  });

  it('contains invalid engineering input without emitting graph coordinates', () => {
    const valid = createInitialOvercurrentParameterState('COORD-02');
    const invalid = reduce(valid, {
      type: 'SET_DEVICE_CT',
      deviceId: 'R2',
      key: 'primaryRatedA',
      value: 0,
    });
    const model = buildOvercurrentTccModel(invalid);
    expect(model.status).toBe('INVALID');
    expect(model.curves).toEqual([]);
    expect(model.operatingPoints).toEqual([]);
    expect(model.layers).toEqual([]);
    expect(model.issues.length).toBeGreaterThan(0);
  });
});
