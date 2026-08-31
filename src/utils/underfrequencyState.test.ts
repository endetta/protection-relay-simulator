import { describe, expect, it } from 'vitest';
import type { UnderfrequencySimulatorState } from '../types/underfrequency';
import {
  createInitialUnderfrequencyState,
  underfrequencyReducer,
  type UnderfrequencyAction,
} from './underfrequencyState';

function reduce(state: UnderfrequencySimulatorState, action: UnderfrequencyAction): UnderfrequencySimulatorState {
  return underfrequencyReducer(state, action);
}

describe('UFR Underfrequency parameter state', () => {
  it('starts from the canonical UFR-01 preset', () => {
    const state = createInitialUnderfrequencyState();
    expect(state.presetId).toBe('UFR-01');
    expect(state.playbackState).toBe('IDLE');
    expect(state.simulationSpeed).toBe(1);
    expect(state.scrubTimeSec).toBeNull();
    expect(state.modified).toBe(false);
  });

  it('stores SET_SCRUB_TIME as a number', () => {
    const state = createInitialUnderfrequencyState();
    const after = reduce(state, { type: 'SET_SCRUB_TIME', timeSec: 12.5 });
    expect(after.scrubTimeSec).toBe(12.5);
    expect(after.playbackState).toBe('IDLE');
  });

  it('stores SET_SCRUB_TIME as null', () => {
    const state = createInitialUnderfrequencyState();
    const withTime = reduce(state, { type: 'SET_SCRUB_TIME', timeSec: 12.5 });
    const after = reduce(withTime, { type: 'SET_SCRUB_TIME', timeSec: null });
    expect(after.scrubTimeSec).toBeNull();
  });

  it('ignores non-finite SET_SCRUB_TIME', () => {
    const state = createInitialUnderfrequencyState();
    const afterNaN = reduce(state, { type: 'SET_SCRUB_TIME', timeSec: NaN });
    expect(afterNaN.scrubTimeSec).toBeNull();
    const afterInf = reduce(state, { type: 'SET_SCRUB_TIME', timeSec: Infinity });
    expect(afterInf.scrubTimeSec).toBeNull();
  });

  it('resets scrubTimeSec on RESET', () => {
    const state = createInitialUnderfrequencyState();
    const withTime = reduce(state, { type: 'SET_SCRUB_TIME', timeSec: 5 });
    const after = reduce(withTime, { type: 'RESET' });
    expect(after.scrubTimeSec).toBeNull();
  });

  it('resets scrubTimeSec on APPLY_PRESET', () => {
    const state = createInitialUnderfrequencyState();
    const withTime = reduce(state, { type: 'SET_SCRUB_TIME', timeSec: 5 });
    const after = reduce(withTime, { type: 'APPLY_PRESET', presetId: 'UFR-02' });
    expect(after.scrubTimeSec).toBeNull();
  });

  it('resets scrubTimeSec on CLEAR_RUN', () => {
    const state = createInitialUnderfrequencyState();
    const running = reduce(state, { type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    const withTime = reduce(running, { type: 'SET_SCRUB_TIME', timeSec: 5 });
    const after = reduce(withTime, { type: 'CLEAR_RUN' });
    expect(after.scrubTimeSec).toBeNull();
    expect(after.playbackState).toBe('IDLE');
  });

  it('resets scrubTimeSec on any engineering mutation (flagModified path)', () => {
    const state = createInitialUnderfrequencyState();
    const withTime = reduce(state, { type: 'SET_SCRUB_TIME', timeSec: 5 });
    const after = reduce(withTime, { type: 'SET_SYSTEM', patch: { baseLoadMw: 1500 } });
    expect(after.scrubTimeSec).toBeNull();
    expect(after.modified).toBe(true);
  });
});
