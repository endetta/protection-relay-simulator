/**
 * DistanceParameterPanel component tests (P4).
 *
 * Render-only assertions: preset list, topology/scheme/characteristic
 * controls, quad controllers appear only for QUADRILATERAL, live summary
 * metrics, and no stray NaN/Infinity.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createInitialDistanceState,
  distanceStateReducer,
} from '../../utils/distanceState';
import type { DistanceSimulatorState } from '../../utils/distanceState';
import { DistanceParameterPanel } from './DistanceParameterPanel';

function noop(): undefined {
  return undefined;
}

function renderPanel(state: DistanceSimulatorState): string {
  return renderToStaticMarkup(<DistanceParameterPanel state={state} dispatch={noop} />);
}

describe('DistanceParameterPanel', () => {
  it('renders the preset list and default mho characteristic', () => {
    const state = createInitialDistanceState('DIST-01');
    const markup = renderPanel(state);

    expect(markup).toContain('DIST-01');
    expect(markup).toContain('Zone 1 Internal Fault');
    expect(markup).toContain('MHO CIRCLE');
    // Quadrilateral group is hidden when mho is active.
    expect(markup).not.toContain('K (BLINDER)');
  });

  it('shows the quadrilateral controllers only when QUADRILATERAL is selected', () => {
    const state = distanceStateReducer(createInitialDistanceState('DIST-01'), {
      type: 'SET_CHARACTERISTIC_TYPE',
      characteristic: 'QUADRILATERAL',
    });
    const markup = renderPanel(state);

    expect(markup).toContain('Quadrilateral');
    expect(markup).toContain('K (BLINDER)');
    expect(markup).toContain('α (BOTTOM TILT)');
    expect(markup).toContain('β (TOP TILT)');
  });

  it('renders three zone fieldsets', () => {
    const markup = renderPanel(createInitialDistanceState('DIST-01'));
    expect(markup.match(/distance-parameter-zone"/g)).toHaveLength(3);
  });

  it('shows a live evaluation summary for the active study', () => {
    const markup = renderPanel(createInitialDistanceState('DIST-01'));
    // DIST-01 trips in Z1 instantly.
    expect(markup).toContain('OPERATE');
    expect(markup).toContain('TRIP ZONE');
  });

  it('never renders NaN or Infinity', () => {
    const markup = renderPanel(createInitialDistanceState('DIST-04'));
    expect(markup).not.toMatch(/NaN|Infinity/);
  });
});
