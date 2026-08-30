import { describe, expect, it } from 'vitest';
import {
  evaluateCoordinationFaultCase,
  evaluateCoordinationPair,
  evaluateLoadSecurityCase,
  runOvercurrentCoordinationStudy,
  scanCoordinationEnvelope,
} from './overcurrentCoordination';
import { getOvercurrentStudyPreset } from '../studies/overcurrentPresets';
import type { CoordinationPair, CoordinationRequirement, OperatingResult, OvercurrentStudyDefinition } from '../types/overcurrent';

function result(deviceId: string, tripTimeSec: number | null, element: '50' | '51' | null = '51'): OperatingResult {
  return {
    deviceId,
    measurement: { primaryCurrentA: 1000, idealSecondaryCurrentA: 1, measuredSecondaryCurrentA: 1 },
    element51: { status: element === null ? 'BELOW_PICKUP' : 'PICKUP', currentMultiple: 2, operateTimeSec: element === '51' ? tripTimeSec : 1, timingMode: 'INVERSE' },
    element50: { status: element === '50' ? 'PICKUP' : 'DISABLED', operateTimeSec: element === '50' ? 0 : null },
    selectedElement: element,
    selectedTripTimeSec: tripTimeSec,
  };
}

const pair: CoordinationPair = { id: 'P', locationId: 'F', primaryDeviceId: 'P', backupDeviceId: 'B', backupOrder: 1 };
const req: CoordinationRequirement = { id: 'Q', pairId: 'P', requiredCtiSec: 0.3 };

describe('O06 coordination engine', () => {
  it('treats CTI equality as PASS', () => {
    const evaluated = evaluateCoordinationPair(pair, req, result('P', 0.2), result('B', 0.5));
    expect(evaluated.status).toBe('PASS');
    expect(evaluated.observedCtiSec).toBeCloseTo(0.3, 12);
  });

  it('keeps missing backup as NOT_EVALUABLE', () => {
    expect(evaluateCoordinationPair(pair, req, result('P', 0.2), result('B', null, null)).status).toBe('NOT_EVALUABLE');
  });

  it('reproduces the intentional COORD-02 grading failure', () => {
    const study = getOvercurrentStudyPreset('COORD-02')!;
    const result = runOvercurrentCoordinationStudy(study);
    expect(result.status).toBe('VALID');
    if (result.status !== 'VALID') return;
    expect(result.value.audit.status).toBe('COORDINATION_INCOMPLETE');
    expect(result.value.audit.worstCase?.faultCaseId).toBe('COORD-02:F3:MAX');
    expect(result.value.audit.worstCase?.observedCtiSec).toBeCloseTo(0.27830769230769226, 12);
    expect(result.value.audit.dimensions.find((entry) => entry.dimension === 'TIME_GRADING')?.status).toBe('FAIL');
  });

  it('passes the O01 corrected R2 TMS vector across all validation cases', () => {
    const study = structuredClone(getOvercurrentStudyPreset('COORD-02')!) as OvercurrentStudyDefinition;
    const r2 = study.devicesById.R2;
    (r2.settings.phase51 as { timeScale: number }).timeScale = 0.19;
    const result = runOvercurrentCoordinationStudy(study);
    expect(result.status).toBe('VALID');
    if (result.status !== 'VALID') return;
    expect(result.value.audit.status).toBe('COORDINATED');
    expect(result.value.audit.passedCaseCount).toBe(6);
    expect(result.value.audit.worstCase?.surplusSec).toBeCloseTo(0.005307692307692291, 12);
  });

  it('detects the O01 upstream instantaneous-overreach challenge', () => {
    const study = getOvercurrentStudyPreset('COORD-05')!;
    const result = evaluateCoordinationFaultCase(study, 'COORD-05:F3:MAX');
    expect(result.status).toBe('VALID');
    if (result.status !== 'VALID') return;
    expect(result.value.violations.some((entry) => entry.type === 'INSTANTANEOUS_OVERREACH' && entry.deviceId === 'R2')).toBe(true);
    expect(result.value.violations.some((entry) => entry.type === 'SELECTIVITY_FAIL')).toBe(true);
  });

  it('evaluates configured maximum load independently of fault coordination', () => {
    const study = getOvercurrentStudyPreset('COORD-02')!;
    const result = evaluateLoadSecurityCase(study, 'COORD-02:LOAD:MAX');
    expect(result.status).toBe('VALID');
    if (result.status !== 'VALID') return;
    expect(result.value.status).toBe('PASS');
    expect(result.value.deviceResults.every((entry) => entry.status === 'PASS')).toBe(true);
  });

  it('scans configured fault-location data and returns a deterministic worst point', () => {
    const study = getOvercurrentStudyPreset('COORD-02')!;
    const a = scanCoordinationEnvelope(study, 'COORD-02:SCRUBBER', 41);
    const b = scanCoordinationEnvelope(study, 'COORD-02:SCRUBBER', 41);
    expect(a).toEqual(b);
    expect(a.status).toBe('VALID');
    if (a.status !== 'VALID') return;
    expect(a.value.points.length).toBeGreaterThan(100);
    expect(a.value.worstPoint?.locationId).toBe('F3');
    expect(a.value.worstPoint?.surplusSec).toBeLessThan(0);
  });
});
