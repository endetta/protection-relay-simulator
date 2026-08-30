import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { computeUnderfrequencyTimeline } from '../../engines/underfrequencyTimeline';
import { getUnderfrequencyStudyPreset } from '../../studies/underfrequencyPresets';
import { studyFromPreset } from '../../utils/underfrequencyState';
import type { UnderfrequencyStudyDefinition, UnderfrequencyTimelineRun } from '../../types/underfrequency';
import { SheddingChart } from './SheddingChart';

function runFor(presetId: string): UnderfrequencyTimelineRun {
  const preset = getUnderfrequencyStudyPreset(presetId);
  const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
  return computeUnderfrequencyTimeline(study);
}

function renderChart(presetId: string): string {
  const preset = getUnderfrequencyStudyPreset(presetId);
  const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
  return renderToStaticMarkup(
    <SheddingChart uflsStages={study.uflsStages} baseLoadMw={study.system.baseLoadMw} run={runFor(presetId)} />,
  );
}

describe('UFR Load Shedding chart', () => {
  it('renders a descending-threshold UFLS ladder with threshold and shed MW', () => {
    const markup = renderChart('UFR-02');
    expect(markup).toContain('Load Shedding');
    expect(markup).toContain('UFLS ladder');
    expect(markup.match(/class="underfrequency-shedding-stage"/g)).toHaveLength(4);
    expect(markup).toContain('OPERATED');
    expect(markup).toContain('MW shed');
    expect(markup).toContain('Stage 1 — 49.50');
    expect(markup).toContain('Stage 4 — 48.00');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });

  it('renders DISABLED/OFF ladder rows when every stage is disabled, without crashing', () => {
    const preset = getUnderfrequencyStudyPreset('UFR-02');
    const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
    const stages = study.uflsStages.map((s) => ({ ...s, enabled: false }));
    const markup = renderToStaticMarkup(
      <SheddingChart uflsStages={stages} baseLoadMw={study.system.baseLoadMw} run={null} />,
    );
    expect(markup).toContain('DISABLED');
    expect(markup).toContain('OFF');
    expect(markup.match(/data-enabled="false"/g)).toHaveLength(4);
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });
});
