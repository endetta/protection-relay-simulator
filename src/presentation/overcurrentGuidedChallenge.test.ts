import { describe, expect, it } from 'vitest';
import { runOvercurrentCoordinationStudy } from '../engines/overcurrentCoordination';
import {
  COORD_01_TWO_RELAY_TIME_GRADING,
  COORD_02_THREE_RELAY_RADIAL,
  COORD_03_PICKUP_AND_TIME,
  COORD_04_CURVE_SELECTION,
  COORD_05_INSTANTANEOUS_COORDINATION,
  COORD_06_FULL_COORDINATION,
} from '../studies/overcurrentPresets';
import type { OvercurrentStudyDefinition } from '../types/overcurrent';
import {
  createInitialOvercurrentParameterState,
  overcurrentParameterReducer,
  type OvercurrentParameterAction,
  type OvercurrentParameterState,
} from '../utils/overcurrentState';
import { buildOvercurrentGuidedChallengeModel } from './overcurrentGuidedChallenge';

const GUIDED_IDS = ['COORD-01', 'COORD-02', 'COORD-03', 'COORD-04', 'COORD-05', 'COORD-06'] as const;

function reduce(state: OvercurrentParameterState, action: OvercurrentParameterAction): OvercurrentParameterState {
  return overcurrentParameterReducer(state, action);
}

function solvedState(id: typeof GUIDED_IDS[number]): OvercurrentParameterState {
  let state = createInitialOvercurrentParameterState(id);
  switch (id) {
    case 'COORD-01':
      state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R1', value: 0.19 });
      break;
    case 'COORD-02':
      state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
      break;
    case 'COORD-03':
      state = reduce(state, { type: 'SET_DEVICE_51_PICKUP', deviceId: 'R3', valueASecondary: 0.8 });
      state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
      break;
    case 'COORD-04':
      state = reduce(state, { type: 'SET_DEVICE_51_CURVE', deviceId: 'R2', curveId: 'IEC_VI' });
      break;
    case 'COORD-05':
      state = reduce(state, { type: 'SET_DEVICE_50_PICKUP', deviceId: 'R2', valueASecondary: 7 });
      break;
    case 'COORD-06':
      state = reduce(state, { type: 'SET_DEVICE_51_PICKUP', deviceId: 'R3', valueASecondary: 0.8 });
      state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
      state = reduce(state, { type: 'SET_DEVICE_50_PICKUP', deviceId: 'R2', valueASecondary: 7 });
      break;
  }
  return state;
}

function fourRelayStudy(): OvercurrentStudyDefinition {
  const base = COORD_02_THREE_RELAY_RADIAL;
  const r1 = base.devicesById.R1;
  const r0 = {
    ...r1,
    id: 'R0',
    label: 'R0',
    order: 0,
    settings: { ...r1.settings, phase51: { ...r1.settings.phase51, timeScale: 0.70 } },
  };
  const faultCases = base.faultCases.map((faultCase) => ({
    ...faultCase,
    current: faultCase.current.kind === 'STATIC'
      ? { ...faultCase.current, primaryCurrentAByDevice: { R0: faultCase.current.primaryCurrentAByDevice.R1, ...faultCase.current.primaryCurrentAByDevice } }
      : faultCase.current,
    protectionChain: { ...faultCase.protectionChain, backupDeviceIds: [...faultCase.protectionChain.backupDeviceIds, 'R0'] },
  }));
  const loadCases = base.loadCases.map((loadCase) => ({
    ...loadCase,
    current: loadCase.current.kind === 'STATIC'
      ? { ...loadCase.current, primaryCurrentAByDevice: { R0: loadCase.current.primaryCurrentAByDevice.R1, ...loadCase.current.primaryCurrentAByDevice } }
      : loadCase.current,
  }));
  const extraPairs = base.topology.locations.map((location, index) => ({
    id: `FOUR:${location.id}:R1-R0`,
    locationId: location.id,
    primaryDeviceId: 'R1',
    backupDeviceId: 'R0',
    backupOrder: index + 1,
  }));
  const extraRequirements = extraPairs.map((pair) => ({
    id: `REQ:${pair.id}`,
    pairId: pair.id,
    requiredCtiSec: 0.3,
    budget: { breakerAllowanceSec: 0.1, relayTimingAllowanceSec: 0.05, studySafetyMarginSec: 0.15 },
  }));
  return {
    ...base,
    id: 'FOUR-GUIDED',
    label: 'Four Relay Guided Contract',
    topology: { ...base.topology, id: 'FOUR-GUIDED:T', deviceIds: ['R0', 'R1', 'R2', 'R3'] },
    devicesById: { R0: r0, ...base.devicesById },
    faultCases,
    loadCases,
    currentProfiles: [],
    faultLocationProfiles: [],
    coordinationPairs: [...base.coordinationPairs, ...extraPairs],
    coordinationRequirements: [...base.coordinationRequirements, ...extraRequirements],
    defaultSelectedDeviceId: 'R3',
  };
}

describe('O13 guided challenge registry and solvability', () => {
  it('starts every coordination challenge from a deterministic intentional failure', () => {
    const studies = [
      COORD_01_TWO_RELAY_TIME_GRADING,
      COORD_02_THREE_RELAY_RADIAL,
      COORD_03_PICKUP_AND_TIME,
      COORD_04_CURVE_SELECTION,
      COORD_05_INSTANTANEOUS_COORDINATION,
      COORD_06_FULL_COORDINATION,
    ];
    for (const study of studies) {
      const result = runOvercurrentCoordinationStudy(study);
      expect(result.status).toBe('VALID');
      if (result.status === 'VALID') {
        expect(result.value.audit.status).toBe('COORDINATION_INCOMPLETE');
        expect(result.value.audit.passedCaseCount).toBeLessThan(result.value.audit.totalCaseCount);
      }
    }
  });

  it('proves each challenge has at least one test-only engineering solution', () => {
    for (const id of GUIDED_IDS) {
      let state = solvedState(id);
      expect(buildOvercurrentGuidedChallengeModel(state).status).toBe('VALIDATION_REQUIRED');
      state = reduce(state, { type: 'RUN_COORDINATION_TEST' });
      const model = buildOvercurrentGuidedChallengeModel(state);
      expect(model.status).toBe('VERIFIED');
      expect(model.passedCaseCount).toBe(model.totalCaseCount);
      expect(model.requirements.every((row) => row.status === 'PASS')).toBe(true);
      expect(model.whyThisWorks.length).toBeGreaterThan(0);
    }
  });

  it('keeps the three-level hint contract and never stores an exact numeric answer', () => {
    const forbidden = /(?:\b\d*\.\d+\b|\b\d+(?:\.\d+)?\s*A\s*sec\b|(?:TMS|time dial|pickup|I>>)\s*(?:=|to)\s*\d+)/i;
    for (const id of GUIDED_IDS) {
      const state = createInitialOvercurrentParameterState(id);
      const hints = state.studyDefinition.learning?.hints ?? [];
      expect(hints.map((hint) => hint.level)).toEqual(['LOCATION', 'PARAMETER_FAMILY', 'DIRECTION']);
      expect(hints.map((hint) => hint.text).join('\n')).not.toMatch(forbidden);
    }
  });
});

describe('O13 guided workflow semantics', () => {
  it('requires explicit run-all validation even when live engineering results are already coordinated', () => {
    let state = solvedState('COORD-02');
    expect(buildOvercurrentGuidedChallengeModel(state).status).toBe('VALIDATION_REQUIRED');
    state = reduce(state, { type: 'RUN_COORDINATION_TEST' });
    expect(buildOvercurrentGuidedChallengeModel(state).status).toBe('VERIFIED');
  });

  it('reveals hints progressively and Reset clears only temporary challenge progress plus engineering edits', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'REVEAL_GUIDED_HINT' });
    state = reduce(state, { type: 'REVEAL_GUIDED_HINT' });
    let model = buildOvercurrentGuidedChallengeModel(state);
    expect(model.revealedHints.map((hint) => hint.level)).toEqual(['LOCATION', 'PARAMETER_FAMILY']);

    state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
    state = reduce(state, { type: 'RESET' });
    model = buildOvercurrentGuidedChallengeModel(state);
    expect(model.status).toBe('READY');
    expect(model.revealedHints).toEqual([]);
    expect(state.devicesById.R2.settings.phase51.timeScale).toBe(0.18);
    expect(state.modified).toBe(false);
  });

  it('keeps Free Study engineering-identical while hiding challenge completion and hints', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    const devices = state.devicesById;
    state = reduce(state, { type: 'SET_GUIDANCE_MODE', guidance: 'FREE' });
    expect(state.devicesById).toBe(devices);
    expect(state.modified).toBe(false);
    expect(buildOvercurrentGuidedChallengeModel(state).status).toBe('NOT_APPLICABLE');
  });

  it('preserves completed validation across selection-only fault scrubber movement', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'RUN_COORDINATION_TEST' });
    const validation = state.validationState;
    state = reduce(state, { type: 'SET_FAULT_LOCATION_POSITION', profileId: 'COORD-02:SCRUBBER', normalizedPosition: 0.8 });
    expect(state.validationState).toBe(validation);
  });

  it('invalidates a previously verified challenge after an engineering setting edit', () => {
    let state = solvedState('COORD-02');
    state = reduce(state, { type: 'RUN_COORDINATION_TEST' });
    expect(buildOvercurrentGuidedChallengeModel(state).status).toBe('VERIFIED');
    state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.20 });
    expect(state.validationState.status).toBe('IDLE');
    expect(buildOvercurrentGuidedChallengeModel(state).status).toBe('VALIDATION_REQUIRED');
  });

  it('keeps challenge derivation generic for a synthetic four-relay topology', () => {
    const study = fourRelayStudy();
    const base = createInitialOvercurrentParameterState('COORD-02');
    const state: OvercurrentParameterState = {
      ...base,
      studyPresetId: study.id,
      studyDefinition: study,
      topology: study.topology,
      devicesById: study.devicesById,
      coordinationRequirements: study.coordinationRequirements,
      selectedDeviceId: 'R3',
      initialSnapshot: {
        id: `${study.id}:INITIAL`,
        label: 'Initial Settings',
        devicesById: study.devicesById,
        coordinationRequirements: study.coordinationRequirements,
        selectedFaultCaseId: study.defaultFaultCaseId,
      },
      comparisonSnapshot: null,
      modified: false,
      validationState: { status: 'IDLE' },
      guidedChallengeProgress: { revealedHintCount: 0 },
    };
    const model = buildOvercurrentGuidedChallengeModel(state);
    expect(model.applicable).toBe(true);
    expect(model.objectiveTitle).toContain('Coordinate R3');
    expect(model.requirements.length).toBeGreaterThan(0);
  });
});
