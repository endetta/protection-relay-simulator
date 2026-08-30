import { describe, expect, it } from 'vitest';
import {
  aggregateBaseMva,
  aggregateInertia,
  clampGovernorMw,
  computeInitialDeficit,
  computeRocof,
  evaluateUnderfrequencySystem,
  evaluateUnderfrequencyUfr,
  governorHeadroomMw,
  perUnitSaturationDeviationHz,
  solveSteadyStateDeficit,
  systemStiffnessBetaPu,
  validateUnderfrequencyGenerators,
  validateUnderfrequencySystem,
  validateUnderfrequencyUflsStages,
  type UnderfrequencyStaticContext,
} from './underfrequency';
import type {
  UnderfrequencyGeneratorData,
  UnderfrequencySystemData,
  UflsStageSettings,
} from '../types/underfrequency';

// ─────────────────────────────── Fixtures ──────────────────────────────────

const SYSTEM: UnderfrequencySystemData = {
  fNominalHz: 50,
  voltageKv: 150,
  baseLoadMw: 1300,
};

const GENS: readonly UnderfrequencyGeneratorData[] = [
  {
    id: 'G1', label: 'G1 — Thermal 600 MW', mwRated: 600, mva: 700,
    inertiaSec: 5.0, droopPu: 0.05, poles: 2, governorMaxMw: 640, initialMw: 500, status: 'ONLINE',
  },
  {
    id: 'G2', label: 'G2 — Hydro 400 MW', mwRated: 400, mva: 450,
    inertiaSec: 4.0, droopPu: 0.04, poles: 4, governorMaxMw: 430, initialMw: 350, status: 'ONLINE',
  },
  {
    id: 'G3', label: 'G3 — Gas 300 MW', mwRated: 300, mva: 330,
    inertiaSec: 4.5, droopPu: 0.05, poles: 2, governorMaxMw: 320, initialMw: 250, status: 'ONLINE',
  },
  {
    id: 'G4', label: 'G4 — CCGT 250 MW', mwRated: 250, mva: 280,
    inertiaSec: 3.0, droopPu: 0.06, poles: 2, governorMaxMw: 265, initialMw: 200, status: 'ONLINE',
  },
];

const UFLS: readonly UflsStageSettings[] = [
  { id: 'S1', label: 'Stage 1 — 49.50', enabled: true, thresholdHz: 49.50, timeDelaySec: 0.20, shedFractionPct: 5 },
  { id: 'S2', label: 'Stage 2 — 49.00', enabled: true, thresholdHz: 49.00, timeDelaySec: 0.30, shedFractionPct: 10 },
  { id: 'S3', label: 'Stage 3 — 48.50', enabled: true, thresholdHz: 48.50, timeDelaySec: 0.40, shedFractionPct: 15 },
  { id: 'S4', label: 'Stage 4 — 48.00', enabled: true, thresholdHz: 48.00, timeDelaySec: 0.50, shedFractionPct: 20 },
];

const CONTEXT: UnderfrequencyStaticContext = { system: SYSTEM, generators: GENS, uflsStages: UFLS };

// Minimal helpers to make a generator variant for the saturation / deficit cases.
function gen(id: string, over: Partial<UnderfrequencyGeneratorData>): UnderfrequencyGeneratorData {
  const base = GENS.find((g) => g.id === id)!;
  return { ...base, ...over };
}

// ─────────────────────────── Aggregates (U01 § 12.1) ───────────────────────

describe('Underfrequency aggregates (U01 § 12.1)', () => {
  it('computes S_base = Σ MVA', () => {
    expect(aggregateBaseMva(GENS)).toBeCloseTo(1760, 10);
  });

  it('computes inertia-weighted H_sys', () => {
    // (5·700 + 4·450 + 4.5·330 + 3·280)/1760 = 7625/1760
    expect(aggregateInertia(GENS, 1760)).toBeCloseTo(7625 / 1760, 10);
    expect(aggregateInertia(GENS, 1760)).toBeCloseTo(4.332386, 6);
  });
});

// ─────────────────────────── ROCOF (U01 § 12.2) ────────────────────────────

describe('Underfrequency ROCOF (U01 § 12.2)', () => {
  it('computes initial ROCOF for a 500 MW loss', () => {
    const rocof = computeRocof(500, 4.3323863636, 1760, 50);
    // df/dt|₀ = -(50/(2·H_sys))·(D₀/S_base)
    expect(rocof).toBeCloseTo(-(50 / (2 * 4.3323863636)) * (500 / 1760), 6);
    expect(rocof).toBeCloseTo(-1.6393, 3);
  });

  it('computes 100 MW small-deficit ROCOF (UFR-06)', () => {
    expect(computeRocof(100, 4.3323863636, 1760, 50)).toBeCloseTo(
      -(50 / (2 * 4.3323863636)) * (100 / 1760),
      10,
    );
  });
});

// ─────────────────────────── Governor math (U01 § 7) ───────────────────────

describe('Underfrequency governor/droop (U01 § 7)', () => {
  it('returns positive headroom for an online unit with spare margin', () => {
    expect(governorHeadroomMw(GENS[0])).toBeCloseTo(140, 10); // 640 - 500
    expect(governorHeadroomMw(GENS[3])).toBeCloseTo(65, 10);   // 265 - 200
  });

  it('limits a small deviation to headroom for the smallest headroom unit', () => {
    // G4 headroom 65 MW. A tiny -0.1 Hz deviation:
    // response = -(-0.1)/50 · (280/0.06) = 0.002 · 4666.67 = 9.33 MW (< 65)
    expect(clampGovernorMw(GENS[3], -0.1, 50)).toBeCloseTo(9.3333, 3);
  });

  it('clamps to headroom at saturation', () => {
    // A deep deviation for G4 (-1 Hz): uncapped = (1/50)·(280/0.06)=93.3 > 65 → 65
    expect(clampGovernorMw(GENS[3], -1, 50)).toBeCloseTo(65, 6);
  });

  it('gives zero response at f = f_nom (df = 0)', () => {
    expect(clampGovernorMw(GENS[0], 0, 50)).toBeCloseTo(0, 10);
  });

  it('computes per-unit saturation deviation', () => {
    // Δf_i,sat = -f_nom·headroom·R/MVA
    // G1: -50·140·0.05/700 = -0.5 Hz
    expect(perUnitSaturationDeviationHz(GENS[0], 50)).toBeCloseTo(-0.5, 10);
    // G4: -50·65·0.06/280 = -0.6964 Hz
    expect(perUnitSaturationDeviationHz(GENS[3], 50)).toBeCloseTo(-0.69643, 4);
  });

  it('system stiffness sums only unsaturated units', () => {
    // At df=-0.1, all units unsaturated → full β_pu
    const fullBeta = systemStiffnessBetaPu(GENS, -0.1, 50);
    expect(fullBeta).toBeCloseTo(36516.6667, 2);
    // At df=-1.0, every unit is saturated (all |satΔ| < 1.0) → β = 0
    const zeroBeta = systemStiffnessBetaPu(GENS, -1.0, 50);
    expect(zeroBeta).toBeCloseTo(0, 10);
  });
});

// ─────────────────────────── Steady-state solver (U01 § 12.3-12.4) ─────────

describe('Underfrequency solveSteadyStateDeficit (U01 § 12.3 / 12.4)', () => {
  it('solves unsaturated steady state for small deficit', () => {
    const result = solveSteadyStateDeficit({
      generators: GENS, fNominalHz: 50, deficitMw: 100, uflsStages: UFLS, baseLoadMw: 1300,
    });
    expect(result.solveStatus).toBe('SETTLED');
    expect(result.steadyStateHz).not.toBeNull();
    // Δf_ss = -f_nom·D/β_pu = -50·100/36516.67
    expect(result.steadyStateHz!).toBeCloseTo(50 - 50 * 100 / 36516.6667, 6);
    expect(result.steadyStateHz!).toBeCloseTo(49.8631, 3);
    expect(result.betaPu).toBeCloseTo(36516.6667, 2);
  });

  it('saturates units as deficit deepens but still settles', () => {
    // Saturation order is by ascending |satΔ|: G2 (0.3556), G3 (0.4545), G1 (0.5),
    // G4 (0.6964). At deficit 340 those three small-Δ units saturate, leaving
    // only G4 on the slope.
    const result = solveSteadyStateDeficit({
      generators: GENS, fNominalHz: 50, deficitMw: 340, uflsStages: UFLS, baseLoadMw: 1300,
    });
    expect(result.solveStatus).toBe('SETTLED');
    expect(result.steadyStateHz).not.toBeNull();
    const byId = new Map(result.governorResults.map((g) => [g.generatorId, g]));
    expect(byId.get('G2')!.saturated).toBe(true);
    expect(byId.get('G2')!.droopResponseMw).toBeCloseTo(80, 6); // 430-350
    expect(byId.get('G1')!.saturated).toBe(true);
    expect(byId.get('G3')!.saturated).toBe(true);
    expect(byId.get('G3')!.droopResponseMw).toBeCloseTo(70, 6); // 320-250
    expect(byId.get('G4')!.saturated).toBe(false);
    // Only G4 unsaturated → β = MVA/R = 280/0.06 = 4666.67
    expect(result.betaPu).toBeCloseTo(4666.6667, 1);
    // Saturated MW = 80 + 140 + 70 = 290; residual = 340 - 290 = 50
    // df = -50·50/4666.67 = -0.5357; f_ss = 49.4643
    expect(result.steadyStateHz!).toBeCloseTo(49.4643, 3);
  });

  it('returns COLLAPSE when deficit exceeds available headroom (never throws)', () => {
    // Total headroom = 355 MW. Deficit 1000 MW >> 355 → collapse.
    const result = solveSteadyStateDeficit({
      generators: GENS, fNominalHz: 50, deficitMw: 1000, uflsStages: UFLS, baseLoadMw: 1300,
    });
    expect(result.solveStatus).toBe('COLLAPSE');
    expect(result.steadyStateHz).toBeNull();
  });

  it('guards against non-finite nominal frequency', () => {
    const result = solveSteadyStateDeficit({
      generators: GENS, fNominalHz: Number.NaN, deficitMw: 100, uflsStages: UFLS, baseLoadMw: 1300,
    });
    expect(result.solveStatus).toBe('COLLAPSE');
  });
});

// ─────────────────────────── Deficit & UFLS static (U01 § 9, § 12.5) ───────

describe('Underfrequency initial deficit & UFLS arming (U01 § 6.2 / § 12.5)', () => {
  it('computes balanced pre-disturbance deficit = 0', () => {
    expect(computeInitialDeficit(GENS, 1300)).toBeCloseTo(0, 10);
  });

  it('adds a loss by removing the unit from the online set', () => {
    const postLoss = GENS.filter((g) => g.id !== 'G1');
    expect(computeInitialDeficit(postLoss, 1300)).toBeCloseTo(500, 10);
  });

  it('arrests a stage only with strict below-threshold (never on exact equality)', () => {
    const at = evaluateUnderfrequencyUfr(UFLS, 49.50, 1300);
    const s1 = at.find((r) => r.stageId === 'S1')!;
    expect(s1.operated).toBe(false); // exact equality → not armed

    const slightlyBelow = evaluateUnderfrequencyUfr(UFLS, 49.50 - 1e-9, 1300);
    const s1Below = slightlyBelow.find((r) => r.stageId === 'S1')!;
    expect(s1Below.operated).toBe(true);

    const above = evaluateUnderfrequencyUfr(UFLS, 49.55, 1300);
    expect(above.find((r) => r.stageId === 'S1')!.operated).toBe(false);
  });

  it('computes shed MW from pre-disturbance load', () => {
    const at = evaluateUnderfrequencyUfr(UFLS, 49.40, 1300);
    // Stages S1 (49.50) and S2 (49.00) operate; S1 shed = 5%·1300 = 65, S2 = 10%·1300 = 130
    const s1 = at.find((r) => r.stageId === 'S1')!;
    const s2 = at.find((r) => r.stageId === 'S2')!;
    const s3 = at.find((r) => r.stageId === 'S3')!;
    expect(s1.shedMw).toBeCloseTo(65, 6);
    expect(s2.shedMw).toBeCloseTo(130, 6);
    expect(s3.operated).toBe(false);
  });
});

// ─────────────────────────── Validation (U01 § 12.6-12.7) ──────────────────

describe('Underfrequency validation (U01 § 12.6 / 12.7)', () => {
  it('passes a valid system/generators/UFLS', () => {
    expect(validateUnderfrequencySystem(SYSTEM)).toHaveLength(0);
    expect(validateUnderfrequencyGenerators(GENS)).toHaveLength(0);
    expect(validateUnderfrequencyUflsStages(UFLS)).toHaveLength(0);
  });

  it('rejects non-positive inertia', () => {
    const bad = GENS.map((g) => (g.id === 'G1' ? gen('G1', { inertiaSec: 0 }) : g));
    const issues = validateUnderfrequencyGenerators(bad);
    expect(issues.some((i) => i.code === 'NON_POSITIVE_INERTIA')).toBe(true);
  });

  it('rejects non-positive droop', () => {
    const bad = GENS.map((g) => (g.id === 'G1' ? gen('G1', { droopPu: -0.05 }) : g));
    expect(validateUnderfrequencyGenerators(bad).some((i) => i.code === 'NON_POSITIVE_DROOP')).toBe(true);
  });

  it('rejects a negative pole count', () => {
    const bad = GENS.map((g) => (g.id === 'G1' ? gen('G1', { poles: 0 }) : g));
    expect(validateUnderfrequencyGenerators(bad).some((i) => i.code === 'INVALID_POLES')).toBe(true);
  });

  it('rejects negative headroom (governorMax < initial)', () => {
    const bad = GENS.map((g) => (g.id === 'G1' ? gen('G1', { governorMaxMw: 400 }) : g));
    expect(validateUnderfrequencyGenerators(bad).some((i) => i.code === 'NON_POSITIVE_HEADROOM')).toBe(true);
  });

  it('rejects unordered UFLS stages', () => {
    const swapped = [
      UFLS[1], // S2 (49.00) first
      UFLS[0], // S1 (49.50) second — higher threshold after lower → invalid
      UFLS[2],
      UFLS[3],
    ];
    const issues = validateUnderfrequencyUflsStages(swapped);
    expect(issues.some((i) => i.code === 'INVALID_UFLS_ORDER')).toBe(true);
  });

  it('rejects non-positive nominal frequency', () => {
    expect(validateUnderfrequencySystem({ ...SYSTEM, fNominalHz: 0 }).some((i) => i.code === 'NON_POSITIVE_F_NOM')).toBe(true);
  });
});

// ─────────────────────────── Static evaluator (U01 § 11) ───────────────────

describe('Underfrequency evaluateUnderfrequencySystem (U01 § 11)', () => {
  it('returns VALID for the nominal balanced context', () => {
    const evalResult = evaluateUnderfrequencySystem(CONTEXT);
    expect(evalResult.status).toBe('VALID');
    if (evalResult.status === 'VALID') {
      expect(evalResult.value.steadyStateHz).toBeCloseTo(50, 6);
      expect(evalResult.value.steadyStateStatus).toBe('SETTLED');
      expect(evalResult.value.initialDeficitMw).toBeCloseTo(0, 6);
      expect(evalResult.value.displayStatus).toBe('RESTRAIN');
    }
  });

  it('returns INVALID (not throws) for a bad system', () => {
    const evalResult = evaluateUnderfrequencySystem({ ...CONTEXT, system: { ...SYSTEM, fNominalHz: NaN } });
    expect(evalResult.status).toBe('INVALID');
  });

  it('returns OPERATE when UFLS sheds for a large loss', () => {
    const postLossGens = GENS.filter((g) => g.id !== 'G1');
    const evalResult = evaluateUnderfrequencySystem({ ...CONTEXT, generators: postLossGens });
    expect(evalResult.status).toBe('VALID');
    if (evalResult.status === 'VALID') {
      expect(evalResult.value.totalShedMw).toBeGreaterThan(0);
      expect(evalResult.value.displayStatus).toBe('OPERATE');
    }
  });
});
