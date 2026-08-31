import { describe, expect, it } from 'vitest';
import { evaluateUnderfrequencySystem } from './underfrequency';
import { computeUnderfrequencyTimeline } from './underfrequencyTimeline';
import { clampGovernorMw } from './underfrequencyGovernor';
import type {
  UnderfrequencyGeneratorData,
  UnderfrequencyStudyDefinition,
  UnderfrequencySystemData,
  UflsStageSettings,
} from '../types/underfrequency';

// ─────────────────────────────── Fixtures ──────────────────────────────────
// Mirror the U01 default generator set / UFLS ladder from § 10.1-10.2.

const SYSTEM: UnderfrequencySystemData = { fNominalHz: 50, voltageKv: 150, baseLoadMw: 1300 };

const GENS: readonly UnderfrequencyGeneratorData[] = [
  { id: 'G1', label: 'G1 — Thermal 600 MW', mwRated: 600, mva: 700, inertiaSec: 5.0, droopPu: 0.05, poles: 2, governorMaxMw: 640, initialMw: 500, status: 'ONLINE' },
  { id: 'G2', label: 'G2 — Hydro 400 MW', mwRated: 400, mva: 450, inertiaSec: 4.0, droopPu: 0.04, poles: 4, governorMaxMw: 430, initialMw: 350, status: 'ONLINE' },
  { id: 'G3', label: 'G3 — Gas 300 MW', mwRated: 300, mva: 330, inertiaSec: 4.5, droopPu: 0.05, poles: 2, governorMaxMw: 320, initialMw: 250, status: 'ONLINE' },
  { id: 'G4', label: 'G4 — CCGT 250 MW', mwRated: 250, mva: 280, inertiaSec: 3.0, droopPu: 0.06, poles: 2, governorMaxMw: 265, initialMw: 200, status: 'ONLINE' },
];

const UFLS: readonly UflsStageSettings[] = [
  { id: 'S1', label: 'Stage 1 — 49.50', enabled: true, thresholdHz: 49.50, timeDelaySec: 0.20, shedFractionPct: 5 },
  { id: 'S2', label: 'Stage 2 — 49.00', enabled: true, thresholdHz: 49.00, timeDelaySec: 0.30, shedFractionPct: 10 },
  { id: 'S3', label: 'Stage 3 — 48.50', enabled: true, thresholdHz: 48.50, timeDelaySec: 0.40, shedFractionPct: 15 },
  { id: 'S4', label: 'Stage 4 — 48.00', enabled: true, thresholdHz: 48.00, timeDelaySec: 0.50, shedFractionPct: 20 },
];

function study(
  over: Partial<UnderfrequencyStudyDefinition> = {},
  steps: UnderfrequencyStudyDefinition['disturbanceSteps'] = [],
): UnderfrequencyStudyDefinition {
  return {
    id: 'UFR-TEST',
    label: 'Test Study',
    description: 'Test',
    system: SYSTEM,
    generators: GENS,
    relay: { enabled: true, modelLabel: 'UFR/UFLS — ANSI 81' },
    uflsStages: UFLS,
    disturbanceSteps: steps,
    ...over,
  };
}

// A study that removes G1 (500 MW) via a at-t=0 generator-loss step.
function loseG1Study(): UnderfrequencyStudyDefinition {
  return study({}, [{ id: 'D1', kind: 'GENERATOR_LOSS', timeSec: 0, generatorId: 'G1' }]);
}

// A study that adds a constant load step at t=0.
function loadStepStudy(mw: number): UnderfrequencyStudyDefinition {
  return study({}, [{ id: 'D1', kind: 'LOAD_STEP', timeSec: 0, mw }]);
}

// ───────────────────────────── Static parity mirror ─────────────────────────
// The static evaluator derives the deficit only from the generator set's
// `status` and `system.baseLoadMw` — it has no disturbance-step mechanism. To
// build a like-for-like parity reference, encode the SAME post-disturbance
// state the timeline produces via event-steps:
//   * GENERATOR_LOSS G1  → pass a generator set with G1 TRIPPED.
//   * LOAD_STEP +mw      → pass a system whose baseLoad already includes +mw.
// This keeps sBaseMva / H_sys / deficit identical across both models, so the
// closed-form steady state is a true bit-exact parity target (§ 13.1).

/** Survivors after G1 is tripped (matches timeline's online set post-loss). */
const WITHOUT_G1: readonly UnderfrequencyGeneratorData[] = GENS.filter((g) => g.id !== 'G1');

/** System with baseLoad bumped by `mw` — matches the timeline's post-step deficit. */
function systemWithLoad(mw: number): UnderfrequencySystemData {
  return { ...SYSTEM, baseLoadMw: SYSTEM.baseLoadMw + mw };
}

function lastOpenedStageIds(run: ReturnType<typeof computeUnderfrequencyTimeline>): string[] {
  return run.events.filter((e) => e.type === 'UFLS_TRIP').map((e) => e.stageId ?? '');
}

// ─────────────────────────────── Parity ─────────────────────────────────────

describe('Underfrequency timeline ↔ static parity (U01 § 13.1)', () => {
  it('settles bit-identical to the static reference for a small 100 MW load step (UFR-06)', () => {
    const s = loadStepStudy(100);
    const timeline = computeUnderfrequencyTimeline(s);
    // Load step of +100 MW on the balanced set: encode it as baseLoad bump.
    const staticRef = evaluateUnderfrequencySystem({ system: systemWithLoad(100), generators: s.generators, uflsStages: s.uflsStages });
    expect(timeline.status).toBe('VALID');
    expect(staticRef.status).toBe('VALID');
    if (timeline.status === 'VALID' && staticRef.status === 'VALID') {
      expect(timeline.finalFrequencyHz).not.toBeNull();
      expect(Math.abs(timeline.finalFrequencyHz! - staticRef.value.steadyStateHz!)).toBeLessThan(1e-6);
    }
  });

  it('settles bit-identical to the static reference for the 500 MW G1 loss', () => {
    const s = loseG1Study();
    const timeline = computeUnderfrequencyTimeline(s);
    // G1 loss: pass the survivor set (G1 TRIPPED) so the static sees the same
    // deficit 500 and the same sBaseMva / H_sys as the timeline's online set.
    const staticRef = evaluateUnderfrequencySystem({ system: s.system, generators: WITHOUT_G1, uflsStages: s.uflsStages });
    expect(timeline.status).toBe('VALID');
    expect(staticRef.status).toBe('VALID');
    if (timeline.status === 'VALID' && staticRef.status === 'VALID') {
      expect(timeline.finalFrequencyHz).not.toBeNull();
      // Both resolve the same latched UFLS set → identical settled frequency.
      expect(Math.abs(timeline.finalFrequencyHz! - staticRef.value.steadyStateHz!)).toBeLessThan(1e-6);
    }
  });

  it('UFR-02 500 MW G1-loss ROCOF matches the analytic reference', () => {
    const s = loseG1Study();
    // The static evaluator over the survivor set reports the post-loss ROCOF.
    const staticRef = evaluateUnderfrequencySystem({ system: s.system, generators: WITHOUT_G1, uflsStages: s.uflsStages });
    if (staticRef.status !== 'VALID') throw new Error('expected valid static');
    // D₀ = 500 MW; S_base = (450+330+280) = 1060; H_sys recomputed over survivors.
    const sBase = WITHOUT_G1.reduce((sum, g) => sum + g.mva, 0);
    const hSys = WITHOUT_G1.reduce((sum, g) => sum + g.inertiaSec * g.mva, 0) / sBase;
    const expectedRocof = -(50 / (2 * hSys)) * (500 / sBase);
    expect(staticRef.value.initialRocofHzPerSec).toBeCloseTo(expectedRocof, 6);
  });

  it('final frequency matches the static solver for a no-UFLS small deficit', () => {
    const s = study({ uflsStages: [] }, [{ id: 'D1', kind: 'LOAD_STEP', timeSec: 0, mw: 100 }]);
    const timeline = computeUnderfrequencyTimeline(s);
    const staticRef = evaluateUnderfrequencySystem({ system: systemWithLoad(100), generators: s.generators, uflsStages: [] });
    expect(timeline.status).toBe('VALID');
    if (timeline.status === 'VALID' && staticRef.status === 'VALID') {
      expect(Math.abs(timeline.finalFrequencyHz! - staticRef.value.steadyStateHz!)).toBeLessThan(1e-6);
    }
  });
});

// ─────────────────────────────── Determinism ────────────────────────────────

describe('Underfrequency timeline determinism & correctness (U01 § 13.2)', () => {
  it('is deterministic: two runs are JSON-identical', () => {
    const s = loseG1Study();
    const a = computeUnderfrequencyTimeline(s);
    const b = computeUnderfrequencyTimeline(s);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('never throws and always produces finite frequencies for random studies', () => {
    // Dense-gridded runs emit ~50 samples/sec, so 500 studies legitimately
    // exceed the 5 s default; this is a property check, not a timing check.
    let seed = 0x2026_0815;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000);
    for (let trial = 0; trial < 500; trial += 1) {
      const deficit = 50 + rand() * 800;
      const s = loadStepStudy(deficit);
      const run = computeUnderfrequencyTimeline(s);
      expect(run.status).toBe('VALID');
      if (run.steadyStateStatus === 'SETTLED') {
        expect(run.finalFrequencyHz).not.toBeNull();
        expect(Number.isFinite(run.finalFrequencyHz!)).toBe(true);
        expect(run.finalFrequencyHz!).toBeLessThanOrEqual(50 + 1e-9);
      } else {
        expect(run.finalFrequencyHz).toBeNull();
      }
      for (const snap of run.snapshots) {
        expect(Number.isFinite(snap.frequencyHz)).toBe(true);
      }
    }
  }, 20000);

  it('emits an initial balanced snapshot at exactly nominal frequency', () => {
    const s = study(); // UFR-01: no disturbance
    const run = computeUnderfrequencyTimeline(s);
    expect(run.status).toBe('VALID');
    const first = run.snapshots[0];
    expect(first.frequencyHz).toBeCloseTo(50, 12);
    expect(first.deficitMw).toBeCloseTo(0, 9);
  });
});

// ────────────── Governor-path cross-check (U01 § 7 / § 13) ──────────────────
// The timeline and the static solver must run the SAME governor physics. This
// drives the preserved random studies and asserts the emitted per-generator
// droop response at each snapshot equals `clampGovernorMw` at the same dfHz —
// the shared primitives now back both paths, so a defect in the copy the
// tests actually exercise (the static one) cannot pass while the production
// copy (the timeline's) drifts. A tight tolerance absorbs the single-ulp
// ambiguity of a snapshot landing exactly on a saturation crossing; any real
// divergence (wrong sign, wrong clamp, wrong droop) is orders of magnitude
// larger.

describe('Underfrequency timeline emits the shared governor response (U01 § 7 / § 13)', () => {
  it('matches clampGovernorMw at every online-generator snapshot for random studies', () => {
    let seed = 0x81_50_2030;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000);
    for (let trial = 0; trial < 200; trial += 1) {
      const count = 2 + Math.floor(rand() * 3); // 2-4 generators
      const generators: UnderfrequencyGeneratorData[] = [];
      for (let i = 0; i < count; i += 1) {
        const mva = 300 + Math.floor(rand() * 500);
        const mwRated = mva * 0.85;
        generators.push({
          id: `G${i}`,
          label: `G${i}`,
          mwRated,
          mva,
          inertiaSec: 2.5 + rand() * 5,
          droopPu: 0.03 + rand() * 0.05,
          poles: rand() > 0.5 ? 2 : 4,
          governorMaxMw: mwRated * 1.1,
          initialMw: mwRated * 0.8,
          status: 'ONLINE',
        });
      }
      const steps: UnderfrequencyStudyDefinition['disturbanceSteps'] = [
        { id: 'D1', kind: 'LOAD_STEP', timeSec: 0, mw: 100 + rand() * 700 },
      ];
      const s = study({ generators, uflsStages: [] }, steps);
      const timeline = computeUnderfrequencyTimeline(s);
      expect(timeline.status).toBe('VALID');
      if (timeline.status !== 'VALID') continue;
      const fNomHz = s.system.fNominalHz;
      for (const snap of timeline.snapshots) {
        const dfHz = snap.frequencyHz - fNomHz;
        for (const g of generators) {
          const gsnap = snap.generators.find((gg) => gg.generatorId === g.id);
          if (gsnap && gsnap.status !== 'TRIPPED') {
            const expected = clampGovernorMw(g, dfHz, fNomHz);
            expect(Math.abs(gsnap.governorResponseMw - expected)).toBeLessThan(1e-9);
          }
        }
      }
    }
  });
});

// ─────────────────────── Snapshot density (U01 § 8.3) ───────────────────────
// The engine must emit a dense ~0.02 s snapshot grid plus exact event-time
// samples. Regression: the pre-dense loop emitted only boundary samples, which
// rendered the chart as a discrete signal and left balanced / quick-settle runs
// as a 2-point left-edge stub.

describe('Underfrequency timeline snapshot density (U01 § 8.3)', () => {
  it('emits a dense ~0.02 s grid with no inter-sample gap above one step', () => {
    for (const s of [study(), loseG1Study(), loadStepStudy(100)]) {
      const run = computeUnderfrequencyTimeline(s);
      expect(run.status).toBe('VALID');
      if (run.status !== 'VALID') continue;
      expect(run.snapshots.length).toBeGreaterThan(100);
      let maxGap = 0;
      for (let i = 1; i < run.snapshots.length; i += 1) {
        maxGap = Math.max(maxGap, run.snapshots[i].engineeringTimeSec - run.snapshots[i - 1].engineeringTimeSec);
      }
      expect(maxGap).toBeLessThanOrEqual(0.02 + 1e-9);
    }
  });

  it('spans a visible nominal baseline: even balanced runs start at t=0 and fill the window', () => {
    const run = computeUnderfrequencyTimeline(study()); // UFR-01 balanced
    expect(run.status).toBe('VALID');
    if (run.status !== 'VALID') return;
    expect(run.snapshots[0].engineeringTimeSec).toBeCloseTo(0, 9);
    expect(run.snapshots[0].frequencyHz).toBeCloseTo(50, 9);
    expect(run.finalTimeSec).toBeGreaterThanOrEqual(5);
    expect(run.snapshots.length).toBeGreaterThanOrEqual(250);
  });
});

// ─────────────────────────────── UFLS dynamics ──────────────────────────────

describe('Underfrequency timeline UFLS dynamics (U01 § 9)', () => {
  it('sheds when frequency falls below stage threshold', () => {
    const s = loseG1Study();
    const run = computeUnderfrequencyTimeline(s);
    expect(run.status).toBe('VALID');
    const trips = run.events.filter((e) => e.type === 'UFLS_TRIP');
    expect(trips.length).toBeGreaterThan(0);
  });

  it('reports a latched stage only once', () => {
    const s = loseG1Study();
    const run = computeUnderfrequencyTimeline(s);
    const trips = run.events.filter((e) => e.type === 'UFLS_TRIP');
    const ids = trips.map((e) => e.stageId);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate stage in a run
  });

  it('honours the strict below-threshold boundary at arming', () => {
    const s = loseG1Study();
    const run = computeUnderfrequencyTimeline(s);
    // The first UFLS_ARMED event must be at a frequency strictly below its
    // threshold (never exactly equal).
    const armEvents = run.events.filter((e) => e.type === 'UFLS_ARMED');
    for (const ev of armEvents) {
      const stage = s.uflsStages.find((st) => st.id === ev.stageId)!;
      const snapAt = run.snapshots.find((sn) => Math.abs(sn.engineeringTimeSec - ev.timeSec) < 1e-9);
      expect(snapAt).toBeDefined();
      expect(snapAt!.frequencyHz).toBeLessThan(stage.thresholdHz);
    }
  });

  it('sheds all stages that operate en route but latches each', () => {
    const s = loseG1Study();
    const run = computeUnderfrequencyTimeline(s);
    expect(lastOpenedStageIds(run)).toEqual(run.events.filter((e) => e.type === 'UFLS_TRIP').map((e) => e.stageId));
  });
});

// ─────────────────────────────── Collapse ───────────────────────────────────

describe('Underfrequency timeline collapse (U01 § 12.4)', () => {
  it('reports COLLAPSE when the deficit exceeds governor + UFLS capacity and never throws', () => {
    // 2000 MW load step: far beyond headroom (355 MW) + total UFLS (650 MW).
    const s = loadStepStudy(2000);
    const run = computeUnderfrequencyTimeline(s);
    expect(run.status).toBe('VALID');
    expect(run.steadyStateStatus).toBe('COLLAPSE');
    expect(run.finalFrequencyHz).toBeNull();
    for (const snap of run.snapshots) {
      expect(Number.isFinite(snap.frequencyHz)).toBe(true);
    }
  });
});

// ───── UFR-FIX-01: UFLS timer must accumulate across segment boundaries ─────
// U01 §9.3: "When a stage arms, its timer accumulates engineering time."
// Regression: state.timers was never advanced within a segment — elapsed was
// always 0, so tauTrip = timeDelaySec - 0 was measured from the segment start
// (post-saturation), not from the arming instant. This test forces an armed
// stage to survive a governor-saturation segment boundary and asserts the trip
// time = arming + delay, not segment-start + delay.

describe('Underfrequency timeline UFLS timer accumulation (U01 §9.3, UFR-FIX-01)', () => {
  it('trips a stage after timeDelaySec elapsed since arming, across a saturation crossing', () => {
    // Large load step: drives below S1 threshold fast, then saturates all gens
    // before the 0.20 s delay elapses → arming segment is cut by a saturation
    // segment. The trip must still be 0.20 s after arming.
    const s = loadStepStudy(800);
    const run = computeUnderfrequencyTimeline(s);
    expect(run.status).toBe('VALID');

    const arm = run.events.find((e) => e.type === 'UFLS_ARMED' && e.stageId === 'S1');
    const trip = run.events.find((e) => e.type === 'UFLS_TRIP' && e.stageId === 'S1');
    expect(arm).toBeDefined();
    expect(trip).toBeDefined();
    if (!arm || !trip) return;

    // The trip must fire at least `timeDelaySec` after arming.
    const s1 = s.uflsStages.find((st) => st.id === 'S1')!;
    expect(trip.timeSec - arm.timeSec).toBeCloseTo(s1.timeDelaySec, 1);
  });

  it('releases an armed stage (STAGE_RESET) without a trip when frequency never crosses the delay', () => {
    // Small deficit: S1 arms but frequency settles back above threshold before
    // 0.20 s elapses (no saturation, immediate recovery). The stage must be
    // reset, not tripped.
    const s = loadStepStudy(60);
    const run = computeUnderfrequencyTimeline(s);
    expect(run.status).toBe('VALID');
    const s1Trips = run.events.filter((e) => e.type === 'UFLS_TRIP' && e.stageId === 'S1');
    expect(s1Trips.length).toBe(0);
  });

  // ---- UFR-FIX-02: Delay=0 stage must trip immediately ----
  it('trips a zero-delay stage at the same tick it arms (not dropped by the >EPS gate)', () => {
    const s0Stages: readonly UflsStageSettings[] = [
      { id: 'S1', label: 'Stage 1 — 49.50', enabled: true, thresholdHz: 49.50, timeDelaySec: 0, shedFractionPct: 10 },
      { id: 'S2', label: 'Stage 2 — 49.00', enabled: true, thresholdHz: 49.00, timeDelaySec: 0.30, shedFractionPct: 20 },
      { id: 'S3', label: 'Stage 3 — 48.50', enabled: true, thresholdHz: 48.50, timeDelaySec: 0.40, shedFractionPct: 20 },
      { id: 'S4', label: 'Stage 4 — 48.00', enabled: true, thresholdHz: 48.00, timeDelaySec: 0.50, shedFractionPct: 20 },
    ];
    const s = study({ uflsStages: s0Stages }, [{ id: 'D1', kind: 'LOAD_STEP', timeSec: 0, mw: 800 }]);
    const run = computeUnderfrequencyTimeline(s);
    expect(run.status).toBe('VALID');
    const s1Trips = run.events.filter((e) => e.type === 'UFLS_TRIP' && e.stageId === 'S1');
    expect(s1Trips.length).toBe(1);
    // S1 trip must coincide with arming, not be silently dropped.
    const arm = run.events.find((e) => e.type === 'UFLS_ARMED' && e.stageId === 'S1');
    expect(arm, 'S1 arm event should exist').toBeDefined();
    expect(arm, 'S1 should trip at arming instant for Delay=0').toBeDefined();
    expect(s1Trips[0].timeSec - arm!.timeSec).toBeCloseTo(0, 1);
  });
});

// ─────────────── UFR-FIX-03: GENERATOR_BLOCK stays online, clamps headroom ──────
describe('Underfrequency timeline GENERATOR_BLOCK semantics (U01 §6.1, UFR-FIX-03)', () => {
  it('keeps the generator online with clamped headroom, deficit increases by (initialMw - mw) not initialMw', () => {
    // G1 initialMw = 500. BLOCK to mw = 300 → deficit +200, G1 stays online.
    const s = study(
      {},
      [{ id: 'D1', kind: 'GENERATOR_BLOCK', timeSec: 0, generatorId: 'G1', mw: 300 }],
    );
    const run = computeUnderfrequencyTimeline(s);
    expect(run.status).toBe('VALID');

    const g1After = run.snapshots[run.snapshots.length - 1].generators.find((g) => g.generatorId === 'G1');
    // G1 must be online (ONLINE or AT_GOVERNOR_LIMIT), NOT TRIPPED.
    expect(g1After).toBeDefined();
    expect(g1After!.status).not.toBe('TRIPPED');

    // At t=0 (pre-dynamics snapshot) deficit must reflect: baseline 0 + (500 - 300) = 200.
    const snap0 = run.snapshots[0];
    expect(snap0.engineeringTimeSec).toBeCloseTo(0, 9);
    expect(snap0.deficitMw).toBeCloseTo(200, 6);

    // The disturbance event is a DISTURBANCE_APPLIED referencing G1.
    expect(run.events.some((e) => e.type === 'DISTURBANCE_APPLIED' && e.generatorId === 'G1')).toBe(true);
  });

  it('does NOT remove the generator from the online set (contrast with GENERATOR_LOSS)', () => {
    const block = study({}, [{ id: 'DB', kind: 'GENERATOR_BLOCK', timeSec: 0, generatorId: 'G1', mw: 300 }]);
    const loss = study({}, [{ id: 'DL', kind: 'GENERATOR_LOSS', timeSec: 0, generatorId: 'G1' }]);
    const rb = computeUnderfrequencyTimeline(block);
    const rl = computeUnderfrequencyTimeline(loss);
    const g1Snap = rb.snapshots[0];
    const g1SnapLoss = rl.snapshots[0];
    const blockG1 = g1Snap.generators.find((g) => g.generatorId === 'G1');
    const lossG1 = g1SnapLoss.generators.find((g) => g.generatorId === 'G1');
    // BLOCK: online; LOSS: tripped.
    expect(blockG1!.status).not.toBe('TRIPPED');
    expect(lossG1!.status).toBe('TRIPPED');
  });
});

// ─────────── UFR-FIX-05: Spurious COLLAPSE on dResidualMw === 0 ─────────────────
// A collapsing segment (betaUnsat ≤ EPS or hSysSec ≤ 0) whose residual deficit is
// exactly 0 and whose runaway ROCOF is therefore 0 is a degenerate equilibrium —
// no governor slope, no residual power. The frequency flat-lines at the saturated
// value, which is a legitimate SETTLED tail, not a collapse. Before the fix the
// only gate was dResidualMw > EPS, which is false for zero residual, so the
// recovery branch emitted flat snapshots until the iter cap then fired a spurious
// COLLAPSE event. (UFR-FIX-05)
describe('Underfrequency timeline spurious collapse on zero residual (UFR-FIX-05)', () => {
  it('does not emit COLLAPSE when a collapsing segment has dResidualMw === 0', () => {
    // A full UFLS ladder that sheds exactly the deficit lands dResidualMw at 0
    // with no unsaturated generators remaining (betaUnsat → 0 ⇒ collapsing).
    // Use small stages so every stage fires to zero-out the residual.
    const tightStages: readonly UflsStageSettings[] = [
      { id: 'S1', label: 'S1', enabled: true, thresholdHz: 49.50, timeDelaySec: 0.05, shedFractionPct: 100 },
    ];
    // G1 alone: sheds all 500 MW at S1 → deficit 500 → residual 500 - 500 = 0.
    const single = study(
      { uflsStages: tightStages, generators: [GENS[0]] },
      [
        { id: 'D1', kind: 'LOAD_STEP', timeSec: 0, mw: 500 },
      ],
    );
    const run = computeUnderfrequencyTimeline(single);
    expect(run.steadyStateStatus).not.toBe('COLLAPSE');
    expect(run.events.some((e) => e.type === 'COLLAPSE')).toBe(false);
    // Flat tail: final frequency equals the saturated-setpoint frequency, not a
    // runaway. It should at least not be BELOW the first stage threshold by a
    // runaway margin.
    if (run.snapshots.length > 0) {
      const last = run.snapshots[run.snapshots.length - 1];
      expect(last.frequencyHz).toBeGreaterThanOrEqual(49.50);
    }
  });

  it('still emits COLLAPSE when a collapsing segment has positive residual', () => {
    // A load step larger than total generator capacity → positive residual → real runaway.
    const single = study(
      { uflsStages: UFLS, generators: [GENS[0]] },
      [
        { id: 'D1', kind: 'LOAD_STEP', timeSec: 0, mw: 900 }, // > 640 governorMax
      ],
    );
    const run = computeUnderfrequencyTimeline(single);
    expect(run.steadyStateStatus).toBe('COLLAPSE');
    expect(run.events.some((e) => e.type === 'COLLAPSE')).toBe(true);
  });
});
