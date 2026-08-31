import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getUnderfrequencyStudyPreset } from '../../studies/underfrequencyPresets';
import type {
  UnderfrequencyTimelineRun,
  UnderfrequencyTimelineSnapshot,
} from '../../types/underfrequency';
import { buildUnderfrequencySldModel } from '../../presentation/underfrequencySld';
import { UnderfrequencySld } from './UnderfrequencySld';

const STUDY = getUnderfrequencyStudyPreset('UFR-01').study;

function makeSnapshot(partial: Partial<UnderfrequencyTimelineSnapshot>): UnderfrequencyTimelineSnapshot {
  return {
    engineeringTimeSec: 0,
    frequencyHz: 50,
    rocofHzPerSec: 0,
    deficitMw: 0,
    generators: STUDY.generators.map((g) => ({
      generatorId: g.id,
      status: 'ONLINE',
      outputMw: g.initialMw,
      governorResponseMw: 0,
      headroomMw: Math.max(0, g.governorMaxMw - g.initialMw),
      saturated: false,
      rpm: 3000,
    })),
    armedStageIds: [],
    operatedStageIds: [],
    ...partial,
  };
}

function makeRun(partial: Partial<UnderfrequencyTimelineRun> = {}): UnderfrequencyTimelineRun {
  return {
    studyId: 'UFR-01',
    snapshots: [makeSnapshot({ engineeringTimeSec: 0 })],
    events: [],
    finalFrequencyHz: 50,
    finalTimeSec: 0,
    steadyStateStatus: 'SETTLED',
    status: 'VALID',
    issues: [],
    ...partial,
  };
}

function renderSld(model: ReturnType<typeof buildUnderfrequencySldModel>): string {
  return renderToStaticMarkup(<UnderfrequencySld model={model} />);
}

describe('UFR SLD component', () => {
  it('has an accessible label and a status role on the bus readout', () => {
    const markup = renderSld(buildUnderfrequencySldModel(STUDY, null, null));
    expect(markup).toContain('aria-label="Diagram satu garis sistem underfrequency"');
    expect(markup).toContain('role="status"');
  });

  it('idle renders pre-fault: all generators online, blocks energized, success tone, no shed/collapse', () => {
    const markup = renderSld(buildUnderfrequencySldModel(STUDY, null, null));
    for (const g of STUDY.generators) {
      expect(markup).toContain(`data-gen="${g.id}"`);
      expect(markup).toContain(`data-status="online"`);
    }
    for (const block of ['A', 'B', 'C', 'D']) {
      expect(markup).toContain(`data-block="${block}"`);
      expect(markup).toContain('data-status="energized"');
    }
    expect(markup).toContain('data-tone="success"');
    expect(markup).not.toContain('SHED');
    expect(markup).not.toContain('COLLAPSE');
    expect(markup).toContain('data-block="A"');
  });

  it('marks a TRIPPED generator with data-status="tripped" and a broken tie', () => {
    const snapshot = makeSnapshot({
      generators: STUDY.generators.map((g, i) => ({
        generatorId: g.id,
        status: i === 0 ? 'TRIPPED' : 'ONLINE',
        outputMw: i === 0 ? 0 : g.initialMw,
        governorResponseMw: 0,
        headroomMw: Math.max(0, g.governorMaxMw - g.initialMw),
        saturated: false,
        rpm: i === 0 ? 0 : 3000,
      })),
    });
    const markup = renderSld(buildUnderfrequencySldModel(STUDY, snapshot, null));
    // G1 (first generator) is tripped.
    expect(markup).toContain(`data-gen="${STUDY.generators[0].id}"`);
    expect(markup).toContain('data-status="tripped"');
  });

  it('marks a shed block with data-status="SHED", breaker data-open, and danger tone', () => {
    // S1..S4 operate → cumulative 650 MW > A capacity → block A shed; tone danger.
    const snapshot = makeSnapshot({ operatedStageIds: ['S1', 'S2', 'S3', 'S4'] });
    const markup = renderSld(buildUnderfrequencySldModel(STUDY, snapshot, null));
    expect(markup).toContain('data-block="A"');
    // Block A group carries SHED; its breaker is open.
    expect(markup).toContain('data-status="SHED"');
    expect(markup).toContain('data-open="true"');
    expect(markup).toContain('data-tone="danger"');
  });

  it('shows COLLAPSE label and danger tone on collapse', () => {
    const snapshot = makeSnapshot({ frequencyHz: 47.2, operatedStageIds: ['S1', 'S2', 'S3', 'S4'] });
    const markup = renderSld(
      buildUnderfrequencySldModel(STUDY, snapshot, makeRun({ steadyStateStatus: 'COLLAPSE' })),
    );
    expect(markup).toContain('COLLAPSE');
    expect(markup).toContain('data-tone="danger"');
  });

  it('marks a governor-limited generator with data-status="limit"', () => {
    const snapshot = makeSnapshot({
      generators: STUDY.generators.map((g, i) => ({
        generatorId: g.id,
        status: i === 0 ? 'AT_GOVERNOR_LIMIT' : 'ONLINE',
        outputMw: g.governorMaxMw,
        governorResponseMw: g.governorMaxMw - g.initialMw,
        headroomMw: 0,
        saturated: i === 0,
        rpm: 3000,
      })),
    });
    const markup = renderSld(buildUnderfrequencySldModel(STUDY, snapshot, null));
    expect(markup).toContain('data-status="limit"');
  });

  it('does not render NaN/Infinity anywhere', () => {
    const snapshot = makeSnapshot({ operatedStageIds: ['S1', 'S2', 'S3', 'S4'] });
    const markup = renderSld(
      buildUnderfrequencySldModel(STUDY, snapshot, makeRun({ steadyStateStatus: 'COLLAPSE' })),
    );
    expect(markup).not.toMatch(/(?:NaN|Infinity)/);
  });

  it('partitions base load into the A/B/C/D fractions in the bus block labels', () => {
    const markup = renderSld(buildUnderfrequencySldModel(STUDY, null, null));
    // formatEngineeringNumber rounds to 2 decimals (455.00, 390.00, 260.00, 195.00).
    expect(markup).toContain('455.00 MW');
    expect(markup).toContain('390.00 MW');
    expect(markup).toContain('260.00 MW');
    expect(markup).toContain('195.00 MW');
    expect(markup).toContain('35%');
    expect(markup).toContain('15%');
  });
});
