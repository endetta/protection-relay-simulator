import { describe, expect, it } from 'vitest';
import { computeNextScrubSec, shouldDispatchScrub } from './underfrequencyPlayback';

describe('computeNextScrubSec', () => {
  it('starts from 0 when current is null', () => {
    const result = computeNextScrubSec(null, 1, 1, 20);
    expect(result.timeSec).toBeCloseTo(1, 6);
    expect(result.reachedEnd).toBe(false);
  });

  it('advances by wallDelta × speed', () => {
    const result = computeNextScrubSec(5, 2, 5, 100);
    expect(result.timeSec).toBeCloseTo(15, 6); // 5 + 2×5
    expect(result.reachedEnd).toBe(false);
  });

  it('clamps at totalTimeSec and signals reachedEnd', () => {
    const result = computeNextScrubSec(18, 5, 1, 20);
    expect(result.timeSec).toBe(20);
    expect(result.reachedEnd).toBe(true);
  });

  it('returns the current value when already at end', () => {
    const result = computeNextScrubSec(20, 1, 1, 20);
    expect(result.timeSec).toBe(20);
    expect(result.reachedEnd).toBe(true);
  });

  it('ignores non-positive wallDelta', () => {
    expect(computeNextScrubSec(5, 0, 1, 20).timeSec).toBe(5);
    expect(computeNextScrubSec(5, -1, 1, 20).timeSec).toBe(5);
    expect(computeNextScrubSec(5, NaN, 1, 20).timeSec).toBe(5);
  });

  it('handles speed multiplier correctly', () => {
    expect(computeNextScrubSec(0, 1, 10, 100).timeSec).toBe(10);
    expect(computeNextScrubSec(0, 1, 5, 100).timeSec).toBe(5);
  });
});

describe('shouldDispatchScrub — no-op / stale-ref gate', () => {
  it('dispatches on the first frame from a null scrub (reset/rearmed)', () => {
    expect(shouldDispatchScrub(null, 1)).toBe(true);
  });

  it('does NOT dispatch when the value is unchanged (sub-ms frame, no movement)', () => {
    expect(shouldDispatchScrub(5, 5)).toBe(false);
  });

  it('does NOT dispatch when the next value is null', () => {
    expect(shouldDispatchScrub(5, null)).toBe(false);
  });

  it('does NOT dispatch on non-finite next (defensive; reducer would drop it)', () => {
    expect(shouldDispatchScrub(5, NaN)).toBe(false);
    expect(shouldDispatchScrub(5, Infinity)).toBe(false);
  });

  it('dispatches when the scrub advanced (the normal running case)', () => {
    expect(shouldDispatchScrub(5, 5.01)).toBe(true);
  });

  it('dispatches even from null when the first computed frame lands at the end', () => {
    expect(shouldDispatchScrub(null, 20)).toBe(true);
  });
});

/**
 * Behavioural model of the hook's dispatch decisions — what a sequence of
 * rAF ticks would dispatch, given the latch + no-op guards, WITHOUT needing a
 * DOM or rAF. This pins the fix for the original defect where the hook
 * dispatched SET_SCRUB_TIME unconditionally (even on a no-op first frame whose
 * `current` was stale/null → `next = min(total, null??0 + 0) = 0`, churning the
 * reducer) and never latched COMPLETE.
 */
interface DispatchRecord {
  type: string;
  timeSec?: number | null;
  playbackState?: string;
}

function simulateRun({
  totalTimeSec,
  simulationSpeed,
  ticks,
}: {
  totalTimeSec: number;
  simulationSpeed: 1 | 5 | 10;
  ticks: readonly number[];
}): DispatchRecord[] {
  const dispatched: DispatchRecord[] = [];
  let playbackState: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE' = 'IDLE';
  let scrubTimeSec: number | null = null; // BEGIN_RUN resets to null
  let prevFrameMs: number | null = null;
  // BEGIN_RUN
  playbackState = 'RUNNING';
  scrubTimeSec = null;

  for (const timestampMs of ticks) {
    if (prevFrameMs === null) prevFrameMs = timestampMs;
    const wallDeltaSec = Math.max(0, (timestampMs - prevFrameMs) / 1000);
    prevFrameMs = timestampMs;

    const { timeSec: next, reachedEnd } = computeNextScrubSec(
      scrubTimeSec, wallDeltaSec, simulationSpeed, totalTimeSec,
    );
    if (shouldDispatchScrub(scrubTimeSec, next)) {
      dispatched.push({ type: 'SET_SCRUB_TIME', timeSec: next });
      scrubTimeSec = next;
    }
    // Latch COMPLETE exactly once, only from RUNNING.
    if (playbackState === 'RUNNING' && reachedEnd && (scrubTimeSec ?? 0) >= totalTimeSec) {
      playbackState = 'COMPLETE';
      dispatched.push({ type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    }
  }
  return dispatched;
}

describe('useUnderfrequencyPlayback dispatch model (no rAF, no DOM)', () => {
  it('latches COMPLETE and stops re-dispatching scrub once scrub reaches totalTimeSec', () => {
    // 60fps, ~0.0167s/tick at 1x → 20s run needs ~1200 ticks; use fewer, larger
    // ticks to keep it fast. Each tick advances 5s wall → 5s eng at 1x.
    const ticks: number[] = [];
    let t = 1000;
    for (let i = 0; i < 6; i += 1) {
      t += 1000; // 1s wall per tick
      ticks.push(t);
    }
    const dispatched = simulateRun({ totalTimeSec: 20, simulationSpeed: 5, ticks });

    const complete = dispatched.find((d) => d.type === 'SET_PLAYBACK_STATE' && d.playbackState === 'COMPLETE');
    expect(complete).toBeDefined();
    const completeIdx = dispatched.indexOf(complete!);
    // After COMPLETE there must be no further SET_SCRUB_TIME dispatches (latch holds).
    const after = dispatched.slice(completeIdx + 1);
    expect(after.find((d) => d.type === 'SET_SCRUB_TIME')).toBeUndefined();
  });

  it('does NOT dispatch on a zero-delta first frame (the stale-ref no-op regression)', () => {
    // First tick with no wall delta: wallDeltaSec = 0 → computeNextScrubSec returns
    // the current (null → null) unchanged; shouldDispatchScrub(null, null) is FALSE.
    // (Old hook inlined `min(total, (null??0) + 0) = 0` and dispatched 0.)
    const dispatched = simulateRun({ totalTimeSec: 20, simulationSpeed: 1, ticks: [1000, 1000] });
    const firstScrub = dispatched.find((d) => d.type === 'SET_SCRUB_TIME');
    expect(firstScrub).toBeUndefined(); // null delta → no dispatch, no 0.00 scrub
  });

  it('never dispatches the same scrub value twice (no churn)', () => {
    // Repeated identical ticks at a speed where eng-time rounds to the same 0.01s
    // bucket must not emit duplicate scrub dispatches.
    const ticks: number[] = [];
    let t = 1000;
    for (let i = 0; i < 5; i += 1) {
      t += 1; // ~0ms wall delta → wallDeltaSec rounds to 0
      ticks.push(t);
    }
    const dispatched = simulateRun({ totalTimeSec: 100, simulationSpeed: 1, ticks });
    const scrubValues = dispatched.filter((d) => d.type === 'SET_SCRUB_TIME').map((d) => d.timeSec);
    // No duplicate consecutive scrub values.
    for (let i = 1; i < scrubValues.length; i += 1) {
      expect(scrubValues[i]).not.toBe(scrubValues[i - 1]);
    }
  });
});
