import { renderToStaticMarkup } from 'react-dom/server';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createInitialOvercurrentParameterState, type OvercurrentParameterAction, type OvercurrentParameterState } from '../../utils/overcurrentState';
import { GuidedChallengeCard } from './GuidedChallengeCard';
import { OperatingSequence } from './OperatingSequence';
import { OvercurrentAnalysisPanel } from './OvercurrentAnalysisPanel';
import { OvercurrentParameterPanel } from './OvercurrentParameterPanel';
import { RadialProtectionDiagram } from './RadialProtectionDiagram';
import { TimeCurrentCurve } from './TimeCurrentCurve';
import { buildOvercurrentGuidedChallengeModel } from '../../presentation/overcurrentGuidedChallenge';

const noopDispatch = (_action: OvercurrentParameterAction) => undefined;

const parameterSections: Record<string, boolean> = {
  study: true,
  system: true,
  coordination: true,
  simulation: true,
};

const analysisSections: Record<string, boolean> = {
  status: true,
  study: false,
  order: false,
  measurement: false,
  audit: true,
  impact: true,
  calculation: false,
  events: false,
};

function renderAnalysisPanel(state: OvercurrentParameterState): string {
  const Wrapper = () => {
    const [sections, setSections] = useState<Record<string, boolean>>(analysisSections);
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

function renderParameterPanel(state: OvercurrentParameterState): string {
  const Wrapper = () => {
    const [sections, setSections] = useState<Record<string, boolean>>(parameterSections);
    return (
      <OvercurrentParameterPanel
        state={state}
        dispatch={noopDispatch}
        sections={sections}
        setSections={setSections}
      />
    );
  };
  return renderToStaticMarkup(<Wrapper />);
}

describe('O14 responsive / accessibility / UX contracts', () => {
  it('exposes expanded engineering view entry points without route integration', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const sld = renderToStaticMarkup(<RadialProtectionDiagram state={state} dispatch={noopDispatch} />);
    const tcc = renderToStaticMarkup(<TimeCurrentCurve state={state} dispatch={noopDispatch} />);

    expect(sld).toContain('aria-label="Expand single-line diagram"');
    expect(tcc).toContain('aria-label="Expand time-current characteristic"');
    expect(sld).toContain('aria-label="Scrollable single-line diagram"');
    expect(sld).not.toContain('simulator/overcurrent');
    expect(tcc).not.toContain('simulator/overcurrent');
  });

  it('keeps engineering graph content available as non-visual text', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const markup = renderToStaticMarkup(<TimeCurrentCurve state={state} dispatch={noopDispatch} />);

    expect(markup).toContain('overcurrent-visually-hidden');
    expect(markup).toContain('R3, PRIMARY');
    expect(markup).toContain('observed CTI');
    expect(markup).toContain('Use left and right arrow keys to inspect the characteristic.');
  });

  it('publishes high-level status and timeline progress semantics', () => {
    const running = { ...createInitialOvercurrentParameterState('COORD-02'), playbackState: 'RUNNING' as const };
    const sequence = renderToStaticMarkup(<OperatingSequence state={running} dispatch={noopDispatch} />);
    const analysis = renderAnalysisPanel(running);
    const parameters = renderParameterPanel(running);

    expect(sequence).toContain('role="progressbar"');
    expect(sequence).toContain('aria-label="Overall engineering timeline progress"');
    expect(sequence).toContain('aria-live="polite"');
    expect(analysis).toContain('aria-live="polite"');
    expect(parameters).toContain('FAULT RUNNING · SETTINGS LOCKED');
    expect(parameters).toContain('aria-live="polite"');
  });

  it('keeps Guided challenge status and validation semantics text-first', () => {
    const state = createInitialOvercurrentParameterState('COORD-05');
    const model = buildOvercurrentGuidedChallengeModel(state);
    const markup = renderToStaticMarkup(<GuidedChallengeCard model={model} dispatch={noopDispatch} />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('RUN-ALL VALIDATION');
    expect(markup).toContain('PROGRESSIVE HINTS');
    expect(markup).toContain('Instantaneous Coordination');
  });
});
