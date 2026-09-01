/**
 * DistanceGuidedChallengeCard component tests (P5).
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { studyFromPreset } from '../../utils/distanceState';
import { getDistanceStudyPreset } from '../../studies/distancePresets';
import { DistanceGuidedChallengeCard } from './DistanceGuidedChallengeCard';

function renderForPreset(presetId: string): string {
  const study = studyFromPreset(getDistanceStudyPreset(presetId));
  return renderToStaticMarkup(<DistanceGuidedChallengeCard study={study} />);
}

describe('DistanceGuidedChallengeCard', () => {
  it('renders all four challenge descriptions', () => {
    const markup = renderForPreset('DIST-01');
    expect(markup).toContain('Underreach Prevention');
    expect(markup).toContain('Overreach Prevention');
    expect(markup).toContain('Zone 2 Timing');
    expect(markup).toContain('Load Encroachment');
  });

  it('marks the active preset as active', () => {
    const markup = renderForPreset('DIST-02');
    expect(markup).toContain('data-active="true"');
  });

  it('never renders NaN or Infinity', () => {
    expect(renderForPreset('DIST-04')).not.toMatch(/NaN|Infinity/);
  });
});
