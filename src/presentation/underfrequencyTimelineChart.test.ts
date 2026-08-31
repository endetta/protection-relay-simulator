import { describe, expect, it } from 'vitest';
import { buildUnderfrequencyTimelineTooltip } from './underfrequencyTimelineChart';
import type {
  UnderfrequencyTimelineRun,
  UnderfrequencyTimelineSnapshot,
  UnderfrequencyTimelineEvent,
  UflsStageSettings,
} from '../types/underfrequency';

const STAGES: readonly UflsStageSettings[] = [
  { id: 'S1', label: 'Stage 1', enabled: true, thresholdHz: 49.50, timeDelaySec: 0.2, shedFractionPct: 5 },
  { id: 'S2', label: 'Stage 2', enabled: true, thresholdHz: 49.00, timeDelaySec: 0.3, shedFractionPct: 10 },
];

function makeRun(snapshots: UnderfrequencyTimelineSnapshot[], events: UnderfrequencyTimelineEvent[]): UnderfrequencyTimelineRun {
  return {
    studyId: 'TEST',
    snapshots,
    events,
    finalFrequencyHz: snapshots[snapshots.length - 1]?.frequencyHz ?? null,
    finalTimeSec: snapshots[snapshots.length - 1]?.engineeringTimeSec ?? 0,
    steadyStateStatus: 'SETTLED',
    status: 'VALID',
    issues: [],
  };
}

// ─────────── UFR-FIX-04: tooltip armed pill must not contradict event list ──────
describe('Underfrequency timeline tooltip armed/operated reconciliation (UFR-FIX-04)', () => {
  it('does not show "Armed" for a stage that just tripped', () => {
    const at = 10.0;
    const snap: UnderfrequencyTimelineSnapshot = {
      engineeringTimeSec: at,
      frequencyHz: 47.8,
      rocofHzPerSec: -0.1,
      deficitMw: 400,
      generators: [],
      armedStageIds: ['S1'], // pre-event snapshot shows S1 armed
      operatedStageIds: [],   // pre-event: not yet operated
    };
    const tripEvent: UnderfrequencyTimelineEvent = {
      id: 'E1',
      timeSec: at,
      type: 'UFLS_TRIP',
      stageId: 'S1',
      shedMw: 65,
    };
    const run = makeRun([snap], [tripEvent]);
    const tip = buildUnderfrequencyTimelineTooltip(run, STAGES, at);
    expect(tip).not.toBeNull();
    // S1 must be operated and must NOT be armed.
    expect(tip!.operatedStageIds).toContain('S1');
    expect(tip!.armedStageIds).not.toContain('S1');
  });

  it('does not show "Armed" at a TIMER_RESET event', () => {
    const at = 12.0;
    const snap: UnderfrequencyTimelineSnapshot = {
      engineeringTimeSec: at,
      frequencyHz: 50.1, // rising back above threshold
      rocofHzPerSec: 0.5,
      deficitMw: 300,
      generators: [],
      armedStageIds: ['S1'],
      operatedStageIds: [],
    };
    const resetEvent: UnderfrequencyTimelineEvent = {
      id: 'E2',
      timeSec: at,
      type: 'UFLS_TIMER_RESET',
      stageId: 'S1',
    };
    const run = makeRun([snap], [resetEvent]);
    const tip = buildUnderfrequencyTimelineTooltip(run, STAGES, at);
    expect(tip).not.toBeNull();
    expect(tip!.armedStageIds).not.toContain('S1');
  });

  it('does not show "Armed" at a STAGE_RESET event (released at settle)', () => {
    const at = 30.0;
    const snap: UnderfrequencyTimelineSnapshot = {
      engineeringTimeSec: at,
      frequencyHz: 50.0,
      rocofHzPerSec: 0,
      deficitMw: 0,
      generators: [],
      armedStageIds: ['S1', 'S2'],
      operatedStageIds: [],
    };
    const e1: UnderfrequencyTimelineEvent = { id: 'EA', timeSec: at, type: 'STEADY_STATE_REACHED', detail: '' };
    const e2: UnderfrequencyTimelineEvent = { id: 'ER1', timeSec: at, type: 'STAGE_RESET', stageId: 'S1' };
    const e3: UnderfrequencyTimelineEvent = { id: 'ER2', timeSec: at, type: 'STAGE_RESET', stageId: 'S2' };
    const run = makeRun([snap], [e1, e2, e3]);
    const tip = buildUnderfrequencyTimelineTooltip(run, STAGES, at);
    expect(tip).not.toBeNull();
    expect(tip!.armedStageIds).not.toContain('S1');
    expect(tip!.armedStageIds).not.toContain('S2');
  });
});
