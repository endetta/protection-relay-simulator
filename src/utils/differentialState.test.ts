import { describe, expect, it } from 'vitest';
import { createInitialDifferentialState, differentialStateReducer } from './differentialState';

function reduce(action: Parameters<typeof differentialStateReducer>[1]) {
  return differentialStateReducer(createInitialDifferentialState(), action);
}

describe('Differential simulator workflow state', () => {
  it('starts from canonical Direct Current Normal Load state', () => {
    const state = createInitialDifferentialState();
    expect(state.scenarioId).toBe('normal-load');
    expect(state.inputMode).toBe('direct');
    expect(state.system.transformerRatingMVA).toBe(25);
    expect(state.i1p).toBeCloseTo(57.7350269, 6);
    expect(state.i2p).toBeCloseTo(-433.0127019, 6);
  });

  it('recalculates terminal current after explicitly switching to Load Driven', () => {
    const initial = createInitialDifferentialState();
    const loadDriven = differentialStateReducer(initial, { type: 'SET_INPUT_MODE', mode: 'load' });
    const state = differentialStateReducer(loadDriven, { type: 'SET_SYSTEM', key: 'activeLoadMW', value: 18 });
    expect(state.scenarioId).toBe('custom');
    expect(state.inputMode).toBe('load');
    expect(state.i1p).toBeGreaterThan(initial.i1p);
    expect(Math.abs(state.i2p)).toBeGreaterThan(Math.abs(initial.i2p));
  });

  it('keeps Direct Current as source-of-truth when system reference data changes', () => {
    const initial = createInitialDifferentialState();
    const state = differentialStateReducer(initial, { type: 'SET_SYSTEM', key: 'activeLoadMW', value: 18 });
    expect(state.inputMode).toBe('direct');
    expect(state.i1p).toBeCloseTo(initial.i1p, 8);
    expect(state.i2p).toBeCloseTo(initial.i2p, 8);
  });

  it('switches to Direct Current when a terminal current is edited', () => {
    const state = reduce({ type: 'SET_CURRENT', side: 2, value: 600 });
    expect(state.scenarioId).toBe('custom');
    expect(state.inputMode).toBe('direct');
    expect(state.i2p).toBe(600);
  });

  it('does not mark the physical scenario Custom when only relay settings change', () => {
    const state = reduce({ type: 'SET_SETTING', key: 'slope1', value: 30 });
    expect(state.scenarioId).toBe('normal-load');
    expect(state.settings.slope1).toBe(30);
  });

  it('enabling multi-slope keeps BP3 above BP2', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'SET_SETTING', key: 'biasBreakpoint2', value: 6 });
    state = differentialStateReducer(state, { type: 'SET_CHARACTERISTIC_MODE', mode: 'multi' });
    expect(state.settings.characteristicMode).toBe('multi');
    expect(state.settings.biasBreakpoint3).toBeGreaterThan(state.settings.biasBreakpoint2);
  });

  it('restores the exact pre-fault physical state when Clear Fault is used', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'SET_CURRENT', side: 1, value: 123.4 });
    state = differentialStateReducer(state, { type: 'SET_CURRENT', side: 2, value: -456.7 });
    const beforeFault = state;

    state = differentialStateReducer(state, { type: 'SET_FAULT_MULTIPLE', value: 6 });
    state = differentialStateReducer(state, { type: 'APPLY_INTERNAL_FAULT' });
    expect(state.faultKind).toBe('internal');
    expect(state.condition.currentMultiple).toBe(6);
    expect(state.i1p).toBeGreaterThan(0);
    expect(state.i2p).toBeGreaterThan(0);

    state = differentialStateReducer(state, { type: 'CLEAR_FAULT' });
    expect(state.faultKind).toBe('none');
    expect(state.i1p).toBeCloseTo(beforeFault.i1p, 8);
    expect(state.i2p).toBeCloseTo(beforeFault.i2p, 8);
    expect(state.scenarioId).toBe(beforeFault.scenarioId);
  });

  it('reset restores canonical Normal Load and reference settings', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'SET_CURRENT', side: 1, value: 1200 });
    state = differentialStateReducer(state, { type: 'SET_SETTING', key: 'slope1', value: 35 });
    state = differentialStateReducer(state, { type: 'RESET' });
    expect(state.scenarioId).toBe('normal-load');
    expect(state.inputMode).toBe('direct');
    expect(state.settings.slope1).toBe(25);
    expect(state.settings.iSet).toBe(0.2);
    expect(state.preFault).toBeNull();
  });

  it('selecting a fault preset keeps a pre-fault state that Clear Fault can restore', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'APPLY_PRESET', presetId: 'internal-fault' });
    expect(state.faultKind).toBe('internal');
    state = differentialStateReducer(state, { type: 'CLEAR_FAULT' });
    expect(state.scenarioId).toBe('normal-load');
    expect(state.inputMode).toBe('direct');
  });
  it('keeps CT mismatch and CT measurement-error defaults in their production presets', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'APPLY_PRESET', presetId: 'ct-ratio-mismatch' });
    expect(state.ct1.priRated).toBe(100);
    expect(state.ct2.priRated).toBe(800);
    expect(state.ct2.errorPct).toBe(1);

    state = differentialStateReducer(state, { type: 'APPLY_PRESET', presetId: 'ct-measurement-error' });
    expect(state.ct2.priRated).toBe(750);
    expect(state.ct2.errorPct).toBe(4);
  });

  it('locks Input Mode while a simplified fault override is active', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'APPLY_INTERNAL_FAULT' });
    expect(state.faultKind).toBe('internal');
    expect(state.inputMode).toBe('load');

    const attempted = differentialStateReducer(state, { type: 'SET_INPUT_MODE', mode: 'direct' });
    expect(attempted).toEqual(state);

    const restored = differentialStateReducer(attempted, { type: 'CLEAR_FAULT' });
    expect(restored.inputMode).toBe('direct');
  });

});
