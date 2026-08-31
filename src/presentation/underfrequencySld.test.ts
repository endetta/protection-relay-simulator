import { describe, expect, it } from 'vitest';
import { getUnderfrequencyStudyPreset } from '../studies/underfrequencyPresets';
import type {
  UnderfrequencyTimelineRun,
  UnderfrequencyTimelineSnapshot,
} from '../types/underfrequency';
import { buildUnderfrequencySldModel, LOAD_BLOCK_FRACTIONS } from './underfrequencySld';

const STUDY = getUnderfrequencyStudyPreset('UFR-01').study;

const BASE_LOAD = STUDY.system.baseLoadMw; // 1300

function makeSnapshot(partial: Partial<UnderfrequencyTimelineSnapshot>): UnderfrequencyTimelineSnapshot {
  return {
    engineeringTimeSec: 0,
    frequencyHz: 50,
    rocofHzPerSec: 0,
    deficitMw: 0,
    generators: [
      { generatorId: 'G1', status: 'ONLINE', outputMw: 500, governorResponseMw: 0, headroomMw: 140, saturated: false, rpm: 3000 },
      { generatorId: 'G2', status: 'ONLINE', outputMw: 350, governorResponseMw: 0, headroomMw: 80, saturated: false, rpm: 1500 },
      { generatorId: 'G3', status: 'ONLINE', outputMw: 250, governorResponseMw: 0, headroomMw: 70, saturated: false, rpm: 3000 },
      { generatorId: 'G4', status: 'ONLINE', outputMw: 200, governorResponseMw: 0, headroomMw: 65, saturated: false, rpm: 3000 },
    ],
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

// Default UFR-01 UFLS stages: S1 5%, S2 10%, S3 15%, S4 20% of base load
function shedMw(stage: string): number {
  const s = STUDY.uflsStages.find((x) => x.id === stage);
  if (!s) throw new Error('unknown stage ' + stage);
  return (s.shedFractionPct / 100) * BASE_LOAD;
}

describe('underfrequencySld buildUnderfrequencySldModel', () => {
  it('returns IDLE with pre-fault state when snapshot is null', () => {
    const model = buildUnderfrequencySldModel(STUDY, null, null);
    expect(model.status).toBe('IDLE');
    expect(model.generators.every((g) => g.status === 'ONLINE')).toBe(true);
    expect(model.generators[0].outputMw).toBe(500);
    expect(model.bus.frequencyHz).toBe(50);
    expect(model.bus.tone).toBe('success');
    expect(model.blocks.every((b) => !b.shed)).toBe(true);
    expect(model.blocks.every((b) => !b.critical || (b.id === 'D' && b.critical))).toBe(true);
  });

  it('partitions base load into A/B/C/D at the default fractions', () => {
    const model = buildUnderfrequencySldModel(STUDY, null, null);
    expect(model.blocks.map((b) => b.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(model.blocks[0].baseMw).toBeCloseTo(BASE_LOAD * LOAD_BLOCK_FRACTIONS.A, 6);
    expect(model.blocks[3].critical).toBe(true);
  });

  it('tone is success when nothing is armed or operated', () => {
    const model = buildUnderfrequencySldModel(STUDY, makeSnapshot({ armedStageIds: [], operatedStageIds: [] }), makeRun());
    expect(model.bus.tone).toBe('success');
  });

  it('tone is warning when a stage is armed but none operated', () => {
    const model = buildUnderfrequencySldModel(
      STUDY,
      makeSnapshot({ armedStageIds: ['S1'], operatedStageIds: [] }),
      makeRun(),
    );
    expect(model.bus.tone).toBe('warning');
  });

  it('tone is danger when a stage has operated', () => {
    const model = buildUnderfrequencySldModel(
      STUDY,
      makeSnapshot({ armedStageIds: ['S3'], operatedStageIds: ['S1', 'S2'] }),
      makeRun(),
    );
    expect(model.bus.tone).toBe('danger');
  });

  it('tone is danger on COLLAPSE', () => {
    const model = buildUnderfrequencySldModel(
      STUDY,
      makeSnapshot({ frequencyHz: 47.2, operatedStageIds: ['S1', 'S2', 'S3', 'S4'] }),
      makeRun({ steadyStateStatus: 'COLLAPSE' }),
    );
    expect(model.bus.tone).toBe('danger');
    expect(model.bus.collapse).toBe(true);
  });

  it('does NOT shed block A when S1 alone operates (65 MW < 455 MW capacity)', () => {
    const model = buildUnderfrequencySldModel(
      STUDY,
      makeSnapshot({ operatedStageIds: ['S1'] }),
      makeRun(),
    );
    expect(model.shedMwTotal).toBeCloseTo(shedMw('S1'), 6);
    expect(model.blocks[0].shed).toBe(false); // A: 65 MW < 455 MW
    expect(model.blocks[1].shed).toBe(false); // B
    expect(model.blocks[2].shed).toBe(false); // C
    expect(model.blocks[3].shed).toBe(false); // D never sheds
    expect(model.bus.unservedMw).toBe(0);
  });

  it('does NOT shed any block when S1+S2 operate (195 MW < 455 MW capacity)', () => {
    const model = buildUnderfrequencySldModel(
      STUDY,
      makeSnapshot({ operatedStageIds: ['S1', 'S2'] }),
      makeRun(),
    );
    expect(model.shedMwTotal).toBeCloseTo(shedMw('S1') + shedMw('S2'), 6);
    expect(model.blocks[0].shed).toBe(false); // A: 195 < 455
    expect(model.blocks[1].shed).toBe(false); // B
    expect(model.blocks[2].shed).toBe(false); // C
  });

  it('sheds block A when cumulative shed exceeds A capacity (S1..S4 = 650 MW > 455 MW)', () => {
    const model = buildUnderfrequencySldModel(
      STUDY,
      makeSnapshot({ operatedStageIds: ['S1', 'S2', 'S3', 'S4'] }),
      makeRun(),
    );
    expect(model.shedMwTotal).toBeCloseTo(shedMw('S1') + shedMw('S2') + shedMw('S3') + shedMw('S4'), 6);
    expect(model.blocks[0].shed).toBe(true); // A: 650 > 455
    expect(model.blocks[1].shed).toBe(false); // B: remaining 195 < 390
    expect(model.blocks[2].shed).toBe(false); // C
    expect(model.blocks[3].shed).toBe(false); // D never
    expect(model.bus.unservedMw).toBe(0);
  });

  it('reports unserved MW when total shed exceeds A+B+C capacity', () => {
    // Craft a study where each operated stage sheds 40% of base load.
    const overStudy = {
      ...STUDY,
      uflsStages: STUDY.uflsStages.map((s) => ({ ...s, shedFractionPct: 40 })),
    };
    // S1+S2+S3 operated → 3 × 40% × 1300 = 1560 MW shed.
    // A+B+C capacity = 0.85 × 1300 = 1105 MW. 1560 > 1105 → unserved = 455.
    // A (455) + B (390) + C (260) all shed; D (critical) never.
    const model = buildUnderfrequencySldModel(
      overStudy,
      makeSnapshot({ operatedStageIds: ['S1', 'S2', 'S3'] }),
      makeRun(),
    );
    expect(model.shedMwTotal).toBeCloseTo(1560, 6);
    expect(model.blocks[0].shed).toBe(true); // A
    expect(model.blocks[1].shed).toBe(true); // B
    expect(model.blocks[2].shed).toBe(true); // C
    expect(model.blocks[3].shed).toBe(false); // D never
    expect(model.bus.unservedMw).toBeCloseTo(1560 - 0.85 * BASE_LOAD, 6);
  });

  it('deterministic for identical inputs', () => {
    const a = buildUnderfrequencySldModel(STUDY, makeSnapshot({ operatedStageIds: ['S1'] }), makeRun());
    const b = buildUnderfrequencySldModel(STUDY, makeSnapshot({ operatedStageIds: ['S1'] }), makeRun());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
