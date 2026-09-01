/**
 * DistanceOneLine component tests (P4).
 *
 * Render-only assertions on the static markup: topology variation,
 * scheme link presence, accessibility labels, and no stray NaN/Infinity.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialDistanceState, distanceStateReducer } from '../../utils/distanceState';
import type { DistanceSimulatorState } from '../../utils/distanceState';
import { DistanceOneLine } from './DistanceOneLine';

function renderState(state: DistanceSimulatorState): string {
  return renderToStaticMarkup(<DistanceOneLine study={state.study} />);
}

describe('DistanceOneLine', () => {
  it('renders single-ended topology with one relay, no scheme link', () => {
    const state = createInitialDistanceState('DIST-01');
    const markup = renderState(state);

    expect(markup).toContain('Single-Ended');
    expect(markup).not.toContain('distance-sld-scheme-link');
    expect(markup).toContain('aria-label="Single-line diagram"');
    expect(markup).toContain('role="img"');
  });

  it('renders double-ended with two relays and a scheme link when a scheme is set', () => {
    const state = distanceStateReducer(createInitialDistanceState('DIST-01'), {
      type: 'APPLY_PRESET',
      presetId: 'DIST-02',
    });
    const markup = renderState(state);

    expect(markup).toContain('Double-Ended');
    expect(markup).toContain('distance-sld-scheme-link');
    expect(markup).toContain('POTT');
    expect(markup.match(/distance-sld-relay"/g)).toHaveLength(2);
    expect(markup).toContain('FWD');
    expect(markup).toContain('REV');
  });

  it('renders tapped topology with a tapped load symbol', () => {
    const state = distanceStateReducer(createInitialDistanceState('DIST-01'), {
      type: 'APPLY_PRESET',
      presetId: 'DIST-03',
    });
    const markup = renderState(state);

    expect(markup).toContain('Tapped');
    expect(markup).toContain('distance-sld-tapped');
    expect(markup).toContain('Tapped Load');
  });

  it('renders CT and VT metadata in the header', () => {
    const state = createInitialDistanceState('DIST-01');
    const markup = renderState(state);
    expect(markup).toContain('1200:1 CT');
    expect(markup).toContain('230 kV VT');
  });

  it('never renders NaN or Infinity', () => {
    const state = createInitialDistanceState('DIST-01');
    const markup = renderState(state);
    expect(markup).not.toMatch(/NaN|Infinity/);
  });
});