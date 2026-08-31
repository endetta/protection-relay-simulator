/**
 * Underfrequency playback clock hook (page-level).
 *
 * Drives engineering-time playback at requestAnimationFrame cadence while
 * `playbackState === 'RUNNING'`, dispatching `SET_SCRUB_TIME` into the reducer
 * so every consumer (SLD, timeline chart, generator diagram, analysis) shares
 * the same synchronized clock snapshot.
 *
 * Latches `SET_PLAYBACK_STATE('COMPLETE')` when `scrubTimeSec >= totalTimeSec`.
 *
 * The scrub computation is exposed as a pure helper (`computeNextScrubSec`) so
 * it can be unit-tested without rAF or React.
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
 * clamping at `totalTimeSec`. Returns `null` when the run is exhausted (caller
 * should latch `COMPLETE`).
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
      const current = scrubTimeSecRef.current ?? 0;
      const next = Math.min(totalTimeSec, current + wallDeltaSec * simulationSpeed);
      dispatch({ type: 'SET_SCRUB_TIME', timeSec: next });
      animationFrame.current = window.requestAnimationFrame(tick);
    };
    animationFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      previousFrameMs.current = null;
    };
  }, [dispatch, playbackState, simulationSpeed, totalTimeSec]);

  // When playback reaches the end, latch COMPLETE.
  useEffect(() => {
    if (playbackState === 'RUNNING' && totalTimeSec > 0 && (scrubTimeSec ?? 0) >= totalTimeSec) {
      dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    }
  }, [dispatch, playbackState, scrubTimeSec, totalTimeSec]);
}
