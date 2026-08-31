import { describe, expect, it } from 'vitest';
import { computeNextScrubSec } from './underfrequencyPlayback';

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

  it('returns null and reachedEnd when already at end', () => {
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
