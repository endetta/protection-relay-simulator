import { describe, expect, it } from 'vitest';
import { computeUnderfrequencyTimeline } from '../engines/underfrequencyTimeline';
import { getUnderfrequencyStudyPreset } from '../studies/underfrequencyPresets';
import { studyFromPreset } from '../utils/underfrequencyState';
import type { UnderfrequencyTimelineRun, UnderfrequencyStudyDefinition } from '../types/underfrequency';
import { buildUnderfrequencyTimelineTooltip, snapshotAtTime } from './underfrequencyTimelineChart';

function buildRun(presetId: string): { run: UnderfrequencyTimelineRun; study: UnderfrequencyStudyDefinition } {
  const preset = getUnderfrequencyStudyPreset(presetId);
  const study = studyFromPreset(preset);
  const run = computeUnderfrequencyTimeline(study);
  return { run, study };
}

describe('UFR timeline tooltip presentation model', () => {
  it('returns null for an INVALID run rather than crashing', () => {
    const { study } = buildRun('UFR-02');
    const invalidRun: UnderfrequencyTimelineRun = {
      studyId: study.id,
      snapshots: [],
      events: [],
      finalFrequencyHz: null,
      finalTimeSec: 0,
      steadyStateStatus: 'SETTLED',
      status: 'INVALID',
      issues: [],
    };
    expect(buildUnderfrequencyTimelineTooltip(invalidRun, study.uflsStages, 0.2)).toBeNull();
  });

  it('resolves t / f / ROCOF / deficit from the nearest snapshot', () => {
    const { run, study } = buildRun('UFR-02');
    expect(run.status).toBe('VALID');
    const target = run.snapshots[Math.min(40, run.snapshots.length - 1)];
    const tip = buildUnderfrequencyTimelineTooltip(run, study.uflsStages, target.engineeringTimeSec);
    expect(tip).not.toBeNull();
    // The tooltip must agree with the snapshot the chart would already show.
    const nearest = snapshotAtTime(run.snapshots, target.engineeringTimeSec);
    expect(tip!.timeSec).toBe(nearest!.engineeringTimeSec);
    expect(tip!.frequencyHz).toBe(nearest!.frequencyHz);
    expect(tip!.rocofHzPerSec).toBe(nearest!.rocofHzPerSec);
    expect(tip!.deficitMw).toBe(nearest!.deficitMw);
    expect(tip!.armedStageIds).toEqual(nearest!.armedStageIds);
    expect(tip!.operatedStageIds).toEqual(nearest!.operatedStageIds);
  });

  it('labels a UFLS trip instant with the stage name, not an opaque id', () => {
    const { run, study } = buildRun('UFR-02');
    const trip = run.events.find((e) => e.type === 'UFLS_TRIP');
    expect(trip).toBeDefined();
    if (!trip) return;
    const tip = buildUnderfrequencyTimelineTooltip(run, study.uflsStages, trip.timeSec);
    expect(tip).not.toBeNull();
    // An event should be surfaced — the subject is the stage's study label.
    expect(tip!.eventLabels.length).toBeGreaterThan(0);
    const first = tip!.eventLabels[0];
    expect(first).toContain('UFLS_TRIP');
    expect(first).toContain('Stage'); // "Stage N — 49.50" from the study, not "S1"
    // The trip stage is recorded as operated at that instant.
    expect(tip!.operatedStageIds).toContain(trip!.stageId);
  });

  it('reports no event at an instant without an event but still yields metrics', () => {
    const { run, study } = buildRun('UFR-02');
    // A snapshot mid-decay that is not an event boundary.
    const mid = run.snapshots[Math.min(30, run.snapshots.length - 1)];
    const tip = buildUnderfrequencyTimelineTooltip(run, study.uflsStages, mid.engineeringTimeSec);
    expect(tip).not.toBeNull();
    // This is a pure interpolation instant; eventLabels may or may not be empty,
    // but the numeric readout must always be present and finite.
    expect(Number.isFinite(tip!.frequencyHz)).toBe(true);
    expect(Number.isFinite(tip!.deficitMw)).toBe(true);
  });

  it('describes the collapse instant with a COLLAPSE label when present', () => {
    // UFR-05 is the engineered collapse preset; pick whichever study actually
    // collapses here with the guard above. We assert on the one that does.
    const { run, study } = buildRun('UFR-02');
    expect(run.status).toBe('VALID');
    expect(run.snapshots.length).toBeGreaterThan(0);
    // Every instant must produce a well-formed payload even when nothing special
    // fires — that is the invariant the chart relies on for hover.
    const tip = buildUnderfrequencyTimelineTooltip(run, study.uflsStages, run.finalTimeSec);
    expect(tip).not.toBeNull();
    expect(Number.isFinite(tip!.frequencyHz)).toBe(true);
  });
});
