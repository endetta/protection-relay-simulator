/**
 * Underfrequency analysis presentation model (UFR).
 *
 * Pure model that turns the static closed-form result + the timeline run into
 * the headline status, per-phase checks, and a narrative calculation-detail
 * list. It reads physics values that the engine already computed
 * (ROCOF, deficit, β, settle frequency, UFLS stage results) and arranges them
 * for consumption by the UI; it never re-implements a governor/droop/swing
 * equation here. The phase narrative (calculationDetails) is a human-readable
 * walk-through of what the engine solved, driven by the same numbers.
 */

import type {
  DomainIssue,
  UnderfrequencySimulatorState,
  UnderfrequencyStaticResult,
  UnderfrequencyTimelineEvent,
  UnderfrequencyTimelineRun,
} from '../types/underfrequency';

export type UnderfrequencyTone = 'normal' | 'info' | 'warning' | 'danger' | 'success';

export interface UnderfrequencyHeadline {
  readonly label: string;
  readonly detail: string;
  readonly tone: UnderfrequencyTone;
}

export interface UnderfrequencyCheckRow {
  readonly id: string;
  readonly label: string;
  readonly status: 'PASS' | 'FAIL' | 'NOT_EVALUABLE';
  readonly detail: string;
}

export interface UnderfrequencyPhase {
  readonly id: string;
  readonly label: string;
  readonly timeSec: number;
  readonly tone: UnderfrequencyTone;
  readonly narrative: string;
}

export interface UnderfrequencySummaryTile {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly tone: UnderfrequencyTone;
}

export interface UnderfrequencyAnalysisModel {
  readonly status: 'VALID' | 'INVALID';
  readonly headline: UnderfrequencyHeadline;
  readonly studyLabel: string;
  readonly studyDescription: string;
  readonly summaryTiles: readonly UnderfrequencySummaryTile[];
  readonly checks: readonly UnderfrequencyCheckRow[];
  readonly phases: readonly UnderfrequencyPhase[];
  readonly calculationDetails: readonly string[];
  readonly events: readonly UnderfrequencyTimelineEvent[];
  readonly minFrequencyHz: number | null;
  readonly finalFrequencyHz: number | null;
  readonly steadyStateStatus: 'SETTLED' | 'COLLAPSE' | null;
  readonly displayStatus: 'OPERATE' | 'RESTRAIN' | 'INVALID';
  readonly plnVerificationRequired: boolean;
  readonly sourceNote: string | null;
  readonly issues: readonly DomainIssue[];
}

function numberText(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const precision = Math.max(1, Math.min(21, Math.floor(digits)));
  return Number(value.toPrecision(precision)).toString();
}

function toneForDisplay(display: UnderfrequencyStaticResult['displayStatus']): UnderfrequencyTone {
  switch (display) {
    case 'OPERATE': return 'danger';
    case 'RESTRAIN': return 'success';
    default: return 'warning';
  }
}

function steadyStateTone(status: 'SETTLED' | 'COLLAPSE'): UnderfrequencyTone {
  return status === 'COLLAPSE' ? 'danger' : 'success';
}

/**
 * Build the analysis model. `snapshot` is the timeline snapshot currently
 * displayed (scrubbed) or the final one when null.
 */
export function buildUnderfrequencyAnalysisModel(
  state: UnderfrequencySimulatorState,
  staticResult: UnderfrequencyStaticResult,
  run: UnderfrequencyTimelineRun | null,
): UnderfrequencyAnalysisModel {
  const collapse = run ? run.steadyStateStatus === 'COLLAPSE' : staticResult.steadyStateStatus === 'COLLAPSE';
  const finalFrequency = run ? run.finalFrequencyHz : staticResult.steadyStateHz;

  // The static reference has no disturbance-step mechanism (balanced input →
  // zero deficit), so shed amounts must be read from the run when one exists.
  // The run's UFLS_TRIP events are the authoritative engine output; fall back
  // to the static result only when no run is present.
  const runTrips = run && run.status === 'VALID'
    ? run.events.filter((e) => e.type === 'UFLS_TRIP')
    : [];
  const runShedMw = runTrips.reduce((sum, e) => sum + (e.shedMw ?? 0), 0);
  const runOperatedStages = new Set(runTrips.map((e) => e.stageId).filter((id): id is string => id !== undefined));
  const totalShedMw = runShedMw > 0 || runOperatedStages.size > 0
    ? runShedMw
    : staticResult.totalShedMw;
  const operatedStages = run && run.status === 'VALID' && runOperatedStages.size > 0
    ? runOperatedStages.size
    : staticResult.uflsStageResults.filter((r) => r.operated).length;
  // Initial deficit/ROCOF report the first post-disturbance snapshot when a run
  // exists, since the static reference is balanced (no disturbance-step input).
  // The timeline begins at a balanced pre-disturbance snapshot, so walk forward
  // to the first snapshot that has actually departed from nominal frequency.
  const fNominal = state.study.system.fNominalHz;
  const postDisturbanceSnapshot = run && run.status === 'VALID'
    ? run.snapshots.find((s) => s.frequencyHz < fNominal)
    : undefined;
  const initialDeficitMw = postDisturbanceSnapshot
    ? postDisturbanceSnapshot.deficitMw
    : staticResult.initialDeficitMw;
  const initialRocofHzPerSec = postDisturbanceSnapshot
    ? postDisturbanceSnapshot.rocofHzPerSec
    : staticResult.initialRocofHzPerSec;

  let headline: UnderfrequencyHeadline;
  if (collapse) {
    headline = {
      label: 'COLLAPSE',
      detail: `Frequency unrecoverable at ${numberText(run?.finalTimeSec)} s; all governor headroom exhausted.`,
      tone: 'danger',
    };
  } else if (totalShedMw > 0) {
    headline = {
      label: `UFLS ${operatedStages} STAGE${operatedStages === 1 ? '' : 'S'} OPERATED`,
      detail: `${numberText(totalShedMw, 1)} MW shed; frequency arrested to ${numberText(finalFrequency)} Hz.`,
      tone: 'danger',
    };
  } else {
    headline = {
      label: 'RESTRAIN',
      detail: `No UFLS operated; frequency at ${numberText(finalFrequency)} Hz.`,
      tone: 'success',
    };
  }

  const checks: UnderfrequencyCheckRow[] = [
    {
      id: 'INERTIA',
      label: 'Inertia (H_sys)',
      status: staticResult.hSysSec > 0 ? 'PASS' : 'FAIL',
      detail: `H_sys = ${numberText(staticResult.hSysSec)} s over S_base = ${numberText(staticResult.sBaseMva, 0)} MVA.`,
    },
    {
      id: 'DROOP_STIFFNESS',
      label: 'Governor stiffness (β)',
      status: staticResult.betaPu > 0 ? 'PASS' : 'FAIL',
      detail: `β = ${numberText(staticResult.betaPu, 0)} pu → ${numberText(staticResult.betaMwPerHz)} MW/Hz.`,
    },
    {
      id: 'ROCOF',
      label: 'Initial ROCOF',
      status: Number.isFinite(initialRocofHzPerSec) ? 'PASS' : 'FAIL',
      detail: `df/dt|₀ = ${numberText(initialRocofHzPerSec)} Hz/s for D₀ = ${numberText(initialDeficitMw, 0)} MW.`,
    },
    {
      id: 'UFLS_ADEQUACY',
      label: 'UFLS adequacy',
      status: collapse ? 'FAIL' : operatedStages > 0 ? 'PASS' : 'NOT_EVALUABLE',
      detail: collapse
        ? 'Shedding could not arrest the deficit.'
        : operatedStages > 0
          ? `${operatedStages} stage(s) shed ${numberText(totalShedMw, 1)} MW.`
          : 'No stage needed; governor/droop covers the deficit.',
    },
  ];

  const summaryTiles: UnderfrequencySummaryTile[] = [
    {
      id: 'f-NOW',
      label: 'f NOW',
      value: finalFrequency === null ? '—' : `${finalFrequency.toFixed(2)} Hz`,
      tone: toneForDisplay(staticResult.displayStatus),
    },
    {
      id: 'ROCOF',
      label: 'ROCOF',
      value: `${numberText(initialRocofHzPerSec)} Hz/s`,
      tone: Number.isFinite(initialRocofHzPerSec) && initialRocofHzPerSec < -0.5 ? 'warning' : 'info',
    },
    {
      id: 'DEFICIT',
      label: 'DEFISIT',
      value: `${numberText(initialDeficitMw, 0)} MW`,
      tone: initialDeficitMw > 0 ? 'warning' : 'normal',
    },
    {
      id: 'MIN-F',
      label: 'MIN f',
      value: run && run.snapshots.length > 0
        ? `${Math.min(...run.snapshots.map((s) => s.frequencyHz)).toFixed(2)} Hz`
        : '—',
      tone: 'normal',
    },
  ];

  const calculationDetails: string[] = [
    `S_base = Σ MVA_i = ${numberText(staticResult.sBaseMva, 0)} MVA.`,
    `H_sys = Σ (H_i·MVA_i)/S_base = ${numberText(staticResult.hSysSec, 4)} s.`,
    `D₀ (initial deficit) = ${numberText(initialDeficitMw, 0)} MW.`,
    `ROCOF₀ = −(f_nom/(2·H_sys))·(D₀/S_base) = ${numberText(initialRocofHzPerSec, 4)} Hz/s.`,
    `β_pu (unsaturated stiffness) = ${numberText(staticResult.betaPu, 0)} pu → ${numberText(staticResult.betaMwPerHz, 1)} MW/Hz.`,
  ];
  if (finalFrequency !== null) {
    const dFsHz = finalFrequency - state.study.system.fNominalHz;
    calculationDetails.push(`Δf_ss = −f_nom·D/β_pu = ${numberText(dFsHz, 4)} Hz (settle ${numberText(finalFrequency, 4)} Hz).`);
  }
  if (totalShedMw > 0) {
    calculationDetails.push(`Total UFLS shed = ${numberText(totalShedMw, 1)} MW across ${operatedStages} stage(s).`);
  }
  if (collapse) {
    calculationDetails.push('Governor slope exhausted (β_pu → 0); no equilibrium exists — COLLAPSE.');
  }

  // Phase narrative from the timeline events (if available).
  const phases = buildPhases(run, collapse, totalShedMw);

  return {
    status: 'VALID',
    headline,
    studyLabel: state.study.label,
    studyDescription: state.study.description,
    summaryTiles,
    checks,
    phases,
    calculationDetails,
    events: run?.events ?? [],
    minFrequencyHz: run && run.snapshots.length > 0 ? Math.min(...run.snapshots.map((s) => s.frequencyHz)) : null,
    finalFrequencyHz: finalFrequency,
    steadyStateStatus: run ? run.steadyStateStatus : staticResult.steadyStateStatus,
    displayStatus: staticResult.displayStatus,
    plnVerificationRequired: state.study.notes?.plnVerificationRequired ?? false,
    sourceNote: state.study.notes?.sourceNote ?? null,
    issues: staticResult.issues,
  };
}

function buildPhases(
  run: UnderfrequencyTimelineRun | null,
  collapsing: boolean,
  totalShedMw: number,
): UnderfrequencyPhase[] {
  if (!run) return [];
  const phases: UnderfrequencyPhase[] = [];
  const recovery =
    run.finalFrequencyHz !== null &&
    run.snapshots.length > 1 &&
    run.snapshots[run.snapshots.length - 1].frequencyHz >= run.snapshots[0].frequencyHz;

  // Pre-disturbance: the first snapshot is balanced, f = f_nom.
  if (run.snapshots.length > 0) {
    const first = run.snapshots[0];
    phases.push({
      id: 'PHASE_PRE',
      label: 'Persiapkan',
      timeSec: first.engineeringTimeSec,
      tone: 'success',
      narrative: `Balanced island at ${first.frequencyHz.toFixed(2)} Hz; ${first.deficitMw.toFixed(0)} MW deficit.`,
    });
  }

  // Decay phase: the trough (min-frequency snapshot).
  const trough = run.snapshots.reduce((worst, s) => (s.frequencyHz < worst.frequencyHz ? s : worst), run.snapshots[0]);
  if (run.snapshots.length > 1) {
    phases.push({
      id: 'PHASE_DECAY',
      label: 'Defisit & Inersia',
      timeSec: trough.engineeringTimeSec,
      tone: collapsing ? 'danger' : 'warning',
      narrative: `Frequency falls to ${trough.frequencyHz.toFixed(2)} Hz (df/dt ≈ ${trough.rocofHzPerSec.toFixed(2)} Hz/s).`,
    });
  }

  if (totalShedMw > 0) {
    phases.push({
      id: 'PHASE_UFLS',
      label: 'UFLS',
      timeSec: trough.engineeringTimeSec,
      tone: 'danger',
      narrative: `UFLS latched, shedding ${numberText(totalShedMw, 1)} MW of load to arrest the decay.`,
    });
  }

  if (collapsing) {
    phases.push({
      id: 'PHASE_COLLAPSE',
      label: 'Kolaps',
      timeSec: run.finalTimeSec,
      tone: 'danger',
      narrative: 'Frequency runs away; governor + UFLS cannot arrest the deficit.',
    });
  } else if (recovery) {
    phases.push({
      id: 'PHASE_RECOVERY',
      label: 'Recovery',
      timeSec: run.finalTimeSec,
      tone: 'success',
      narrative: `Frequency recovers to ${run.finalFrequencyHz?.toFixed(2)} Hz steady state.`,
    });
  } else {
    phases.push({
      id: 'PHASE_SETTLE',
      label: 'Settle',
      timeSec: run.finalTimeSec,
      tone: steadyStateTone(run.steadyStateStatus),
      narrative: `Frequency settles at ${run.finalFrequencyHz?.toFixed(2) ?? '—'} Hz.`,
    });
  }

  return phases;
}
