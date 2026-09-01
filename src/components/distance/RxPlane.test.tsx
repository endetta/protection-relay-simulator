/**
 * RxPlane component tests (P4).
 *
 * Render-only assertions: zone paths carry data-zone, load region renders
 * only when enabled, fault-point tone reflects display status, and no stray
 * NaN/Infinity appears in markup.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { evaluateDistanceDevice } from '../../engines/distanceMeasurement';
import { getDistanceStudyPreset } from '../../studies/distancePresets';
import type { DistanceStudyDefinition } from '../../types/distance';
import { studyFromPreset } from '../../utils/distanceState';
import { RxPlane } from './RxPlane';

function renderRx(presetId: string): string {
  const study: DistanceStudyDefinition = studyFromPreset(getDistanceStudyPreset(presetId));
  const result = evaluateDistanceDevice({
    vLLKvPrimary: study.system.vLLKvPrimary,
    faultCurrentA: study.faultCurrentA,
    faultType: study.faultType,
    k0: study.k0,
    rArcOhmPrimary: study.settings.rArcOhmPrimary,
    z1AngleDeg: study.line.z1AngleDeg,
    settings: study.settings,
    faultPct: study.faultPct,
  });
  return renderToStaticMarkup(<RxPlane study={study} result={result} />);
}

describe('RxPlane', () => {
  it('renders zone paths with data-zone attributes', () => {
    const markup = renderRx('DIST-01');
    expect(markup).toContain('data-zone="Z1"');
    expect(markup).toContain('data-zone="Z2"');
    expect(markup).toContain('data-zone="Z3"');
  });

  it('renders the load region only when enabled', () => {
    const markupLoaded = renderRx('DIST-04');
    expect(markupLoaded).toContain('distance-rx-load-region');

    // A preset with load encroachment disabled must not draw the region.
    const study = studyFromPreset(getDistanceStudyPreset('DIST-01'));
    const studyNoLoad: DistanceStudyDefinition = {
      ...study,
      settings: { ...study.settings, loadEncroachment: { ...study.settings.loadEncroachment, enabled: false } },
    };
    const result = evaluateDistanceDevice({
      vLLKvPrimary: studyNoLoad.system.vLLKvPrimary,
      faultCurrentA: studyNoLoad.faultCurrentA,
      faultType: studyNoLoad.faultType,
      k0: studyNoLoad.k0,
      rArcOhmPrimary: studyNoLoad.settings.rArcOhmPrimary,
      z1AngleDeg: studyNoLoad.line.z1AngleDeg,
      settings: studyNoLoad.settings,
      faultPct: studyNoLoad.faultPct,
    });
    const markupOff = renderToStaticMarkup(<RxPlane study={studyNoLoad} result={result} />);
    expect(markupOff).not.toContain('distance-rx-load-region');
  });

  it('paints the fault point with the operate tone for an in-zone fault', () => {
    const markup = renderRx('DIST-02');
    expect(markup).toMatch(/data-tone="operate"/);
  });

  it('paints the fault point with the restrain tone when suppressed by load region', () => {
    const markup = renderRx('DIST-04');
    expect(markup).toMatch(/data-tone="restrain"/);
  });

  it('never renders NaN or Infinity', () => {
    const markup = renderRx('DIST-01');
    expect(markup).not.toMatch(/NaN|Infinity/);
  });

  it('has an accessible label on the impedance plane', () => {
    const markup = renderRx('DIST-01');
    expect(markup).toContain('aria-label');
    expect(markup).toContain('R-X');
  });
});
