import { describe, expect, it } from 'vitest';
import {
  clampGovernorMw,
  governorHeadroomMw,
  perUnitSaturationDeviationHz,
  systemStiffnessBetaPu,
} from './underfrequencyGovernor';
import type { UnderfrequencyGeneratorData } from '../types/underfrequency';

// ─────────────────────────────── Fixtures ──────────────────────────────────

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
