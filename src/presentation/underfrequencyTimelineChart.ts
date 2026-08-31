/**
 * Underfrequency f(t) timeline chart presentation model (UFR).
 *
 * Pure model that transforms `UnderfrequencyTimelineRun` snapshot/event data
 * into a chart-friendly coordinate + layer model. It clips/swaps coordinate
 * axes and produces tick marks; it never re-implements a relay or governor
 * equation. Every physics value (frequency, ROCOF, deficit) comes from the
 * engine output — this file only decides the layout.
 *
 * The dominant visual is the frequency-vs-time curve (U01 § 14); UFLS
 * thresholds are horizontal stage lines and UFLS trips are vertical markers.
 */

import type {
  UflsStageId,
  UflsStageSettings,
  UnderfrequencyTimelineRun,
  UnderfrequencyTimelineSnapshot,
  UnderfrequencyTimelineEvent,
} from '../types/underfrequency';

// ─────────────────────────────── Model types ────────────────────────────────

export interface UnderfrequencyChartAxis {
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly unit: string;
  readonly ticks: readonly number[];
}

export interface UnderfrequencyChartPoint {
  readonly x: number;
  readonly y: number;
}

export interface UnderfrequencyStageLine {
  readonly stageId: string;
  readonly label: string;
  readonly thresholdHz: number;
  readonly enabled: boolean;
  readonly operated: boolean;
}

export interface UnderfrequencyTripMarker {
  readonly stageId: string;
  readonly label: string;
  readonly timeSec: number;
  readonly shedMw: number;
}

export interface UnderfrequencyPhaseZone {
  readonly id: string;
  readonly label: string;
  readonly kind: 'PRE_DISTURBANCE' | 'DECAY' | 'ARrest' | 'COLLAPSE';
}

export interface UnderfrequencyTimelineChartModel {
  readonly status: 'VALID' | 'INVALID';
  readonly xAxis: UnderfrequencyChartAxis;
  readonly yAxis: UnderfrequencyChartAxis;
  readonly nominalFrequencyHz: number;
  readonly curve: readonly UnderfrequencyChartPoint[];
  readonly stageLines: readonly UnderfrequencyStageLine[];
  readonly tripMarkers: readonly UnderfrequencyTripMarker[];
  readonly armedEvents: readonly UnderfrequencyTimelineEvent[];
  readonly collapseEvent: UnderfrequencyTimelineEvent | null;
  readonly steadyStateEvent: UnderfrequencyTimelineEvent | null;
  readonly minFrequencyHz: number | null;
  readonly finalFrequencyHz: number | null;
  readonly finalTimeSec: number;
}

// ─────────────────────────────── Axis helpers ───────────────────────────────

function niceStep(range: number, targetTicks = 5): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
}

function linearTicks(min: number, max: number, targetTicks = 5): readonly number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const step = niceStep(max - min, targetTicks);
  const ticks: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let value = first; value <= max + step * 1e-9; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

function paddedBounds(min: number, max: number, padFraction = 0.08): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  const span = max - min;
  if (span <= 0) return { min: min - 0.5, max: max + 0.5 };
  return { min: min - span * padFraction, max: max + span * padFraction };
}

// A genuine frequency curve lives a few Hz around nominal; anything beyond this
// band is a collapse/runaway. The y-domain is clamped to the band so an absurd
// footprint (e.g. a 1e6 MW load step) cannot balloon the axis to gigabytes and
// crush the curve into a spike — the off-scale portion is simply not shown.
// Engineered presets (troughs ~45–48 Hz) stay fully inside the band.
const FREQ_BAND_BELOW_NOMINAL_HZ = 15;
const FREQ_BAND_ABOVE_NOMINAL_HZ = 5;

/**
 * Clamp the frequency domain to a readable physics band around nominal. Returns
 * the raw min/max when they already fit, otherwise the band edges. Non-finite
 * inputs collapse to the band (they only come from a runaway, never from a
 * well-formed preset).
 */
function clampedFrequencyDomain(
  min: number,
  max: number,
  fNominalHz: number,
): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: fNominalHz - FREQ_BAND_BELOW_NOMINAL_HZ, max: fNominalHz + FREQ_BAND_ABOVE_NOMINAL_HZ };
  }
  return {
    min: Math.max(min, fNominalHz - FREQ_BAND_BELOW_NOMINAL_HZ),
    max: Math.min(max, fNominalHz + FREQ_BAND_ABOVE_NOMINAL_HZ),
  };
}

function eventOfType(run: UnderfrequencyTimelineRun, types: string[]): UnderfrequencyTimelineEvent | null {
  return run.events.find((e) => types.includes(e.type)) ?? null;
}

// ─────────────────────────────── Builder ────────────────────────────────────

/**
 * Build the f(t) chart model from an engine timeline run. The final frequency
 * and the last snapshot's deficit/ROCOF come straight from the engine.
 */
export function buildUnderfrequencyTimelineChartModel(
  run: UnderfrequencyTimelineRun,
  uflsStages: readonly UflsStageSettings[],
  fNominalHz = 50,
): UnderfrequencyTimelineChartModel {
  if (run.status === 'INVALID') {
    return {
      status: 'INVALID',
      xAxis: { min: 0, max: 1, label: 'Time', unit: 's', ticks: [] },
      yAxis: { min: 0, max: 1, label: 'Frequency', unit: 'Hz', ticks: [] },
      nominalFrequencyHz: 0,
      curve: [],
      stageLines: [],
      tripMarkers: [],
      armedEvents: [],
      collapseEvent: null,
      steadyStateEvent: null,
      minFrequencyHz: null,
      finalFrequencyHz: null,
      finalTimeSec: 0,
    };
  }

  const snapshots = run.snapshots;
  const sampledPoints: UnderfrequencyChartPoint[] = snapshots.map((snap) => ({
    x: snap.engineeringTimeSec,
    y: snap.frequencyHz,
  }));

  // Nominal line drawn explicitly; ensure it sits inside the y-axis range.
  const nominalFrequencyHz = fNominalHz;
  const yValues: number[] = snapshots.map((snap) => snap.frequencyHz);
  // The y-domain is sized to the **curve's own data + nominal line**, not to
  // UFLS stage threshold frequencies. Stage lines are a separate visual
  // overlay (dashed amber) and are clipped to the plot rect at render time —
  // they must not stretch the axis. Otherwise a small-deficit preset whose
  // curve never approaches a stage (e.g. UFR-06: 50 → 49.86 Hz) ends up with
  // a 2+ Hz axis sized to the lowest stage at 48 Hz, and the curve occupies
  // a < 15% sliver that looks like a flat stub (Bug 5).
  const allY = [...yValues, nominalFrequencyHz];
  const yMinData = allY.length > 0 ? Math.min(...allY) : 45;
  const yMaxData = allY.length > 0 ? Math.max(...allY) : 51;
  // Clamp to the physics band first so a runaway/absurd footprint cannot crush
  // the curve, then pad the (possibly trimmed) band for breathing room.
  const yDomain = clampedFrequencyDomain(yMinData, yMaxData, nominalFrequencyHz);
  const yBounds = paddedBounds(yDomain.min, yDomain.max);

  const xMinData = snapshots.length > 0 ? snapshots[0].engineeringTimeSec : 0;
  const xMaxData = snapshots.length > 0 ? snapshots[snapshots.length - 1].engineeringTimeSec : 1;
  const xPadded = paddedBounds(xMinData, Math.max(xMaxData, xMinData + 1));
  // Engineering time is non-negative: clamp the left pad at t=0 so the curve
  // starts AT the left edge instead of floating behind a physically meaningless
  // negative-time gutter (Bug 3: "titik nol tidak di ujung kiri"). The right
  // pad is kept — it is breathing room for the STEADY/COLLAPSE labels.
  const xBounds = { min: Math.max(xPadded.min, 0), max: xPadded.max };

  const operatedFinal = snapshots.length > 0
    ? new Set(snapshots[snapshots.length - 1].operatedStageIds)
    : new Set<string>();

  const tripMarkers: UnderfrequencyTripMarker[] = snapshots.flatMap((snap) => {
    const tripEvents = run.events.filter(
      (e) => e.type === 'UFLS_TRIP' && e.timeSec === snap.engineeringTimeSec,
    );
    return tripEvents.map((e) => ({
      stageId: e.stageId ?? '',
      label: uflsStages.find((s) => s.id === e.stageId)?.label ?? (e.stageId ?? 'Trip'),
      timeSec: snap.engineeringTimeSec,
      shedMw: e.shedMw ?? 0,
    }));
  });

  return {
    status: 'VALID',
    xAxis: {
      min: xBounds.min,
      max: xBounds.max,
      label: 'Engineering Time',
      unit: 's',
      ticks: linearTicks(xBounds.min, xBounds.max),
    },
    yAxis: {
      min: yBounds.min,
      max: yBounds.max,
      label: 'System Frequency',
      unit: 'Hz',
      ticks: linearTicks(yBounds.min, yBounds.max),
    },
    nominalFrequencyHz,
    curve: sampledPoints,
    stageLines: uflsStages.map((stage) => ({
      stageId: stage.id,
      label: stage.label,
      thresholdHz: stage.thresholdHz,
      enabled: stage.enabled,
      operated: operatedFinal.has(stage.id),
    })),
    tripMarkers,
    armedEvents: run.events.filter((e) => e.type === 'UFLS_ARMED' || e.type === 'UFLS_TIMER_RESET'),
    collapseEvent: eventOfType(run, ['COLLAPSE']),
    steadyStateEvent: eventOfType(run, ['STEADY_STATE_REACHED']),
    minFrequencyHz: yValues.length > 0 ? Math.min(...yValues) : null,
    finalFrequencyHz: run.finalFrequencyHz,
    finalTimeSec: run.finalTimeSec,
  };
}

// ─────────────────────────────── Tooltip model ───────────────────────────────

export interface UnderfrequencyTimelineTooltip {
  readonly timeSec: number;
  readonly frequencyHz: number;
  readonly rocofHzPerSec: number;
  readonly deficitMw: number;
  /** Stage IDs armed at the hovered instant (threshold crossed, timer running). */
  readonly armedStageIds: readonly UflsStageId[];
  /** Stage IDs that have operated (tripped) up to and including the hovered instant. */
  readonly operatedStageIds: readonly UflsStageId[];
  /** Human-readable event summary for the exact instant, e.g. "UFLS trip · S1". */
  readonly eventLabels: readonly string[];
}

/**
 * Build the contextual tooltip payload for a cursor at `timeSec`. This is pure
 * presentation: it reads engine output (snapshot + events) and only shapes it
 * for the chart's hover — it never re-derives a relay or governor equation.
 *
 * Returns `null` when there is nothing meaningful to describe (invalid run or
 * an out-of-window time), so the component simply hides the tooltip.
 */
export function buildUnderfrequencyTimelineTooltip(
  run: UnderfrequencyTimelineRun,
  uflsStages: readonly UflsStageSettings[],
  timeSec: number | null | undefined,
): UnderfrequencyTimelineTooltip | null {
  if (run.status !== 'VALID' || run.snapshots.length === 0) return null;
  const snap = snapshotAtTime(run.snapshots, timeSec ?? run.snapshots[run.snapshots.length - 1].engineeringTimeSec);
  if (!snap) return null;

  // Stage labels come from the study so the tooltip speaks in preset terms
  // ("Stage 1 — 49.50" not an opaque "S1"), matching the stage line legend.
  const labelFor = (stageId: string) =>
    uflsStages.find((s) => s.id === stageId)?.label ?? stageId;

  const eventLabels: string[] = [];
  // The snapshot at an event instant is pre-event (the engine latches the stage
  // into operatedIds *after* emitting the snapshot for that tick), so fold the
  // event-derived stage status in — hovering a trip marker should report the
  // stage as just-operated, not mid-transition.
  const operated = new Set(snap.operatedStageIds);
  const armed = new Set(snap.armedStageIds);
  const eventsAtTime = run.events.filter((e) => e.timeSec === snap.engineeringTimeSec);
  for (const ev of eventsAtTime) {
    if (ev.stageId) {
      if (ev.type === 'UFLS_TRIP') operated.add(ev.stageId);
      if (ev.type === 'UFLS_ARMED') armed.add(ev.stageId);
    }
    const subject = ev.stageId ? labelFor(ev.stageId) : ev.generatorId ?? ev.detail ?? '';
    eventLabels.push(subject ? `${ev.type} · ${subject}` : ev.type);
  }

  return {
    timeSec: snap.engineeringTimeSec,
    frequencyHz: snap.frequencyHz,
    rocofHzPerSec: snap.rocofHzPerSec,
    deficitMw: snap.deficitMw,
    armedStageIds: [...armed],
    operatedStageIds: [...operated],
    eventLabels,
  };
}

/** Select the snapshot nearest to a scrub target (engineering seconds). */
export function snapshotAtTime(
  snapshots: readonly UnderfrequencyTimelineSnapshot[],
  timeSec: number | null | undefined,
): UnderfrequencyTimelineSnapshot | null {
  if (snapshots.length === 0) return null;
  if (timeSec === null || timeSec === undefined) return snapshots[snapshots.length - 1];
  let nearest = snapshots[0];
  let bestDistance = Math.abs(nearest.engineeringTimeSec - timeSec);
  for (const snap of snapshots) {
    const distance = Math.abs(snap.engineeringTimeSec - timeSec);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = snap;
    }
  }
  return nearest;
}
