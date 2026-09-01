import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DistanceSimulator } from './DistanceSimulator';

function renderInRouter(node: ReactNode): string {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
}

describe('Distance page / route integration contracts', () => {
  it('composes Parameters, RX plane, and SLD in one page', () => {
    const markup = renderInRouter(<DistanceSimulator />);

    expect(markup).toContain('Distance Relay');
    expect(markup).toContain('Parameters');
    expect(markup).toContain('R-X Plane');
    expect(markup).toContain('Topology · single-line diagram');
    expect(markup).toContain('Guided Study');
    expect(markup).toBeDefined();
  });
});