import { describe, expect, it } from 'vitest';
import type { UnderfrequencyPlaybackSpeed } from '../types/underfrequency';
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
 * Dispatch-model mirror of `useUnderfrequencyPlayback` (no rAF, no DOM).
 *
 * The latch lives ONLY in the dedicated `useEffect` (single, sole COMPLETE
 * dispatch site), never inlined in the tick. This model therefore has exactly
 * one COMPLETE dispatch per run — mirroring the invariant the production hook
 * must hold and the regression that pins it.
 */

type DispatchRecord =
  | { type: 'SET_SCRUB_TIME'; timeSec: number | null }
  | { type: 'SET_PLAYBACK_STATE'; playbackState: 'COMPLETE' };

interface RunOpts {
  readonly totalTimeSec: number;
  readonly simulationSpeed: UnderfrequencyPlaybackSpeed;
  /** wall-clock deltas (seconds) fed into the rAF tick, one per frame */
  readonly wallDeltaSecs: readonly number[];
}

function simulateRun({ totalTimeSec, simulationSpeed, wallDeltaSecs }: RunOpts): DispatchRecord[] {
  const dispatched: DispatchRecord[] = [];
  let playbackState: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE' = 'IDLE';
  let scrubTimeSec: number | null = null;

  // Begin a run (mirrors BEGIN_RUN → scrub null, state RUNNING).
  playbackState = 'RUNNING';

  // Mirror the running tick: advance + gate via shouldDispatchScrub. The
  // COMPLETE latch is NOT applied here — it is applied once, below, in the
  // same place the useEffect runs (after the scrub commits).
  for (const wallDeltaSec of wallDeltaSecs) {
    if (playbackState !== 'RUNNING') break;
    // reachedEnd is intentionally destructured but unused: it is an
    // informational signal only (see computeNextScrubSec JSDoc). The latch is
    // driven by the committed scrub value below, never by reachedEnd.
    const { timeSec: next } = computeNextScrubSec(
      scrubTimeSec,
      wallDeltaSec,
      simulationSpeed,
      totalTimeSec,
    );
    if (shouldDispatchScrub(scrubTimeSec, next)) {
      scrubTimeSec = next;
      dispatched.push({ type: 'SET_SCRUB_TIME', timeSec: next });
    }
    // Single, sole COMPLETE latch — applied against the committed scrub, exactly
    // once per qualifying state, never from the tick inline. Mirrors the
    // useEffect in useUnderfrequencyPlayback: same `(scrubTimeSec ?? 0) >=
    // totalTimeSec` predicate so the test model and production share one
    // truth.
    if (
      playbackState === 'RUNNING' &&
      totalTimeSec > 0 &&
      (scrubTimeSec ?? 0) >= totalTimeSec
    ) {
      playbackState = 'COMPLETE';
      dispatched.push({ type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
      break;
    }
  }
  return dispatched;
}

describe('useUnderfrequencyPlayback dispatch model (no rAF, no DOM)', () => {
  it('latches COMPLETE exactly once and emits no SET_SCRUB_TIME after', () => {
    // 4 frames × 1s × speed 5 = 20s, totalTimeSec 20 → reaches end on frame 4.
    const dispatched = simulateRun({
      totalTimeSec: 20,
      simulationSpeed: 5,
      wallDeltaSecs: [1, 1, 1, 1],
    });
    const completes = dispatched.filter((d) => d.type === 'SET_PLAYBACK_STATE');
    expect(completes).toHaveLength(1);
    const completeIdx = dispatched.findIndex((d) => d.type === 'SET_PLAYBACK_STATE');
    expect(completeIdx).toBeGreaterThanOrEqual(0);
    const after = dispatched.slice(completeIdx + 1);
    expect(after.every((d) => d.type !== 'SET_SCRUB_TIME')).toBe(true);
  });

  it('does NOT latch COMPLETE until scrub actually reaches totalTimeSec', () => {
    // 3 frames × 1s × speed 5 = 15s, totalTimeSec 20 — never reaches end.
    const dispatched = simulateRun({
      totalTimeSec: 20,
      simulationSpeed: 5,
      wallDeltaSecs: [1, 1, 1],
    });
    expect(dispatched.find((d) => d.type === 'SET_PLAYBACK_STATE')).toBeUndefined();
    expect(dispatched.every((d) => d.type === 'SET_SCRUB_TIME')).toBe(true);
  });

  it('never dispatches the same scrub value twice across 1s / 0.5s deltas (no churn)', () => {
    // Frame 1: null → 1. Frames 2 & 3 advance by 0.5 each. None of the three
    // produced values should be duplicated.
    const dispatched = simulateRun({
      totalTimeSec: 100,
      simulationSpeed: 1,
      wallDeltaSecs: [1, 0.5, 0.5],
    });
    const scrubVals = dispatched
      .filter((d): d is { type: 'SET_SCRUB_TIME'; timeSec: number | null } =>
        d.type === 'SET_SCRUB_TIME',
      )
      .map((d) => d.timeSec);
    const uniq = new Set(scrubVals);
    expect(uniq.size).toBe(scrubVals.length);
  });

  it('does NOT dispatch the stale first-frame value when wallDelta is zero', () => {
    // Two zero-delta frames from null: shouldDispatchScrub(null, null) is false,
    // so no SET_SCRUB_TIME; scrub stays null → no latch.
    const dispatched = simulateRun({
      totalTimeSec: 20,
      simulationSpeed: 1,
      wallDeltaSecs: [0, 0],
    });
    expect(dispatched.find((d) => d.type === 'SET_SCRUB_TIME')).toBeUndefined();
    expect(dispatched.find((d) => d.type === 'SET_PLAYBACK_STATE')).toBeUndefined();
  });

  it('a gate-suppressed SET_SCRUB_TIME does NOT cause a stray COMPLETE', () => {
    // Regression for the gate coverage gap: if shouldDispatchScrub returns
    // false (no scrub advance), the dispatch is suppressed, scrub stays at
    // its previous value, and the COMPLETE latch must NOT fire — even when
    // totalTimeSec is small enough to be reached in principle. Here the first
    // frame dispatches (null → 1), then two zero-delta frames where the gate
    // returns false (current = next = 1). Scrub stays at 1.0 < 5.0 → no latch.
    const dispatched = simulateRun({
      totalTimeSec: 5,
      simulationSpeed: 1,
      wallDeltaSecs: [1, 0, 0],
    });
    const scrub = dispatched.filter((d) => d.type === 'SET_SCRUB_TIME');
    const complete = dispatched.find((d) => d.type === 'SET_PLAYBACK_STATE');
    expect(scrub).toHaveLength(1); // only the first-frame advance survived the gate
    expect(complete).toBeUndefined();
  });

  it('sub-µs wall deltas do not stall the run via repeated no-op dispatch attempts', () => {
    // Regression for the FP-rounding stall (documented in the playback hook
    // reconciliation memory). When a frame's wallDeltaSec is so small that
    // `current + wallDeltaSec * speed` rounds to exactly `current` in IEEE-754,
    // shouldDispatchScrub returns false and no SET_SCRUB_TIME is emitted — but
    // the next frame must still be able to advance. Six 1e-9 s deltas at
    // speed 1 = 6e-9 s, which still rounds to 0 in double precision, so the
    // first frame does NOT dispatch (next === current === null → not in the
    // dispatch path either; shouldDispatchScrub(null, null) === false). Once a
    // real delta arrives, the run resumes normally.
    const dispatched = simulateRun({
      totalTimeSec: 100,
      simulationSpeed: 1,
      wallDeltaSecs: [1e-9, 1e-9, 1e-9, 1e-9, 1e-9, 1e-9, 0.5],
    });
    const scrubs = dispatched.filter((d) => d.type === 'SET_SCRUB_TIME').map((d) => d.timeSec);
    // The first six sub-µs frames produce no dispatch (next rounds to current).
    // The seventh frame (0.5s) is the first real advance: null → 0.5.
    expect(scrubs).toEqual([0.5]);
    // No COMPLETE: 0.5 < 100, run continues.
    expect(dispatched.find((d) => d.type === 'SET_PLAYBACK_STATE')).toBeUndefined();
  });
});
