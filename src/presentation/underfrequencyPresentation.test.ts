import { describe, expect, it } from 'vitest';
import { computeUnderfrequencyTimeline } from '../engines/underfrequencyTimeline';
import { evaluateUnderfrequencySystem } from '../engines/underfrequency';
import { UFR_01_NOMINAL, UFR_02_LOSE_LARGE_UNIT, UFR_06_SMALL_DEFICIT } from '../studies/underfrequencyPresets';
import { createInitialUnderfrequencyState } from '../utils/underfrequencyState';
import { buildUnderfrequencyTimelineChartModel, snapshotAtTime } from './underfrequencyTimelineChart';
import { buildUnderfrequencyGeneratorDiagramModel } from './underfrequencyGeneratorDiagram';
import { buildUnderfrequencySheddingChartModel } from './underfrequencySheddingChart';
import { buildUnderfrequencyAnalysisModel } from './underfrequencyAnalysis';

describe('UFR presentation — f(t) timeline chart model', () => {
  it('builds a VALID chart with a non-degenerate axis and monotonically sorted curve', () => {
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const model = buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz);
    expect(model.status).toBe('VALID');
    expect(model.xAxis.max).toBeGreaterThan(model.xAxis.min);
    expect(model.yAxis.max).toBeGreaterThan(model.yAxis.min);
    expect(model.curve.length).toBeGreaterThan(1);
    // Times are monotonically non-decreasing.
    for (let i = 1; i < model.curve.length; i += 1) {
      expect(model.curve[i].x).toBeGreaterThanOrEqual(model.curve[i - 1].x);
    }
    // Nominal line sits inside the y range.
    expect(model.yAxis.min).toBeLessThanOrEqual(model.nominalFrequencyHz);
    expect(model.yAxis.max).toBeGreaterThanOrEqual(model.nominalFrequencyHz);
  });

  it('clamps the y-domain to a readable physics band on a runaway footprint', () => {
    // A 1e9 MW load step drives the curve to ~-4.6e6 Hz. The axis must clamp to
    // a few Hz around nominal so the on-band curve stays legible instead of the
    // domain ballooning and crushing it into a spike (regression: LOW defect).
    const study = {
      ...UFR_02_LOSE_LARGE_UNIT.study,
      disturbanceSteps: [{ id: 'D', kind: 'LOAD_STEP', timeSec: 0, mw: 1e9 }] as const,
    };
    const run = computeUnderfrequencyTimeline(study);
    const model = buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz);
    const nominal = model.nominalFrequencyHz;
    // The domain collapses to a narrow band around nominal, not the full
    // -4.6e6..50 span of the curve; the nominal line is still inside it.
    expect(model.yAxis.max - model.yAxis.min).toBeLessThan(25);
    expect(model.yAxis.min).toBeLessThanOrEqual(nominal);
    expect(model.yAxis.max).toBeGreaterThanOrEqual(nominal);
  });

  it('sizes the y-domain to the curve for a small-deficit preset (Bug 5)', () => {
    // UFR-06 is a 100 MW load step on a ~1500 MW system: the curve drops from
    // 50.00 → ~49.86 Hz. Previously the y-axis was inflated to ~2.3 Hz by the
    // stage threshold lines (48..49.5 Hz) being mixed into the bounds, which
    // made the curve occupy < 6% of the plot and look like a flat stub. The
    // axis must be sized to the curve's own data + nominal, not to UFLS
    // thresholds; stage lines are an overlay, drawn if inside the plot, clipped
    // if outside.
    const study = UFR_06_SMALL_DEFICIT.study;
    const run = computeUnderfrequencyTimeline(study);
    expect(run.status).toBe('VALID');
    const model = buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz);
    const curveMin = Math.min(...run.snapshots.map((s) => s.frequencyHz));
    const dataSpan = model.yAxis.max - model.yAxis.min;
    // The axis should be small enough that the curve's droop is visibly
    // perceptible (≥ 40% of the plot height) — not a 6% sliver.
    const curveSpan = model.yAxis.max - curveMin;
    expect(curveSpan / dataSpan).toBeGreaterThan(0.4);
  });

  it('exposes stage lines for every enabled UFLS stage and marks the operated latch', () => {
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const model = buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz);
    const enabled = study.uflsStages.filter((s) => s.enabled);
    expect(model.stageLines).toHaveLength(enabled.length);
    // Every stage line has the correct threshold and is enabled.
    for (const line of model.stageLines) {
      expect(line.enabled).toBe(true);
      expect(line.thresholdHz).toBeGreaterThan(0);
    }
    const operatedCount = model.stageLines.filter((l) => l.operated).length;
    expect(operatedCount).toBeGreaterThan(0);
  });

  it('reports a null final frequency on a COLLAPSE run', () => {
    const study = {
      ...UFR_01_NOMINAL.study,
      disturbanceSteps: [{ id: 'D', kind: 'LOAD_STEP', timeSec: 0, mw: 5000 }] as const,
    };
    const run = computeUnderfrequencyTimeline(study);
    expect(run.steadyStateStatus).toBe('COLLAPSE');
    const model = buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz);
    expect(model.finalFrequencyHz).toBeNull();
    expect(model.collapseEvent).not.toBeNull();
  });

  it('snapshotAtTime returns the final snapshot when no scrub target is given', () => {
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const snap = snapshotAtTime(run.snapshots, null);
    expect(snap).toBe(run.snapshots[run.snapshots.length - 1]);
  });

  it('clamps the x-axis lower bound to t=0 (engineering time is non-negative)', () => {
    // Bug 3: paddedBounds applied its 8% pad to the time axis too, putting t=0
    // ~7% in from the left edge behind a physically meaningless −0.4 s gutter.
    // Engineering time never starts below zero, so the axis must not extend
    // into negative time.
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const model = buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz);
    expect(model.xAxis.min).toBe(0);
    expect(model.xAxis.max).toBeGreaterThan(0);
  });

  it('shows a full-width nominal baseline for the no-disturbance preset (Bug 3)', () => {
    // UFR-01 is a balanced island: the entire simulated window is a flat 50 Hz
    // line. MIN_SIM_WINDOW_SEC already guarantees a 5 s window in the engine;
    // here we assert the chart presents it as a full-width baseline whose
    // first point is t=0 and whose frequency never leaves nominal.
    const study = UFR_01_NOMINAL.study;
    const run = computeUnderfrequencyTimeline(study);
    expect(run.status).toBe('VALID');
    expect(run.finalTimeSec).toBeGreaterThanOrEqual(5);
    const model = buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz);
    expect(model.curve[0]?.x).toBe(0);
    expect(model.curve[0]?.y).toBeCloseTo(study.system.fNominalHz, 6);
    const lastPoint = model.curve[model.curve.length - 1];
    expect(lastPoint?.y).toBeCloseTo(study.system.fNominalHz, 6);
    // Baseline spans essentially the whole x-window (right edge is the pad).
    const span = (lastPoint.x - model.curve[0].x) / (model.xAxis.max - model.xAxis.min);
    expect(span).toBeGreaterThan(0.85);
  });
});

describe('UFR presentation — generator diagram model', () => {
  it('lays out each generator with output fill derived from the visible max', () => {
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const snapshot = run.snapshots[run.snapshots.length - 1];
    const model = buildUnderfrequencyGeneratorDiagramModel(snapshot.generators, study.generators, snapshot.frequencyHz, study.system.fNominalHz);
    expect(model.status).toBe('VALID');
    expect(model.rows).toHaveLength(study.generators.length);
    // The dropped unit is TRIPPED with zero output.
    const g1 = model.rows.find((r) => r.generatorId === 'G1');
    expect(g1?.status).toBe('TRIPPED');
    expect(g1?.outputMw).toBe(0);
    // Output fill is within [0,1] and proportional to output max.
    for (const row of model.rows) {
      expect(row.outputFill).toBeGreaterThanOrEqual(0);
      expect(row.outputFill).toBeLessThanOrEqual(1);
    }
  });

  it('derives RPM from the snapshot frequency and pole count', () => {
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const snapshot = run.snapshots[run.snapshots.length - 1];
    const model = buildUnderfrequencyGeneratorDiagramModel(snapshot.generators, study.generators, snapshot.frequencyHz, study.system.fNominalHz);
    // G1 is 2-pole; N = 120·f/poles. Only validate for an online unit.
    const g2 = model.rows.find((r) => r.generatorId === 'G2'); // 4-pole
    expect(g2).toBeDefined();
    expect(g2!.rpm).toBeCloseTo((120 * snapshot.frequencyHz) / 4, 6);
  });
});

describe('UFR presentation — shedding chart model', () => {
  it('orders bars by descending threshold and counts the operated latch', () => {
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const model = buildUnderfrequencySheddingChartModel(study.uflsStages, study.system.baseLoadMw, run);
    expect(model.status).toBe('VALID');
    expect(model.bars).toHaveLength(study.uflsStages.length);
    // Descending threshold order.
    for (let i = 1; i < model.bars.length; i += 1) {
      expect(model.bars[i].thresholdHz).toBeLessThan(model.bars[i - 1].thresholdHz);
    }
    expect(model.operatedCount).toBeGreaterThan(0);
    // Shed amount for an operated stage is counted in the total.
    expect(model.totalShedMw).toBeGreaterThan(0);
  });

  it('handles a no-UFLS run with zero operated stages', () => {
    const study = UFR_06_SMALL_DEFICIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const model = buildUnderfrequencySheddingChartModel(study.uflsStages, study.system.baseLoadMw, run);
    expect(model.status).toBe('VALID');
    expect(model.operatedCount).toBe(0);
    expect(model.totalShedMw).toBe(0);
  });

  it('creates an INVALID model when there are no stages', () => {
    const run = computeUnderfrequencyTimeline(UFR_01_NOMINAL.study);
    const model = buildUnderfrequencySheddingChartModel([], 1300, run);
    expect(model.status).toBe('INVALID');
  });
});

describe('UFR presentation — analysis model', () => {
  it('reports RESTRAIN + zero deficit for the nominal preset', () => {
    const study = UFR_01_NOMINAL.study;
    const run = computeUnderfrequencyTimeline(study);
    const staticRef = evaluateUnderfrequencySystem({ system: study.system, generators: study.generators, uflsStages: study.uflsStages });
    expect(staticRef.status).toBe('VALID');
    if (staticRef.status !== 'VALID') return;
    const state = createInitialUnderfrequencyState('UFR-01');
    const model = buildUnderfrequencyAnalysisModel(state, staticRef.value, run);
    expect(model.status).toBe('VALID');
    expect(model.headline.label).toBe('RESTRAIN');
    expect(model.headline.tone).toBe('success');
    expect(model.displayStatus).toBe('RESTRAIN');
    expect(model.calculationDetails.length).toBeGreaterThan(0);
  });

  it('reports UFLS operated + danger tone for the 500 MW loss', () => {
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const postLossWinless = { ...study.system };
    const survivorGens = study.generators.filter((g) => g.id !== 'G1');
    const staticRef = evaluateUnderfrequencySystem({ system: postLossWinless, generators: survivorGens, uflsStages: study.uflsStages });
    expect(staticRef.status).toBe('VALID');
    if (staticRef.status !== 'VALID') return;
    const run = computeUnderfrequencyTimeline(study);
    const state = createInitialUnderfrequencyState('UFR-02');
    const model = buildUnderfrequencyAnalysisModel(state, staticRef.value, run);
    expect(model.status).toBe('VALID');
    expect(model.headline.tone).toBe('danger');
    expect(model.displayStatus).toBe('OPERATE');
    expect(model.plnVerificationRequired).toBe(true);
  });

  it('exposes a min-frequency tile that matches the timeline trough', () => {
    const study = UFR_02_LOSE_LARGE_UNIT.study;
    const run = computeUnderfrequencyTimeline(study);
    const staticRef = evaluateUnderfrequencySystem({ system: study.system, generators: study.generators.filter((g) => g.id !== 'G1'), uflsStages: study.uflsStages });
    if (staticRef.status !== 'VALID') return;
    const state = createInitialUnderfrequencyState('UFR-02');
    const model = buildUnderfrequencyAnalysisModel(state, staticRef.value, run);
    const minSnap = Math.min(...run.snapshots.map((s) => s.frequencyHz));
    const minTile = model.summaryTiles.find((tile) => tile.id === 'MIN-F');
    expect(minTile?.value).toBe(`${minSnap.toFixed(2)} Hz`);
  });

  it('surfaces a COLLAPSE headline when the deficit overwhelms governor + UFLS capacity', () => {
    // +5000 MW load step far exceeds governor headroom (355 MW) + all UFLS
    // (650 MW), so the surviving system must collapse.
    const deltaMw = 5000;
    const study = {
      ...UFR_01_NOMINAL.study,
      disturbanceSteps: [{ id: 'D', kind: 'LOAD_STEP', timeSec: 0, mw: deltaMw }] as const,
    };
    const run = computeUnderfrequencyTimeline(study);
    // Encode the load step into the static reference's baseLoad (the static
    // evaluator has no disturbance-step mechanism — it derives deficit from baseLoad).
    const staticRef = evaluateUnderfrequencySystem({
      system: { ...study.system, baseLoadMw: study.system.baseLoadMw + deltaMw },
      generators: study.generators,
      uflsStages: study.uflsStages,
    });
    expect(staticRef.status).toBe('VALID');
    if (staticRef.status !== 'VALID') return;
    expect(staticRef.value.steadyStateStatus).toBe('COLLAPSE');
    const state = { ...createInitialUnderfrequencyState('UFR-01'), study };
    const model = buildUnderfrequencyAnalysisModel(state, staticRef.value, run);
    expect(model.status).toBe('VALID');
    expect(model.headline.label).toBe('COLLAPSE');
    expect(model.headline.tone).toBe('danger');
    expect(model.steadyStateStatus).toBe('COLLAPSE');
    expect(model.finalFrequencyHz).toBeNull();
  });
});
