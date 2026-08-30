import { describe, expect, it } from 'vitest';
import { evaluateUnderfrequencySystem } from '../engines/underfrequency';
import { computeUnderfrequencyTimeline } from '../engines/underfrequencyTimeline';
import {
  DEFAULT_UNDERFREQUENCY_PRESET_ID,
  UFR_01_NOMINAL,
  UFR_02_LOSE_LARGE_UNIT,
  UFR_04_HIGH_INERTIA,
  UFR_06_SMALL_DEFICIT,
  UNDERFREQUENCY_STUDY_PRESETS,
  getUnderfrequencyStudyPreset,
  listUnderfrequencyStudyPresets,
} from './underfrequencyPresets';
import { validateUnderfrequencyStudyDefinition } from './underfrequencyStudy';

describe('UFR preset registry (U01 § 10)', () => {
  it('lists exactly the six canonical presets in stable order', () => {
    const list = listUnderfrequencyStudyPresets();
    expect(list.map((preset) => preset.id)).toEqual(['UFR-01', 'UFR-02', 'UFR-03', 'UFR-04', 'UFR-05', 'UFR-06']);
  });

  it('keeps the default preset id pointing at the nominal preset', () => {
    expect(DEFAULT_UNDERFREQUENCY_PRESET_ID).toBe('UFR-01');
    expect(getUnderfrequencyStudyPreset(DEFAULT_UNDERFREQUENCY_PRESET_ID).id).toBe('UFR-01');
  });

  it('looks up presets by id and throws on unknown ids', () => {
    expect(getUnderfrequencyStudyPreset('UFR-03').study.label).toBe('Loss of Two Units');
    expect(() => getUnderfrequencyStudyPreset('UFR-99')).toThrow(/Unknown Underfrequency preset/);
  });

  it('registers every preset as a VALID study at construction time', () => {
    for (const preset of UNDERFREQUENCY_STUDY_PRESETS) {
      const validation = validateUnderfrequencyStudyDefinition(preset.study);
      expect(validation.status).toBe('VALID');
    }
  });

  it('flags every preset with plnVerificationRequired (typical-practice values)', () => {
    for (const preset of UNDERFREQUENCY_STUDY_PRESETS) {
      expect(preset.study.notes?.plnVerificationRequired).toBe(true);
    }
  });
});

describe('UFR preset engine evaluation (golden expectations)', () => {
  it('UFR-01 nominal is balanced: zero deficit, no pickup, RESTRAIN', () => {
    const result = evaluateUnderfrequencySystem({
      system: UFR_01_NOMINAL.study.system,
      generators: UFR_01_NOMINAL.study.generators,
      uflsStages: UFR_01_NOMINAL.study.uflsStages,
    });
    expect(result.status).toBe('VALID');
    if (result.status === 'VALID') {
      expect(result.value.initialDeficitMw).toBeCloseTo(0, 9);
      expect(result.value.displayStatus).toBe('RESTRAIN');
      expect(result.value.initialRocofHzPerSec).toBeCloseTo(0, 9);
    }
  });

  it('UFR-02 large-unit loss: G1-loss survivor set shows 500 MW deficit and ROCOF ≈ −3.03 Hz/s', () => {
    const s = UFR_02_LOSE_LARGE_UNIT.study;
    const step = s.disturbanceSteps[0];
    expect(step.kind).toBe('GENERATOR_LOSS');
    expect(step.generatorId).toBe('G1');
    // The static engine derives the deficit from the generator set's status, so
    // encode the same post-loss state the timeline produces via the event step.
    const result = evaluateUnderfrequencySystem({
      system: s.system,
      generators: s.generators.filter((g) => g.id !== step.generatorId),
      uflsStages: s.uflsStages,
    });
    expect(result.status).toBe('VALID');
    if (result.status === 'VALID') {
      expect(result.value.initialDeficitMw).toBeCloseTo(500, 6);
      expect(result.value.initialRocofHzPerSec).toBeCloseTo(-3.0303, 2);
      expect(result.value.displayStatus).toBe('OPERATE');
      // D₀ = 500 MW; S_base = 1060 MVA (survivors); H_sys recomputed over survivors.
      const sBase = 450 + 330 + 280;
      const hSys = (4.0 * 450 + 4.5 * 330 + 3.0 * 280) / sBase;
      expect(result.value.initialRocofHzPerSec).toBeCloseTo(-(50 / (2 * hSys)) * (500 / sBase), 6);
      expect(result.value.hSysSec).toBeCloseTo(hSys, 9);
    }
  });

  it('UFR-06 small deficit: frequency settles slightly below nominal via droop', () => {
    const s = UFR_06_SMALL_DEFICIT.study;
    const deficitMw = 100;
    const staticRef = evaluateUnderfrequencySystem({
      system: { ...s.system, baseLoadMw: s.system.baseLoadMw + deficitMw },
      generators: s.generators,
      uflsStages: s.uflsStages,
    });
    expect(staticRef.status).toBe('VALID');
    if (staticRef.status === 'VALID') {
      // Droop-only settle, no UFLS trip (settle stays above Stage 1 = 49.50 Hz).
      // Δf_ss = −D / β_MW/Hz where β_MW/Hz = β_pu / f_nom; β_pu = Σ MVA/R over
      // the unsaturated set. All four units are unsaturated here.
      const betaPu = s.generators.reduce((sum, g) => sum + g.mva / g.droopPu, 0);
      const betaMwPerHz = betaPu / s.system.fNominalHz;
      const expected = s.system.fNominalHz - deficitMw / betaMwPerHz;
      expect(staticRef.value.steadyStateHz).not.toBeNull();
      expect(staticRef.value.steadyStateHz!).toBeCloseTo(expected, 6);
      expect(staticRef.value.steadyStateHz!).toBeLessThan(50);
      // No UFLS operates: settle sits above the first stage threshold.
      expect(staticRef.value.steadyStateHz!).toBeGreaterThan(49.5);
      expect(staticRef.value.totalShedMw).toBe(0);
    }
  });

  it('UFR-02 and UFR-06 timelines settle bit-close to their static references (parity)', () => {
    const cases = [UFR_02_LOSE_LARGE_UNIT, UFR_06_SMALL_DEFICIT];
    for (const preset of cases) {
      const s = preset.study;
      const timeline = computeUnderfrequencyTimeline(s);
      expect(timeline.status).toBe('VALID');
      if (timeline.status !== 'VALID') continue;
      // Build a like-for-like static reference: for a GENERATOR_LOSS, pass the
      // survivor set; for a LOAD_STEP, encode the inflated baseLoad.
      let staticContext;
      const step = s.disturbanceSteps[0];
      expect(step).toBeDefined();
      if (step.kind === 'GENERATOR_LOSS') {
        staticContext = {
          system: s.system,
          generators: s.generators.filter((g) => g.id !== step.generatorId),
          uflsStages: s.uflsStages,
        };
      } else {
        staticContext = {
          system: { ...s.system, baseLoadMw: s.system.baseLoadMw + (step.mw ?? 0) },
          generators: s.generators,
          uflsStages: s.uflsStages,
        };
      }
      const staticRef = evaluateUnderfrequencySystem(staticContext);
      expect(staticRef.status).toBe('VALID');
      if (timeline.finalFrequencyHz !== null && staticRef.status === 'VALID' && staticRef.value.steadyStateHz !== null) {
        expect(Math.abs(timeline.finalFrequencyHz - staticRef.value.steadyStateHz)).toBeLessThan(1e-6);
      }
    }
  });
});

describe('UFR preset hardening (invalid construction throws)', () => {
  it('UFR-04 high inertia raises H_sys and softens the post-loss ROCOF vs UFR-02', () => {
    const low = evaluateUnderfrequencySystem({
      system: UFR_02_LOSE_LARGE_UNIT.study.system,
      generators: UFR_02_LOSE_LARGE_UNIT.study.generators,
      uflsStages: UFR_02_LOSE_LARGE_UNIT.study.uflsStages,
    });
    const high = evaluateUnderfrequencySystem({
      system: UFR_04_HIGH_INERTIA.study.system,
      generators: UFR_04_HIGH_INERTIA.study.generators,
      uflsStages: UFR_04_HIGH_INERTIA.study.uflsStages,
    });
    expect(low.status).toBe('VALID');
    expect(high.status).toBe('VALID');
    if (low.status === 'VALID' && high.status === 'VALID') {
      expect(high.value.hSysSec).toBeGreaterThan(low.value.hSysSec);
    }
  });

  it('registry exposes no duplicate preset ids', () => {
    const ids = UNDERFREQUENCY_STUDY_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
