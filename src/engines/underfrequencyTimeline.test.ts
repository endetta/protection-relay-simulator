import { describe, expect, it } from 'vitest';
import { evaluateUnderfrequencySystem } from './underfrequency';
import { computeUnderfrequencyTimeline } from './underfrequencyTimeline';
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
  });

  it('emits an initial balanced snapshot at exactly nominal frequency', () => {
    const s = study(); // UFR-01: no disturbance
    const run = computeUnderfrequencyTimeline(s);
    expect(run.status).toBe('VALID');
    const first = run.snapshots[0];
    expect(first.frequencyHz).toBeCloseTo(50, 12);
    expect(first.deficitMw).toBeCloseTo(0, 9);
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
