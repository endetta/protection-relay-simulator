import { renderToStaticMarkup } from 'react-dom/server';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  createInitialOvercurrentParameterState,
  overcurrentParameterReducer,
  type OvercurrentParameterAction,
} from '../../utils/overcurrentState';
import { OvercurrentAnalysisPanel } from './OvercurrentAnalysisPanel';

const noopDispatch = (_action: OvercurrentParameterAction) => undefined;

function renderPanel(state: ReturnType<typeof createInitialOvercurrentParameterState>): string {
  const Wrapper = () => {
    const [sections, setSections] = useState<Record<string, boolean>>({
      status: true,
      study: false,
      order: false,
      measurement: false,
      audit: true,
      impact: true,
      calculation: false,
      events: false,
    });
    return (
      <OvercurrentAnalysisPanel
        state={state}
        dispatch={noopDispatch}
        sections={sections}
        setSections={setSections}
      />
    );
  };
  return renderToStaticMarkup(<Wrapper />);
}

describe('O12 Analysis / Learning component', () => {
  it('renders hierarchy, run-all control, margins, checks, and canonical violation', () => {
    const markup = renderPanel(createInitialOvercurrentParameterState('COORD-02'));
    expect(markup).toContain('COORDINATION INCOMPLETE');
    expect(markup).toContain('Run Coordination Test');
    expect(markup).toContain('Operating Order');
    expect(markup).toContain('Relay Current / Current Multiple');
    expect(markup).toContain('Coordination Audit');
    expect(markup).toContain('TIME GRADING FAIL');
    expect(markup).toContain('GUIDED STUDY · COORD-02');
    expect(markup).toContain('STUDY OBJECTIVE');
    expect(markup).toContain('PROGRESSIVE HINTS');
    // Events and Calculation Details are now conditionally rendered — hidden when empty
    expect(markup).not.toContain('Events');
  });

  it('renders initial/current learning comparison after a setting edit', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = overcurrentParameterReducer(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
    const markup = renderPanel(state);
    expect(markup).toContain('COORDINATED');
    expect(markup).toContain('INITIAL → CURRENT');
    expect(markup).toContain('0.18 → 0.19');
    expect(markup).toContain('5/6 → 6/6');
  });

  it('simplifies Single Relay Study and does not expose coordination-only validation control', () => {
    const markup = renderPanel(createInitialOvercurrentParameterState('OVC-03'));
    expect(markup).toContain('PICKUP');
    expect(markup).not.toContain('Run Coordination Test');
    expect(markup).not.toContain('Coordination Audit');
  });
});
