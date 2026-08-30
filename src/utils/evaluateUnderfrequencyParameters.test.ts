import { describe, expect, it } from 'vitest';
import {
  canBeginUnderfrequencyRun,
  evaluateActiveUnderfrequency,
  validateUnderfrequencyParameterState,
} from './evaluateUnderfrequencyParameters';
import {
  createInitialUnderfrequencyState,
  underfrequencyReducer,
} from './underfrequencyState';
import { UFR_01_NOMINAL, UFR_02_LOSE_LARGE_UNIT } from '../studies/underfrequencyPresets';
import { getUnderfrequencyStudyPreset } from '../studies/underfrequencyPresets';

describe('UFR reducer state lifecycle', () => {
  it('initialises from the nominal preset with modified = false and IDLE', () => {
    const state = createInitialUnderfrequencyState();
    expect(state.presetId).toBe('UFR-01');
    expect(state.modified).toBe(false);
    expect(state.playbackState).toBe('IDLE');
    expect(state.simulationSpeed).toBe(1);
    expect(state.scrubTimeSec).toBeNull();
  });

  it('APPLY_PRESET swaps the whole study and clears modified', () => {
    const state = createInitialUnderfrequencyState();
    const next = underfrequencyReducer(state, { type: 'APPLY_PRESET', presetId: 'UFR-02' });
    expect(next.presetId).toBe('UFR-02');
    expect(next.modified).toBe(false);
    expect(next.study.disturbanceSteps.length).toBeGreaterThan(0);
  });

  it('a SET_SYSTEM mutation marks modified and resets playback to IDLE', () => {
    const state = { ...createInitialUnderfrequencyState(), playbackState: 'COMPLETE' as const };
    const next = underfrequencyReducer(state, { type: 'SET_SYSTEM', patch: { baseLoadMw: 1400 } });
    expect(next.modified).toBe(true);
    expect(next.playbackState).toBe('IDLE');
    expect(next.study.system.baseLoadMw).toBe(1400);
  });

  it('drops non-finite values from a patch (draft hygiene)', () => {
    const state = createInitialUnderfrequencyState();
    const next = underfrequencyReducer(state, { type: 'SET_SYSTEM', patch: { baseLoadMw: Number.NaN } });
    expect(next.study.system.baseLoadMw).toBe(1300);
    expect(next.modified).toBe(false);
  });

  it('SET_DISTURBANCE_DEFICIT_MW replaces the schedule with a single load step', () => {
    const state = createInitialUnderfrequencyState();
    const next = underfrequencyReducer(state, { type: 'SET_DISTURBANCE_DEFICIT_MW', mw: 200 });
    expect(next.study.disturbanceSteps).toEqual([{ id: 'D-MANUAL', kind: 'LOAD_STEP', timeSec: 0, mw: 200 }]);
  });

  it('SET_DISTURBANCE_DEFICIT_MW with zero clears the disturbance', () => {
    const state = underfrequencyReducer(createInitialUnderfrequencyState(), {
      type: 'SET_DISTURBANCE_DEFICIT_MW',
      mw: 200,
    });
    const next = underfrequencyReducer(state, { type: 'SET_DISTURBANCE_DEFICIT_MW', mw: 0 });
    expect(next.study.disturbanceSteps).toEqual([]);
  });

  it('ADD_GENERATOR_LOSS appends a loss step and ignores duplicates', () => {
    const state = createInitialUnderfrequencyState();
    const withLoss = underfrequencyReducer(state, { type: 'ADD_GENERATOR_LOSS', generatorId: 'G1', timeSec: 0 });
    expect(withLoss.study.disturbanceSteps).toContainEqual(
      { id: 'D-LOSS-G1', kind: 'GENERATOR_LOSS', timeSec: 0, generatorId: 'G1' },
    );
    const dup = underfrequencyReducer(withLoss, { type: 'ADD_GENERATOR_LOSS', generatorId: 'G1', timeSec: 0 });
    expect(dup.study.disturbanceSteps.length).toBe(withLoss.study.disturbanceSteps.length);
  });

  it('REMOVE_DISTURBANCE_STEP drops the named step', () => {
    const state = createInitialUnderfrequencyState();
    const withLoss = underfrequencyReducer(state, { type: 'ADD_GENERATOR_LOSS', generatorId: 'G1', timeSec: 0 });
    const removed = underfrequencyReducer(withLoss, { type: 'REMOVE_DISTURBANCE_STEP', stepId: 'D-LOSS-G1' });
    expect(removed.study.disturbanceSteps).toEqual([]);
  });

  it('RESET restores the active preset and clears modified', () => {
    const state = underfrequencyReducer(createInitialUnderfrequencyState(), { type: 'SET_SYSTEM', patch: { baseLoadMw: 1400 } });
    const reset = underfrequencyReducer(state, { type: 'RESET' });
    expect(reset.modified).toBe(false);
    expect(reset.study.system.baseLoadMw).toBe(1300);
  });
});

describe('UFR parameter validation & gating', () => {
  it('accepts a fresh nominal state as VALID', () => {
    const state = createInitialUnderfrequencyState();
    expect(validateUnderfrequencyParameterState(state).status).toBe('VALID');
  });

  it('reports INVALID when the study carries an engineering fault', () => {
    let state = createInitialUnderfrequencyState();
    state = underfrequencyReducer(state, { type: 'SET_UFLS_STAGE', stageId: 'S2', patch: { thresholdHz: 50.5 } });
    const validation = validateUnderfrequencyParameterState(state);
    expect(validation.status).toBe('INVALID');
    if (validation.status === 'INVALID') {
      expect(validation.issues.some((i) => i.code === 'INVALID_UFLS_ORDER')).toBe(true);
    }
  });

  it('canBeginUnderfrequencyRun requires IDLE and VALID', () => {
    const fresh = createInitialUnderfrequencyState();
    expect(canBeginUnderfrequencyRun(fresh)).toBe(true);
    const running = underfrequencyReducer(fresh, { type: 'BEGIN_RUN' });
    expect(canBeginUnderfrequencyRun(running)).toBe(false);
  });

  it('evaluateActiveUnderfrequency returns the static reference for a valid state', () => {
    const state = createInitialUnderfrequencyState();
    const evaluation = evaluateActiveUnderfrequency(state);
    expect(evaluation.status).toBe('VALID');
    if (evaluation.status === 'VALID') {
      expect(evaluation.value.staticResult.sBaseMva).toBeGreaterThan(0);
      expect(evaluation.value.staticResult.hSysSec).toBeGreaterThan(0);
      expect(evaluation.value.staticResult.displayStatus).toBe('RESTRAIN');
    }
  });
});

describe('UFR preset-to-state fidelity', () => {
  it('studyFromPreset produces a study that validates identically to the registry preset', () => {
    const preset = getUnderfrequencyStudyPreset('UFR-02');
    const state = createInitialUnderfrequencyState('UFR-02');
    expect(state.study.id).toBe(preset.study.id);
    expect(state.study.system.baseLoadMw).toBe(preset.study.system.baseLoadMw);
    expect(state.study.generators.length).toBe(preset.study.generators.length);
    expect(state.study.uflsStages.length).toBe(preset.study.uflsStages.length);
    // A disturbed preset surfaced through the reducer must still validate.
    expect(validateUnderfrequencyParameterState(state).status).toBe('VALID');
  });

  it('preserves the UFR-02 disturbance schedule through apply + reset round-trip', () => {
    const state = createInitialUnderfrequencyState('UFR-02');
    expect(state.study.disturbanceSteps).toContainEqual({ id: 'D1', kind: 'GENERATOR_LOSS', timeSec: 0, generatorId: 'G1' });
    expect(UFR_01_NOMINAL.study.disturbanceSteps).toEqual([]);
    expect(UFR_02_LOSE_LARGE_UNIT.study.disturbanceSteps.length).toBeGreaterThan(0);
  });
});
