import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { computeUnderfrequencyTimeline } from '../../engines/underfrequencyTimeline';
import { getUnderfrequencyStudyPreset } from '../../studies/underfrequencyPresets';
import { studyFromPreset } from '../../utils/underfrequencyState';
import type { UnderfrequencyStudyDefinition } from '../../types/underfrequency';
import { FrequencyTimelineChart } from './FrequencyTimelineChart';

function renderChart(presetId: string, scrubTimeSec: number | null = null): string {
  const preset = getUnderfrequencyStudyPreset(presetId);
  const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
  const run = computeUnderfrequencyTimeline(study);
  // Resolve the visible snapshot the way the page does (snapshotAtTime semantics).
  const visibleSnapshot =
    run.status === 'VALID' && run.snapshots.length > 0
      ? scrubTimeSec === null
        ? run.snapshots[run.snapshots.length - 1]
        : run.snapshots.reduce((best, s) =>
            Math.abs(s.engineeringTimeSec - (scrubTimeSec ?? 0)) < Math.abs(best.engineeringTimeSec - (scrubTimeSec ?? 0)) ? s : best,
            run.snapshots[0],
          )
      : null;
  return renderToStaticMarkup(
    <FrequencyTimelineChart
      run={run}
      study={study}
      scrubTimeSec={scrubTimeSec}
      visibleSnapshot={visibleSnapshot}
    />,
  );
}

function renderChartWithoutRun(presetId: string): string {
  const preset = getUnderfrequencyStudyPreset(presetId);
  const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
  return renderToStaticMarkup(
    <FrequencyTimelineChart
      run={null}
      study={study}
      scrubTimeSec={null}
      visibleSnapshot={null}
    />,
  );
}

describe('UFR Frequency — Time chart', () => {
  it('renders a curve with nominal line, stage thresholds, and a readable axis', () => {
    const markup = renderChart('UFR-02');
    expect(markup).toContain('Frequency — Time');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('System frequency');
    expect(markup).toContain('Nominal 50.00 Hz');
    expect(markup).toContain('Engineering Time (s)');
    expect(markup).toContain('Frequency (Hz)');
    expect(markup).toContain('class="underfrequency-ftc-curve"');
    expect(markup).toContain('class="underfrequency-ftc-nominal"');
    // Four enabled UFLS stage threshold lines.
    expect(markup.match(/class="underfrequency-ftc-stage"/g)).toHaveLength(4);
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });

  it('renders the readout and legend (playback bar lives at the page level now)', () => {
    const markup = renderChart('UFR-02');
    expect(markup).toContain('f NOW');
    expect(markup).toContain('MIN f');
    expect(markup).toContain('STEADY');
    expect(markup).toContain('UFLS threshold');
    expect(markup).toContain('UFLS trip');
    // Playback controls moved to the global page-level bar in Phase 3.
    expect(markup).not.toContain('aria-label="Kontrol playback Underfrequency"');
    expect(markup).not.toContain('aria-label="Geser timeline underfrequency"');
  });

  it('does NOT render Story-mode controls (removed in Phase 3)', () => {
    const markup = renderChart('UFR-02');
    expect(markup).not.toContain('Story');
    expect(markup).not.toContain('Langkah fase story');
  });

  it('renders a scrub crosshair when a scrub time is provided', () => {
    const markup = renderChart('UFR-02', 1);
    expect(markup).toContain('underfrequency-ftc-scrub-crosshair');
  });

  it('does not render a scrub crosshair when scrub time is null', () => {
    const markup = renderChart('UFR-02', null);
    expect(markup).not.toContain('underfrequency-ftc-scrub-crosshair');
  });

  it('holds the graph when no run is provided rather than crashing', () => {
    const markup = renderChartWithoutRun('UFR-02');
    expect(markup).toContain('INPUT INVALID · GRAPH HELD');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });
});
