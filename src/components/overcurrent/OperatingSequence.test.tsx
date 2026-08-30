import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialOvercurrentParameterState, type OvercurrentParameterAction } from '../../utils/overcurrentState';
import { OperatingSequence } from './OperatingSequence';

const noopDispatch = (_action: OvercurrentParameterAction) => undefined;

describe('O11 Operating Sequence component', () => {
  it('renders a ready generic three-relay sequence without pretending the fault has already been applied', () => {
    const markup = renderToStaticMarkup(<OperatingSequence state={createInitialOvercurrentParameterState('COORD-02')} dispatch={noopDispatch} />);
    expect(markup).toContain('Operating Sequence');
    expect(markup).toContain('READY TO APPLY FAULT');
    expect(markup.match(/class="overcurrent-sequence-row"/g)).toHaveLength(3);
    expect(markup).toContain('R3');
    expect(markup).toContain('BACKUP 1');
    expect(markup).toContain('BACKUP 2');
    expect(markup).toContain('0 recorded');
    expect(markup).not.toContain('FAULT APPLIED</span>');
  });

  it('uses O07 engineering state at t=0 once a timed run has begun', () => {
    const state = { ...createInitialOvercurrentParameterState('COORD-02'), playbackState: 'RUNNING' as const };
    const markup = renderToStaticMarkup(<OperatingSequence state={state} dispatch={noopDispatch} />);
    expect(markup).toContain('PICKUP / TIMING');
    expect(markup).toContain('51 TIMING');
    expect(markup).toContain('FAULT APPLIED');
    expect(markup).toContain('51 PICKUP');
  });

  it('renders the instantaneous 50 branch separately from breaker clearing', () => {
    const state = { ...createInitialOvercurrentParameterState('OVC-05'), playbackState: 'RUNNING' as const };
    const markup = renderToStaticMarkup(<OperatingSequence state={state} dispatch={noopDispatch} />);
    expect(markup).toContain('BREAKER CLEARING');
    expect(markup).toContain('50 · TRIPPED');
    expect(markup).toContain('50 TRIP OUTPUT');
  });
});
