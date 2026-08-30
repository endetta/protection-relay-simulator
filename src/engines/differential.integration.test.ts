import { describe, expect, it } from 'vitest';
import { calculateDifferential } from './differential';
import { applyCT } from './measurementChain';
import { DEFAULT_SETTINGS, PRESETS } from '../utils/presets';
import { differentialStateReducer, createInitialDifferentialState } from '../utils/differentialState';

describe('Differential production preset integration', () => {
  for (const preset of PRESETS) {
    it(`${preset.label} -> ${preset.expectedUnderReferenceSettings}`, () => {
      const i1 = applyCT(preset.i1p, preset.ct1);
      const i2 = applyCT(preset.i2p, preset.ct2);
      const result = calculateDifferential({ i1, i2, ...DEFAULT_SETTINGS });
      expect(result.decision).toBe(preset.expectedUnderReferenceSettings);
    });
  }

  it('Normal Load produces matched CT-secondary currents from unequal transformer-side primary currents', () => {
    const preset = PRESETS.find((item) => item.id === 'normal-load');
    expect(preset).toBeDefined();
    if (!preset) return;
    const i1 = applyCT(preset.i1p, preset.ct1);
    const i2 = applyCT(preset.i2p, preset.ct2);
    expect(Math.abs(preset.i1p)).not.toBeCloseTo(Math.abs(preset.i2p), 4);
    expect(i1).toBeCloseTo(-i2, 8);
  });

  it('CT Ratio Mismatch creates spill current while remaining restrained', () => {
    const preset = PRESETS.find((item) => item.id === 'ct-ratio-mismatch');
    expect(preset).toBeDefined();
    if (!preset) return;
    const result = calculateDifferential({
      i1: applyCT(preset.i1p, preset.ct1),
      i2: applyCT(preset.i2p, preset.ct2),
      ...DEFAULT_SETTINGS,
    });
    expect(result.iDiff).toBeGreaterThan(0);
    expect(result.iDiff).toBeLessThan(result.iOpLimit);
    expect(result.decision).toBe('RESTRAIN');
  });
});

describe('Load Driven current-source propagation', () => {
  it('changes measured CT current when Sload changes after Load Driven is selected', () => {
    const initial = createInitialDifferentialState();
    const loadDriven = differentialStateReducer(initial, { type: 'SET_INPUT_MODE', mode: 'load' });
    const beforeI1s = applyCT(loadDriven.i1p, loadDriven.ct1);
    const beforeI2s = applyCT(loadDriven.i2p, loadDriven.ct2);

    const changed = differentialStateReducer(loadDriven, { type: 'SET_SYSTEM', key: 'activeLoadMW', value: 18 });
    const afterI1s = applyCT(changed.i1p, changed.ct1);
    const afterI2s = applyCT(changed.i2p, changed.ct2);

    expect(afterI1s).toBeGreaterThan(beforeI1s);
    expect(Math.abs(afterI2s)).toBeGreaterThan(Math.abs(beforeI2s));
  });

  it('changes measured CT current when Sn changes during an external fault because fault current is × Irated', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'APPLY_PRESET', presetId: 'ct-measurement-error' });
    const beforeI1s = applyCT(state.i1p, state.ct1);
    const beforeI2s = applyCT(state.i2p, state.ct2);

    state = differentialStateReducer(state, { type: 'SET_SYSTEM', key: 'transformerRatingMVA', value: 30 });
    const afterI1s = applyCT(state.i1p, state.ct1);
    const afterI2s = applyCT(state.i2p, state.ct2);

    expect(afterI1s).toBeGreaterThan(beforeI1s);
    expect(Math.abs(afterI2s)).toBeGreaterThan(Math.abs(beforeI2s));
  });

  it('keeps fault CT current independent of Sload while the explicit × Irated fault condition is active', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'APPLY_PRESET', presetId: 'ct-measurement-error' });
    const beforeI1s = applyCT(state.i1p, state.ct1);
    const beforeI2s = applyCT(state.i2p, state.ct2);

    state = differentialStateReducer(state, { type: 'SET_SYSTEM', key: 'activeLoadMW', value: 18 });
    const afterI1s = applyCT(state.i1p, state.ct1);
    const afterI2s = applyCT(state.i2p, state.ct2);

    expect(afterI1s).toBeCloseTo(beforeI1s, 8);
    expect(afterI2s).toBeCloseTo(beforeI2s, 8);
  });
});
