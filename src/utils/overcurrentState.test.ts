import { describe, expect, it } from 'vitest';
import { OVERCURRENT_INVERSE_CURVES } from '../engines/overcurrent';
import { getOvercurrentStudyPreset } from '../studies/overcurrentPresets';
import {
  canBeginOvercurrentFaultRun,
  evaluateActiveOvercurrentParameters,
  validateOvercurrentParameterState,
} from './evaluateOvercurrentParameters';
import {
  createInitialOvercurrentParameterState,
  overcurrentParameterReducer,
  overcurrentSettingsLocked,
  type OvercurrentParameterAction,
  type OvercurrentParameterState,
} from './overcurrentState';

function reduce(state: OvercurrentParameterState, action: OvercurrentParameterAction): OvercurrentParameterState {
  return overcurrentParameterReducer(state, action);
}

function activeResult(state: OvercurrentParameterState, deviceId: string) {
  const evaluated = evaluateActiveOvercurrentParameters(state);
  expect(evaluated.status).toBe('VALID');
  if (evaluated.status !== 'VALID') throw new Error('Expected a valid active Overcurrent parameter evaluation.');
  return evaluated.value.deviceResults[deviceId];
}

describe('O08 Overcurrent parameter state', () => {
  it('starts from the canonical OVC-01 load-only preset', () => {
    const state = createInitialOvercurrentParameterState();
    expect(state.studyPresetId).toBe('OVC-01');
    expect(state.studyMode).toBe('SINGLE_RELAY');
    expect(state.guidanceMode).toBe('GUIDED');
    expect(state.selectedDeviceId).toBe('R1');
    expect(state.activeLoadCaseId).toBe('OVC-01:LOAD');
    expect(state.activeFaultCaseId).toBeNull();
    expect(state.playbackState).toBe('IDLE');
    expect(state.modified).toBe(false);
    expect(activeResult(state, 'R1').selectedElement).toBeNull();
  });

  it('changes study mode by loading the first authoritative preset for that mode', () => {
    const single = createInitialOvercurrentParameterState();
    const coordination = reduce(single, { type: 'SET_STUDY_MODE', mode: 'COORDINATION_LAB' });
    expect(coordination.studyPresetId).toBe('COORD-01');
    expect(coordination.topology.deviceIds).toEqual(['R1', 'R2']);
    expect(coordination.selectedDeviceId).toBe('R2');

    const restoredSingle = reduce(coordination, { type: 'SET_STUDY_MODE', mode: 'SINGLE_RELAY' });
    expect(restoredSingle.studyPresetId).toBe('OVC-01');
    expect(restoredSingle.topology.deviceIds).toEqual(['R1']);
  });

  it('keeps current, CT, pickup, timing, and 50 changes on the approved engine path', () => {
    let state = createInitialOvercurrentParameterState('OVC-04');
    let result = activeResult(state, 'R1');
    expect(result.measurement.measuredSecondaryCurrentA).toBe(4);
    expect(result.element51.currentMultiple).toBe(5);
    expect(result.element51.operateTimeSec).toBeCloseTo(0.427972007, 9);

    state = reduce(state, {
      type: 'SET_CASE_CURRENT',
      caseKind: 'FAULT',
      caseId: 'OVC-04:CASE',
      deviceId: 'R1',
      valueA: 5000,
    });
    state = reduce(state, { type: 'SET_DEVICE_CT', deviceId: 'R1', key: 'ratioErrorPct', value: 5 });
    state = reduce(state, { type: 'SET_DEVICE_51_PICKUP', deviceId: 'R1', valueASecondary: 1.05 });
    result = activeResult(state, 'R1');
    expect(result.measurement.measuredSecondaryCurrentA).toBeCloseTo(5.25, 12);
    expect(result.element51.currentMultiple).toBeCloseTo(5, 12);
    expect(result.element51.operateTimeSec).toBeCloseTo(0.427972007, 9);

    state = reduce(state, { type: 'SET_DEVICE_50_ENABLED', deviceId: 'R1', enabled: true });
    state = reduce(state, { type: 'SET_DEVICE_50_PICKUP', deviceId: 'R1', valueASecondary: 5 });
    result = activeResult(state, 'R1');
    expect(result.element50.status).toBe('PICKUP');
    expect(result.selectedElement).toBe('50');
    expect(result.selectedTripTimeSec).toBe(0);
  });

  it('supports IEC/IEEE curve and Definite Time settings without changing the registry', () => {
    let state = createInitialOvercurrentParameterState('OVC-03');
    state = reduce(state, { type: 'SET_DEVICE_51_CURVE', deviceId: 'R1', curveId: 'IEEE_MI' });
    state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R1', value: 0.2 });
    expect(state.devicesById.R1.settings.phase51.inverseCurveId).toBe('IEEE_MI');
    expect(OVERCURRENT_INVERSE_CURVES[state.devicesById.R1.settings.phase51.inverseCurveId].family).toBe('IEEE');
    expect(activeResult(state, 'R1').element51.operateTimeSec).toBeCloseTo(0.760649846, 8);

    state = reduce(state, { type: 'SET_DEVICE_51_TIMING_MODE', deviceId: 'R1', timingMode: 'DEFINITE' });
    state = reduce(state, { type: 'SET_DEVICE_51_DEFINITE_DELAY', deviceId: 'R1', valueSec: 0.35 });
    const result = activeResult(state, 'R1');
    expect(result.element51.timingMode).toBe('DEFINITE');
    expect(result.element51.operateTimeSec).toBe(0.35);
  });

  it('reconciles CTI budget edits to one authoritative required CTI', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    const requirement = state.coordinationRequirements[0];
    expect(requirement.requiredCtiSec).toBe(0.3);

    state = reduce(state, {
      type: 'SET_CTI_BUDGET_PART',
      requirementId: requirement.id,
      key: 'studySafetyMarginSec',
      valueSec: 0.2,
    });
    const changed = state.coordinationRequirements[0];
    expect(changed.budget?.studySafetyMarginSec).toBe(0.2);
    expect(changed.requiredCtiSec).toBeCloseTo(0.35, 12);
    expect(state.studyDefinition.coordinationRequirements).toBe(state.coordinationRequirements);
    expect(validateOvercurrentParameterState(state).status).toBe('VALID');
  });

  it('does not mutate the registry preset and Reset restores the selected preset exactly', () => {
    const registryPreset = getOvercurrentStudyPreset('COORD-02')!;
    expect(registryPreset.devicesById.R2.settings.phase51.timeScale).toBe(0.18);

    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
    state = reduce(state, { type: 'SET_GUIDANCE_MODE', guidance: 'FREE' });
    expect(state.modified).toBe(true);
    expect(state.devicesById.R2.settings.phase51.timeScale).toBe(0.19);
    expect(registryPreset.devicesById.R2.settings.phase51.timeScale).toBe(0.18);

    state = reduce(state, { type: 'RESET' });
    expect(state.studyPresetId).toBe('COORD-02');
    expect(state.guidanceMode).toBe('GUIDED');
    expect(state.devicesById.R2.settings.phase51.timeScale).toBe(0.18);
    expect(state.modified).toBe(false);
  });

  it('locks engineering settings during a run but keeps focus, speed, Clear, and Reset available', () => {
    let state = createInitialOvercurrentParameterState('OVC-04');
    expect(canBeginOvercurrentFaultRun(state)).toBe(true);
    state = reduce(state, { type: 'BEGIN_FAULT_RUN' });
    expect(overcurrentSettingsLocked(state)).toBe(true);

    const lockedPickup = state.devicesById.R1.settings.phase51.pickupASecondary;
    const attempted = reduce(state, { type: 'SET_DEVICE_51_PICKUP', deviceId: 'R1', valueASecondary: 1.2 });
    expect(attempted).toBe(state);
    expect(attempted.devicesById.R1.settings.phase51.pickupASecondary).toBe(lockedPickup);

    state = reduce(state, { type: 'SET_SIMULATION_SPEED', speed: 10 });
    expect(state.simulationSpeed).toBe(10);
    expect(state.playbackState).toBe('RUNNING');

    state = reduce(state, { type: 'CLEAR_FAULT_RUN' });
    expect(state.playbackState).toBe('IDLE');
    expect(overcurrentSettingsLocked(state)).toBe(false);
    state = reduce(state, { type: 'SET_DEVICE_51_PICKUP', deviceId: 'R1', valueASecondary: 1.2 });
    expect(state.devicesById.R1.settings.phase51.pickupASecondary).toBe(1.2);
  });

  it('blocks a run for invalid or numerically unrepresentable engineering data', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.049 });
    expect(validateOvercurrentParameterState(state).status).toBe('INVALID');
    expect(canBeginOvercurrentFaultRun(state)).toBe(false);
    expect(reduce(state, { type: 'BEGIN_FAULT_RUN' }).playbackState).toBe('IDLE');

    state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'SET_DEVICE_CT', deviceId: 'R1', key: 'primaryRatedA', value: Number.MIN_VALUE });
    const evaluated = validateOvercurrentParameterState(state);
    expect(evaluated.status).toBe('INVALID');
    if (evaluated.status === 'INVALID') {
      expect(evaluated.issues.some((entry) => entry.code === 'NUMERICAL_RANGE')).toBe(true);
    }
    expect(reduce(state, { type: 'BEGIN_FAULT_RUN' }).playbackState).toBe('IDLE');
  });


  it('invalidates a completed timed run when the engineering state or active study current changes', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'BEGIN_FAULT_RUN' });
    state = reduce(state, { type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    expect(state.playbackState).toBe('COMPLETE');

    state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
    expect(state.playbackState).toBe('IDLE');

    state = reduce(state, { type: 'BEGIN_FAULT_RUN' });
    state = reduce(state, { type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    state = reduce(state, { type: 'SELECT_FAULT_CASE', faultCaseId: 'COORD-02:F2:MAX' });
    expect(state.playbackState).toBe('IDLE');

    state = reduce(state, { type: 'BEGIN_FAULT_RUN' });
    state = reduce(state, { type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    state = reduce(state, { type: 'SET_FAULT_LOCATION_POSITION', profileId: 'COORD-02:SCRUBBER', normalizedPosition: 0.8 });
    expect(state.playbackState).toBe('IDLE');
  });

  it('treats Guided/Free and fault-location focus as learning/selection state, not engineering mutations', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'RUN_COORDINATION_TEST' });
    expect(state.validationState.status).toBe('COMPLETE');
    const validation = state.validationState;

    state = reduce(state, { type: 'SET_GUIDANCE_MODE', guidance: 'FREE' });
    expect(state.modified).toBe(false);
    expect(state.validationState).toBe(validation);
    expect(state.guidedChallengeProgress.revealedHintCount).toBe(0);

    state = reduce(state, { type: 'SET_GUIDANCE_MODE', guidance: 'GUIDED' });
    state = reduce(state, { type: 'REVEAL_GUIDED_HINT' });
    expect(state.guidedChallengeProgress.revealedHintCount).toBe(1);

    state = reduce(state, { type: 'SET_FAULT_LOCATION_POSITION', profileId: 'COORD-02:SCRUBBER', normalizedPosition: 0.8 });
    expect(state.validationState).toBe(validation);
    expect(state.modified).toBe(false);

    state = reduce(state, { type: 'RESET' });
    expect(state.guidedChallengeProgress.revealedHintCount).toBe(0);
    expect(state.validationState.status).toBe('IDLE');
  });
});
