/**
 * Underfrequency playback clock hook (page-level).
 *
 * Drives engineering-time playback at requestAnimationFrame cadence while
 * `playbackState === 'RUNNING'`, dispatching `SET_SCRUB_TIME` into the reducer
 * so every consumer (SLD, timeline chart, generator diagram, analysis) shares
 * the same synchronized clock snapshot.
 *
 * Latches `SET_PLAYBACK_STATE('COMPLETE')` when `scrubTimeSec >= totalTimeSec`,
 * in a single dedicated `useEffect` (never inlined in the rAF tick) so the
 * latch fires once, reactively, against the committed scrub value.
 *
 * The scrub computation is exposed as a pure helper (`computeNextScrubSec`) and
 * the per-frame dispatch decision as `shouldDispatchScrub`, both testable
 * without rAF or React. `shouldDispatchScrub` prevents the reducer being
 * churned with no-op / stale-ref dispatches (zero-delta first frame, sub-ms
 * frames with no movement, or non-finite values) that would otherwise
 * re-run every consumer memo for no gain.
 */

import { useEffect, useRef, type Dispatch } from 'react';
import type { UnderfrequencyAction } from '../utils/underfrequencyState';
import type {
  UnderfrequencyPlaybackSpeed,
  UnderfrequencyPlaybackState,
} from '../types/underfrequency';

// ──────────────────────────── Pure helpers ───────────────────────────────

/**
 * Advance the engineering-time scrub by a wall-clock delta × playback speed,
 * clamping at `totalTimeSec`. Returns the next scrub value and an informational
 * `reachedEnd` flag. The flag is a derived signal (`next >= totalTimeSec`),
 * not the production COMPLETE-latch trigger: the latch lives in a `useEffect`
 * that observes the *committed* `scrubTimeSec` reducer state, so the helper
 * itself stays a pure clock advance and the latching decision stays
 * reactive. Callers should not branch on `reachedEnd` to drive state
 * transitions; treat it as a debugging / test convenience.
 */
export function computeNextScrubSec(
  currentScrubSec: number | null,
  wallDeltaSec: number,
  simulationSpeed: UnderfrequencyPlaybackSpeed,
  totalTimeSec: number,
): { readonly timeSec: number | null; readonly reachedEnd: boolean } {
  if (!Number.isFinite(wallDeltaSec) || wallDeltaSec <= 0) {
    return { timeSec: currentScrubSec, reachedEnd: false };
  }
  const start = currentScrubSec ?? 0;
  const next = Math.min(totalTimeSec, start + wallDeltaSec * simulationSpeed);
  return { timeSec: next, reachedEnd: next >= totalTimeSec };
}

/**
 * Decide whether a frame should dispatch a `SET_SCRUB_TIME`. The clock runs at
 * up to 60 fps, but the scrub usually advances sub-millisecond per frame; we
 * still need one update per frame so the crosshair tracks the cursor, yet we
 * must never dispatch when nothing changed (first frame, zero delta) or when
 * the next value is not finite — both would churn the reducer / memos for no
 * gain and the latter would be dropped by the reducer anyway.
 */
export function shouldDispatchScrub(
  currentScrubSec: number | null,
  nextScrubSec: number | null,
): boolean {
  if (nextScrubSec === null || !Number.isFinite(nextScrubSec)) return false;
  if (currentScrubSec === null) return true;
  return nextScrubSec !== currentScrubSec;
}

export interface UseUnderfrequencyPlaybackParams {
  readonly playbackState: UnderfrequencyPlaybackState;
  readonly simulationSpeed: UnderfrequencyPlaybackSpeed;
  readonly totalTimeSec: number;
  readonly scrubTimeSec: number | null;
  readonly dispatch: Dispatch<UnderfrequencyAction>;
}

export function useUnderfrequencyPlayback({
  playbackState,
  simulationSpeed,
  totalTimeSec,
  scrubTimeSec,
  dispatch,
}: UseUnderfrequencyPlaybackParams): void {
  const previousFrameMs = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);
  const scrubTimeSecRef = useRef<number | null>(scrubTimeSec);
  scrubTimeSecRef.current = scrubTimeSec;

  // Playback clock: advances scrubTimeSec toward totalTimeSec while RUNNING.
  useEffect(() => {
    if (playbackState !== 'RUNNING' || totalTimeSec <= 0) {
      previousFrameMs.current = null;
      return undefined;
    }
    const tick = (timestampMs: number) => {
      if (previousFrameMs.current === null) previousFrameMs.current = timestampMs;
      const wallDeltaSec = Math.max(0, (timestampMs - previousFrameMs.current) / 1000);
      previousFrameMs.current = timestampMs;
      const current = scrubTimeSecRef.current;
      const { timeSec: next } = computeNextScrubSec(
        current,
        wallDeltaSec,
        simulationSpeed,
        totalTimeSec,
      );
      if (shouldDispatchScrub(current, next)) {
        dispatch({ type: 'SET_SCRUB_TIME', timeSec: next });
      }
      animationFrame.current = window.requestAnimationFrame(tick);
    };
    animationFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      previousFrameMs.current = null;
    };
  }, [dispatch, playbackState, simulationSpeed, totalTimeSec]);

  // Single, sole COMPLETE latch: fires reactively against the committed
  // scrub value once scrubTimeSec reaches totalTimeSec. The latch is driven
  // by the committed scrub state in this effect — not by the rAF tick — so
  // it cannot fire on a speculative or transient value, only on what the
  // reducer has actually accepted. This is the canonical placement for a
  // state-transition latching in React: side effects on a state change
  // belong in an effect, not in the sampler.
  useEffect(() => {
    if (playbackState === 'RUNNING' && totalTimeSec > 0 && (scrubTimeSec ?? 0) >= totalTimeSec) {
      dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    }
  }, [dispatch, playbackState, scrubTimeSec, totalTimeSec]);
}
