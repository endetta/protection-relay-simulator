import { describe, expect, it } from 'vitest';
import { evaluateOvercurrentTimeline } from '../engines/overcurrentTimeline';
import {
  canBeginOvercurrentFaultRun,
  evaluateActiveOvercurrentParameters,
} from '../utils/evaluateOvercurrentParameters';
import {
  createInitialOvercurrentParameterState,
  overcurrentParameterReducer,
  type OvercurrentParameterState,
} from '../utils/overcurrentState';
import {
  buildOvercurrentSldModel,
  chooseFaultCaseForLocation,
} from './overcurrentSld';

function reduce(
  state: OvercurrentParameterState,
  action: Parameters<typeof overcurrentParameterReducer>[1],
): OvercurrentParameterState {
  return overcurrentParameterReducer(state, action);
}

describe('O09 Overcurrent SLD presentation model', () => {
  it('builds the canonical single-relay load feeder from active O08 state', () => {
    const state = createInitialOvercurrentParameterState('OVC-01');
    const model = buildOvercurrentSldModel(state);

    expect(model.status).toBe('VALID');
    expect(model.devices).toHaveLength(1);
    expect(model.devices[0]).toMatchObject({
      id: 'R1',
      selected: true,
      role: 'OTHER',
      primaryCurrentA: 600,
      carriesCurrent: true,
      breakerState: 'CLOSED',
    });
    expect(model.activeLocationId).toBeNull();
    expect(model.currentPathActive).toBe(true);
    expect(model.currentPathEnd).toBe(1);
    expect(model.scrubber).toBeNull();
  });

  it('derives F3 primary and ordered backup roles from the explicit protection chain', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const model = buildOvercurrentSldModel(state);

    expect(model.activeLocationId).toBe('F3');
    expect(model.activeFaultPosition).toBeCloseTo(0.85, 12);
    expect(model.protectionChain).toEqual({ primaryDeviceId: 'R3', backupDeviceIds: ['R2', 'R1'] });
    expect(model.devices.map((device) => [device.id, device.role, device.backupOrder, device.primaryCurrentA])).toEqual([
      ['R1', 'BACKUP', 2, 6000],
      ['R2', 'BACKUP', 1, 6000],
      ['R3', 'PRIMARY', null, 6000],
    ]);
    expect(model.faults.find((fault) => fault.id === 'F3')?.active).toBe(true);
  });

  it('preserves the active fault-current category when selecting another SLD location', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    expect(chooseFaultCaseForLocation(state, 'F2')).toBe('COORD-02:F2:MAX');
    expect(chooseFaultCaseForLocation(state, 'F1')).toBe('COORD-02:F1:MAX');

    const f2 = reduce(state, { type: 'SELECT_FAULT_CASE', faultCaseId: 'COORD-02:F2:MIN' });
    expect(chooseFaultCaseForLocation(f2, 'F3')).toBe('COORD-02:F3:MIN');
  });

  it('uses the approved configured profile resolver for scrubber current and role changes', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, {
      type: 'SET_FAULT_LOCATION_POSITION',
      profileId: 'COORD-02:SCRUBBER',
      normalizedPosition: 0.8,
    });

    expect(state.activeFaultCaseId).toBeNull();
    expect(state.faultLocationSelection).toEqual({
      profileId: 'COORD-02:SCRUBBER',
      normalizedPosition: 0.8,
    });
    expect(canBeginOvercurrentFaultRun(state)).toBe(false);
    const active = evaluateActiveOvercurrentParameters(state);
    expect(active.status).toBe('VALID');
    if (active.status !== 'VALID') throw new Error('Expected valid configured profile evaluation.');
    expect(active.value.source).toMatchObject({
      kind: 'FAULT_PROFILE',
      locationId: 'F3',
      normalizedPosition: 0.8,
    });
    expect(active.value.primaryCurrentAByDevice).toEqual({ R1: 6200, R2: 6200, R3: 6200 });

    const model = buildOvercurrentSldModel(state);
    expect(model.activeFaultPosition).toBe(0.8);
    expect(model.protectionChain).toEqual({ primaryDeviceId: 'R3', backupDeviceIds: ['R2', 'R1'] });
    expect(model.devices.find((device) => device.id === 'R3')?.role).toBe('PRIMARY');

    const reset = reduce(state, { type: 'RESET' });
    expect(reset.activeFaultCaseId).toBe('COORD-02:F3:MAX');
    expect(reset.faultLocationSelection).toBeNull();
  });

  it('locks fault-location changes during a deterministic O07 run', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = reduce(state, { type: 'BEGIN_FAULT_RUN' });
    expect(state.playbackState).toBe('RUNNING');
    const attempted = reduce(state, {
      type: 'SET_FAULT_LOCATION_POSITION',
      profileId: 'COORD-02:SCRUBBER',
      normalizedPosition: 0.8,
    });
    expect(attempted).toBe(state);
    expect(attempted.activeFaultCaseId).toBe('COORD-02:F3:MAX');
    expect(attempted.faultLocationSelection).toBeNull();
  });

  it('rejects invalid or out-of-range scrubber actions without changing state', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    expect(reduce(state, {
      type: 'SET_FAULT_LOCATION_POSITION',
      profileId: 'COORD-02:SCRUBBER',
      normalizedPosition: 1.2,
    })).toBe(state);
    expect(reduce(state, {
      type: 'SET_FAULT_LOCATION_POSITION',
      profileId: 'UNKNOWN',
      normalizedPosition: 0.5,
    })).toBe(state);
  });

  it('maps the authoritative O07 final snapshot to breaker-open and fault-isolated state', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const timeline = evaluateOvercurrentTimeline({
      study: state.studyDefinition,
      faultCaseId: state.activeFaultCaseId!,
      playbackSpeed: 1,
    });
    expect(timeline.status).toBe('VALID');
    if (timeline.status !== 'VALID') throw new Error('Expected valid canonical O07 timeline.');

    const model = buildOvercurrentSldModel(state, timeline.value);
    expect(model.faultIsolated).toBe(true);
    expect(model.currentPathActive).toBe(false);
    expect(model.devices.find((device) => device.id === 'R3')?.breakerState).toBe('OPEN');
    expect(model.devices.find((device) => device.id === 'R2')?.breakerState).toBe('CLOSED');
  });

  it('ignores a stale timeline snapshot after the selected fault case changes', () => {
    const f3 = createInitialOvercurrentParameterState('COORD-02');
    const timeline = evaluateOvercurrentTimeline({
      study: f3.studyDefinition,
      faultCaseId: f3.activeFaultCaseId!,
      playbackSpeed: 1,
    });
    expect(timeline.status).toBe('VALID');
    if (timeline.status !== 'VALID') throw new Error('Expected valid canonical O07 timeline.');

    const f2 = reduce(f3, { type: 'SELECT_FAULT_CASE', faultCaseId: 'COORD-02:F2:MAX' });
    const model = buildOvercurrentSldModel(f2, timeline.value);
    expect(model.activeLocationId).toBe('F2');
    expect(model.faultIsolated).toBe(false);
    expect(model.devices.every((device) => device.breakerState === 'CLOSED')).toBe(true);
  });

  it('contains invalid engineering state without emitting false diagram current', () => {
    const valid = createInitialOvercurrentParameterState('COORD-02');
    const invalid = reduce(valid, {
      type: 'SET_DEVICE_CT',
      deviceId: 'R2',
      key: 'primaryRatedA',
      value: 0,
    });
    const model = buildOvercurrentSldModel(invalid);
    expect(model.status).toBe('INVALID');
    expect(model.currentPathActive).toBe(false);
    expect(model.devices.every((device) => device.primaryCurrentA === null)).toBe(true);
    expect(model.issues.length).toBeGreaterThan(0);
  });
});
