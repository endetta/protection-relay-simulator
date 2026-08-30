import { describe, expect, it } from 'vitest';
import type { OvercurrentStudyDefinition } from '../types/overcurrent';
import {
  getCoordinationPairsForLocation,
  initializeOvercurrentSimulatorState,
  resolveCurrentProfileAtTime,
  resolveFaultCaseCurrents,
  resolveFaultLocationStudy,
  resolveLoadCaseCurrents,
  validateOvercurrentStudyDefinition,
} from './overcurrentStudy';
import {
  COORD_01_TWO_RELAY_TIME_GRADING,
  COORD_02_THREE_RELAY_RADIAL,
  OVERCURRENT_STUDY_PRESETS,
  getOvercurrentStudyPreset,
  validateOvercurrentPresetRegistry,
} from './overcurrentPresets';

describe('O05 preset registry', () => {
  it('contains only structurally valid study definitions', () => {
    expect(validateOvercurrentPresetRegistry()).toEqual([]);
    for (const preset of OVERCURRENT_STUDY_PRESETS) {
      expect(validateOvercurrentStudyDefinition(preset).status).toBe('VALID');
    }
  });

  it('registers the O01 single-relay suite and canonical coordination studies', () => {
    expect(OVERCURRENT_STUDY_PRESETS.map((preset) => preset.id)).toEqual([
      'OVC-01', 'OVC-02', 'OVC-03', 'OVC-04', 'OVC-05', 'OVC-06', 'OVC-07', 'OVC-08',
      'COORD-01', 'COORD-02', 'COORD-03', 'COORD-04', 'COORD-05', 'COORD-06',
    ]);
    expect(getOvercurrentStudyPreset('COORD-02')).toBe(COORD_02_THREE_RELAY_RADIAL);
  });
});

describe('O05 current-study resolution', () => {
  it('resolves explicit static fault and load cases without hidden defaults', () => {
    const fault = resolveFaultCaseCurrents(COORD_02_THREE_RELAY_RADIAL, 'COORD-02:F3:MAX');
    expect(fault).toEqual({ status: 'VALID', value: { R1: 6000, R2: 6000, R3: 6000 } });

    const load = resolveLoadCaseCurrents(COORD_02_THREE_RELAY_RADIAL, 'COORD-02:LOAD:MAX');
    expect(load).toEqual({ status: 'VALID', value: { R1: 600, R2: 600, R3: 600 } });
  });

  it('supports deterministic STEP and LINEAR current profiles', () => {
    const step = {
      id: 'P-STEP', label: 'Step', interpolation: 'STEP' as const,
      samples: [
        { timeSec: 0, primaryCurrentAByDevice: { R1: 100 } },
        { timeSec: 1, primaryCurrentAByDevice: { R1: 300 } },
      ],
    };
    expect(resolveCurrentProfileAtTime(step, 0.5)).toEqual({ status: 'VALID', value: { R1: 100 } });
    const stepWithInternalBoundary = {
      ...step,
      samples: [...step.samples, { timeSec: 2, primaryCurrentAByDevice: { R1: 500 } }],
    };
    expect(resolveCurrentProfileAtTime(stepWithInternalBoundary, 1)).toEqual({ status: 'VALID', value: { R1: 300 } });

    const linear = { ...step, id: 'P-LINEAR', interpolation: 'LINEAR' as const };
    expect(resolveCurrentProfileAtTime(linear, 0.5)).toEqual({ status: 'VALID', value: { R1: 200 } });
    expect(resolveCurrentProfileAtTime(linear, 5)).toEqual({ status: 'VALID', value: { R1: 300 } });
  });
});

describe('O05 fault-location study profile', () => {
  it('interpolates configured current data and changes explicit protection zone metadata', () => {
    const f1 = resolveFaultLocationStudy(COORD_02_THREE_RELAY_RADIAL, 'COORD-02:SCRUBBER', 0.30);
    const f2 = resolveFaultLocationStudy(COORD_02_THREE_RELAY_RADIAL, 'COORD-02:SCRUBBER', 0.50);
    const f3 = resolveFaultLocationStudy(COORD_02_THREE_RELAY_RADIAL, 'COORD-02:SCRUBBER', 0.80);

    expect(f1.status).toBe('VALID');
    expect(f1.status === 'VALID' && f1.value.locationId).toBe('F1');
    expect(f2.status === 'VALID' && f2.value.protectionChain?.primaryDeviceId).toBe('R2');
    expect(f3.status === 'VALID' && f3.value.protectionChain?.backupDeviceIds).toEqual(['R2', 'R1']);
  });

  it('rejects scrubber extrapolation outside configured study samples', () => {
    expect(resolveFaultLocationStudy(COORD_02_THREE_RELAY_RADIAL, 'COORD-02:SCRUBBER', 0.05).status).toBe('INVALID');
    expect(resolveFaultLocationStudy(COORD_02_THREE_RELAY_RADIAL, 'COORD-02:SCRUBBER', 1.1).status).toBe('INVALID');
  });
});

describe('O05 primary/backup metadata and initialization', () => {
  it('keeps adjacent coordination tiers explicit at F3', () => {
    expect(getCoordinationPairsForLocation(COORD_02_THREE_RELAY_RADIAL, 'F3')).toEqual([
      expect.objectContaining({ primaryDeviceId: 'R3', backupDeviceId: 'R2', backupOrder: 1 }),
      expect.objectContaining({ primaryDeviceId: 'R2', backupDeviceId: 'R1', backupOrder: 2 }),
    ]);
  });

  it('initializes mutable state only from explicit preset defaults', () => {
    const initialized = initializeOvercurrentSimulatorState(COORD_01_TWO_RELAY_TIME_GRADING);
    expect(initialized.status).toBe('VALID');
    if (initialized.status === 'VALID') {
      expect(initialized.value.selectedDeviceId).toBe('R2');
      expect(initialized.value.activeLoadCaseId).toBe('COORD-01:LOAD:MAX');
      expect(initialized.value.activeFaultCaseId).toBe('COORD-01:F2:MAX');
      expect(initialized.value.initialSnapshot?.selectedFaultCaseId).toBe('COORD-01:F2:MAX');
      expect(initialized.value.playbackState).toBe('IDLE');
    }
  });
});

describe('O05 study-definition hardening', () => {
  it('rejects a CTI budget that does not reconcile to its authoritative CTI', () => {
    const broken: OvercurrentStudyDefinition = {
      ...COORD_01_TWO_RELAY_TIME_GRADING,
      coordinationRequirements: COORD_01_TWO_RELAY_TIME_GRADING.coordinationRequirements.map((requirement) => ({
        ...requirement,
        budget: { breakerAllowanceSec: 0.1, relayTimingAllowanceSec: 0.05, studySafetyMarginSec: 0.05 },
      })),
    };
    expect(validateOvercurrentStudyDefinition(broken).status).toBe('INVALID');
  });

  it('rejects hidden/missing per-device study current data', () => {
    const original = COORD_01_TWO_RELAY_TIME_GRADING.faultCases[0];
    const broken: OvercurrentStudyDefinition = {
      ...COORD_01_TWO_RELAY_TIME_GRADING,
      faultCases: [
        { ...original, current: { kind: 'STATIC', primaryCurrentAByDevice: { R1: 6000 } } },
        ...COORD_01_TWO_RELAY_TIME_GRADING.faultCases.slice(1),
      ],
    };
    expect(validateOvercurrentStudyDefinition(broken).status).toBe('INVALID');
  });

  it('rejects a backup chain that moves downstream instead of upstream', () => {
    const source = COORD_02_THREE_RELAY_RADIAL.faultCases.find((faultCase) => faultCase.id === 'COORD-02:F3:MAX')!;
    const broken: OvercurrentStudyDefinition = {
      ...COORD_02_THREE_RELAY_RADIAL,
      faultCases: COORD_02_THREE_RELAY_RADIAL.faultCases.map((faultCase) => faultCase.id === source.id
        ? { ...faultCase, protectionChain: { primaryDeviceId: 'R2', backupDeviceIds: ['R3'] } }
        : faultCase),
    };
    expect(validateOvercurrentStudyDefinition(broken).status).toBe('INVALID');
  });
});
