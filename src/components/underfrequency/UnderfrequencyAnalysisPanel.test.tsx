import { renderToStaticMarkup } from 'react-dom/server';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { evaluateUnderfrequencySystem } from '../../engines/underfrequency';
import { computeUnderfrequencyTimeline } from '../../engines/underfrequencyTimeline';
import { createInitialUnderfrequencyState } from '../../utils/underfrequencyState';
import type {
  UnderfrequencyStaticResult,
  UnderfrequencyTimelineRun,
} from '../../types/underfrequency';
import { UnderfrequencyAnalysisPanel } from './UnderfrequencyAnalysisPanel';

function panelData(presetId: string): { state: ReturnType<typeof createInitialUnderfrequencyState>; staticResult: UnderfrequencyStaticResult; run: UnderfrequencyTimelineRun } {
  const state = createInitialUnderfrequencyState(presetId);
  const study = state.study;
  const staticEval = evaluateUnderfrequencySystem({
    system: study.system,
    generators: study.generators,
    uflsStages: study.uflsStages,
  });
  if (staticEval.status === 'INVALID') throw new Error(JSON.stringify(staticEval.issues));
  const run = computeUnderfrequencyTimeline(study);
  return { state, staticResult: staticEval.value, run };
}

function renderPanel(presetId: string): string {
  const { state, staticResult, run } = panelData(presetId);
  const Wrapper = () => {
    const [sections, setSections] = useState<Record<string, boolean>>({
      status: true,
      study: true,
      checks: true,
      summary: true,
      phases: false,
      calculation: false,
      events: false,
    });
    return (
      <UnderfrequencyAnalysisPanel
        state={state}
        staticResult={staticResult}
        run={run}
        sections={sections}
        setSections={setSections}
      />
    );
  };
  return renderToStaticMarkup(<Wrapper />);
}

describe('UFR Analysis / Learning panel', () => {
  it('renders status hierarchy, checks, big-number summary tiles, and the study description', () => {
    const markup = renderPanel('UFR-02');
    expect(markup).toContain('Status Relay / System');
    // The 500 MW unit loss sheds three adjacent UFLS stages en route to arrest.
    expect(markup).toContain('UFLS 3 STAGES OPERATED');
    expect(markup).toContain('Inertia (H_sys)');
    expect(markup).toContain('Governor stiffness (β)');
    expect(markup).toContain('Initial ROCOF');
    expect(markup).toContain('UFLS adequacy');
    expect(markup).toContain('f NOW');
    expect(markup).toContain('ROCOF');
    expect(markup).toContain('DEFISIT');
    expect(markup).toContain('MIN f');
    expect(markup).toContain('PLN STANDARD — NOT VERIFIED');
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });

  it('renders operating phases and calculation detail when available', () => {
    const markup = renderPanel('UFR-06');
    expect(markup).toContain('Tahapan Operasi');
    expect(markup).toContain('Detail Perhitungan');
    expect(markup).toContain('S_base');
    expect(markup).toContain('H_sys');
    expect(markup).toContain('ROCOF');
    expect(markup).toContain('Persiapkan');
  });

  it('renders RESTRAIN for a balanced, no-shed study', () => {
    const markup = renderPanel('UFR-01');
    expect(markup).toContain('RESTRAIN');
    expect(markup).toContain('Tidak ada UFLS yang beroperasi');
  });

  it('places the Ringkasan group above Studi (readability priority)', () => {
    const markup = renderPanel('UFR-02');
    const ringkasanIndex = markup.indexOf('Ringkasan');
    const studiIndex = markup.indexOf('Studi');
    expect(ringkasanIndex).toBeGreaterThanOrEqual(0);
    expect(studiIndex).toBeGreaterThan(ringkasanIndex);
  });

  it('renders each event row as a 3-cell grid (time | label | id·MW)', () => {
    const markup = renderPanel('UFR-02');
    // A UFLS_TRIP row should place its generator/stage tag inside the same row
    // cell (not dropped to a second line) with the shed MW on the right.
    expect(markup).toMatch(/<b>UFLS trip<\/b>\s*<small>[^<]+/);
    expect(markup).toMatch(/<small>[^<]*MW<\/small>/);
  });
});
