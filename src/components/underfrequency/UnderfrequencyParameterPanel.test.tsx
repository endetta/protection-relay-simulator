import { renderToStaticMarkup } from 'react-dom/server';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  createInitialUnderfrequencyState,
  underfrequencyReducer,
  type UnderfrequencyAction,
} from '../../utils/underfrequencyState';
import { UnderfrequencyParameterPanel } from './UnderfrequencyParameterPanel';

const noopDispatch = (_action: UnderfrequencyAction) => undefined;

function renderPanel(presetId: string): string {
  const state = createInitialUnderfrequencyState(presetId);
  const Wrapper = () => {
    const [sections, setSections] = useState<Record<string, boolean>>({
      study: true,
      system: true,
      gen: true,
      relay: true,
      ufls: true,
      disturbance: true,
      simulation: true,
    });
    return (
      <UnderfrequencyParameterPanel
        state={state}
        dispatch={noopDispatch}
        sections={sections}
        setSections={setSections}
      />
    );
  };
  return renderToStaticMarkup(<Wrapper />);
}

describe('UFR Parameter editor', () => {
  it('renders the collapse-by-default parameter grammar with clear section titles', () => {
    const markup = renderPanel('UFR-02');
    expect(markup).toContain('Underfrequency relay parameter editor');
    expect(markup).toContain('Scenario / Preset');
    expect(markup).toContain('System');
    expect(markup).toContain('Relay');
    expect(markup).toContain('UFLS Stages');
    expect(markup).toContain('Disturbance');
    expect(markup).toContain('Simulation');
    expect(markup).toContain('Nominal frequency');
    expect(markup).toContain('Base load');
  });

  it('renders four generators with distinct droop and inertia parameters', () => {
    const markup = renderPanel('UFR-02');
    expect(markup.match(/>Rated MW</g)).toHaveLength(4);
    expect(markup.match(/>Inertia H</g)).toHaveLength(4);
    expect(markup.match(/>Droop R</g)).toHaveLength(4);
    expect(markup).toContain('Governor max');
    expect(markup).toContain('ANSI function');
    expect(markup).toContain('81U — Underfrequency');
  });

  it('renders the UFLS ladder with threshold/delay/shed fields and PLN not-verified note', () => {
    const markup = renderPanel('UFR-02');
    expect(markup.match(/>Threshold</g)).toHaveLength(4);
    expect(markup.match(/>Delay</g)).toHaveLength(4);
    expect(markup.match(/>Shed fraction</g)).toHaveLength(4);
    expect(markup).toContain('PLN STANDARD — NOT VERIFIED');
  });

  it('renders the disturbance schedule and deterministic run controls', () => {
    const markup = renderPanel('UFR-02');
    expect(markup).toContain('GEN LOSS');
    expect(markup).toContain('Manual ΔP (load step)');
    expect(markup).toContain('Add generator loss');
    expect(markup).toContain('Playback speed');
    expect(markup).toContain('Engineering run');
    expect(markup).toContain('aria-label="Simulation playback speed"');
  });

  it('reports invalid state when a non-finite or out-of-range setting is applied', () => {
    let state = createInitialUnderfrequencyState('UFR-02');
    state = underfrequencyReducer(state, { type: 'SET_UFLS_STAGE', stageId: 'S2', patch: { thresholdHz: 46 } });
    // Force an invalid ordering: Stage 2 threshold above Stage 1.
    state = underfrequencyReducer(state, { type: 'SET_UFLS_STAGE', stageId: 'S1', patch: { thresholdHz: 48.5 } });
    const Wrapper = () => {
      const [sections, setSections] = useState<Record<string, boolean>>({ study: true, system: true, gen: true, relay: true, ufls: true, disturbance: true, simulation: true });
      return (
        <UnderfrequencyParameterPanel
          state={state}
          dispatch={noopDispatch}
          sections={sections}
          setSections={setSections}
        />
      );
    };
    const markup = renderToStaticMarkup(<Wrapper />);
    expect(markup).toContain('INPUT INVALID · OUTPUT HELD');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });
});
