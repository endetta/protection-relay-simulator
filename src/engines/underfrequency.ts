/**
 * Underfrequency engine (U01 § 5-8, per underfrequency-relay.md).
 *
 * Pure, deterministic calculation. No React, no DOM, no SVG. Reuses the
 * scale-aware `nearlyEqual` tolerance from overcurrent.ts (O02 invariant).
 *
 * The math is distilled from a single-area coherent swing equation with
 * per-generator algebraic governor/droop response and staged UFLS:
 *
 *   H_sys     = Σ(H_i·MVA_i) / Σ(MVA_i)                 [inertia-weighted]
 *   resp_i    = clamp(-Δf/f_nom · MVA_i/R_i, 0, headroom_i)
 *   β_pu      = Σ_unsaturated (MVA_i/R_i)
 *   Δf_ss     = -f_nom · D / β_pu                        [unsaturated]
 *
 * All functions are non-throwing on the numeric boundary: bad inputs yield
 * an explicit `INVALID` / collapse status, never a thrown exception.
 */

import type {
  DomainEvaluation,
  DomainIssue,
  UnderfrequencyDomainIssueCode,
  UnderfrequencyGeneratorData,
  UnderfrequencyGovernorResult,
  UnderfrequencySolveStatus,
  UnderfrequencyStaticResult,
  UnderfrequencySteadyStateStatus,
  UnderfrequencySystemData,
  UnderfrequencyUflsStageResult,
  UflsStageSettings,
} from '../types/underfrequency';
import { nearlyEqual } from './overcurrent';
import {
  governorHeadroomMw,
  perUnitDroopMw,
  perUnitSaturationDeviationHz,
} from './underfrequencyGovernor';

// ─────────────────────────────── Issue helpers ─────────────────────────────

function issue(
  code: UnderfrequencyDomainIssueCode,
  path: string,
  detail: string,
): DomainIssue {
  return { code, path, detail };
}

function invalid(issues: readonly DomainIssue[]): DomainEvaluation<never> {
  return { status: 'INVALID', issues };
}

/** Map the solve status onto the binary steady-state classifier (U01 § 11.1). */
function solveStatusToSteadyStateStatus(
  status: UnderfrequencySolveStatus,
): UnderfrequencySteadyStateStatus {
  return status === 'SETTLED' ? 'SETTLED' : 'COLLAPSE';
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

// ─────────────────────────────── Aggregates ────────────────────────────────
// U01 § 5.2.

/** Sum of online generator MVA — the study base. */
export function aggregateBaseMva(
  generators: readonly UnderfrequencyGeneratorData[],
): number {
  return generators.reduce((sum, g) => sum + g.mva, 0);
}

/**
 * Inertia-weighted mean H over the online set.
 * `H_sys = Σ(H_i·MVA_i) / Σ(MVA_i)`.
 */
export function aggregateInertia(
  generators: readonly UnderfrequencyGeneratorData[],
  sBaseMva: number,
): number {
  const numer = generators.reduce((sum, g) => sum + g.inertiaSec * g.mva, 0);
  if (!isFinitePositive(sBaseMva)) return Number.NaN;
  return numer / sBaseMva;
}

// ---------------------------------------------------------------------------
// Governor / droop math (U01 § 7) lives in underfrequencyGovernor.ts — the one
// deep module consumed by both the static solver here and the time-domain run.
// ---------------------------------------------------------------------------

// ─────────────────────────────── Static reference ──────────────────────────
// Aggregates the closed-form steady-state for a given (already-resolved)
// online set, deficit, and UFLS stage list. This is the reference the
// timeline parity test compares against.

interface StaticInput {
  readonly generators: readonly UnderfrequencyGeneratorData[];
  readonly fNominalHz: number;
  readonly deficitMw: number;
  readonly uflsStages: readonly UflsStageSettings[];
  readonly baseLoadMw: number;
}

/** Result of the closed-form UFLS resolution — the residual steady state. */
interface ResolvedDeficit {
  readonly generators: readonly UnderfrequencyGeneratorData[];
  readonly fNominalHz: number;
  readonly deficitMw: number;
  readonly uflsStages: readonly UflsStageSettings[];
  readonly baseLoadMw: number;
  /** The frequency after the residual deficit is solved (null on collapse). */
  readonly finalFrequencyHz: number | null;
  /** Stage ids that shed during resolution. */
  readonly operatedStageIds: readonly string[];
  readonly totalShedMw: number;
}

/**
 * Solve the closed-loop steady-state frequency for a constant deficit.
 * Monotone piecewise-linear inversion with saturation; returns a status,
 * never a throw. Collapse is signalled by `solveStatus = COLLAPSE`.
 */
export function solveSteadyStateDeficit(input: StaticInput): {
  readonly steadyStateHz: number | null;
  readonly betaPu: number;
  readonly solveStatus: UnderfrequencySolveStatus;
  readonly governorResults: readonly UnderfrequencyGovernorResult[];
} {
  const { generators, fNominalHz, deficitMw } = input;
  if (!isFinitePositive(fNominalHz) || !Number.isFinite(deficitMw)) {
    return { steadyStateHz: null, betaPu: 0, solveStatus: 'COLLAPSE', governorResults: [] };
  }

  // Saturation-ordered walk: units with the smallest |sat delta| saturate first.
  const ordered = [...generators].sort(
    (a, b) =>
      Math.abs(perUnitSaturationDeviationHz(a, fNominalHz)) -
      Math.abs(perUnitSaturationDeviationHz(b, fNominalHz)),
  );

  // Monotone piecewise-linear inversion with saturation. On each step:
  //   Δf_ss = -f_nom · (D - Σ_sat headroom) / β_unsat
  // Saturated units deliver their full headroom (fixed), so only the residual
  // deficit is left for the unsaturated droop slope. If Δf_ss would push the
  // next (least-saturated) unit past its limit, saturate it and repeat.
  let beta = 0;
  for (const g of generators) beta += g.mva / g.droopPu;
  let saturatedMaxMw = 0;
  const remaining = [...ordered];
  const governorResults: UnderfrequencyGovernorResult[] = [];

  for (let iter = 0; iter < generators.length + 1; iter += 1) {
    if (beta <= 1e-9 || remaining.length === 0) {
      // Either the slope degenerated or every unit is saturated — the deficit
      // can no longer be covered by governor response. This is a collapse.
      return {
        steadyStateHz: null,
        betaPu: 0,
        solveStatus: 'COLLAPSE',
        governorResults,
      };
    }
    const residual = deficitMw - saturatedMaxMw;
    const df = (-fNominalHz * residual) / beta; // Δf_ss = -f_nom·D_residual/β_unsat
    // The unit that saturates next is the one with the smallest |sat delta|
    // not already saturated (saturated units are no longer in `remaining`).
    const next = remaining[0];
    if (next) {
      const satDelta = perUnitSaturationDeviationHz(next, fNominalHz);
      if (df <= satDelta) {
        // This unit would exceed its limit → saturate it & take it off the slope.
        const headroom = governorHeadroomMw(next);
        beta -= next.mva / next.droopPu;
        remaining.shift();
        saturatedMaxMw += headroom;
        governorResults.push({
          generatorId: next.id,
          saturated: true,
          saturatingDeltaHz: satDelta,
          headroomMw: headroom,
          droopResponseMw: headroom,
          actualOutputMw: next.initialMw + headroom,
        });
        continue;
      }
    }
    // Fixed point found on the unsaturated slope.
    for (const g of remaining) {
      governorResults.push({
        generatorId: g.id,
        saturated: false,
        saturatingDeltaHz: perUnitSaturationDeviationHz(g, fNominalHz),
        headroomMw: governorHeadroomMw(g),
        droopResponseMw: perUnitDroopMw(g, df, fNominalHz),
        actualOutputMw: g.initialMw + perUnitDroopMw(g, df, fNominalHz),
      });
    }
    return {
      // Over-shedding (a deficit that is negative after UFLS) would otherwise
      // report a steady state above nominal. There is no equilibrium above
      // nominal in this governor model (droop response is clamped to
      // [0, headroom]), so clamp the settle point to Δf = 0 — this matches the
      // timeline's clamp exactly (U01 § 8.2) and keeps parity universal.
      steadyStateHz: fNominalHz + Math.min(df, 0),
      betaPu: beta,
      solveStatus: 'SETTLED',
      governorResults,
    };
  }

  return { steadyStateHz: null, betaPu: 0, solveStatus: 'DEFICIT_EXCEEDS_AVAILABLE_GENERATION', governorResults };
}

// ─────────────────────── UFLS stage resolution (static) ────────────────────
// U01 § 9. The static evaluator reports which stages would operate for the
// final steady-state frequency; the timeline engine also applies the timer
// dynamics. This is the closed-form reference for what the timeline settles to.

export function evaluateUnderfrequencyUfr(
  stages: readonly UflsStageSettings[],
  frequencyHz: number,
  baseLoadMw: number,
): readonly UnderfrequencyUflsStageResult[] {
  if (!Number.isFinite(baseLoadMw) || baseLoadMw <= 0) {
    return stages.map((s) => ({
      stageId: s.id,
      thresholdHz: s.thresholdHz,
      shedMw: 0,
      operated: false,
    }));
  }
  const results: UnderfrequencyUflsStageResult[] = [];
  // A stage operates if frequency ended up at/below its threshold (strict below).
  for (const stage of stages) {
    if (!stage.enabled) {
      results.push({ stageId: stage.id, thresholdHz: stage.thresholdHz, shedMw: 0, operated: false });
      continue;
    }
    const shedMw = (stage.shedFractionPct / 100) * baseLoadMw;
    const operated = frequencyHz < stage.thresholdHz && !nearlyEqual(frequencyHz, stage.thresholdHz);
    results.push({ stageId: stage.id, thresholdHz: stage.thresholdHz, shedMw, operated });
  }
  return results;
}

// ─────────────────────────────── Validation ────────────────────────────────
// U01 § 12.7 / § 9.5. Returns issues; non-throwing.

export function validateUnderfrequencySystem(
  system: UnderfrequencySystemData,
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  if (!isFinitePositive(system.fNominalHz)) {
    issues.push(issue('NON_POSITIVE_F_NOM', 'system.fNominalHz', 'Frekuensi nominal harus finite dan > 0.'));
  }
  if (!Number.isFinite(system.voltageKv) || system.voltageKv <= 0) {
    issues.push(issue('NUMERICAL_RANGE', 'system.voltageKv', 'Tegangan harus finite dan > 0.'));
  }
  if (!Number.isFinite(system.baseLoadMw) || system.baseLoadMw <= 0) {
    issues.push(issue('NUMERICAL_RANGE', 'system.baseLoadMw', 'Base load harus finite dan > 0.'));
  }
  return issues;
}

export function validateUnderfrequencyGenerators(
  generators: readonly UnderfrequencyGeneratorData[],
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  if (generators.length === 0) {
    issues.push(issue('INVALID_TOPOLOGY', 'generators', 'Setidaknya satu generator diperlukan.'));
    return issues;
  }
  for (const g of generators) {
    if (!isFinitePositive(g.mva)) {
      issues.push(issue('NON_POSITIVE_MVA', `generators.${g.id}.mva`, 'Rating MVA harus finite dan > 0.'));
    }
    if (!isFinitePositive(g.inertiaSec)) {
      issues.push(issue('NON_POSITIVE_INERTIA', `generators.${g.id}.inertiaSec`, 'Konstanta inertia harus finite dan > 0.'));
    }
    if (!isFinitePositive(g.droopPu)) {
      issues.push(issue('NON_POSITIVE_DROOP', `generators.${g.id}.droopPu`, 'Droop harus finite dan > 0.'));
    }
    if (!Number.isInteger(g.poles) || g.poles <= 0) {
      issues.push(issue('INVALID_POLES', `generators.${g.id}.poles`, 'Jumlah pole harus bilangan bulat positif.'));
    }
    if (g.governorMaxMw < g.initialMw) {
      issues.push(issue('NON_POSITIVE_HEADROOM', `generators.${g.id}.governorMaxMw`, 'Output maksimum governor harus >= initial output (headroom non-negatif).'));
    }
    if (g.initialMw > g.mwRated) {
      issues.push(issue('NUMERICAL_RANGE', `generators.${g.id}.initialMw`, 'Initial output tidak boleh melebihi rated MW.'));
    }
  }
  return issues;
}

export function validateUnderfrequencyUflsStages(
  stages: readonly UflsStageSettings[],
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  // Stage ordering must be strictly descending threshold (applied with tolerance).
  // The sweep is non-breaking so every violation is reported (a single reported
  // issue misleads the parameter panel's per-field highlighting); a later stage
  // must not mask an earlier stage's offence.
  for (let i = 1; i < stages.length; i += 1) {
    const prev = stages[i - 1];
    const curr = stages[i];
    if (curr.thresholdHz >= prev.thresholdHz && !nearlyEqual(curr.thresholdHz, prev.thresholdHz)) {
      issues.push(issue('INVALID_UFLS_ORDER', `uflsStages.${curr.id}.thresholdHz`, 'UFLS stages harus diurutkan berdasarkan threshold yang menurun secara strict.'));
    }
  }
  for (const s of stages) {
    if (!isFinitePositive(s.thresholdHz)) {
      issues.push(issue('NUMERICAL_RANGE', `uflsStages.${s.id}.thresholdHz`, 'Threshold harus finite dan > 0.'));
    }
    if (!Number.isFinite(s.timeDelaySec) || s.timeDelaySec < 0) {
      issues.push(issue('NUMERICAL_RANGE', `uflsStages.${s.id}.timeDelaySec`, 'Delay harus finite dan >= 0.'));
    }
    // Shed fraction bounds apply to ALL stages, including stages[0] — the
    // previous loop started at i=1 so stage 0 was never checked. (UFR-FIX-06)
    if (s.shedFractionPct < 0 || s.shedFractionPct > 100) {
      issues.push(issue('NON_POSITIVE_SHED_FRACTION', `uflsStages.${s.id}.shedFractionPct`, 'Shed fraction harus berada dalam [0, 100].'));
    }
  }
  return issues;
}

// ──────────────────────────── Static evaluator ──────────────────────────────
// U01 § 11. Evaluates the resolved online set & deficit against UFLS to
// produce the closed-form reference static result.

export interface UnderfrequencyStaticContext {
  readonly system: UnderfrequencySystemData;
  readonly generators: readonly UnderfrequencyGeneratorData[];
  readonly uflsStages: readonly UflsStageSettings[];
}

export function evaluateUnderfrequencySystem(
  context: UnderfrequencyStaticContext,
): DomainEvaluation<UnderfrequencyStaticResult> {
  const { system, generators, uflsStages } = context;
  const allIssues = [
    ...validateUnderfrequencySystem(system),
    ...validateUnderfrequencyGenerators(generators),
    ...validateUnderfrequencyUflsStages(uflsStages),
  ];
  if (allIssues.length > 0) {
    return invalid(allIssues);
  }

  const sBaseMva = aggregateBaseMva(generators);
  const hSysSec = aggregateInertia(generators, sBaseMva);
  const fNominalHz = system.fNominalHz;
  const initialDeficitMw = computeInitialDeficit(generators, system.baseLoadMw);
  const initialRocofHzPerSec = computeRocof(initialDeficitMw, hSysSec, sBaseMva, fNominalHz);

  // Static reference: the final state after all UFLS that would operate have
  // shed. Since the static evaluator does not animate timers, we resolve the
  // residual deficit by monotone fixed-point (shedding lowers deficit → raises
  // frequency → may de-operate a stage), then solve the residual steady state.
  // This is the closed-form target the timeline must converge to (U01 § 13.1).
  const resolved = resolveStaticWithUfls(system, generators, uflsStages);
  const solved = solveSteadyStateDeficit(resolved);

  // UFLS results come from the resolved shed set (which may shed a stage that
  // the final frequency is above — UFLS operates en-route, then frequency
  // recovers). Report each stage with its final operated/latched state.
  const operatedSet = new Set(resolved.operatedStageIds);
  const uflsStageResults = uflsStages.map((s) => ({
    stageId: s.id,
    thresholdHz: s.thresholdHz,
    shedMw: (s.shedFractionPct / 100) * system.baseLoadMw,
    operated: operatedSet.has(s.id),
  }));
  const totalShedMw = resolved.totalShedMw;

  const generatorStatus = Object.fromEntries(
    generators.map((g) => [g.id, g.status]),
  ) as Record<string, UnderfrequencyGeneratorData['status']>;

  const result: UnderfrequencyStaticResult = {
    sBaseMva,
    hSysSec,
    betaPu: solved.betaPu,
    betaMwPerHz: solved.betaPu / fNominalHz,
    initialRocofHzPerSec,
    initialDeficitMw,
    steadyStateHz: solved.steadyStateHz,
    steadyStateStatus: solveStatusToSteadyStateStatus(solved.solveStatus),
    solveStatus: solved.solveStatus,
    governorResults: solved.governorResults,
    uflsStageResults,
    totalShedMw,
    generatorStatus,
    displayStatus:
      totalShedMw > 0 ||
      (resolved.finalFrequencyHz !== null && resolved.finalFrequencyHz < fNominalHz)
        ? 'OPERATE'
        : 'RESTRAIN',
    issues: [],
  };
  return { status: 'VALID', value: result };
}

// ─────────────────────── Internal static resolution ────────────────────────
// U01 § 9.5 — the closed-form UFLS resolution used only as a parity reference.
// It sheds all stages that operate (strict below threshold) then solves the
// residual deficit. This is the target the timeline must converge to.

function resolveStaticWithUfls(
  system: UnderfrequencySystemData,
  generators: readonly UnderfrequencyGeneratorData[],
  uflsStages: readonly UflsStageSettings[],
): ResolvedDeficit {
  const fNominalHz = system.fNominalHz;
  const baseLoadMw = system.baseLoadMw;
  const initialDeficit = computeInitialDeficit(generators, baseLoadMw);

  // Greedy-latch UFLS resolution (U01 § 9). The closed-form reference must
  // reproduce the *timeline's* latched final state — UFLS trips latch and never
  // un-operate even if frequency later recovers above a threshold. The falling
  // frequency encounters stages in strictly descending threshold order, so we
  // shed the highest-threshold not-yet-shed stage, latch it, and stop once the
  // settled frequency sits at/above the next un-shed stage's pickup (strict
  // below-threshold, via `nearlyEqual`). This is exactly the set the timeline
  // latches, so the closed form is a true bit-exact parity target (§ 13.1).
  const enabled = uflsStages.filter((s) => s.enabled);
  const shedSet = new Set<string>();
  let deficit = initialDeficit;
  for (let guard = 0; guard <= enabled.length; guard += 1) {
    const candidate = solveSteadyStateDeficit({
      generators,
      fNominalHz,
      deficitMw: deficit,
      uflsStages,
      baseLoadMw,
    });
    // The next stage the falling frequency would encounter: the highest
    // threshold not yet shed.
    const next = enabled
      .filter((s) => !shedSet.has(s.id))
      .sort((a, b) => b.thresholdHz - a.thresholdHz)[0];
    const shedMore =
      next === undefined
        ? false
        : candidate.steadyStateHz === null // collapse → below the whole ladder
          ? true
          : candidate.steadyStateHz < next.thresholdHz &&
            !nearlyEqual(candidate.steadyStateHz, next.thresholdHz);
    if (!shedMore) break;
    shedSet.add(next.id);
    deficit -= (next.shedFractionPct / 100) * baseLoadMw;
  }

  const finalCandidate = solveSteadyStateDeficit({
    generators,
    fNominalHz,
    deficitMw: deficit,
    uflsStages,
    baseLoadMw,
  });
  const totalShedMw = [...shedSet].reduce((sum, id) => {
    const stage = uflsStages.find((s) => s.id === id);
    return sum + (stage ? (stage.shedFractionPct / 100) * baseLoadMw : 0);
  }, 0);
  return {
    generators,
    fNominalHz,
    deficitMw: deficit,
    uflsStages,
    baseLoadMw,
    finalFrequencyHz: finalCandidate.steadyStateHz,
    operatedStageIds: [...shedSet],
    totalShedMw,
  };
}

// ─────────────────────────────── Helpers ───────────────────────────────────
// U01 § 5.3 / § 6.2.

/** Net pre-governor deficit: load − online generation. */
export function computeInitialDeficit(
  generators: readonly UnderfrequencyGeneratorData[],
  baseLoadMw: number,
): number {
  const onlineMw = generators
    .filter((g) => g.status !== 'TRIPPED')
    .reduce((sum, g) => sum + g.initialMw, 0);
  return baseLoadMw - onlineMw;
}

/** ROCOF at t=0: `-(f_nom/(2H_sys))·(D₀/S_base)`. */
export function computeRocof(
  deficitMw: number,
  hSysSec: number,
  sBaseMva: number,
  fNominalHz: number,
): number {
  if (!isFinitePositive(hSysSec) || !isFinitePositive(sBaseMva) || !isFinitePositive(fNominalHz)) {
    return Number.NaN;
  }
  return (-fNominalHz / (2 * hSysSec)) * (deficitMw / sBaseMva);
}

/** Per-generator droop share of a total response at a given df. */
export function inertiaSharePct(
  generator: UnderfrequencyGeneratorData,
  sBaseMva: number,
): number {
  if (!isFinitePositive(sBaseMva)) return 0;
  return (generator.mva / sBaseMva) * 100;
}
