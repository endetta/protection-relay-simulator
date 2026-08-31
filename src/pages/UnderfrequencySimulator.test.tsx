import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { UnderfrequencySimulator } from './UnderfrequencySimulator';
import { SimulatorHome } from './SimulatorHome';

function renderInRouter(node: ReactNode): string {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
}

describe('Underfrequency (81U) page / route integration contracts', () => {
  it('composes Parameters, Live Simulation and Analysis with the module identity', () => {
    const markup = renderInRouter(<UnderfrequencySimulator />);

    expect(markup).toContain('Underfrequency Relay');
    expect(markup).toContain('Parameter');
    expect(markup).toContain('Simulasi Langsung');
    expect(markup).toContain('Analisis');
    // Default live view is the SLD (D1); Generator/Load cards remain shared.
    expect(markup).toContain('Diagram satu garis');
    expect(markup).toContain('Generator Diagram');
    expect(markup).toContain('Load Shedding');
    // The default preset is UFR-01 Nominal — balanced, no disturbance.
    expect(markup).toContain('Operasi Nominal');
    // Global playback bar + view tabs above the panel.
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-label="Kontrol pemutaran simulasi global"');
  });

  it('keeps the shared Home control and module-specific header identity', () => {
    const markup = renderInRouter(<UnderfrequencySimulator />);

    expect(markup).toContain('href="/"');
    expect(markup).toContain('Protection System Simulator');
    expect(markup).toContain('Underfrequency Relay');
    // Not the Differential module-specific help text.
    expect(markup).not.toContain('Differential Model Help');
    expect(markup).toContain('Buka bantuan Underfrequency Relay');
  });

  it('activates Underfrequency on the homepage without dropping other available modules', () => {
    const markup = renderInRouter(<SimulatorHome />);

    expect(markup).toContain('Underfrequency Relay');
    expect(markup).toContain('Overcurrent Relay');
    expect(markup).toContain('Differential Relay');
    expect(markup).toContain('Distance Relay');
  });
});
