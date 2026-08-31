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

  it('keeps the scrub slider and readout in sync with the visible (last) snapshot when scrub is null (IDLE)', () => {
    const markup = renderInRouter(<UnderfrequencySimulator />);

    // When scrubTimeSec is null (initial IDLE / after CLEAR_RUN), snapshotAtTime
    // returns the last snapshot and the slider must sit at the end, not at 0.
    // Regression: scrubValue was `state.scrubTimeSec ?? 0`, so the view showed
    // the final snapshot while the slider thumb and readout showed 0.00s.
    const readoutMatch = markup.match(/class="underfrequency-scrub-readout[^"]*"[^>]*>([^<]+)<\/span>/);
    expect(readoutMatch).not.toBeNull();
    const readout = readoutMatch![1].trim();
    const [left, right] = readout.split('/').map((s) => s.trim());
    // At IDLE the readout must be "total / total" (e.g. "5.00s / 5.00s"), not "0.00s / 5.00s".
    expect(left).toBe(right);
    expect(left).not.toBe('0.00s');

    const inputTag = markup.match(/<input[^>]*aria-label="Geser waktu simulasi"[^>]*>/);
    expect(inputTag).not.toBeNull();
    const valueMatch = inputTag![0].match(/\svalue="([^"]+)"/);
    const maxMatch = inputTag![0].match(/\smax="([^"]+)"/);
    expect(valueMatch).not.toBeNull();
    expect(maxMatch).not.toBeNull();
    // Thumb at the end: value === max.
    expect(valueMatch![1]).toBe(maxMatch![1]);
  });
});
