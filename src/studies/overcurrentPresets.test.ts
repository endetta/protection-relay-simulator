import { describe, expect, it } from 'vitest';
import { calculateOvercurrentDevice } from '../engines/overcurrent';
import { resolveFaultCaseCurrents } from './overcurrentStudy';
import {
  COORD_01_TWO_RELAY_TIME_GRADING,
  COORD_02_THREE_RELAY_RADIAL,
  COORD_05_INSTANTANEOUS_COORDINATION,
  OVC_02_NEAR_PICKUP,
  OVC_03_MODERATE_OVERCURRENT,
  OVC_05_INSTANTANEOUS_FAULT,
  OVC_08_CT_MEASUREMENT_ERROR,
} from './overcurrentPresets';

describe('O05 O01 preset parity', () => {
  it('keeps OVC-02 near-pickup reference time', () => {
    const result = calculateOvercurrentDevice(808, OVC_02_NEAR_PICKUP.devicesById.R1);
    expect(result.element51.operateTimeSec).toBeCloseTo(70.3424198, 6);
  });

  it('keeps OVC-03 moderate-overcurrent reference time', () => {
    const result = calculateOvercurrentDevice(1600, OVC_03_MODERATE_OVERCURRENT.devicesById.R1);
    expect(result.element51.operateTimeSec).toBeCloseTo(1.002902702, 8);
  });

  it('keeps OVC-05 50 priority', () => {
    const result = calculateOvercurrentDevice(4000, OVC_05_INSTANTANEOUS_FAULT.devicesById.R1);
    expect(result.selectedElement).toBe('50');
    expect(result.element51.operateTimeSec).toBeCloseTo(0.427972007, 8);
  });

  it('keeps OVC-08 +5% CT error pickup crossing', () => {
    const result = calculateOvercurrentDevice(780, OVC_08_CT_MEASUREMENT_ERROR.devicesById.R1);
    expect(result.measurement.measuredSecondaryCurrentA).toBeCloseTo(0.819, 12);
    expect(result.element51.currentMultiple).toBeCloseTo(1.02375, 12);
  });
});

describe('O05 coordination study reference data', () => {
  it('COORD-01 starts with an intentional F2 MAX time-grading deficit', () => {
    const currents = resolveFaultCaseCurrents(COORD_01_TWO_RELAY_TIME_GRADING, 'COORD-01:F2:MAX');
    expect(currents.status).toBe('VALID');
    if (currents.status === 'VALID') {
      const primary = calculateOvercurrentDevice(currents.value.R2, COORD_01_TWO_RELAY_TIME_GRADING.devicesById.R2);
      const backup = calculateOvercurrentDevice(currents.value.R1, COORD_01_TWO_RELAY_TIME_GRADING.devicesById.R1);
      const cti = backup.selectedTripTimeSec! - primary.selectedTripTimeSec!;
      expect(cti).toBeCloseTo(0.278307692, 8);
      expect(cti).toBeLessThan(0.30);
    }
  });

  it('COORD-02 preserves the O01 F3 MAX canonical vector', () => {
    const currents = resolveFaultCaseCurrents(COORD_02_THREE_RELAY_RADIAL, 'COORD-02:F3:MAX');
    expect(currents.status).toBe('VALID');
    if (currents.status === 'VALID') {
      const r3 = calculateOvercurrentDevice(currents.value.R3, COORD_02_THREE_RELAY_RADIAL.devicesById.R3);
      const r2 = calculateOvercurrentDevice(currents.value.R2, COORD_02_THREE_RELAY_RADIAL.devicesById.R2);
      expect(r3.selectedTripTimeSec).toBeCloseTo(0.207692308, 8);
      expect(r2.selectedTripTimeSec).toBeCloseTo(0.486, 10);
      expect(r2.selectedTripTimeSec! - r3.selectedTripTimeSec!).toBeCloseTo(0.278307692, 8);
    }
  });

  it('COORD-05 exposes the O01 R2 instantaneous-overreach challenge', () => {
    const currents = resolveFaultCaseCurrents(COORD_05_INSTANTANEOUS_COORDINATION, 'COORD-05:F3:MAX');
    expect(currents.status).toBe('VALID');
    if (currents.status === 'VALID') {
      const r2 = calculateOvercurrentDevice(currents.value.R2, COORD_05_INSTANTANEOUS_COORDINATION.devicesById.R2);
      expect(r2.measurement.measuredSecondaryCurrentA).toBeCloseTo(6, 12);
      expect(r2.selectedElement).toBe('50');
    }
  });
});
