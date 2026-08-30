import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { computeUnderfrequencyTimeline } from '../../engines/underfrequencyTimeline';
import { getUnderfrequencyStudyPreset } from '../../studies/underfrequencyPresets';
import { studyFromPreset } from '../../utils/underfrequencyState';
import type { UnderfrequencyStudyDefinition, UnderfrequencyTimelineSnapshot } from '../../types/underfrequency';
import { GeneratorDiagram } from './GeneratorDiagram';

function snapshotFor(presetId: string): UnderfrequencyTimelineSnapshot {
  const preset = getUnderfrequencyStudyPreset(presetId);
  const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
  const run = computeUnderfrequencyTimeline(study);
  if (run.status === 'INVALID' || run.snapshots.length === 0) throw new Error('No valid snapshot for test');
  return run.snapshots[run.snapshots.length - 1];
}

function renderDiagram(presetId: string): string {
  const preset = getUnderfrequencyStudyPreset(presetId);
  const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
  const snapshot = snapshotFor(presetId);
  return renderToStaticMarkup(<GeneratorDiagram snapshot={snapshot} study={study} />);
}

describe('UFR Generator Diagram', () => {
  it('renders four generator rows with output, governor, and RPM stat tiles', () => {
    const markup = renderDiagram('UFR-02');
    expect(markup).toContain('Generator Diagram');
    expect(markup).toContain('Generator response diagram');
    expect(markup.match(/class="underfrequency-gen-diagram-row"/g)).toHaveLength(4);
    expect(markup.match(/>Output</g)).toHaveLength(4);
    expect(markup.match(/>Governor</g)).toHaveLength(4);
    expect(markup.match(/>RPM</g)).toHaveLength(4);
    expect(markup.match(/>Droop</g)).toHaveLength(4);
    expect(markup.match(/>Headroom</g)).toHaveLength(4);
    expect(markup).toContain('MW');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });

  it('shows NO SNAPSHOT status when no snapshot is available', () => {
    const preset = getUnderfrequencyStudyPreset('UFR-02');
    const study: UnderfrequencyStudyDefinition = studyFromPreset(preset);
    const markup = renderToStaticMarkup(<GeneratorDiagram snapshot={null} study={study} />);
    expect(markup).toContain('NO SNAPSHOT');
  });
});
