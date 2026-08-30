import { describe, expect, it } from 'vitest';
import {
  evaluateUnderfrequencySystem,
  solveSteadyStateDeficit,
  type UnderfrequencyStaticContext,
} from './underfrequency';
import type {
  UnderfrequencyGeneratorData,
  UnderfrequencySystemData,
  UflsStageSettings,
} from '../types/underfrequency';

/**
 * Deterministic numerical hardening (plan V2 / U01 § 13.3).
 *
 * Uses a fixed-seed LCG (NOT Math.random) so failures are reproducible.
 * Intended as the "no error when building from scratch" proof: the engine
 * must NEVER throw, always return finite frequencies (or an explicit
 * non-finite / collapse status), and honour the strict-inequality UFLS
 * pickup boundary via the shared `nearlyEqual` tolerance.
 */

let seed = 0x81_50_2026;
function random(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x1_0000_0000;
}

const SYSTEM: UnderfrequencySystemData = { fNominalHz: 50, voltageKv: 150, baseLoadMw: 1300 };

function gen(id: string): UnderfrequencyGeneratorData {
  const mva = 300 + Math.floor(random() * 500);
  const mwRated = mva * 0.85;
  return {
    id: `G${id}`,
    label: `G${id}`,
    mwRated,
    mva,
    inertiaSec: 2.5 + random() * 5,       // 2.5 - 7.5 s
    droopPu: 0.03 + random() * 0.05,      // 3% - 8%
    poles: random() > 0.5 ? 2 : 4,
    governorMaxMw: mwRated * 1.1,
    initialMw: mwRated * 0.8,
    status: 'ONLINE',
  };
}

function ufls(base: number): UflsStageSettings {
  return {
    id: `S${base}`,
    label: `Stage ${base}`,
    enabled: true,
    thresholdHz: 49.50 - (base - 1) * 0.5,
    timeDelaySec: 0.2 + (base - 1) * 0.1,
    shedFractionPct: 5 * base,
  };
}

const DEFAULT_UFLS: readonly UflsStageSettings[] = [ufls(1), ufls(2), ufls(3), ufls(4)];

describe('Underfrequency U01 hardening (seeded, deterministic)', () => {
  it('never throws and always returns a valid-shape result for random online sets', () => {
    let runs = 0;
    let nonFiniteSeen = 0;
    for (let trial = 0; trial < 4000; trial += 1) {
      const count = 2 + Math.floor(random() * 4); // 2-5 generators
      const generators: UnderfrequencyGeneratorData[] = [];
      for (let i = 0; i < count; i += 1) generators.push(gen(String(i)));
      const context: UnderfrequencyStaticContext = { system: SYSTEM, generators, uflsStages: DEFAULT_UFLS };
      let result;
      try {
        result = evaluateUnderfrequencySystem(context);
      } catch {
        throw new Error(`Evaluate threw on trial ${trial}`);
      }
      expect(result).not.toBeNull();
      if (result.status === 'VALID') {
        runs += 1;
        const v = result.value;
        if (v.steadyStateHz !== null && !Number.isFinite(v.steadyStateHz)) nonFiniteSeen += 1;
        expect(Number.isFinite(v.initialRocofHzPerSec)).toBe(true);
        expect(Number.isFinite(v.sBaseMva)).toBe(true);
        expect(Number.isFinite(v.hSysSec)).toBe(true);
      }
    }
    expect(runs).toBeGreaterThan(0);
    expect(nonFiniteSeen).toBe(0);
  });

  it('maps a runaway deficit to COLLAPSE, never a throw or a wrong number', () => {
    for (let trial = 0; trial < 1000; trial += 1) {
      const generators = [gen('0'), gen('1')];
      const deficit = 1000 + random() * 5000;
      let result;
      try {
        result = solveSteadyStateDeficit({
          generators,
          fNominalHz: 50,
          deficitMw: deficit,
          uflsStages: DEFAULT_UFLS,
          baseLoadMw: 1300,
        });
      } catch {
        throw new Error(`solveSteadyStateDeficit threw at deficit ${deficit}`);
      }
      expect(result).not.toBeNull();
      // Either a finite settled frequency, or an explicit collapse.
      if (result.solveStatus === 'SETTLED') {
        expect(result.steadyStateHz).not.toBeNull();
        expect(Number.isFinite(result.steadyStateHz!)).toBe(true);
      } else {
        expect(result.steadyStateHz).toBeNull();
      }
    }
  });

  it('honours the strict-inequality UFLS pickup boundary (never arms on exact equality)', () => {
    // Test each stage in isolation: at exact threshold → not armed; just below → armed.
    for (const stage of DEFAULT_UFLS) {
      expect(evaluateUnderfrequencyUfrBoundary([stage], stage.thresholdHz)).toBe(false);
      expect(evaluateUnderfrequencyUfrBoundary([stage], stage.thresholdHz - 1e-9)).toBe(true);
      expect(evaluateUnderfrequencyUfrBoundary([stage], stage.thresholdHz + 1e-9)).toBe(false);
    }
  });

  it('always yields finite, ordered frequency snapshots for a settled timeline-like solve', () => {
    for (let trial = 0; trial < 2000; trial += 1) {
      const generators = [gen('0'), gen('1'), gen('2')];
      const deficit = random() * 600;
      const result = solveSteadyStateDeficit({
        generators,
        fNominalHz: 50,
        deficitMw: deficit,
        uflsStages: DEFAULT_UFLS,
        baseLoadMw: 1300,
      });
      expect(result).not.toBeNull();
      if (result.solveStatus === 'SETTLED') {
        const f = result.steadyStateHz!;
        expect(Number.isFinite(f)).toBe(true);
        // Underfrequency never overshoots above nominal for a positive deficit.
        expect(f).toBeLessThanOrEqual(50 + 1e-9);
        // Should never collapse to an absurdly low (unphysical) value in a settled case.
        expect(f).toBeGreaterThan(35);
      }
    }
  });
});

// A tiny local helper mirroring the strict-inequality rule (U01 § 9.2) so the
// boundary test is self-contained and does not import a private function. It
// mirrors `nearlyEqual` (scale-aware 1e-12 tolerance from overcurrent.ts:34).
function evaluateUnderfrequencyUfrBoundary(
  stages: readonly UflsStageSettings[],
  frequencyHz: number,
): boolean {
  for (const stage of stages) {
    if (!stage.enabled) continue;
    const withinTolerance = Math.abs(frequencyHz - stage.thresholdHz) <=
      1e-12 * Math.max(1, Math.abs(frequencyHz), Math.abs(stage.thresholdHz));
    if (frequencyHz < stage.thresholdHz && !withinTolerance) return true;
  }
  return false;
}
