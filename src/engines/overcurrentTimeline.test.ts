import { describe, expect, it } from 'vitest';
import { evaluateCoordinationFaultCase } from './overcurrentCoordination';
import { calculateOvercurrentDevice } from './overcurrent';
import {
  engineeringDeltaToWallClockSec,
  evaluateOvercurrentTimeline,
  evaluateOvercurrentTimelineFrame,
} from './overcurrentTimeline';
import {
  COORD_02_THREE_RELAY_RADIAL,
  OVERCURRENT_STUDY_PRESETS,
} from '../studies/overcurrentPresets';
import type {
  CurrentProfile,
  DomainEvaluation,
  OvercurrentProtectionDevice,
  OvercurrentStudyDefinition,
  TimelineSnapshot,
} from '../types/overcurrent';

interface DeviceOptions {
  readonly delaySec?: number;
  readonly breakerSec?: number;
  readonly pickup51SecondaryA?: number;
  readonly timingMode?: 'DEFINITE' | 'INVERSE';
  readonly timeScale?: number;
  readonly enabled51?: boolean;
  readonly enabled50?: boolean;
  readonly pickup50SecondaryA?: number;
}

function device(id: string, order: number, options: DeviceOptions = {}): OvercurrentProtectionDevice {
  return {
    id,
    label: id,
    order,
    kind: 'OVERCURRENT_50_51',
    settings: {
      ct: { primaryRatedA: 1000, secondaryRatedA: 1, ratioErrorPct: 0 },
      phase51: {
        enabled: options.enabled51 ?? true,
        pickupASecondary: options.pickup51SecondaryA ?? 1,
        timingMode: options.timingMode ?? 'DEFINITE',
        inverseCurveId: 'IEC_SI',
        timeScale: options.timeScale ?? 0.1,
        definiteDelaySec: options.delaySec ?? 1,
      },
      phase50: {
        enabled: options.enabled50 ?? false,
        pickupASecondary: options.pickup50SecondaryA ?? 10,
      },
      breaker: { clearingTimeSec: options.breakerSec ?? 0.1 },
    },
  };
}

interface StudyOptions {
  readonly devices: readonly OvercurrentProtectionDevice[];
  readonly currents?: Readonly<Record<string, number>>;
  readonly profile?: CurrentProfile;
  readonly postFaultProfile?: CurrentProfile;
  readonly externalClearTimeSec?: number;
  readonly primaryDeviceId?: string;
  readonly backupDeviceIds?: readonly string[];
}

function study(options: StudyOptions): OvercurrentStudyDefinition {
  const deviceIds = options.devices.map((entry) => entry.id);
  const primaryDeviceId = options.primaryDeviceId ?? deviceIds[deviceIds.length - 1];
  const currentProfiles = [options.profile, options.postFaultProfile]
    .filter((entry): entry is CurrentProfile => entry !== undefined);
  return {
    id: 'O07-TEST',
    label: 'O07 Test Study',
    mode: options.devices.length === 1 ? 'SINGLE_RELAY' : 'COORDINATION_LAB',
    guidance: 'FREE',
    topology: {
      id: 'O07-TEST:TOPOLOGY',
      label: 'Test radial feeder',
      kind: options.devices.length === 1 ? 'SINGLE_RELAY_FEEDER' : 'RADIAL_FEEDER',
      deviceIds,
      locations: [{ id: 'F', label: 'Fault' }],
    },
    devicesById: Object.fromEntries(options.devices.map((entry) => [entry.id, entry])),
    loadCases: [],
    faultCases: [{
      id: 'F:CASE',
      label: 'Fault case',
      locationId: 'F',
      category: 'CUSTOM',
      current: options.profile
        ? { kind: 'PROFILE', profileId: options.profile.id }
        : { kind: 'STATIC', primaryCurrentAByDevice: options.currents ?? {} },
      protectionChain: {
        primaryDeviceId,
        backupDeviceIds: options.backupDeviceIds ?? [],
      },
      externalClearTimeSec: options.externalClearTimeSec,
      postFaultProfileId: options.postFaultProfile?.id,
    }],
    currentProfiles,
    faultLocationProfiles: [],
    coordinationPairs: [],
    coordinationRequirements: [],
    validationCaseIds: ['F:CASE'],
    loadSecurityCaseIds: [],
    defaultSelectedDeviceId: primaryDeviceId,
    defaultFaultCaseId: 'F:CASE',
  };
}

function timelineValue(result: DomainEvaluation<TimelineSnapshot>): TimelineSnapshot {
  if (result.status === 'INVALID') throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function runTimeline(definition: OvercurrentStudyDefinition, speed: 1 | 5 | 10 = 1): TimelineSnapshot {
  return timelineValue(evaluateOvercurrentTimeline({
    study: definition,
    faultCaseId: definition.faultCases[0].id,
    playbackSpeed: speed,
  }));
}

function eventsFor(snapshot: TimelineSnapshot, deviceId: string) {
  return snapshot.events.filter((event) => 'deviceId' in event && event.deviceId === deviceId);
}

describe('O07 pickup, trip, and static parity', () => {
  it('keeps normal current and exact 51 pickup equality below pickup', () => {
    const relay = device('R1', 1);
    const below = runTimeline(study({ devices: [relay], currents: { R1: 900 } }));
    const equal = runTimeline(study({ devices: [relay], currents: { R1: 1000 } }));

    expect(below.relays.R1).toMatchObject({ state: 'BELOW_PICKUP', tripOutputTimeSec: null, operateProgress51: 0 });
    expect(equal.relays.R1).toMatchObject({ state: 'BELOW_PICKUP', tripOutputTimeSec: null, operateProgress51: 0 });
    expect(eventsFor(equal, 'R1')).toEqual([]);
  });

  it('uses strict high-set equality and trips 50 at engineering t=0 only above it', () => {
    const relay = device('R1', 1, {
      enabled51: false,
      enabled50: true,
      pickup50SecondaryA: 3,
    });
    const equal = runTimeline(study({ devices: [relay], currents: { R1: 3000 } }));
    const above = runTimeline(study({ devices: [relay], currents: { R1: 3001 } }));

    expect(equal.relays.R1.tripOutputTimeSec).toBeNull();
    expect(above.relays.R1.tripOutputTimeSec).toBe(0);
    expect(above.events.map((event) => [event.type, event.timeSec])).toEqual([
      ['FAULT_APPLIED', 0],
      ['50_TRIP', 0],
      ['BREAKER_OPENING', 0],
      ['BREAKER_OPEN', 0.1],
      ['FAULT_ISOLATED', 0.1],
    ]);
  });

  it('gives 50 same-instant priority while preserving the preceding 51 pickup event', () => {
    const relay = device('R1', 1, {
      delaySec: 0.2,
      enabled50: true,
      pickup50SecondaryA: 3,
    });
    const timeline = runTimeline(study({ devices: [relay], currents: { R1: 4000 } }));
    expect(timeline.relays.R1.tripOutputTimeSec).toBe(0);
    expect(timeline.events.filter((event) => event.timeSec === 0).map((event) => event.type)).toEqual([
      'FAULT_APPLIED',
      '51_PICKUP',
      '50_TRIP',
      'BREAKER_OPENING',
    ]);
    expect(timeline.events.some((event) => event.type === '51_TRIP')).toBe(false);
  });

  it('keeps definite-time delay independent of picked-up current magnitude', () => {
    const relay = device('R1', 1, { delaySec: 0.5 });
    const moderate = runTimeline(study({ devices: [relay], currents: { R1: 1500 } }));
    const high = runTimeline(study({ devices: [relay], currents: { R1: 9000 } }));
    expect(moderate.relays.R1.tripOutputTimeSec).toBe(0.5);
    expect(high.relays.R1.tripOutputTimeSec).toBe(0.5);
  });

  it('matches the O03/O04 pure engine for constant inverse current', () => {
    const relay = device('R1', 1, {
      timingMode: 'INVERSE',
      pickup51SecondaryA: 0.8,
      timeScale: 0.1,
    });
    const pure = calculateOvercurrentDevice(1600, relay);
    const timeline = runTimeline(study({ devices: [relay], currents: { R1: 1600 } }));
    expect(pure.selectedElement).toBe('51');
    expect(timeline.relays.R1.tripOutputTimeSec).toBeCloseTo(pure.selectedTripTimeSec!, 12);
  });

  it('matches O06 operating element/time for every actual constant-current trip', () => {
    const faultCaseId = 'COORD-02:F3:MAX';
    const coordination = evaluateCoordinationFaultCase(COORD_02_THREE_RELAY_RADIAL, faultCaseId);
    const timeline = evaluateOvercurrentTimeline({
      study: COORD_02_THREE_RELAY_RADIAL,
      faultCaseId,
      playbackSpeed: 1,
    });
    expect(coordination.status).toBe('VALID');
    expect(timeline.status).toBe('VALID');
    if (coordination.status === 'INVALID' || timeline.status === 'INVALID') return;

    for (const relay of Object.values(timeline.value.relays)) {
      if (relay.tripOutputTimeSec === null) continue;
      const staticResult = coordination.value.deviceResults[relay.deviceId];
      expect(relay.tripOutputTimeSec).toBeCloseTo(staticResult.selectedTripTimeSec!, 12);
      const tripEvent = timeline.value.events.find((event) => (
        (event.type === '50_TRIP' || event.type === '51_TRIP') && event.deviceId === relay.deviceId
      ));
      expect(tripEvent?.type).toBe(staticResult.selectedElement === '50' ? '50_TRIP' : '51_TRIP');
    }
  });

  it('evaluates the full O05 static fault registry with pure-engine parity', () => {
    for (const preset of OVERCURRENT_STUDY_PRESETS) {
      for (const faultCase of preset.faultCases) {
        if (faultCase.current.kind !== 'STATIC') continue;
        const timeline = evaluateOvercurrentTimeline({
          study: preset,
          faultCaseId: faultCase.id,
          playbackSpeed: 1,
        });
        expect(timeline.status, `${preset.id}/${faultCase.id}`).toBe('VALID');
        if (timeline.status === 'INVALID') continue;

        for (const relay of Object.values(timeline.value.relays)) {
          if (relay.tripOutputTimeSec === null) continue;
          const pure = calculateOvercurrentDevice(
            faultCase.current.primaryCurrentAByDevice[relay.deviceId],
            preset.devicesById[relay.deviceId],
          );
          expect(relay.tripOutputTimeSec, `${faultCase.id}/${relay.deviceId}`)
            .toBeCloseTo(pure.selectedTripTimeSec!, 11);
        }
      }
    }
  });

  it('retains static pure-engine parity across a deterministic 1,000-case sweep', () => {
    let seed = 0x7a11c0de;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let index = 0; index < 1000; index += 1) {
      const relay = device('R1', 1, {
        timingMode: index % 2 === 0 ? 'INVERSE' : 'DEFINITE',
        pickup51SecondaryA: 0.4 + random() * 1.6,
        timeScale: 0.05 + random() * 1.5,
        delaySec: 0.05 + random() * 1.95,
        enabled50: index % 3 === 0,
        pickup50SecondaryA: 1.5 + random() * 6,
        breakerSec: random() * 0.25,
      });
      const primaryCurrentA = random() * 10_000;
      const pure = calculateOvercurrentDevice(primaryCurrentA, relay);
      const timeline = runTimeline(study({ devices: [relay], currents: { R1: primaryCurrentA } }));

      if (pure.selectedTripTimeSec === null) {
        expect(timeline.relays.R1.tripOutputTimeSec, `case ${index}`).toBeNull();
      } else {
        expect(timeline.relays.R1.tripOutputTimeSec, `case ${index}`)
          .toBeCloseTo(pure.selectedTripTimeSec, 11);
      }
    }
  });
});

describe('O07 current profiles and accumulated 51 progress', () => {
  it('resets immediately when a STEP profile clears before the 1.0 s trip', () => {
    const relay = device('R1', 1, { delaySec: 1 });
    const profile: CurrentProfile = {
      id: 'STEP-RESET',
      label: 'Reset before trip',
      interpolation: 'STEP',
      samples: [
        { timeSec: 0, primaryCurrentAByDevice: { R1: 2000 } },
        { timeSec: 0.4, primaryCurrentAByDevice: { R1: 0 } },
      ],
    };
    const timeline = runTimeline(study({ devices: [relay], profile }));

    expect(timeline.relays.R1).toMatchObject({ state: 'RESET', tripOutputTimeSec: null, operateProgress51: 0 });
    expect(eventsFor(timeline, 'R1').map((event) => [event.type, event.timeSec])).toEqual([
      ['51_PICKUP', 0],
      ['51_RESET', 0.4],
    ]);
  });

  it('starts a STEP timing episode at the configured profile boundary', () => {
    const relay = device('R1', 1, { delaySec: 0.5 });
    const profile: CurrentProfile = {
      id: 'STEP-UP',
      label: 'Step pickup',
      interpolation: 'STEP',
      samples: [
        { timeSec: 0, primaryCurrentAByDevice: { R1: 0 } },
        { timeSec: 0.2, primaryCurrentAByDevice: { R1: 2000 } },
      ],
    };
    const timeline = runTimeline(study({ devices: [relay], profile }));
    expect(timeline.relays.R1.tripOutputTimeSec).toBeCloseTo(0.7, 12);
    expect(eventsFor(timeline, 'R1').slice(0, 2).map((event) => [event.type, event.timeSec])).toEqual([
      ['51_PICKUP', 0.2],
      ['51_TRIP', 0.7],
    ]);
  });

  it('solves a LINEAR pickup crossing and definite-time expiry deterministically', () => {
    const relay = device('R1', 1, { delaySec: 0.25 });
    const profile: CurrentProfile = {
      id: 'LINEAR-UP',
      label: 'Linear pickup',
      interpolation: 'LINEAR',
      samples: [
        { timeSec: 0, primaryCurrentAByDevice: { R1: 0 } },
        { timeSec: 1, primaryCurrentAByDevice: { R1: 2000 } },
      ],
    };
    const timeline = runTimeline(study({ devices: [relay], profile }));
    const pickup = eventsFor(timeline, 'R1').find((event) => event.type === '51_PICKUP');
    expect(pickup?.timeSec).toBeCloseTo(0.5, 12);
    expect(timeline.relays.R1.tripOutputTimeSec).toBeCloseTo(0.75, 10);
  });

  it('integrates inverse progress over a LINEAR profile within the O01 tolerance', () => {
    const relay = device('R1', 1, { timingMode: 'INVERSE', timeScale: 0.1 });
    const profile: CurrentProfile = {
      id: 'LINEAR-INVERSE',
      label: 'Linear inverse accumulation',
      interpolation: 'LINEAR',
      samples: [
        { timeSec: 0, primaryCurrentAByDevice: { R1: 2000 } },
        { timeSec: 1, primaryCurrentAByDevice: { R1: 4000 } },
      ],
    };
    const timeline = runTimeline(study({ devices: [relay], profile }));

    // Analytic reference for IEC SI, c=0 and M(t)=2+2t:
    // Q(t) = (((2+2t)^1.02 - 2^1.02)/(2*1.02) - t) / (0.1*0.14).
    expect(timeline.relays.R1.tripOutputTimeSec).toBeCloseTo(0.7046535489622434, 9);
  });

  it('uses a fresh timing episode after drop, reset, and later rise', () => {
    const relay = device('R1', 1, { delaySec: 0.6 });
    const profile: CurrentProfile = {
      id: 'STEP-RESTART',
      label: 'Restart',
      interpolation: 'STEP',
      samples: [
        { timeSec: 0, primaryCurrentAByDevice: { R1: 2000 } },
        { timeSec: 0.4, primaryCurrentAByDevice: { R1: 0 } },
        { timeSec: 0.8, primaryCurrentAByDevice: { R1: 2000 } },
      ],
    };
    const timeline = runTimeline(study({ devices: [relay], profile }));
    expect(eventsFor(timeline, 'R1').slice(0, 4).map((event) => [event.type, event.timeSec])).toEqual([
      ['51_PICKUP', 0],
      ['51_RESET', 0.4],
      ['51_PICKUP', 0.8],
      ['51_TRIP', 1.4],
    ]);
    expect(timeline.relays.R1.tripOutputTimeSec).toBeCloseTo(1.4, 12);
  });
});

describe('O07 breaker, isolation, backup, and tie ordering', () => {
  it('keeps backup timing through primary clearing and resets it only at isolation', () => {
    const backup = device('B', 1, { delaySec: 0.55 });
    const primary = device('P', 2, { delaySec: 0.3, breakerSec: 0.1 });
    const timeline = runTimeline(study({
      devices: [backup, primary],
      currents: { B: 2000, P: 2000 },
      primaryDeviceId: 'P',
      backupDeviceIds: ['B'],
    }));

    expect(timeline.relays.P).toMatchObject({ tripOutputTimeSec: 0.3, breakerOpenTimeSec: 0.4 });
    expect(timeline.relays.B).toMatchObject({ tripOutputTimeSec: null, operateProgress51: 0, state: 'RESET' });
    expect(eventsFor(timeline, 'B').map((event) => [event.type, event.timeSec])).toEqual([
      ['51_PICKUP', 0],
      ['51_RESET', 0.4],
    ]);
  });

  it('retains a backup trip and its scheduled opening when it trips before isolation', () => {
    const backup = device('B', 1, { delaySec: 0.4, breakerSec: 0.2 });
    const primary = device('P', 2, { delaySec: 0.3, breakerSec: 0.15 });
    const timeline = runTimeline(study({
      devices: [backup, primary],
      currents: { B: 2000, P: 2000 },
      primaryDeviceId: 'P',
      backupDeviceIds: ['B'],
    }));

    expect(timeline.relays.P).toMatchObject({ tripOutputTimeSec: 0.3, breakerOpenTimeSec: 0.45 });
    expect(timeline.relays.B).toMatchObject({ tripOutputTimeSec: 0.4, breakerOpenTimeSec: 0.6 });
    expect(timeline.events).toContainEqual(expect.objectContaining({ type: 'FAULT_ISOLATED', timeSec: 0.45, clearingDeviceId: 'P' }));
    expect(timeline.engineeringTimeSec).toBe(0.6);
  });

  it('processes zero clearing as trip, opening, open, then isolation at one timestamp', () => {
    const primary = device('P', 1, { delaySec: 0.3, breakerSec: 0 });
    const timeline = runTimeline(study({ devices: [primary], currents: { P: 2000 } }));
    expect(timeline.events.filter((event) => event.timeSec === 0.3).map((event) => event.type)).toEqual([
      '51_TRIP',
      'BREAKER_OPENING',
      'BREAKER_OPEN',
      'FAULT_ISOLATED',
    ]);
  });

  it('uses stable device order for simultaneous trips and breaker opens', () => {
    const backup = device('B', 1, { delaySec: 0.3, breakerSec: 0.1 });
    const primary = device('P', 2, { delaySec: 0.3, breakerSec: 0.1 });
    const timeline = runTimeline(study({
      devices: [backup, primary],
      currents: { B: 2000, P: 2000 },
      primaryDeviceId: 'P',
      backupDeviceIds: ['B'],
    }));
    const trips = timeline.events.filter((event) => event.type === '51_TRIP');
    const openings = timeline.events.filter((event) => event.type === 'BREAKER_OPEN');
    expect(trips.map((event) => 'deviceId' in event && event.deviceId)).toEqual(['B', 'P']);
    expect(openings.map((event) => 'deviceId' in event && event.deviceId)).toEqual(['B', 'P']);
  });
});

describe('O07 external clear, safety, genericity, and playback separation', () => {
  it('applies an external post-fault profile before same-time 51 completion', () => {
    const relay = device('R1', 1, { delaySec: 0.4 });
    const postFaultProfile: CurrentProfile = {
      id: 'POST-ZERO',
      label: 'Post clear zero',
      interpolation: 'STEP',
      samples: [{ timeSec: 0, primaryCurrentAByDevice: { R1: 0 } }],
    };
    const timeline = runTimeline(study({
      devices: [relay],
      currents: { R1: 2000 },
      externalClearTimeSec: 0.4,
      postFaultProfile,
    }));

    expect(timeline.relays.R1).toMatchObject({ tripOutputTimeSec: null, operateProgress51: 0, state: 'RESET' });
    expect(timeline.events.filter((event) => event.timeSec === 0.4).map((event) => event.type)).toEqual([
      'CURRENT_PROFILE_CHANGED',
      'FAULT_ISOLATED',
      '51_RESET',
    ]);
  });

  it('rejects an external clear without explicit post-fault current metadata', () => {
    const relay = device('R1', 1);
    const result = evaluateOvercurrentTimeline({
      study: study({ devices: [relay], currents: { R1: 2000 }, externalClearTimeSec: 0.4 }),
      faultCaseId: 'F:CASE',
      playbackSpeed: 1,
    });
    expect(result).toEqual(expect.objectContaining({ status: 'INVALID' }));
    if (result.status === 'INVALID') expect(result.issues).toContainEqual(expect.objectContaining({ code: 'MISSING_REFERENCE' }));
  });

  it('rejects a non-finite profile without throwing', () => {
    const relay = device('R1', 1);
    const profile: CurrentProfile = {
      id: 'INVALID',
      label: 'Invalid profile',
      interpolation: 'STEP',
      samples: [{ timeSec: 0, primaryCurrentAByDevice: { R1: Number.NaN } }],
    };
    const run = () => evaluateOvercurrentTimeline({
      study: study({ devices: [relay], profile }),
      faultCaseId: 'F:CASE',
      playbackSpeed: 1,
    });
    expect(run).not.toThrow();
    const result = run();
    expect(result.status).toBe('INVALID');
    if (result.status === 'INVALID') expect(result.issues.some((entry) => entry.code === 'NON_FINITE_INPUT')).toBe(true);
  });

  it('is structurally deterministic across repeated runs', () => {
    const relay = device('R1', 1, { timingMode: 'INVERSE' });
    const definition = study({ devices: [relay], currents: { R1: 2500 } });
    const first = evaluateOvercurrentTimeline({ study: definition, faultCaseId: 'F:CASE', playbackSpeed: 1 });
    const second = evaluateOvercurrentTimeline({ study: definition, faultCaseId: 'F:CASE', playbackSpeed: 1 });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('supports a generic four-relay radial chain without hard-coded IDs', () => {
    const relays = [
      device('UPSTREAM', 1, { delaySec: 0.8, breakerSec: 0.5 }),
      device('MID_A', 2, { delaySec: 0.6, breakerSec: 0.5 }),
      device('MID_B', 3, { delaySec: 0.4, breakerSec: 0.5 }),
      device('FEEDER', 4, { delaySec: 0.2, breakerSec: 0.5 }),
    ];
    const timeline = runTimeline(study({
      devices: relays,
      currents: Object.fromEntries(relays.map((entry) => [entry.id, 2000])),
      primaryDeviceId: 'FEEDER',
      backupDeviceIds: ['MID_B', 'MID_A', 'UPSTREAM'],
    }));
    expect(Object.keys(timeline.relays)).toEqual(relays.map((entry) => entry.id));
    expect(timeline.events.filter((event) => event.type === '51_TRIP').map((event) => (
      'deviceId' in event ? event.deviceId : null
    ))).toEqual(['FEEDER', 'MID_B', 'MID_A']);
    expect(timeline.relays.UPSTREAM).toMatchObject({ state: 'RESET', tripOutputTimeSec: null });
  });

  it('keeps engineering results speed-independent and maps only wall-clock delta', () => {
    const relay = device('R1', 1, { delaySec: 0.5 });
    const definition = study({ devices: [relay], currents: { R1: 2000 } });
    const at1x = runTimeline(definition, 1);
    const at5x = runTimeline(definition, 5);
    const at10x = runTimeline(definition, 10);
    expect(at5x).toEqual(at1x);
    expect(at10x).toEqual(at1x);
    expect(engineeringDeltaToWallClockSec(10, 1)).toEqual({ status: 'VALID', value: 10 });
    expect(engineeringDeltaToWallClockSec(10, 5)).toEqual({ status: 'VALID', value: 2 });
    expect(engineeringDeltaToWallClockSec(10, 10)).toEqual({ status: 'VALID', value: 1 });
  });
});

describe('O07 timeline frame COMPLETE tolerance', () => {
  function frameValue(result: ReturnType<typeof evaluateOvercurrentTimelineFrame>) {
    if (result.status !== 'VALID') throw new Error(`Expected VALID but got ${result.status}: ${result.issues?.map((i) => i.detail).join(', ')}`);
    return result.value;
  }

  // 0.3s definite delay + 0.1s breaker clearing → engineeringTimeSec = 0.4
  const relay = device('R1', 1, { delaySec: 0.3, breakerSec: 0.1 });
  const definition = study({ devices: [relay], currents: { R1: 2000 } });
  const timeline = runTimeline(definition);
  const endTimeSec = timeline.engineeringTimeSec;

  it('honors COMPLETE when engineeringTimeSec is within tolerance of endTimeSec', () => {
    // endTimeSec - 1e-12 is within TIME_EPS_FACTOR (1e-10) tolerance of endTimeSec
    const frame = frameValue(evaluateOvercurrentTimelineFrame({
      study: definition,
      faultCaseId: definition.faultCases[0].id,
      playbackSpeed: 1,
      engineeringTimeSec: endTimeSec - 1e-12,
      playbackState: 'COMPLETE',
    }));
    expect(frame.playbackState).toBe('COMPLETE');
  });

  it('returns RUNNING when engineeringTimeSec is well below endTimeSec', () => {
    const frame = frameValue(evaluateOvercurrentTimelineFrame({
      study: definition,
      faultCaseId: definition.faultCases[0].id,
      playbackSpeed: 1,
      engineeringTimeSec: 0.1,
      playbackState: 'COMPLETE',
    }));
    expect(frame.playbackState).toBe('RUNNING');
  });

  it('returns COMPLETE at exact endTimeSec with COMPLETE request', () => {
    const frame = frameValue(evaluateOvercurrentTimelineFrame({
      study: definition,
      faultCaseId: definition.faultCases[0].id,
      playbackSpeed: 1,
      engineeringTimeSec: endTimeSec,
      playbackState: 'COMPLETE',
    }));
    expect(frame.playbackState).toBe('COMPLETE');
  });
});
