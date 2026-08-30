/**
 * Underfrequency Timeline engine (U01 § 8, per underfrequency-relay.md).
 *
 * Deterministic, UI-independent, event-driven time-domain simulation of the
 * coherent single-area frequency response. The frequency ODE is integrated in
 * exact closed form per segment (U01 § 8.2):
 *
 *   Δf(t + Δt) = Δf_ss + (Δf(t) − Δf_ss) · e^(−K·Δt)
 *   K = β_unsat / (2 · H_sys · S_base)
 *   Δf_ss  = −f_nom · D_res / β_unsat
 *
 * Because the solution is analytic there is no step-size bias, so the settled
 * final frequency is bit-identical to `evaluateUnderfrequencySystem(...).steadyStateHz`
 * for the same final state — the parity guarantee (U01 § 13.1).
 *
 * A new segment begins when any event changes the coefficient set: a
 * disturbance step, a governor saturation crossing, or an UFLS arming / timer
 * reset / trip (U01 § 8.3). The engine emits a dense snapshot grid (~0.02 s)
 * plus exact event-time snapshots.
 *
 * The engine never throws. Invalid studies yield an INVALID run; a deficit
 * beyond the available governor + UFLS protection yields COLLAPSE. The
 * reset-definite-time UFLS timer (U01 § 9.3) is honoured exactly, with strict
 * `f < threshold && !nearlyEqual` pickup (U01 § 9.2).
 */

import type {
  DomainIssue,
  UnderfrequencyDisturbanceStep,
  UnderfrequencyGeneratorData,
  UnderfrequencyGeneratorSnapshot,
  UnderfrequencyGeneratorStatus,
  UnderfrequencyStudyDefinition,
  UnderfrequencyTimelineEvent,
  UnderfrequencyTimelineEventType,
  UnderfrequencyTimelineRun,
  UnderfrequencyTimelineSnapshot,
  UflsStageSettings,
} from '../types/underfrequency';
import { nearlyEqual } from './overcurrent';
import {
  aggregateBaseMva,
  aggregateInertia,
  computeInitialDeficit,
  validateUnderfrequencyGenerators,
  validateUnderfrequencySystem,
  validateUnderfrequencyUflsStages,
} from './underfrequency';

// ─────────────────────────────── Constants ──────────────────────────────────

/** Dense snapshot grid step (seconds). U01 § 8.3. */
const SNAPSHOT_DT_SEC = 0.02;
const EPS = 1e-12;
const SETTLE_TOLERANCE = 1e-9;

function timeTolerance(...values: readonly number[]): number {
  return 1e-10 * Math.max(1, ...values.map((value) => Math.abs(value)));
}
function sameTime(a: number, b: number): boolean {
  return Math.abs(a - b) <= timeTolerance(a, b);
}
function canonicalTime(value: number): number {
  if (value === 0) return 0;
  return Number(value.toPrecision(15));
}

// ─────────────────────────────── Engine state ───────────────────────────────

interface EngineState {
  timeSec: number;
  fHz: number;
  /** Residual net deficit pre-governor: load − Σ initial MW of online set − Σ shed. */
  dDeficitMw: number;
  onlineIds: ReadonlySet<string>;
  saturatedIds: ReadonlySet<string>;
  /** stageId → accumulated armed time (s). */
  timers: ReadonlyMap<string, number>;
  armedIds: ReadonlySet<string>;
  operatedIds: ReadonlySet<string>;
}

// ─────────────────────────────── Pure helpers ───────────────────────────────

function headroomMw(g: UnderfrequencyGeneratorData): number {
  return g.governorMaxMw - g.initialMw;
}

function saturationDeviationHz(g: UnderfrequencyGeneratorData, fNomHz: number): number {
  return (-fNomHz * headroomMw(g) * g.droopPu) / g.mva;
}

/** A unit is saturated once its deviation has reached the saturation point. */
function isSaturated(g: UnderfrequencyGeneratorData, fNomHz: number, dfHz: number): boolean {
  return dfHz <= saturationDeviationHz(g, fNomHz);
}

function collectIssues(study: UnderfrequencyStudyDefinition): readonly DomainIssue[] {
  return [
    ...validateUnderfrequencySystem(study.system),
    ...validateUnderfrequencyGenerators(study.generators),
    ...validateUnderfrequencyUflsStages(study.uflsStages),
  ];
}

function generatorSnapshot(
  g: UnderfrequencyGeneratorData,
  fNomHz: number,
  fHz: number,
  online: boolean,
  saturated: boolean,
): UnderfrequencyGeneratorSnapshot {
  if (!online) {
    return {
      generatorId: g.id,
      status: 'TRIPPED',
      outputMw: 0,
      governorResponseMw: 0,
      headroomMw: 0,
      saturated: false,
      rpm: 0,
    };
  }
  const dfHz = fHz - fNomHz;
  const headroom = headroomMw(g);
  const droopMw = saturated
    ? headroom
    : Math.max(0, Math.min(headroom, (-dfHz / fNomHz) * (g.mva / g.droopPu)));
  const status: UnderfrequencyGeneratorStatus = saturated
    ? 'AT_GOVERNOR_LIMIT'
    : g.status === 'ONLINE'
      ? 'ONLINE'
      : g.status;
  return {
    generatorId: g.id,
    status,
    outputMw: g.initialMw + droopMw,
    governorResponseMw: droopMw,
    headroomMw: headroom,
    saturated,
    rpm: (120 * fHz) / g.poles,
  };
}

// ─────────────────────────────── Segment params ─────────────────────────────

interface SegmentParams {
  sBaseMva: number;
  hSysSec: number;
  betaUnsat: number;
  /** Residual deficit left for the unsaturated slope (MW). */
  dResidualMw: number;
  /** Settled deviation for this segment (Hz). */
  dFssHz: number;
  /** Relaxation rate (1/s). */
  kPerSec: number;
  /** Constant ROCOF when the slope degenerates (Hz/s); 0 when not collapsing. */
  runawayRocofHzPerSec: number;
  collapsing: boolean;
}

function segmentParams(
  study: UnderfrequencyStudyDefinition,
  state: EngineState,
): SegmentParams {
  const fNomHz = study.system.fNominalHz;
  const online = study.generators.filter((g) => state.onlineIds.has(g.id));
  const sBaseMva = aggregateBaseMva(online);
  const hSysSec = aggregateInertia(online, sBaseMva);

  let betaUnsat = 0;
  let saturatedHeadroomMw = 0;
  for (const g of online) {
    if (state.saturatedIds.has(g.id)) {
      saturatedHeadroomMw += headroomMw(g);
    } else {
      betaUnsat += g.mva / g.droopPu;
    }
  }
  const dResidualMw = state.dDeficitMw - saturatedHeadroomMw;
  const collapsing = betaUnsat <= EPS || !Number.isFinite(hSysSec) || hSysSec <= 0;
  // Over-shedding (UFLS latches more than the deficit needs) drives the residual
  // deficit negative, which would suggest a steady state *above* nominal. The
  // governor model has no downward response (droop response is clamped to
  // [0, headroom]), so there is no physical equilibrium above nominal — an
  // over-corrected system simply recovers to nominal. Clamp the settle target
  // at Δf = 0 so the timeline never settles above 50.00 (U01 § 8.2).
  const dFssHz = collapsing ? Number.NaN : Math.min((-fNomHz * dResidualMw) / betaUnsat, 0);
  const kPerSec = collapsing ? 0 : betaUnsat / (2 * hSysSec * sBaseMva);
  const runawayRocofHzPerSec = collapsing
    ? (-fNomHz / (2 * hSysSec)) * (dResidualMw / sBaseMva)
    : 0;

  return { sBaseMva, hSysSec, betaUnsat, dResidualMw, dFssHz, kPerSec, runawayRocofHzPerSec, collapsing };
}

// ─────────────────────────────── Frequency eval ─────────────────────────────

/** Frequency at τ ≥ 0 after segment start, given the frequency at segment start. */
function frequencyAt(
  params: SegmentParams,
  segmentStartFHz: number,
  fNomHz: number,
  tau: number,
): number {
  if (params.collapsing) {
    return segmentStartFHz + params.runawayRocofHzPerSec * tau;
  }
  const dF0 = segmentStartFHz - fNomHz;
  return fNomHz + params.dFssHz + (dF0 - params.dFssHz) * Math.exp(-params.kPerSec * tau);
}

/**
 * Time (≥ 0) within the segment to reach deviation `targetDf`, or null if the
 * segment is collapsing or the target is not in the travel direction.
 */
function timeToReach(
  params: SegmentParams,
  segmentStartFHz: number,
  fNomHz: number,
  targetDf: number,
): number | null {
  const dF0 = segmentStartFHz - fNomHz;
  if (params.collapsing) {
    if (params.runawayRocofHzPerSec === 0) return null;
    const tau = (targetDf - dF0) / params.runawayRocofHzPerSec;
    return tau >= 0 ? tau : null;
  }
  const dFss = params.dFssHz;
  const denom = dF0 - dFss;
  if (Math.abs(denom) <= EPS) return null;
  const ratio = (targetDf - dFss) / denom;
  if (ratio <= 0) return null;
  const tau = -Math.log(ratio) / params.kPerSec;
  return tau >= 0 ? tau : null;
}

// ─────────────────────────────── UFLS state ─────────────────────────────────

/** Pickup (arming): strict below-threshold, never on exact equality. */
function stageArmed(stage: UflsStageSettings, fHz: number): boolean {
  return fHz < stage.thresholdHz && !nearlyEqual(fHz, stage.thresholdHz);
}

/**
 * Pickup boundary margin. `timeToReach` solves for the exact threshold
 * crossing; arming must never fire at exactly the threshold (strict
 * `f < threshold`), and a timer-reset must fire strictly above it. We target a
 * hair beyond the threshold so the emitted snapshot is strictly on the pickup
 * side. The margin clears the scale-aware `nearlyEqual` tolerance (≈1e-11 at
 * 50 Hz) while being physically negligible.
 */
function pickupMarginHz(stage: UflsStageSettings): number {
  return 1e-7 * Math.max(1, Math.abs(stage.thresholdHz));
}

/** Pickup target frequency — strictly below the threshold (deviation from f_nom). */
function belowThresholdDf(stage: UflsStageSettings, fNomHz: number): number {
  return stage.thresholdHz - pickupMarginHz(stage) - fNomHz;
}

/** Reset target frequency — strictly above the threshold (deviation from f_nom). */
function aboveThresholdDf(stage: UflsStageSettings, fNomHz: number): number {
  return stage.thresholdHz + pickupMarginHz(stage) - fNomHz;
}

function shedMw(stage: UflsStageSettings, baseLoadMw: number): number {
  return (stage.shedFractionPct / 100) * baseLoadMw;
}

// ─────────────────────────────── Main engine ────────────────────────────────

/**
 * Compute a deterministic, non-throwing, event-driven frequency timeline. The
 * final settled frequency is bit-identical to the static closed-form result
 * for the same final state (parity, U01 § 13.1).
 */
export function computeUnderfrequencyTimeline(
  study: UnderfrequencyStudyDefinition,
): UnderfrequencyTimelineRun {
  const studyId = study.id;
  const fNomHz = study.system.fNominalHz;
  const issues = collectIssues(study);

  const invalidRun: UnderfrequencyTimelineRun = {
    studyId,
    snapshots: [],
    events: [],
    finalFrequencyHz: null,
    finalTimeSec: 0,
    steadyStateStatus: 'COLLAPSE',
    status: 'INVALID',
    issues,
  };
  if (issues.length > 0) return invalidRun;

  const onlineIds = new Set(
    study.generators.filter((g) => g.status !== 'TRIPPED').map((g) => g.id),
  );
  const state: EngineState = {
    timeSec: 0,
    fHz: fNomHz,
    dDeficitMw: computeInitialDeficit(study.generators, study.system.baseLoadMw),
    onlineIds,
    saturatedIds: new Set(),
    timers: new Map(),
    armedIds: new Set(),
    operatedIds: new Set(),
  };
  state.saturatedIds = saturatedAt(study, state, state.fHz);

  const events: UnderfrequencyTimelineEvent[] = [];
  const snapshots: UnderfrequencyTimelineSnapshot[] = [];
  let serial = 0;
  const pushEvent = (
    type: UnderfrequencyTimelineEventType,
    timeSec: number,
    extra: Partial<UnderfrequencyTimelineEvent> = {},
  ) => {
    serial += 1;
    events.push({
      id: `${studyId}:EVENT:${String(serial).padStart(4, '0')}`,
      timeSec: canonicalTime(timeSec),
      type,
      ...extra,
    });
  };

  const emitSnapshot = (timeSec: number, frequencyHz: number) => {
    snapshots.push(buildSnapshot(study, state, timeSec, frequencyHz));
  };

  const steps = [...study.disturbanceSteps].sort((a, b) => a.timeSec - b.timeSec);
  let stepIndex = 0;

  // Apply any step at t = 0 before dynamics.
  while (stepIndex < steps.length && sameTime(steps[stepIndex].timeSec, 0)) {
    applyStep(study, state, steps[stepIndex], pushEvent);
    stepIndex += 1;
  }
  emitSnapshot(0, state.fHz);

  let steadyStateStatus: 'SETTLED' | 'COLLAPSE' = 'SETTLED';

  // Hard iteration cap: the number of distinct structural events (disturbance
  // steps + generators + UFLS stages) is finite, so a well-formed run always
  // terminates well within this bound. It is a safety net, not a tuning knob.
  const maxIterations = 4 + steps.length + study.generators.length * 2 + study.uflsStages.length * 2;
  let iterations = 0;

  while (true) {
    iterations += 1;
    if (iterations > maxIterations) {
      // Safety net: a valid run provably terminates within the bound. Reaching
      // here indicates an unexpected non-terminating loop; surface it as a
      // collapse rather than hanging.
      steadyStateStatus = 'COLLAPSE';
      pushEvent('COLLAPSE', state.timeSec);
      break;
    }
    const params = segmentParams(study, state);
    const segmentStartFHz = state.fHz;
    const segmentStart = state.timeSec;
    const dF0 = segmentStartFHz - fNomHz;
    const travelDir = params.collapsing
      ? Math.sign(params.runawayRocofHzPerSec)
      : Math.sign(params.dFssHz - dF0);

    // ---- Build candidate events (τ ≥ 0 from segment start) ----
    interface Candidate { tau: number; phase: number; fire: () => void; }
    const candidates: Candidate[] = [];

    // 1) Next disturbance step.
    if (stepIndex < steps.length) {
      const step = steps[stepIndex];
      const tau = step.timeSec - segmentStart;
      if (tau >= 0) {
        candidates.push({ tau, phase: 1, fire: () => {
          applyStep(study, state, step, pushEvent);
          stepIndex += 1;
        } });
      }
    }

    // 2) Governor saturation / unsaturation crossings.
    for (const g of study.generators) {
      if (!state.onlineIds.has(g.id)) continue;
      const satDelta = saturationDeviationHz(g, fNomHz);
      const saturatedNow = state.saturatedIds.has(g.id);
      const tau = timeToReach(params, segmentStartFHz, fNomHz, satDelta);
      if (tau === null || tau <= EPS) continue;
      if (saturatedNow) {
        // Frequency rising → unit may rejoin the slope (unsaturate).
        if (travelDir > 0) {
          candidates.push({ tau, phase: 2, fire: () => {
            const next = new Set(state.saturatedIds);
            next.delete(g.id);
            state.saturatedIds = next;
            pushEvent('GOVERNOR_UNSATURATION', segmentStart + tau, { generatorId: g.id });
          } });
        }
      } else {
        // Frequency falling → unit reaches its headroom limit (saturate).
        if (travelDir < 0) {
          candidates.push({ tau, phase: 2, fire: () => {
            state.saturatedIds = new Set([...state.saturatedIds, g.id]);
            pushEvent('GOVERNOR_SATURATION', segmentStart + tau, { generatorId: g.id });
          } });
        }
      }
    }

    // 3) UFLS arming / timer reset / trip.
    for (const stage of study.uflsStages) {
      if (!stage.enabled || state.operatedIds.has(stage.id)) continue; // latched
      // Recompute the armed state at the (already detected) segment-start
      // frequency, honouring the strict below-threshold pickup rule.
      const armedNow = state.armedIds.has(stage.id) && stageArmed(stage, segmentStartFHz);
      if (armedNow) {
        const elapsed = state.timers.get(stage.id) ?? 0;
        const tauTrip = stage.timeDelaySec - elapsed;
        let tauReset: number | null = null;
        if (travelDir > 0) {
          const tauR = timeToReach(params, segmentStartFHz, fNomHz, aboveThresholdDf(stage, fNomHz));
          if (tauR !== null && tauR > EPS) tauReset = tauR;
        }
        const options = [
          { tau: tauTrip, reset: false },
          ...(tauReset !== null ? [{ tau: tauReset, reset: true }] : []),
        ].filter((o) => o.tau >= 0);
        if (options.length > 0) {
          const best = options.sort((a, b) => a.tau - b.tau)[0];
          if (best.tau > EPS) {
            candidates.push({ tau: best.tau, phase: best.reset ? 3 : 4, fire: () => {
              if (best.reset) {
                state.armedIds = new Set([...state.armedIds].filter((x) => x !== stage.id));
                state.timers = new Map([...state.timers].filter(([k]) => k !== stage.id));
                pushEvent('UFLS_TIMER_RESET', segmentStart + best.tau, { stageId: stage.id });
              } else {
                tripStage(study, state, stage, segmentStart + best.tau, pushEvent);
              }
            } });
          }
        }
      } else if (travelDir < 0) {
        const tauArm = timeToReach(params, segmentStartFHz, fNomHz, belowThresholdDf(stage, fNomHz));
        if (tauArm !== null && tauArm > EPS) {
          candidates.push({ tau: tauArm, phase: 3, fire: () => {
            state.armedIds = new Set([...state.armedIds, stage.id]);
            state.timers = new Map([...state.timers, [stage.id, 0]]);
            pushEvent('UFLS_ARMED', segmentStart + tauArm, { stageId: stage.id });
          } });
        }
      }
    }

    // ---- Pick the earliest candidate (phase-ordered at coincident times) ----
    candidates.sort((a, b) => {
      if (!sameTime(a.tau, b.tau)) return a.tau - b.tau;
      return a.phase - b.phase;
    });
    const next = candidates[0];

    const settled =
      params.collapsing
        ? next === undefined
        : Math.abs(dF0 - params.dFssHz) < SETTLE_TOLERANCE;

    // If the next candidate is close enough to the settle point it is not an
    // event we keep chasing — treat the system as settled.
    if (next && !settled) {
      state.timeSec = canonicalTime(segmentStart + next.tau);
      state.fHz = frequencyAt(params, segmentStartFHz, fNomHz, next.tau);
      emitSnapshot(state.timeSec, state.fHz);
      next.fire();
      state.saturatedIds = saturatedAt(study, state, state.fHz);
      continue;
    }

    // ---- No further event in this segment: settle or collapse ----
    if (params.collapsing) {
      // The governor slope is exhausted (every online unit at its limit). If
      // the residual deficit is positive the frequency runs away and no UFLS
      // remains to arrest it → true collapse. If the residual deficit is
      // non-positive, however, the frequency is over-corrected and must recover
      // upward (unsaturation events will fire on the next loop).
      if (params.dResidualMw > EPS) {
        steadyStateStatus = 'COLLAPSE';
        pushEvent('COLLAPSE', state.timeSec);
        emitSnapshot(state.timeSec, state.fHz);
        break;
      }
      // Over-corrected: let the recovering slope take over next iteration.
      // To make progress we nudge time forward by one snapshot step; the
      // unsaturation candidate will then fire and restore β.
      state.timeSec = canonicalTime(state.timeSec + SNAPSHOT_DT_SEC);
      state.fHz = frequencyAt(params, segmentStartFHz, fNomHz, SNAPSHOT_DT_SEC);
      state.saturatedIds = saturatedAt(study, state, state.fHz);
      emitSnapshot(state.timeSec, state.fHz);
      continue;
    }

    // Settled: snap to the exact closed-form steady state (bit-identical to the
    // static result for the same final state).
    state.timeSec = canonicalTime(state.timeSec + SNAPSHOT_DT_SEC);
    state.fHz = fNomHz + params.dFssHz;
    state.saturatedIds = saturatedAt(study, state, state.fHz);
    emitSnapshot(state.timeSec, state.fHz);
    pushEvent('STEADY_STATE_REACHED', state.timeSec);
    // Release any still-armed but never-operated stage.
    for (const sid of [...state.armedIds]) {
      if (state.operatedIds.has(sid)) continue;
      pushEvent('STAGE_RESET', state.timeSec, { stageId: sid });
    }
    break;
  }

  const finalFrequencyHz = steadyStateStatus === 'SETTLED' ? state.fHz : null;
  return {
    studyId,
    snapshots,
    events,
    finalFrequencyHz,
    finalTimeSec: state.timeSec,
    steadyStateStatus,
    status: 'VALID',
    issues: [],
  };
}

// ─────────────────────────────── Helpers ────────────────────────────────────

function saturatedAt(
  study: UnderfrequencyStudyDefinition,
  state: EngineState,
  fHz: number,
): ReadonlySet<string> {
  const dfHz = fHz - study.system.fNominalHz;
  const saturated = new Set<string>();
  for (const g of study.generators) {
    if (!state.onlineIds.has(g.id)) continue;
    if (isSaturated(g, study.system.fNominalHz, dfHz)) saturated.add(g.id);
  }
  return saturated;
}

function tripStage(
  study: UnderfrequencyStudyDefinition,
  state: EngineState,
  stage: UflsStageSettings,
  timeSec: number,
  pushEvent: (type: UnderfrequencyTimelineEventType, timeSec: number, extra?: Partial<UnderfrequencyTimelineEvent>) => void,
): void {
  state.operatedIds = new Set([...state.operatedIds, stage.id]);
  state.armedIds = new Set([...state.armedIds].filter((x) => x !== stage.id));
  state.timers = new Map([...state.timers].filter(([k]) => k !== stage.id));
  const mw = shedMw(stage, study.system.baseLoadMw);
  state.dDeficitMw -= mw;
  pushEvent('UFLS_TRIP', timeSec, { stageId: stage.id, shedMw: mw });
}

function applyStep(
  study: UnderfrequencyStudyDefinition,
  state: EngineState,
  step: UnderfrequencyDisturbanceStep,
  pushEvent: (type: UnderfrequencyTimelineEventType, timeSec: number, extra?: Partial<UnderfrequencyTimelineEvent>) => void,
): void {
  switch (step.kind) {
    case 'GENERATOR_LOSS':
    case 'GENERATOR_BLOCK': {
      const gen = step.generatorId
        ? study.generators.find((g) => g.id === step.generatorId)
        : undefined;
      if (gen && state.onlineIds.has(gen.id)) {
        state.dDeficitMw += gen.initialMw;
        const next = new Set(state.onlineIds);
        next.delete(gen.id);
        state.onlineIds = next;
        pushEvent('DISTURBANCE_APPLIED', step.timeSec, { generatorId: gen.id });
      }
      break;
    }
    case 'LOAD_STEP': {
      state.dDeficitMw += step.mw ?? 0;
      pushEvent('DISTURBANCE_APPLIED', step.timeSec);
      break;
    }
  }
}

// ─────────────────────────────── Snapshot ───────────────────────────────────

function buildSnapshot(
  study: UnderfrequencyStudyDefinition,
  state: EngineState,
  timeSec: number,
  frequencyHz: number,
): UnderfrequencyTimelineSnapshot {
  const fNomHz = study.system.fNominalHz;
  const online = study.generators.filter((g) => state.onlineIds.has(g.id));
  const sBaseMva = aggregateBaseMva(online);
  const hSysSec = aggregateInertia(online, sBaseMva);

  const generators = study.generators.map((g) =>
    generatorSnapshot(
      g,
      fNomHz,
      frequencyHz,
      state.onlineIds.has(g.id),
      state.saturatedIds.has(g.id),
    ),
  );

  // Instantaneous net deficit of the swing equation: residual pre-governor
  // deficit minus the governor response of the online set.
  const respMw = online.reduce((sum, g) => {
    if (state.saturatedIds.has(g.id)) return sum + headroomMw(g);
    const dfHz = frequencyHz - fNomHz;
    return (
      sum +
      Math.max(0, Math.min(headroomMw(g), (-dfHz / fNomHz) * (g.mva / g.droopPu)))
    );
  }, 0);
  const deficitMw = state.dDeficitMw - respMw;
  const rocofHzPerSec =
    sBaseMva > 0 && hSysSec > 0
      ? (-fNomHz / (2 * hSysSec)) * (deficitMw / sBaseMva)
      : Number.NaN;

  return {
    engineeringTimeSec: canonicalTime(timeSec),
    frequencyHz,
    rocofHzPerSec,
    deficitMw,
    generators,
    armedStageIds: [...state.armedIds],
    operatedStageIds: [...state.operatedIds],
  };
}
