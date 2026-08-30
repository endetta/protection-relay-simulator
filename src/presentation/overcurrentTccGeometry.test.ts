import { describe, expect, it } from 'vitest';
import { mapClientPointToTccViewBox } from './overcurrentTccGeometry';

describe('O10H TCC client/viewBox mapping', () => {
  it('maps the center correctly when a wide viewport creates horizontal letterboxing', () => {
    const mapped = mapClientPointToTccViewBox(500, 150, {
      left: 0,
      top: 0,
      width: 1000,
      height: 300,
    }, 900, 520);
    expect(mapped?.x).toBeCloseTo(450, 12);
    expect(mapped?.y).toBeCloseTo(260, 12);
  });

  it('maps the center correctly when a tall/narrow viewport creates vertical letterboxing', () => {
    const mapped = mapClientPointToTccViewBox(207, 180, {
      left: 0,
      top: 0,
      width: 414,
      height: 360,
    }, 900, 520);
    expect(mapped?.x).toBeCloseTo(450, 12);
    expect(mapped?.y).toBeCloseTo(260, 12);
  });

  it('rejects invalid dimensions rather than producing non-finite coordinates', () => {
    expect(mapClientPointToTccViewBox(10, 10, { left: 0, top: 0, width: 0, height: 100 }, 900, 520)).toBeNull();
  });
});
