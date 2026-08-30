import { describe, expect, it } from 'vitest';
import { evaluateOvercurrentTimelineFrame } from '../engines/overcurrentTimeline';
import {
  COORD_02_THREE_RELAY_RADIAL,
  OVC_05_INSTANTANEOUS_FAULT,
  OVC_07_CLEARS_BEFORE_TRIP,
} from '../studies/overcurrentPresets';
import type { CurrentProfile, OvercurrentProtectionDevice, OvercurrentStudyDefinition } from '../types/overcurrent';
import { createInitialOvercurrentParameterState, overcurrentParameterReducer } from '../utils/overcurrentState';
import {
  buildOvercurrentOperatingSequenceModel,
  createOvercurrentOperatingSequencePlan,
} from './overcurrentOperatingSequence';

function stateFor(presetId: string, faultCaseId?: string) {
  let state = createInitialOvercurrentParameterState(presetId);
  if (faultCaseId && state.activeFaultCaseId !== faultCaseId) {
    state = overcurrentParameterReducer(state, { type: 'SELECT_FAULT_CASE', faultCaseId });
  }
  return state;
}

function makeDevice(id: string, order: number): OvercurrentProtectionDevice {
  return {
    id,
    label: id,
    order,
    kind: 'OVERCURRENT_50_51',
    settings: {
      ct: { primaryRatedA: 1000, secondaryRatedA: 1, ratioErrorPct: 0 },
      phase51: { enabled: true, pickupASecondary: 1, timingMode: 'DEFINITE', inverseCurveId: 'IEC_SI', timeScale: 0.1, definiteDelaySec: 1 },
      phase50: { enabled: false, pickupASecondary: 10 },
      breaker: { clearingTimeSec: 0.1 },
    },
  };
}

function linearStudy(): OvercurrentStudyDefinition {
  const relay = makeDevice('R1', 1);
  const profile: CurrentProfile = {
    id: 'LINEAR',
    label: 'Linear current',
    interpolation: 'LINEAR',
    samples: [
      { timeSec: 0, primaryCurrentAByDevice: { R1: 0 } },
      { timeSec: 1, primaryCurrentAByDevice: { R1: 2000 } },
    ],
  };
  return {
    id: 'O11-LINEAR',
    label: 'O11 Linear',
    mode: 'SINGLE_RELAY',
    guidance: 'FREE',
    topology: { id: 'T', label: 'T', kind: 'SINGLE_RELAY_FEEDER', deviceIds: ['R1'], locations: [{ id: 'F', label: 'F' }] },
    devicesById: { R1: relay },
    loadCases: [],
    faultCases: [{ id: 'F:CASE', label: 'F', locationId: 'F', category: 'CUSTOM', current: { kind: 'PROFILE', profileId: 'LINEAR' }, protectionChain: { primaryDeviceId: 'R1', backupDeviceIds: [] } }],
    currentProfiles: [profile],
    faultLocationProfiles: [],
    coordinationPairs: [],
    coordinationRequirements: [],
    validationCaseIds: ['F:CASE'],
    loadSecurityCaseIds: [],
    defaultSelectedDeviceId: 'R1',
    defaultFaultCaseId: 'F:CASE',
  };
}

describe('O11 timeline frame projection', () => {
  it('shows concurrent timing, primary trip, breaker clearing, and backup reset at isolation', () => {
    const state = stateFor('COORD-02', 'COORD-02:F3:MAX');
    const plan = createOvercurrentOperatingSequencePlan(state);
    expect(plan.status).toBe('VALID');
    if (plan.status === 'INVALID') return;

    const during = buildOvercurrentOperatingSequenceModel({ ...state, playbackState: 'RUNNING' }, 0.25, plan);
    const primary = during.rows.find((row) => row.deviceId === 'R3');
    const backup = during.rows.find((row) => row.deviceId === 'R2');
    expect(primary?.state).toBe('BREAKER_OPENING');
    expect(backup?.state).toBe('51_TIMING');
    expect(backup?.operateProgress51).toBeGreaterThan(0);

    const isolation = plan.value.completedTimeline.events.find((event) => event.type === 'FAULT_ISOLATED');
    expect(isolation).toBeDefined();
    const after = buildOvercurrentOperatingSequenceModel({ ...state, playbackState: 'RUNNING' }, (isolation?.timeSec ?? 0) + 1e-6, plan);
    expect(after.faultIsolated).toBe(true);
    expect(after.rows.find((row) => row.deviceId === 'R2')).toMatchObject({ state: 'RESET', operateProgress51: 0 });
    expect(after.rows.find((row) => row.deviceId === 'R1')).toMatchObject({ state: 'RESET', operateProgress51: 0 });
  });

  it('preserves 50 zero-second trip while breaker clearing remains a later event', () => {
    const state = stateFor(OVC_05_INSTANTANEOUS_FAULT.id);
    const modelAtZero = buildOvercurrentOperatingSequenceModel({ ...state, playbackState: 'RUNNING' }, 0);
    expect(modelAtZero.rows[0]).toMatchObject({ selectedElement: '50', actualTripOutputTimeSec: 0, state: 'BREAKER_OPENING' });
    expect(modelAtZero.globalStatusLabel).toBe('BREAKER CLEARING');
    const complete = buildOvercurrentOperatingSequenceModel({ ...state, playbackState: 'COMPLETE' }, 999);
    expect(complete.faultIsolated).toBe(true);
  });

  it('shows progress before an external clear then resets without a trip', () => {
    const state = stateFor(OVC_07_CLEARS_BEFORE_TRIP.id);
    const before = buildOvercurrentOperatingSequenceModel({ ...state, playbackState: 'RUNNING' }, 0.2);
    expect(before.rows[0].state).toBe('51_TIMING');
    expect(before.rows[0].operateProgress51).toBeGreaterThan(0);
    const after = buildOvercurrentOperatingSequenceModel({ ...state, playbackState: 'RUNNING' }, 0.4);
    expect(after.rows[0]).toMatchObject({ state: 'RESET', actualTripOutputTimeSec: null, operateProgress51: 0 });
    expect(after.faultIsolated).toBe(true);
  });

  it('uses O07 engine progress for LINEAR profiles rather than linear UI interpolation', () => {
    const definition = linearStudy();
    const frame = evaluateOvercurrentTimelineFrame({ study: definition, faultCaseId: 'F:CASE', playbackSpeed: 1, engineeringTimeSec: 0.6 });
    expect(frame.status).toBe('VALID');
    if (frame.status === 'INVALID') return;
    // Pickup is at 0.5 s; definite-time progress is 0.1 / 1.0 at t=0.6.
    expect(frame.value.relays.R1.state).toBe('51_TIMING');
    expect(frame.value.relays.R1.operateProgress51).toBeCloseTo(0.1, 9);
  });

  it('keeps frame engineering output independent of 1x/5x/10x playback choice', () => {
    const frames = ([1, 5, 10] as const).map((speed) => evaluateOvercurrentTimelineFrame({
      study: COORD_02_THREE_RELAY_RADIAL,
      faultCaseId: 'COORD-02:F3:MAX',
      playbackSpeed: speed,
      engineeringTimeSec: 0.25,
    }));
    expect(frames.every((entry) => entry.status === 'VALID')).toBe(true);
    expect(JSON.stringify(frames[1])).toBe(JSON.stringify(frames[0]));
    expect(JSON.stringify(frames[2])).toBe(JSON.stringify(frames[0]));
  });
});
