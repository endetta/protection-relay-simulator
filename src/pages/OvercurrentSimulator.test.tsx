import { useState, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SimulatorHeader } from '../components/SimulatorHeader';
import { OvercurrentAnalysisPanel } from '../components/overcurrent/OvercurrentAnalysisPanel';
import { createInitialOvercurrentParameterState, type OvercurrentParameterAction } from '../utils/overcurrentState';
import { OvercurrentSimulator } from './OvercurrentSimulator';
import { SimulatorHome } from './SimulatorHome';

function renderInRouter(node: ReactNode): string {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
}

describe('O15 Overcurrent page / route integration contracts', () => {
  it('composes Parameters, SLD, TCC, Operating Sequence and Analysis in one page', () => {
    const markup = renderInRouter(<OvercurrentSimulator />);

    expect(markup).toContain('Overcurrent Relay');
    expect(markup).toContain('Parameters');
    expect(markup).toContain('50 / 51 characteristic');
    expect(markup).toContain('Time-Current Characteristic');
    expect(markup).toContain('Topology · single-line diagram');
    expect(markup).toContain('Operating Sequence');
    expect(markup).toContain('OVC-01');
    expect(markup).not.toContain('50 / 51 PROTECTION &amp; COORDINATION');
    expect(markup.indexOf('Time-Current Characteristic')).toBeLessThan(markup.indexOf('Topology · single-line diagram'));
    // The global header represents executed/validated state, not a predicted
    // static pickup/trip for a merely selected study current.
    expect(markup).toContain('READY');
  });

  it('keeps the shared Home control and module-specific header identity', () => {
    const markup = renderInRouter(<OvercurrentSimulator />);

    expect(markup).toContain('href="/"');
    expect(markup).toContain('Protection System Simulator');
    expect(markup).toContain('Overcurrent Relay');
    expect(markup).not.toContain('Differential Model Help');
    expect(markup).toContain('Open Overcurrent relay help');
  });

  it('activates Overcurrent on the existing minimal Homepage without activating future modules', () => {
    const markup = renderInRouter(<SimulatorHome />);

    expect(markup).toContain('Overcurrent Relay');
    expect(markup).toContain('Differential Relay');
    expect(markup).toContain('Distance Relay');
    expect(markup).toContain('Underfrequency Relay');
    expect(markup).toContain('data-available="true"');
    expect((markup.match(/data-available="true"/g) ?? []).length).toBe(4);
    expect((markup.match(/data-available="false"/g) ?? []).length).toBe(0);
    expect(markup).not.toContain('data-available="false"');
  });

  it('preserves the Differential header defaults while allowing module-specific Overcurrent identity', () => {
    const markup = renderInRouter(
      <SimulatorHeader scenario='Normal Load' status='RESTRAIN' onReset={() => undefined} onHelp={() => undefined} />,
    );

    expect(markup).toContain('Differential Relay');
    expect(markup).toContain('RESTRAIN');
    expect(markup).toContain('Open differential relay help');
  });

  it('blocks run-all validation while a page-level numeric draft is invalid', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const dispatch = (_action: OvercurrentParameterAction) => undefined;
    const Wrapper = () => {
      const [sections, setSections] = useState<Record<string, boolean>>({
        status: false,
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
          dispatch={dispatch}
          inputDraftValid={false}
          sections={sections}
          setSections={setSections}
        />
      );
    };
    const markup = renderInRouter(<Wrapper />);

    // When inputDraftValid=false, the analysis panel shows "INPUT INVALID / OUTPUT HELD" 
    // as the status badge label, and "Correct the invalid parameter draft before continuing." 
    // as the sublabel in the collapsed summary, but it suppresses the duplicate invalid banner.
    expect(markup).toContain('INPUT INVALID / OUTPUT HELD');
    expect(markup).toContain('Correct the invalid parameter draft before continuing.');
    expect(markup).toContain('disabled');
  });

});
