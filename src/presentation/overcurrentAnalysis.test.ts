import { describe, expect, it } from 'vitest';
import { createInitialOvercurrentParameterState, overcurrentParameterReducer } from '../utils/overcurrentState';
import { buildOvercurrentOperatingSequenceModel, createOvercurrentOperatingSequencePlan } from './overcurrentOperatingSequence';
import { buildOvercurrentAnalysisModel } from './overcurrentAnalysis';

function reduce(state: ReturnType<typeof createInitialOvercurrentParameterState>, action: Parameters<typeof overcurrentParameterReducer>[1]) {
  return overcurrentParameterReducer(state, action);
}

describe('O12 Analysis / Learning presentation', () => {
  it('surfaces the canonical COORD-02 time-grading failure and adjacent margins', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const model = buildOvercurrentAnalysisModel(state);
    expect(model.status).toBe('VALID');
    expect(model.headline.label).toBe('COORDINATION INCOMPLETE');
    expect(model.operatingOrder[0]?.deviceId).toBe('R3');
    expect(model.coordinationMargins).toHaveLength(2);
    expect(model.coordinationMargins.find((row) => row.primaryDeviceId === 'R3' && row.backupDeviceId === 'R2')).toMatchObject({
      status: 'FAIL',
      observedCtiSec: expect.closeTo(0.2783076923076923, 9),
      requiredCtiSec: 0.3,
    });
    expect(model.violations.some((violation) => violation.type === 'TIME_GRADING')).toBe(true);
    expect(model.checks).toContainEqual(expect.objectContaining({ dimension: 'TIME_GRADING', status: 'FAIL' }));
  });

  it('shows initial/current impact and reaches 6/6 after the canonical R2 TMS correction', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
    const model = buildOvercurrentAnalysisModel(state);
    expect(model.headline.label).toBe('COORDINATED');
    expect(model.settingImpacts).toContainEqual(expect.objectContaining({ deviceId: 'R2', parameter: expect.stringContaining('TMS') }));
    expect(model.comparison).toMatchObject({ currentPassedCases: 6, totalCases: 6 });
    expect(model.comparison!.currentViolations).toBeLessThan(model.comparison!.initialViolations);
  });

  it('runs the complete configured validation registry through the reducer action', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
    state = reduce(state, { type: 'RUN_COORDINATION_TEST' });
    expect(state.validationState.status).toBe('COMPLETE');
    if (state.validationState.status === 'COMPLETE') {
      expect(state.validationState.audit).toMatchObject({ status: 'COORDINATED', passedCaseCount: 6, totalCaseCount: 6 });
    }
  });

  it('surfaces instantaneous overreach and selectivity failures without hinting an exact setting', () => {
    const state = createInitialOvercurrentParameterState('COORD-05');
    const model = buildOvercurrentAnalysisModel(state);
    expect(model.violations.some((violation) => violation.type === 'INSTANTANEOUS_OVERREACH')).toBe(true);
    expect(model.violations.some((violation) => violation.type === 'SELECTIVITY_FAIL')).toBe(true);
    expect(model.hints).toHaveLength(3);
    expect(model.hints.join(' ')).not.toMatch(/\bset\s+\d|TMS\s+\d|I>>\s+\d/i);
  });

  it('uses the active O11 timeline frame for exact runtime status', () => {
    const state = createInitialOvercurrentParameterState('OVC-03');
    const running = { ...state, playbackState: 'RUNNING' as const };
    const plan = createOvercurrentOperatingSequencePlan(running);
    const sequence = buildOvercurrentOperatingSequenceModel(running, 0.2, plan);
    const model = buildOvercurrentAnalysisModel(running, sequence.snapshot);
    expect(model.headline.label).toBe('51 TIMING');
    expect(model.events.some((event) => event.type === '51_PICKUP')).toBe(true);
  });

  it('contains invalid arithmetic instead of exposing stale analysis values', () => {
    let state = createInitialOvercurrentParameterState('OVC-03');
    state = reduce(state, { type: 'SET_DEVICE_51_PICKUP', deviceId: 'R1', valueASecondary: Number.NaN });
    const model = buildOvercurrentAnalysisModel(state);
    expect(model.status).toBe('INVALID');
    expect(model.headline.label).toBe('INPUT INVALID / OUTPUT HELD');
    expect(model.measurements).toEqual([]);
  });
});
