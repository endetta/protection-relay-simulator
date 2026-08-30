import { describe, expect, it } from 'vitest';
import { calculateDifferential } from '../engines/differential';
import { applyCT } from '../engines/measurementChain';
import { calculateSystemDerived } from '../engines/systemModel';
import { createInitialDifferentialState, differentialStateReducer } from './differentialState';
import { evaluateDifferentialSimulation } from './evaluateDifferentialSimulation';

function expectInvalidWithoutThrow(mutator: (state: ReturnType<typeof createInitialDifferentialState>) => void) {
  const state = createInitialDifferentialState();
  mutator(state);
  expect(() => evaluateDifferentialSimulation(state)).not.toThrow();
  const evaluated = evaluateDifferentialSimulation(state);
  expect(evaluated.ok).toBe(false);
}

describe('release-hardening evaluation boundary', () => {
  it('evaluates the canonical initial state', () => {
    const evaluated = evaluateDifferentialSimulation(createInitialDifferentialState());
    expect(evaluated.ok).toBe(true);
    if (evaluated.ok) expect(evaluated.value.result.decision).toBe('RESTRAIN');
  });

  it('converts differential-current overflow into INVALID instead of throwing', () => {
    expectInvalidWithoutThrow((state) => {
      state.i1p = 1e308;
      state.i2p = 1e308;
      state.ct1 = { priRated: 1, secRated: 1, errorPct: 0 };
      state.ct2 = { priRated: 1, secRated: 1, errorPct: 0 };
    });
  });

  it('converts system-derived overflow into INVALID instead of throwing', () => {
    expectInvalidWithoutThrow((state) => {
      state.system.activeLoadMW = 1e308;
      state.system.powerFactor = 0.1;
    });
  });

  it('converts CT arithmetic overflow into INVALID instead of throwing', () => {
    expectInvalidWithoutThrow((state) => {
      state.i1p = 1e308;
      state.ct1 = { priRated: 1, secRated: 5, errorPct: 10 };
    });
  });

  it('keeps the strict engines strict when derived arithmetic is non-finite', () => {
    expect(() => calculateSystemDerived({
      transformerRatingMVA: 25,
      side1KV: 150,
      side2KV: 20,
      activeLoadMW: 1e308,
      powerFactor: 0.1,
    })).toThrow(RangeError);
    expect(() => applyCT(1e308, { priRated: 1, secRated: 5, errorPct: 10 })).toThrow(RangeError);
    expect(() => calculateDifferential({
      i1: 1e308,
      i2: 1e308,
      iSet: 0.2,
      biasBreakpoint1: 0.5,
      slope1: 25,
      biasBreakpoint2: 2,
      slope2: 50,
      characteristicMode: 'dual',
      biasBreakpoint3: 5,
      slope3: 80,
    })).toThrow(RangeError);
  });

  it('does not throw from Load Driven reducer updates that overflow', () => {
    let state = createInitialDifferentialState();
    state = differentialStateReducer(state, { type: 'SET_INPUT_MODE', mode: 'load' });
    expect(() => {
      state = differentialStateReducer(state, { type: 'SET_SYSTEM', key: 'activeLoadMW', value: 1e308 });
    }).not.toThrow();
    expect(evaluateDifferentialSimulation(state).ok).toBe(false);
  });
});
