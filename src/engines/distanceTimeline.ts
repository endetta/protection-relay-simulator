/**
 * Distance Relay timeline engine (D07).
 *
 * Deterministic, UI-independent, event-driven timeline. Mirrors the O07
 * Overcurrent Timeline Engine in structure but is significantly simpler:
 *   - Zone 1: instantaneous trip (t = 0)
 *   - Zone 2/3: fixed delay (t = timeDelaySec)
 *   - Breaker clearing: applied after trip
 *   - No inverse-time integration (distance zones use fixed delays)
 *   - No current-profile interpolation (fault current is a fixed study input)
 *
 * The timeline engine is consumed by the playback system and the
 * operating-sequence presentation layer.
 */

import type {
  DistanceDisplayStatus,
  DistanceOperatingResult,
  DistanceStudyDefinition,
  DistanceZoneId,
} from '../types/distance';
import { evaluateDistanceDevice, type EvaluateDistanceInput } from './distanceMeasurement';

// ──────────────────────────── Types ────────────────────────────────────────

export interface DistanceTimelineEvent {
  readonly timeSec: number;
  readonly kind: 'ZONE1_PICKUP' | 'ZONE2_PICKUP' | 'ZONE3_PICKUP' | 'TRIP' | 'BREAKER_CLEAR' | 'EXTERNAL_CLEAR' | 'RESET';
  readonly zoneId?: DistanceZoneId;
  readonly message: string;
}

export interface DistanceTimelineSnapshot {
  /** Engineering time of this snapshot. */
  readonly timeSec: number;
  /** The display status at this instant. */
  readonly displayStatus: DistanceDisplayStatus;
  /** Whether the breaker is open. */
  readonly breakerOpen: boolean;
  /** Active trip zone at this instant (null if no trip). */
  readonly tripZone: DistanceZoneId | null;
  /** Per-zone status at this instant. */
  readonly zones: readonly {
    readonly zoneId: DistanceZoneId;
    readonly inZone: boolean;
    readonly timerElapsed: boolean;
  }[];
  /** Apparent impedance at this instant. */
  readonly rOhmSecondary: number;
  readonly xOhmSecondary: number;
  /** Whether the apparent impedance is in the load region. */
  readonly loadRegion: boolean;
  /** Cumulative events up to this snapshot. */
  readonly events: readonly DistanceTimelineEvent[];
}

export interface DistanceTimelineRun {
  readonly study: DistanceStudyDefinition;
  readonly breakerClearingSec: number;
  readonly events: readonly DistanceTimelineEvent[];
  readonly snapshots: readonly DistanceTimelineSnapshot[];
  /** Final trip zone (null if no trip occurred). */
  readonly finalTripZone: DistanceZoneId | null;
  /** Final display status. */
  readonly finalDisplayStatus: DistanceDisplayStatus;
  /** Total engineering duration of the timeline. */
  readonly durationSec: number;
}

// ──────────────────────── Timeline engine ──────────────────────────────────

/**
 * Compute a deterministic timeline for a distance relay study evaluation.
 * This is a single-fault, fixed-current timeline: the fault location and
 * current are constant throughout the evaluation. The timeline produces:
 *
 *   t = 0:           evaluation + zone pickup events
 *   t = zone_delay:  trip event (first operated zone)
 *   t = trip + breaker: breaker clear event
 *
 * No external clear is supported in v1 (out of scope per D01 § 3.2).
 */
export function computeDistanceTimeline(study: DistanceStudyDefinition): DistanceTimelineRun {
  const evaluateInput: EvaluateDistanceInput = {
    vLLKvPrimary: study.system.vLLKvPrimary,
    faultCurrentA: study.faultCurrentA,
    faultType: study.faultType,
    k0: study.k0,
    rArcOhmPrimary: study.settings.rArcOhmPrimary,
    z1AngleDeg: study.line.z1AngleDeg,
    settings: study.settings,
    faultPct: study.faultPct,
  };

  const result = evaluateDistanceDevice(evaluateInput);
  const events: DistanceTimelineEvent[] = [];
  const breakerClearingSec = study.settings.breaker.clearingTimeSec;

  // Zone pickup events at t = 0.
  for (const zone of result.zones) {
    if (zone.inZone) {
      const zoneNum = zone.zoneId;
      const kind = zoneNum === 'Z1' ? 'ZONE1_PICKUP' : zoneNum === 'Z2' ? 'ZONE2_PICKUP' : 'ZONE3_PICKUP';
      events.push({
        timeSec: 0,
        kind,
        zoneId: zone.zoneId,
        message: `${zoneNum} pickup — apparent impedance inside zone`,
      });
    }
  }

  // Trip event.
  let tripTimeSec = 0;
  if (result.tripZone) {
    const tripZone = result.zones.find((z) => z.zoneId === result.tripZone);
    tripTimeSec = tripZone?.timeToTripSec ?? 0;
    events.push({
      timeSec: tripTimeSec,
      kind: 'TRIP',
      zoneId: result.tripZone,
      message: `${result.tripZone} trip at ${tripTimeSec.toFixed(3)} s`,
    });
  }

  // Breaker clear event.
  let clearTimeSec = tripTimeSec;
  if (result.tripZone) {
    clearTimeSec = tripTimeSec + breakerClearingSec;
    events.push({
      timeSec: clearTimeSec,
      kind: 'BREAKER_CLEAR',
      message: `Breaker open at ${clearTimeSec.toFixed(3)} s`,
    });
  }

  // Build snapshots: one at t=0, one at trip (if timed), one at breaker clear.
  const snapshots: DistanceTimelineSnapshot[] = [];
  const makeSnapshot = (timeSec: number, tripActive: boolean, breakerOpen: boolean): DistanceTimelineSnapshot => ({
    timeSec,
    displayStatus: tripActive && result.tripZone ? 'OPERATE' : result.loadRegion ? 'RESTRAIN' : result.displayStatus,
    breakerOpen,
    tripZone: tripActive ? result.tripZone : null,
    zones: result.zones.map((z) => ({
      zoneId: z.zoneId,
      inZone: z.inZone,
      timerElapsed: z.timeToTripSec !== null && timeSec >= z.timeToTripSec,
    })),
    rOhmSecondary: result.impedance.rOhmSecondary,
    xOhmSecondary: result.impedance.xOhmSecondary,
    loadRegion: result.loadRegion,
    events: [],
  });

  snapshots.push(makeSnapshot(0, false, false));
  if (result.tripZone && tripTimeSec > 0) {
    snapshots.push(makeSnapshot(tripTimeSec, true, false));
  }
  if (result.tripZone) {
    snapshots.push(makeSnapshot(clearTimeSec, true, true));
  }

  const durationSec = result.tripZone ? clearTimeSec : 0;

  return {
    study,
    breakerClearingSec,
    events,
    snapshots,
    finalTripZone: result.tripZone,
    finalDisplayStatus: result.displayStatus,
    durationSec,
  };
}

/**
 * Evaluate the distance device at a specific engineering time.
 * For v1 this is identical to `evaluateDistanceDevice` because the
 * fault current is constant; this wrapper exists so the D07 contract
 * matches the O07 `snapshotAt` pattern for future extensibility.
 */
export function snapshotAt(
  study: DistanceStudyDefinition,
  _timeSec: number,
): DistanceOperatingResult {
  return evaluateDistanceDevice({
    vLLKvPrimary: study.system.vLLKvPrimary,
    faultCurrentA: study.faultCurrentA,
    faultType: study.faultType,
    k0: study.k0,
    rArcOhmPrimary: study.settings.rArcOhmPrimary,
    z1AngleDeg: study.line.z1AngleDeg,
    settings: study.settings,
    faultPct: study.faultPct,
  });
}
