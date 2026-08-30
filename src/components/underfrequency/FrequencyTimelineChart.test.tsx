import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { computeUnderfrequencyTimeline } from '../../engines/underfrequencyTimeline';
import { getUnderfrequencyStudyPreset } from '../../studies/underfrequencyPresets';
import { studyFromPreset, type UnderfrequencyAction } from '../../utils/underfrequencyState';
import type { UnderfrequencyStudyDefinition } from '../../types/underfrequency';
import { FrequencyTimelineChart } from './FrequencyTimelineChart';

const noopDispatch = (_action: UnderfrequencyAction) => undefined;

function renderChart(presetId: string, playbackState: string = 'COMPLETE'): string {
  const preset = getUnderfrequencyStudyPreset(presetId);
  const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
  const run = computeUnderfrequencyTimeline(study);
  return renderToStaticMarkup(
    <FrequencyTimelineChart
      run={run}
      study={study}
      playbackState={playbackState}
      simulationSpeed={1}
      dispatch={noopDispatch}
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
      playbackState='IDLE'
      simulationSpeed={1}
      dispatch={noopDispatch}
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

  it('renders the readout, legend, and Playback controls including speed and scrub', () => {
    const markup = renderChart('UFR-02');
    expect(markup).toContain('f NOW');
    expect(markup).toContain('MIN f');
    expect(markup).toContain('STEADY');
    expect(markup).toContain('UFLS threshold');
    expect(markup).toContain('UFLS trip');
    expect(markup).toContain('aria-label="Underfrequency playback control"');
    expect(markup).toContain('aria-label="Playback speed"');
    expect(markup).toContain('aria-label="Scrub underfrequency timeline"');
  });

  it('renders story-mode steps and a Story toggle in the header', () => {
    const markup = renderChart('UFR-02');
    expect(markup).toContain('Story');
    expect(markup).toContain('aria-pressed="false"');
  });

  it('holds the graph when no run is provided rather than crashing', () => {
    const markup = renderChartWithoutRun('UFR-02');
    expect(markup).toContain('INPUT INVALID · GRAPH HELD');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });
});
