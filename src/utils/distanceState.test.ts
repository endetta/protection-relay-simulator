/**
 * Distance Relay state reducer tests (D03).
 */

import { describe, expect, it } from 'vitest';
import {
  createInitialDistanceState,
  distanceStateReducer,
  faultTypeLabel,
  deriveDistanceStudy,
} from './distanceState';
import type { DistanceSimulatorState } from './distanceState';

function freshState(): DistanceSimulatorState {
  return createInitialDistanceState('DIST-01');
}

describe('distanceStateReducer', () => {
  it('starts un-modified on a fresh preset', () => {
    const s = freshState();
    expect(s.modified).toBe(false);
  });

  it('SET_TOPOLOGY flips modified', () => {
    const s = freshState();
    const next = distanceStateReducer(s, { type: 'SET_TOPOLOGY', topology: 'DOUBLE_ENDED' });
    expect(next.study.topology).toBe('DOUBLE_ENDED');
    expect(next.modified).toBe(true);
  });

  it('SET_SCHEME flips modified', () => {
    const s = freshState();
    const next = distanceStateReducer(s, { type: 'SET_SCHEME', scheme: 'POTT' });
    expect(next.study.scheme).toBe('POTT');
    expect(next.modified).toBe(true);
  });

  it('SET_CHARACTERISTIC_TYPE flips modified and updates the active characteristic', () => {
    const s = freshState();
    const next = distanceStateReducer(s, { type: 'SET_CHARACTERISTIC_TYPE', characteristic: 'QUADRILATERAL' });
    expect(next.study.settings.characteristicType).toBe('QUADRILATERAL');
    expect(next.modified).toBe(true);
  });

  it('SET_FAULT_PCT clamps to [0, 100]', () => {
    const s = freshState();
    const clamped1 = distanceStateReducer(s, { type: 'SET_FAULT_PCT', value: 150 });
    expect(clamped1.study.faultPct).toBe(100);
    const clamped2 = distanceStateReducer(s, { type: 'SET_FAULT_PCT', value: -10 });
    expect(clamped2.study.faultPct).toBe(0);
  });

  it('rejects non-finite fault current', () => {
    const s = freshState();
    const same = distanceStateReducer(s, { type: 'SET_FAULT_CURRENT_A', value: Number.NaN });
    expect(same).toBe(s);
  });

  it('SET_ZONE patches a specific zone', () => {
    const s = freshState();
    const next = distanceStateReducer(s, { type: 'SET_ZONE', zone: 1, patch: { reachOhmSecondary: 25 } });
    expect(next.study.settings.zone1.reachOhmSecondary).toBe(25);
  });

  it('APPLY_PRESET resets modified', () => {
    let s = freshState();
    s = distanceStateReducer(s, { type: 'SET_FAULT_PCT', value: 80 });
    expect(s.modified).toBe(true);
    s = distanceStateReducer(s, { type: 'APPLY_PRESET', presetId: 'DIST-02' });
    expect(s.modified).toBe(false);
    expect(s.presetId).toBe('DIST-02');
  });

  it('SET_LOAD_ENCROACHMENT toggles enabled and updates rMin', () => {
    const s = freshState();
    const next = distanceStateReducer(s, { type: 'SET_LOAD_ENCROACHMENT', patch: { enabled: false, rMinLoadOhmSecondary: 10 } });
    expect(next.study.settings.loadEncroachment.enabled).toBe(false);
    expect(next.study.settings.loadEncroachment.rMinLoadOhmSecondary).toBe(10);
  });
});

describe('deriveDistanceStudy + helpers', () => {
  it('derives line impedance from line length + z1', () => {
    const s = freshState();
    const derived = deriveDistanceStudy(s);
    expect(derived.lineImpedancePrimaryOhm).toBeGreaterThan(0);
    expect(derived.zLineSecondary).toBeGreaterThan(0);
  });

  it('fault type labels are non-empty', () => {
    expect(faultTypeLabel('THREE_PHASE')).toMatch(/Phase/);
    expect(faultTypeLabel('SINGLE_LINE_GROUND')).toBe('SLG');
  });
});