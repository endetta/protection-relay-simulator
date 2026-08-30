import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  createInitialOvercurrentParameterState,
  overcurrentParameterReducer,
  type OvercurrentParameterAction,
  type OvercurrentParameterState,
} from '../../utils/overcurrentState';
import { TimeCurrentCurve } from './TimeCurrentCurve';

const noopDispatch = (_action: OvercurrentParameterAction) => undefined;

function renderState(state: OvercurrentParameterState): string {
  return renderToStaticMarkup(<TimeCurrentCurve state={state} dispatch={noopDispatch} />);
}

function reduce(
  state: OvercurrentParameterState,
  action: Parameters<typeof overcurrentParameterReducer>[1],
): OvercurrentParameterState {
  return overcurrentParameterReducer(state, action);
}

describe('O10 Time-Current Curve', () => {
  it('renders a log-log, keyboard-accessible three-relay primary-current TCC', () => {
    const markup = renderState(createInitialOvercurrentParameterState('COORD-02'));

    expect(markup).toContain('Time-Current Characteristic');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('Primary Current (A primary) · log scale');
    expect(markup).toContain('Operating Time (s) · log scale');
    expect(markup).toContain('A Primary</button>');
    expect(markup.match(/data-layer-kind="RELAY_CURVE"/g)).toHaveLength(3);
    expect(markup.match(/data-layer-kind="OPERATING_POINT"/g)).toHaveLength(3);
    expect(markup.match(/data-layer-kind="COORDINATION_CORRIDOR"/g)).toHaveLength(2);
    expect(markup.match(/data-layer-kind="COORDINATION_BRACKET"/g)).toHaveLength(2);
    expect(markup).toContain('Δt');
    expect(markup).toContain('R3, IEC Very Inverse, pickup 0.8000 amperes secondary, selected');
    expect(markup).toContain('R2 operating point, BACKUP 1');
    expect(markup).toContain('tabindex="0"');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });

  it('does not offer Fit Point for a below-pickup study marker with no finite trip time', () => {
    const markup = renderState(createInitialOvercurrentParameterState('OVC-01'));
    expect(markup).toContain('BELOW PICKUP');
    expect(markup).not.toContain('Fit Point');
  });

  it('renders single-relay current-multiple defaults and exact 50 off-scale semantics', () => {
    const markup = renderState(createInitialOvercurrentParameterState('OVC-05'));

    expect(markup).toContain('Current Multiple (× pickup) · log scale');
    expect(markup).toContain('× Pickup</button>');
    expect(markup).toContain('data-layer-kind="INSTANTANEOUS_BOUNDARY"');
    expect(markup).toContain('data-element="50"');
    expect(markup).toContain('50 · 0 s · OFF-SCALE');
    expect(markup).toContain('Fit Point');
    expect(markup).toContain('50 high-set / 0 s off-scale');
  });

  it('renders initial/current comparison after a relay setting edit', () => {
    const initial = createInitialOvercurrentParameterState('OVC-03');
    const changed = reduce(initial, {
      type: 'SET_DEVICE_51_TIME_SCALE',
      deviceId: 'R1',
      value: 0.2,
    });
    const markup = renderState(changed);

    expect(markup).toContain('Initial comparison');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-layer-kind="INITIAL_SETTING_GHOST"');
    expect(markup).toContain('initial setting comparison');
    expect(markup.match(/class="overcurrent-tcc-curve-group"/g)).toHaveLength(2);
  });

  it('shares relay selection state with O09 and marks the selected TCC curve and point', () => {
    const initial = createInitialOvercurrentParameterState('COORD-02');
    const selected = reduce(initial, { type: 'SELECT_DEVICE', deviceId: 'R2' });
    const markup = renderState(selected);

    expect(markup).toContain('Selected <b>R2</b>');
    expect(markup).toMatch(/data-selected="true" data-ghost="false" data-device-id="R2"/);
    expect(markup).toContain('R2, IEC Very Inverse, pickup 1.0000 amperes secondary, selected');
    expect(markup).toMatch(/data-selected="true" data-element="51"[^>]*data-device-id="R2"/);
  });

  it('contains invalid state and keeps later-gate UI outside O10', () => {
    const valid = createInitialOvercurrentParameterState('COORD-02');
    const invalid = reduce(valid, {
      type: 'SET_DEVICE_CT',
      deviceId: 'R2',
      key: 'primaryRatedA',
      value: 0,
    });
    const markup = renderState(invalid);

    expect(markup).toContain('INPUT INVALID · GRAPH HELD');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
    expect(markup).not.toContain('Operating Sequence');
    expect(markup).not.toContain('Coordination Inspector');
    expect(markup).not.toContain('PROTECTION SYSTEM SIMULATOR');
  });
});
