import type {
  CoordinationPair,
  CoordinationRequirement,
  CTIBudget,
  CurrentProfile,
  DevicePrimaryCurrentMap,
  FaultCase,
  FaultLocationProfile,
  LoadCase,
  OvercurrentProtectionDevice,
  OvercurrentStudyDefinition,
  StudyLearningMetadata,
  StudyPresetId,
  StudyTopology,
} from '../types/overcurrent';
import { validateOvercurrentStudyDefinition } from './overcurrentStudy';

const CTI_BUDGET_030: CTIBudget = {
  breakerAllowanceSec: 0.10,
  relayTimingAllowanceSec: 0.05,
  studySafetyMarginSec: 0.15,
};

function currentMap(entries: Readonly<Record<string, number>>): DevicePrimaryCurrentMap {
  return { ...entries };
}

function makeDevice(
  id: string,
  order: number,
  options: {
    pickup51?: number;
    curve?: OvercurrentProtectionDevice['settings']['phase51']['inverseCurveId'];
    timeScale?: number;
    timingMode?: OvercurrentProtectionDevice['settings']['phase51']['timingMode'];
    definiteDelaySec?: number;
    enabled50?: boolean;
    pickup50?: number;
    ctErrorPct?: number;
    breakerClearingSec?: number;
  } = {},
): OvercurrentProtectionDevice {
  return {
    id,
    label: id,
    order,
    kind: 'OVERCURRENT_50_51',
    settings: {
      ct: {
        primaryRatedA: 1000,
        secondaryRatedA: 1,
        ratioErrorPct: options.ctErrorPct ?? 0,
      },
      phase51: {
        enabled: true,
        pickupASecondary: options.pickup51 ?? 0.8,
        timingMode: options.timingMode ?? 'INVERSE',
        inverseCurveId: options.curve ?? 'IEC_SI',
        timeScale: options.timeScale ?? 0.10,
        definiteDelaySec: options.definiteDelaySec ?? 0.50,
      },
      phase50: {
        enabled: options.enabled50 ?? false,
        pickupASecondary: options.pickup50 ?? 3.0,
      },
      breaker: {
        clearingTimeSec: options.breakerClearingSec ?? 0.10,
      },
    },
  };
}

function loadCase(id: string, label: string, currents: DevicePrimaryCurrentMap, category: LoadCase['category'] = 'MAXIMUM'): LoadCase {
  return { id, label, category, current: { kind: 'STATIC', primaryCurrentAByDevice: currents } };
}

function singleTopology(id: string): StudyTopology {
  return {
    id: `${id}:TOPOLOGY`,
    label: 'Single Relay Feeder',
    kind: 'SINGLE_RELAY_FEEDER',
    deviceIds: ['R1'],
    locations: [{ id: 'F1', label: 'Protected Feeder', normalizedPosition: 0.75 }],
  };
}

function singleLearning(title: string): StudyLearningMetadata {
  return {
    objective: {
      title,
      requirementKeys: ['SENSITIVITY', 'SELECTIVITY', 'TIME_GRADING', 'INSTANTANEOUS_REACH', 'LOAD_SECURITY'],
    },
    hints: [],
  };
}

interface SinglePresetOptions {
  readonly id: StudyPresetId;
  readonly label: string;
  readonly primaryCurrentA?: number;
  readonly device?: OvercurrentProtectionDevice;
  readonly externalClearTimeSec?: number;
  readonly postFaultProfile?: CurrentProfile;
  readonly noFault?: boolean;
  readonly objective: string;
}

function singleRelayPreset(options: SinglePresetOptions): OvercurrentStudyDefinition {
  const device = options.device ?? makeDevice('R1', 1);
  const faultCaseId = `${options.id}:CASE`;
  const baseLoad = loadCase(`${options.id}:LOAD`, 'Reference Load', currentMap({ R1: 600 }), 'MAXIMUM');
  const faultCases: FaultCase[] = options.noFault || options.primaryCurrentA === undefined
    ? []
    : [{
      id: faultCaseId,
      label: options.label,
      locationId: 'F1',
      category: 'CUSTOM',
      current: { kind: 'STATIC', primaryCurrentAByDevice: currentMap({ R1: options.primaryCurrentA }) },
      protectionChain: { primaryDeviceId: 'R1', backupDeviceIds: [] },
      externalClearTimeSec: options.externalClearTimeSec,
      postFaultProfileId: options.postFaultProfile?.id,
    }];

  return {
    id: options.id,
    label: options.label,
    mode: 'SINGLE_RELAY',
    guidance: 'GUIDED',
    topology: singleTopology(options.id),
    devicesById: { R1: device },
    loadCases: [baseLoad],
    faultCases,
    currentProfiles: options.postFaultProfile ? [options.postFaultProfile] : [],
    faultLocationProfiles: [],
    coordinationPairs: [],
    coordinationRequirements: [],
    validationCaseIds: faultCases.map((faultCase) => faultCase.id),
    loadSecurityCaseIds: [baseLoad.id],
    defaultSelectedDeviceId: 'R1',
    defaultLoadCaseId: baseLoad.id,
    defaultFaultCaseId: faultCases[0]?.id,
    learning: singleLearning(options.objective),
  };
}

export const OVC_01_NORMAL_LOAD = singleRelayPreset({
  id: 'OVC-01',
  label: 'Normal Load',
  noFault: true,
  objective: 'Observe a healthy load current below 51 pickup.',
});

export const OVC_02_NEAR_PICKUP = singleRelayPreset({
  id: 'OVC-02',
  label: 'Near Pickup',
  primaryCurrentA: 808,
  objective: 'Observe how inverse operating time becomes very long just above pickup.',
});

export const OVC_03_MODERATE_OVERCURRENT = singleRelayPreset({
  id: 'OVC-03',
  label: 'Moderate Overcurrent',
  primaryCurrentA: 1600,
  objective: 'Observe normal 51 inverse timing at two times pickup.',
});

export const OVC_04_HIGH_FAULT = singleRelayPreset({
  id: 'OVC-04',
  label: 'High Fault Current',
  primaryCurrentA: 4000,
  objective: 'Compare faster inverse operation at a larger current multiple.',
});

export const OVC_05_INSTANTANEOUS_FAULT = singleRelayPreset({
  id: 'OVC-05',
  label: 'Instantaneous Fault',
  primaryCurrentA: 4000,
  device: makeDevice('R1', 1, { enabled50: true, pickup50: 3.0 }),
  objective: 'Observe 50 high-set priority while the theoretical 51 result remains available.',
});

export const OVC_06_DEFINITE_TIME = singleRelayPreset({
  id: 'OVC-06',
  label: 'Definite Time',
  primaryCurrentA: 1600,
  device: makeDevice('R1', 1, { timingMode: 'DEFINITE', definiteDelaySec: 0.50 }),
  objective: 'Compare fixed 51 delay against inverse-time behavior.',
});

const OVC_07_POST_CLEAR: CurrentProfile = {
  id: 'OVC-07:POST_CLEAR',
  label: 'Post-Clear Current',
  interpolation: 'STEP',
  samples: [{ timeSec: 0, primaryCurrentAByDevice: currentMap({ R1: 0 }) }],
};

export const OVC_07_CLEARS_BEFORE_TRIP = singleRelayPreset({
  id: 'OVC-07',
  label: 'Fault Clears Before Trip',
  primaryCurrentA: 1600,
  externalClearTimeSec: 0.40,
  postFaultProfile: OVC_07_POST_CLEAR,
  objective: 'Observe pickup and timing followed by reset when current clears before 51 trip.',
});

export const OVC_08_CT_MEASUREMENT_ERROR = singleRelayPreset({
  id: 'OVC-08',
  label: 'CT Measurement Error',
  primaryCurrentA: 780,
  device: makeDevice('R1', 1, { ctErrorPct: 5 }),
  objective: 'Observe how CT measurement error can move relay current across pickup.',
});

function pair(
  id: string,
  locationId: string,
  primaryDeviceId: string,
  backupDeviceId: string,
  backupOrder: number,
): CoordinationPair {
  return { id, locationId, primaryDeviceId, backupDeviceId, backupOrder };
}

function requirement(id: string, pairId: string): CoordinationRequirement {
  return {
    id,
    pairId,
    requiredCtiSec: 0.30,
    budget: CTI_BUDGET_030,
  };
}

function fault(
  id: string,
  label: string,
  locationId: string,
  category: FaultCase['category'],
  currents: DevicePrimaryCurrentMap,
  primaryDeviceId: string,
  backupDeviceIds: readonly string[],
): FaultCase {
  return {
    id,
    label,
    locationId,
    category,
    current: { kind: 'STATIC', primaryCurrentAByDevice: currents },
    protectionChain: { primaryDeviceId, backupDeviceIds },
  };
}

function twoRelayFaultCases(): FaultCase[] {
  return [
    fault('COORD-01:F1:MIN', 'F1 Minimum Fault', 'F1', 'MIN', currentMap({ R1: 6000, R2: 0 }), 'R1', []),
    fault('COORD-01:F1:NOM', 'F1 Nominal Fault', 'F1', 'NOMINAL', currentMap({ R1: 8000, R2: 0 }), 'R1', []),
    fault('COORD-01:F1:MAX', 'F1 Maximum Fault', 'F1', 'MAX', currentMap({ R1: 10000, R2: 0 }), 'R1', []),
    fault('COORD-01:F2:MIN', 'F2 Minimum Fault', 'F2', 'MIN', currentMap({ R1: 2500, R2: 2500 }), 'R2', ['R1']),
    fault('COORD-01:F2:NOM', 'F2 Nominal Fault', 'F2', 'NOMINAL', currentMap({ R1: 4000, R2: 4000 }), 'R2', ['R1']),
    fault('COORD-01:F2:MAX', 'F2 Maximum Fault', 'F2', 'MAX', currentMap({ R1: 6000, R2: 6000 }), 'R2', ['R1']),
  ];
}

const COORD_01_PAIR = pair('COORD-01:F2:R2-R1', 'F2', 'R2', 'R1', 1);

const COORD_01_SCRUBBER: FaultLocationProfile = {
  id: 'COORD-01:SCRUBBER',
  label: 'Configured Radial Fault Study Profile',
  interpolation: 'LINEAR',
  samples: [
    { normalizedPosition: 0.30, primaryCurrentAByDevice: currentMap({ R1: 10000, R2: 0 }) },
    // Configured topology transition: R2 is out of the current path upstream
    // of F2, then both in-series relays see the same through-fault current.
    { normalizedPosition: 0.499, primaryCurrentAByDevice: currentMap({ R1: 8000, R2: 0 }) },
    { normalizedPosition: 0.50, primaryCurrentAByDevice: currentMap({ R1: 7000, R2: 7000 }) },
    { normalizedPosition: 0.80, primaryCurrentAByDevice: currentMap({ R1: 6000, R2: 6000 }) },
    { normalizedPosition: 0.95, primaryCurrentAByDevice: currentMap({ R1: 5000, R2: 5000 }) },
  ],
  segments: [
    { startPosition: 0.30, endPosition: 0.50, locationId: 'F1', protectionChain: { primaryDeviceId: 'R1', backupDeviceIds: [] } },
    { startPosition: 0.50, endPosition: 0.95, locationId: 'F2', protectionChain: { primaryDeviceId: 'R2', backupDeviceIds: ['R1'] } },
  ],
};

export const COORD_01_TWO_RELAY_TIME_GRADING: OvercurrentStudyDefinition = {
  id: 'COORD-01',
  label: 'Two Relay Time Grading',
  mode: 'COORDINATION_LAB',
  guidance: 'GUIDED',
  topology: {
    id: 'COORD-01:TOPOLOGY',
    label: 'Two Relay Radial Feeder',
    kind: 'RADIAL_FEEDER',
    deviceIds: ['R1', 'R2'],
    locations: [
      { id: 'F1', label: 'Upstream Fault', normalizedPosition: 0.35 },
      { id: 'F2', label: 'Downstream Fault', normalizedPosition: 0.80 },
    ],
  },
  devicesById: {
    R1: makeDevice('R1', 1, { pickup51: 1.00, curve: 'IEC_VI', timeScale: 0.18 }),
    R2: makeDevice('R2', 2, { pickup51: 0.80, curve: 'IEC_VI', timeScale: 0.10 }),
  },
  loadCases: [loadCase('COORD-01:LOAD:MAX', 'Maximum Load', currentMap({ R1: 600, R2: 600 }))],
  faultCases: twoRelayFaultCases(),
  currentProfiles: [],
  faultLocationProfiles: [COORD_01_SCRUBBER],
  coordinationPairs: [COORD_01_PAIR],
  coordinationRequirements: [requirement('COORD-01:REQ:R2-R1', COORD_01_PAIR.id)],
  validationCaseIds: ['COORD-01:F1:MIN', 'COORD-01:F1:MAX', 'COORD-01:F2:MIN', 'COORD-01:F2:MAX'],
  loadSecurityCaseIds: ['COORD-01:LOAD:MAX'],
  defaultSelectedDeviceId: 'R2',
  defaultLoadCaseId: 'COORD-01:LOAD:MAX',
  defaultFaultCaseId: 'COORD-01:F2:MAX',
  learning: {
    objective: {
      title: 'Coordinate the downstream R2 primary with upstream R1 backup for all configured cases.',
      requirementKeys: ['SENSITIVITY', 'SELECTIVITY', 'TIME_GRADING', 'LOAD_SECURITY'],
    },
    hints: [
      { level: 'LOCATION', text: 'Inspect the R2 → R1 relationship for downstream fault F2.', faultCaseId: 'COORD-01:F2:MAX', pairId: COORD_01_PAIR.id },
      { level: 'PARAMETER_FAMILY', text: 'The intentional initial issue is primarily a time-grading problem.', pairId: COORD_01_PAIR.id },
      { level: 'DIRECTION', text: 'The upstream backup must operate later relative to the downstream primary.', pairId: COORD_01_PAIR.id, deviceId: 'R1' },
    ],
    completionNotes: ['Verify both minimum and maximum downstream-fault study cases before accepting the setting.'],
  },
};

function threeRelayFaultCases(prefix = 'COORD-02'): FaultCase[] {
  return [
    fault(`${prefix}:F1:MIN`, 'F1 Minimum Fault', 'F1', 'MIN', currentMap({ R1: 6000, R2: 0, R3: 0 }), 'R1', []),
    fault(`${prefix}:F1:NOM`, 'F1 Nominal Fault', 'F1', 'NOMINAL', currentMap({ R1: 8000, R2: 0, R3: 0 }), 'R1', []),
    fault(`${prefix}:F1:MAX`, 'F1 Maximum Fault', 'F1', 'MAX', currentMap({ R1: 10000, R2: 0, R3: 0 }), 'R1', []),
    fault(`${prefix}:F2:MIN`, 'F2 Minimum Fault', 'F2', 'MIN', currentMap({ R1: 4000, R2: 4000, R3: 0 }), 'R2', ['R1']),
    fault(`${prefix}:F2:NOM`, 'F2 Nominal Fault', 'F2', 'NOMINAL', currentMap({ R1: 6000, R2: 6000, R3: 0 }), 'R2', ['R1']),
    fault(`${prefix}:F2:MAX`, 'F2 Maximum Fault', 'F2', 'MAX', currentMap({ R1: 8000, R2: 8000, R3: 0 }), 'R2', ['R1']),
    fault(`${prefix}:F3:MIN`, 'F3 Minimum Fault', 'F3', 'MIN', currentMap({ R1: 2500, R2: 2500, R3: 2500 }), 'R3', ['R2', 'R1']),
    fault(`${prefix}:F3:NOM`, 'F3 Nominal Fault', 'F3', 'NOMINAL', currentMap({ R1: 4000, R2: 4000, R3: 4000 }), 'R3', ['R2', 'R1']),
    fault(`${prefix}:F3:MAX`, 'F3 Maximum Fault', 'F3', 'MAX', currentMap({ R1: 6000, R2: 6000, R3: 6000 }), 'R3', ['R2', 'R1']),
  ];
}

function threeRelayTopology(prefix: string): StudyTopology {
  return {
    id: `${prefix}:TOPOLOGY`,
    label: 'Three Relay Radial Feeder',
    kind: 'RADIAL_FEEDER',
    deviceIds: ['R1', 'R2', 'R3'],
    locations: [
      { id: 'F1', label: 'Upstream Fault', normalizedPosition: 0.25 },
      { id: 'F2', label: 'Middle Fault', normalizedPosition: 0.55 },
      { id: 'F3', label: 'Downstream Fault', normalizedPosition: 0.85 },
    ],
  };
}

function threeRelayPairs(prefix: string): CoordinationPair[] {
  return [
    pair(`${prefix}:F2:R2-R1`, 'F2', 'R2', 'R1', 1),
    pair(`${prefix}:F3:R3-R2`, 'F3', 'R3', 'R2', 1),
    pair(`${prefix}:F3:R2-R1`, 'F3', 'R2', 'R1', 2),
  ];
}

function threeRelayScrubber(prefix: string): FaultLocationProfile {
  return {
    id: `${prefix}:SCRUBBER`,
    label: 'Configured Three-Relay Fault Study Profile',
    interpolation: 'LINEAR',
    samples: [
      { normalizedPosition: 0.20, primaryCurrentAByDevice: currentMap({ R1: 10000, R2: 0, R3: 0 }) },
      // Close sample pairs model configured radial-path transitions without
      // pretending the scrubber is a network short-circuit solver.
      { normalizedPosition: 0.349, primaryCurrentAByDevice: currentMap({ R1: 9000, R2: 0, R3: 0 }) },
      { normalizedPosition: 0.35, primaryCurrentAByDevice: currentMap({ R1: 8500, R2: 8500, R3: 0 }) },
      { normalizedPosition: 0.649, primaryCurrentAByDevice: currentMap({ R1: 7500, R2: 7500, R3: 0 }) },
      { normalizedPosition: 0.65, primaryCurrentAByDevice: currentMap({ R1: 7000, R2: 7000, R3: 7000 }) },
      { normalizedPosition: 0.80, primaryCurrentAByDevice: currentMap({ R1: 6200, R2: 6200, R3: 6200 }) },
      { normalizedPosition: 0.95, primaryCurrentAByDevice: currentMap({ R1: 5000, R2: 5000, R3: 5000 }) },
    ],
    segments: [
      { startPosition: 0.20, endPosition: 0.35, locationId: 'F1', protectionChain: { primaryDeviceId: 'R1', backupDeviceIds: [] } },
      { startPosition: 0.35, endPosition: 0.65, locationId: 'F2', protectionChain: { primaryDeviceId: 'R2', backupDeviceIds: ['R1'] } },
      { startPosition: 0.65, endPosition: 0.95, locationId: 'F3', protectionChain: { primaryDeviceId: 'R3', backupDeviceIds: ['R2', 'R1'] } },
    ],
  };
}

type ThreeRelayChallengeKind =
  | 'TIME_GRADING'
  | 'PICKUP_AND_TIME'
  | 'CURVE_SELECTION'
  | 'INSTANTANEOUS'
  | 'FULL_COORDINATION';

function threeRelayLearning(
  id: StudyPresetId,
  kind: ThreeRelayChallengeKind,
): StudyLearningMetadata {
  const commonRequirements = [
    'SENSITIVITY',
    'SELECTIVITY',
    'TIME_GRADING',
    'INSTANTANEOUS_REACH',
    'LOAD_SECURITY',
    'BACKUP_AVAILABILITY',
  ] as const;

  switch (kind) {
    case 'PICKUP_AND_TIME':
      return {
        objective: {
          title: 'Restore minimum-fault sensitivity while preserving load security and three-relay time grading.',
          requirementKeys: commonRequirements,
        },
        hints: [
          { level: 'LOCATION', text: 'Inspect R3 at F3 minimum fault, then compare the R3 → R2 margin at F3 maximum fault.', faultCaseId: `${id}:F3:MIN`, deviceId: 'R3' },
          { level: 'PARAMETER_FAMILY', text: 'The intentional problem spans the downstream 51 pickup window and the adjacent 51 time-grading relationship.', pairId: `${id}:F3:R3-R2`, deviceId: 'R3' },
          { level: 'DIRECTION', text: 'Keep downstream pickup below the configured minimum fault but above maximum load, while ensuring the upstream backup operates later than the downstream primary.', pairId: `${id}:F3:R3-R2`, deviceId: 'R2' },
        ],
        completionNotes: ['Confirm both the pickup window and all configured CTI checks with Run Coordination Test.'],
      };
    case 'CURVE_SELECTION':
      return {
        objective: {
          title: 'Coordinate the three-relay feeder by selecting a 51 characteristic shape that remains selective across the configured fault-current range.',
          requirementKeys: commonRequirements,
        },
        hints: [
          { level: 'LOCATION', text: 'Inspect the R3 → R2 relationship at the downstream F3 maximum-fault case.', faultCaseId: `${id}:F3:MAX`, pairId: `${id}:F3:R3-R2` },
          { level: 'PARAMETER_FAMILY', text: 'The intentional issue is associated with the R2 inverse-time characteristic shape, not CT ratio or breaker clearing time.', pairId: `${id}:F3:R3-R2`, deviceId: 'R2' },
          { level: 'DIRECTION', text: 'Choose a characteristic that keeps R2 sufficiently delayed at the high-current downstream case while preserving grading at the other configured cases.', pairId: `${id}:F3:R3-R2`, deviceId: 'R2' },
        ],
        completionNotes: ['A curve name is not the objective; any valid setting outcome that passes the complete configured study is acceptable.'],
      };
    case 'INSTANTANEOUS':
      return {
        objective: {
          title: 'Maintain three-relay 51 grading while preventing upstream 50 overreach.',
          requirementKeys: commonRequirements,
        },
        hints: [
          { level: 'LOCATION', text: 'Inspect R2 instantaneous reach for downstream F3 maximum fault.', faultCaseId: `${id}:F3:MAX`, deviceId: 'R2' },
          { level: 'PARAMETER_FAMILY', text: 'The violation is in the instantaneous high-set element rather than the 51 time curve.', deviceId: 'R2' },
          { level: 'DIRECTION', text: 'The upstream instantaneous element must not operate for the configured downstream fault unless the study explicitly permits it.', deviceId: 'R2' },
        ],
        completionNotes: ['Validate both instantaneous reach and the underlying 51 grading across all configured MIN/MAX cases.'],
      };
    case 'FULL_COORDINATION':
      return {
        objective: {
          title: 'Resolve the combined pickup, time-grading, and instantaneous-reach issues and verify the complete three-relay coordination study.',
          requirementKeys: commonRequirements,
        },
        hints: [
          { level: 'LOCATION', text: 'Start at downstream F3: compare its minimum-fault sensitivity with the maximum-fault R3 → R2 operating sequence.', faultCaseId: `${id}:F3:MIN`, pairId: `${id}:F3:R3-R2` },
          { level: 'PARAMETER_FAMILY', text: 'More than one setting family is involved: 51 pickup, 51 timing, and upstream 50 reach all affect the configured failures.', pairId: `${id}:F3:R3-R2`, deviceId: 'R2' },
          { level: 'DIRECTION', text: 'Restore the downstream pickup window, preserve delayed upstream backup timing, and keep backup instantaneous reach outside the configured downstream fault.', pairId: `${id}:F3:R3-R2`, deviceId: 'R2' },
        ],
        completionNotes: ['Do not accept one corrected operating point as proof; the capstone completes only after the entire configured validation registry passes.'],
      };
    case 'TIME_GRADING':
    default:
      return {
        objective: {
          title: 'Coordinate R3 → R2 → R1 for all configured radial fault cases.',
          requirementKeys: commonRequirements,
        },
        hints: [
          { level: 'LOCATION', text: 'Inspect the R3 → R2 margin at F3 maximum fault.', faultCaseId: `${id}:F3:MAX`, pairId: `${id}:F3:R3-R2` },
          { level: 'PARAMETER_FAMILY', text: 'The intentional initial issue is a time-grading problem.', pairId: `${id}:F3:R3-R2` },
          { level: 'DIRECTION', text: 'R2 should operate later relative to downstream primary R3.', pairId: `${id}:F3:R3-R2`, deviceId: 'R2' },
        ],
        completionNotes: ['Run the configured MIN/MAX validation registry; one visible operating point is not sufficient proof of coordination.'],
      };
  }
}

function makeThreeRelayStudy(options: {
  readonly id: StudyPresetId;
  readonly label: string;
  readonly r2TimeScale: number;
  readonly r2Curve?: OvercurrentProtectionDevice['settings']['phase51']['inverseCurveId'];
  readonly r3Pickup51?: number;
  readonly r2Instantaneous?: { enabled: boolean; pickupASecondary: number };
  readonly challengeKind?: ThreeRelayChallengeKind;
  readonly guidance?: 'GUIDED' | 'FREE';
}): OvercurrentStudyDefinition {
  const pairs = threeRelayPairs(options.id);
  return {
    id: options.id,
    label: options.label,
    mode: 'COORDINATION_LAB',
    guidance: options.guidance ?? 'GUIDED',
    topology: threeRelayTopology(options.id),
    devicesById: {
      R1: makeDevice('R1', 1, { pickup51: 1.20, curve: 'IEC_VI', timeScale: 0.35 }),
      R2: makeDevice('R2', 2, {
        pickup51: 1.00,
        curve: options.r2Curve ?? 'IEC_VI',
        timeScale: options.r2TimeScale,
        enabled50: options.r2Instantaneous?.enabled ?? false,
        pickup50: options.r2Instantaneous?.pickupASecondary ?? 5.0,
      }),
      R3: makeDevice('R3', 3, { pickup51: options.r3Pickup51 ?? 0.80, curve: 'IEC_VI', timeScale: 0.10 }),
    },
    loadCases: [loadCase(`${options.id}:LOAD:MAX`, 'Maximum Load', currentMap({ R1: 600, R2: 600, R3: 600 }))],
    faultCases: threeRelayFaultCases(options.id),
    currentProfiles: [],
    faultLocationProfiles: [threeRelayScrubber(options.id)],
    coordinationPairs: pairs,
    coordinationRequirements: pairs.map((item) => requirement(`${options.id}:REQ:${item.locationId}:${item.primaryDeviceId}-${item.backupDeviceId}`, item.id)),
    validationCaseIds: [
      `${options.id}:F1:MIN`, `${options.id}:F1:MAX`,
      `${options.id}:F2:MIN`, `${options.id}:F2:MAX`,
      `${options.id}:F3:MIN`, `${options.id}:F3:MAX`,
    ],
    loadSecurityCaseIds: [`${options.id}:LOAD:MAX`],
    defaultSelectedDeviceId: 'R3',
    defaultLoadCaseId: `${options.id}:LOAD:MAX`,
    defaultFaultCaseId: `${options.id}:F3:MAX`,
    learning: threeRelayLearning(options.id, options.challengeKind ?? 'TIME_GRADING'),
  };
}

export const COORD_02_THREE_RELAY_RADIAL = makeThreeRelayStudy({
  id: 'COORD-02',
  label: 'Three Relay Radial',
  r2TimeScale: 0.18,
  challengeKind: 'TIME_GRADING',
});

/** O13 pickup-window + timing challenge. */
export const COORD_03_PICKUP_AND_TIME = makeThreeRelayStudy({
  id: 'COORD-03',
  label: 'Pickup + Time',
  r2TimeScale: 0.18,
  r3Pickup51: 2.60,
  challengeKind: 'PICKUP_AND_TIME',
});

/** O13 curve-shape challenge: initial R2 IEC EI intentionally loses F3 high-current grading. */
export const COORD_04_CURVE_SELECTION = makeThreeRelayStudy({
  id: 'COORD-04',
  label: 'Curve Selection',
  r2TimeScale: 0.19,
  r2Curve: 'IEC_EI',
  challengeKind: 'CURVE_SELECTION',
});

/** O01 §30 / O13 instantaneous-overreach challenge. */
export const COORD_05_INSTANTANEOUS_COORDINATION = makeThreeRelayStudy({
  id: 'COORD-05',
  label: 'Instantaneous Coordination',
  r2TimeScale: 0.19,
  r2Instantaneous: { enabled: true, pickupASecondary: 5.0 },
  challengeKind: 'INSTANTANEOUS',
});

/** O13 capstone with simultaneous sensitivity, grading, and upstream-50 reach issues. */
export const COORD_06_FULL_COORDINATION = makeThreeRelayStudy({
  id: 'COORD-06',
  label: 'Full Coordination Study',
  r2TimeScale: 0.18,
  r3Pickup51: 2.60,
  r2Instantaneous: { enabled: true, pickupASecondary: 5.0 },
  challengeKind: 'FULL_COORDINATION',
});

export const OVERCURRENT_STUDY_PRESETS = [
  OVC_01_NORMAL_LOAD,
  OVC_02_NEAR_PICKUP,
  OVC_03_MODERATE_OVERCURRENT,
  OVC_04_HIGH_FAULT,
  OVC_05_INSTANTANEOUS_FAULT,
  OVC_06_DEFINITE_TIME,
  OVC_07_CLEARS_BEFORE_TRIP,
  OVC_08_CT_MEASUREMENT_ERROR,
  COORD_01_TWO_RELAY_TIME_GRADING,
  COORD_02_THREE_RELAY_RADIAL,
  COORD_03_PICKUP_AND_TIME,
  COORD_04_CURVE_SELECTION,
  COORD_05_INSTANTANEOUS_COORDINATION,
  COORD_06_FULL_COORDINATION,
] as const satisfies readonly OvercurrentStudyDefinition[];

export const OVERCURRENT_STUDY_PRESET_REGISTRY: Readonly<Record<StudyPresetId, OvercurrentStudyDefinition>> =
  Object.fromEntries(OVERCURRENT_STUDY_PRESETS.map((preset) => [preset.id, preset]));

export function getOvercurrentStudyPreset(id: StudyPresetId): OvercurrentStudyDefinition | undefined {
  return OVERCURRENT_STUDY_PRESET_REGISTRY[id];
}

export function listOvercurrentStudyPresets(): readonly OvercurrentStudyDefinition[] {
  return OVERCURRENT_STUDY_PRESETS;
}

export function validateOvercurrentPresetRegistry(): readonly string[] {
  const errors: string[] = [];
  const ids = OVERCURRENT_STUDY_PRESETS.map((preset) => preset.id);
  if (new Set(ids).size !== ids.length) errors.push('Preset IDs must be unique.');
  for (const preset of OVERCURRENT_STUDY_PRESETS) {
    const validation = validateOvercurrentStudyDefinition(preset);
    if (validation.status === 'INVALID') {
      errors.push(...validation.issues.map((item) => `${preset.id}: ${item.path ?? item.code}: ${item.detail ?? item.code}`));
    }
  }
  return errors;
}
