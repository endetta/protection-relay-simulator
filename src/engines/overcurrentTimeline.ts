import { nearlyEqual } from './overcurrent';
import { validateOvercurrentStudyDefinition } from '../studies/overcurrentStudy';
import { evaluateOvercurrentDevice } from '../utils/evaluateOvercurrentDevice';
import type {
  CurrentProfile,
  DevicePrimaryCurrentMap,
  DomainEvaluation,
  DomainIssue,
  FaultCase,
  FaultCaseId,
  OvercurrentProtectionDevice,
  OvercurrentStudyDefinition,
  OvercurrentPlaybackState,
  PlaybackSpeed,
  ProtectionDeviceId,
  RelayTimelineSnapshot,
  TimelineEvent,
  TimelineSnapshot,
} from '../types/overcurrent';

/** Explicit O07 run inputs. Playback speed is presentation mapping only. */
export interface OvercurrentTimelineRunDefinition {
  readonly study: OvercurrentStudyDefinition;
  readonly faultCaseId: FaultCaseId;
  readonly playbackSpeed: PlaybackSpeed;
}

type RelayTraceEventType = '51_PICKUP' | '50_TRIP' | '51_TRIP' | '51_RESET';

interface RelayTraceEvent {
  readonly type: RelayTraceEventType;
  readonly timeSec: number;
  readonly deviceId: ProtectionDeviceId;
}

interface RelayTrip {
  readonly deviceId: ProtectionDeviceId;
  readonly element: '50' | '51';
  readonly timeSec: number;
  readonly progress51: number;
}

interface RelayTrace {
  readonly events: readonly RelayTraceEvent[];
  readonly trip: RelayTrip | null;
  readonly timing51: boolean;
  readonly progress51: number;
}

interface CurrentSeriesPoint {
  readonly timeSec: number;
  readonly currents: DevicePrimaryCurrentMap;
}

interface CurrentSeries {
  readonly profileId: string | null;
  readonly interpolation: 'STEP' | 'LINEAR';
  readonly points: readonly CurrentSeriesPoint[];
  readonly changeTimes: readonly number[];
}

interface TraceStop {
  readonly timeSec: number;
  /** BEFORE is used for external clear because the current change is phase 1. */
  readonly instantPolicy: 'BEFORE' | 'AFTER';
}

interface QueuedEvent {
  readonly event: TimelineEvent;
  readonly phase: number;
  readonly serial: number;
}

const TIME_EPS_FACTOR = 1e-10;
const PROGRESS_EPS = 1e-10;
const INTEGRATION_TOLERANCE = 1e-11;
const MAX_INTEGRATION_DEPTH = 18;

class TimelineComputationError extends Error {
  readonly issues: readonly DomainIssue[];

  constructor(issues: readonly DomainIssue[]) {
    super(issues.map((entry) => entry.detail ?? entry.code).join(' '));
    this.name = 'TimelineComputationError';
    this.issues = issues;
  }
}

function issue(code: DomainIssue['code'], path: string, detail: string): DomainIssue {
  return { code, path, detail };
}

function timeTolerance(...values: readonly number[]): number {
  return TIME_EPS_FACTOR * Math.max(1, ...values.map((value) => Math.abs(value)));
}

function sameTime(a: number, b: number): boolean {
  return Math.abs(a - b) <= timeTolerance(a, b);
}

function beforeTime(a: number, b: number): boolean {
  return a < b && !sameTime(a, b);
}

function atOrBeforeTime(a: number, b: number): boolean {
  return a < b || sameTime(a, b);
}

function canonicalTime(value: number): number {
  if (value === 0) return 0;
  return Number(value.toPrecision(15));
}

function clampProgress(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function finiteResult(value: number, path: string, detail: string): number {
  if (!Number.isFinite(value)) throw new TimelineComputationError([issue('NUMERICAL_RANGE', path, detail)]);
  return value;
}

function validatePlaybackSpeed(playbackSpeed: PlaybackSpeed): DomainIssue[] {
  return playbackSpeed === 1 || playbackSpeed === 5 || playbackSpeed === 10
    ? []
    : [issue('INVALID_TIMELINE_STATE', 'playbackSpeed', 'Playback speed must be 1, 5, or 10.')];
}

/** Converts presentation time without changing any engineering timestamp. */
export function engineeringDeltaToWallClockSec(
  engineeringDeltaSec: number,
  playbackSpeed: PlaybackSpeed,
): DomainEvaluation<number> {
  const issues = validatePlaybackSpeed(playbackSpeed);
  if (!Number.isFinite(engineeringDeltaSec)) {
    issues.push(issue('NON_FINITE_INPUT', 'engineeringDeltaSec', 'Engineering delta must be finite.'));
  } else if (engineeringDeltaSec < 0) {
    issues.push(issue('INVALID_TIMELINE_STATE', 'engineeringDeltaSec', 'Engineering delta must be >= 0 s.'));
  }
  if (issues.length > 0) return { status: 'INVALID', issues };
  return { status: 'VALID', value: engineeringDeltaSec / playbackSpeed };
}

function findFaultCase(study: OvercurrentStudyDefinition, faultCaseId: FaultCaseId): FaultCase | undefined {
  return study.faultCases.find((faultCase) => faultCase.id === faultCaseId);
}

function findProfile(study: OvercurrentStudyDefinition, profileId: string): CurrentProfile | undefined {
  return study.currentProfiles.find((profile) => profile.id === profileId);
}

function makeCurrentSeries(study: OvercurrentStudyDefinition, faultCase: FaultCase): CurrentSeries {
  if (faultCase.current.kind === 'STATIC') {
    return {
      profileId: null,
      interpolation: 'STEP',
      points: [{ timeSec: 0, currents: faultCase.current.primaryCurrentAByDevice }],
      changeTimes: [],
    };
  }

  const profile = findProfile(study, faultCase.current.profileId);
  if (!profile) {
    throw new TimelineComputationError([
      issue('MISSING_REFERENCE', `faultCases.${faultCase.id}.current.profileId`, `Unknown current profile ${faultCase.current.profileId}.`),
    ]);
  }
  const first = profile.samples[0];
  if (!first) {
    throw new TimelineComputationError([
      issue('INVALID_PROFILE', `currentProfiles.${profile.id}.samples`, 'Timeline current profile must contain at least one sample.'),
    ]);
  }

  const points: CurrentSeriesPoint[] = [];
  if (first.timeSec > 0) points.push({ timeSec: 0, currents: first.primaryCurrentAByDevice });
  for (const sample of profile.samples) {
    points.push({ timeSec: sample.timeSec, currents: sample.primaryCurrentAByDevice });
  }

  return {
    profileId: profile.id,
    interpolation: profile.interpolation,
    points,
    // The first sample defines the value before/at its timestamp; later samples
    // are the meaningful profile-transition boundaries.
    changeTimes: profile.samples.slice(1).map((sample) => sample.timeSec),
  };
}

function primaryCurrentAt(
  startTimeSec: number,
  endTimeSec: number,
  startCurrentA: number,
  endCurrentA: number,
  interpolation: 'STEP' | 'LINEAR',
  timeSec: number,
): number {
  if (interpolation === 'STEP' || sameTime(startTimeSec, endTimeSec)) return startCurrentA;
  const ratio = (timeSec - startTimeSec) / (endTimeSec - startTimeSec);
  return startCurrentA + (endCurrentA - startCurrentA) * ratio;
}

function evaluateAtCurrent(primaryCurrentA: number, device: OvercurrentProtectionDevice) {
  const evaluated = evaluateOvercurrentDevice(primaryCurrentA, device);
  if (evaluated.status === 'INVALID') {
    throw new TimelineComputationError(evaluated.issues.map((entry) => ({
      ...entry,
      path: `timeline.${device.id}.${entry.path ?? 'evaluation'}`,
    })));
  }
  return evaluated.value;
}

function simpsonEstimate(
  a: number,
  b: number,
  fa: number,
  fm: number,
  fb: number,
): number {
  return ((b - a) / 6) * (fa + 4 * fm + fb);
}

function adaptiveSimpson(
  fn: (timeSec: number) => number,
  a: number,
  b: number,
  tolerance: number,
): number {
  if (sameTime(a, b)) return 0;
  const middle = (a + b) / 2;
  const fa = finiteResult(fn(a), 'timeline.integration', '51 progress rate became non-finite.');
  const fm = finiteResult(fn(middle), 'timeline.integration', '51 progress rate became non-finite.');
  const fb = finiteResult(fn(b), 'timeline.integration', '51 progress rate became non-finite.');
  const whole = simpsonEstimate(a, b, fa, fm, fb);

  const recurse = (
    left: number,
    right: number,
    fLeft: number,
    fMiddle: number,
    fRight: number,
    estimate: number,
    remainingTolerance: number,
    depth: number,
  ): number => {
    const mid = (left + right) / 2;
    const leftMid = (left + mid) / 2;
    const rightMid = (mid + right) / 2;
    const fLeftMid = finiteResult(fn(leftMid), 'timeline.integration', '51 progress rate became non-finite.');
    const fRightMid = finiteResult(fn(rightMid), 'timeline.integration', '51 progress rate became non-finite.');
    const leftEstimate = simpsonEstimate(left, mid, fLeft, fLeftMid, fMiddle);
    const rightEstimate = simpsonEstimate(mid, right, fMiddle, fRightMid, fRight);
    const refined = leftEstimate + rightEstimate;

    if (depth <= 0 || Math.abs(refined - estimate) <= 15 * remainingTolerance) {
      return refined + (refined - estimate) / 15;
    }
    return recurse(left, mid, fLeft, fLeftMid, fMiddle, leftEstimate, remainingTolerance / 2, depth - 1)
      + recurse(mid, right, fMiddle, fRightMid, fRight, rightEstimate, remainingTolerance / 2, depth - 1);
  };

  return finiteResult(
    recurse(a, b, fa, fm, fb, whole, tolerance, MAX_INTEGRATION_DEPTH),
    'timeline.integration',
    'Accumulated 51 progress exceeded the supported numeric range.',
  );
}

function thresholdCrossing(
  startTimeSec: number,
  endTimeSec: number,
  startMeasuredA: number,
  endMeasuredA: number,
  thresholdA: number,
): number | null {
  const minimum = Math.min(startMeasuredA, endMeasuredA);
  const maximum = Math.max(startMeasuredA, endMeasuredA);
  if (thresholdA < minimum || thresholdA > maximum || nearlyEqual(startMeasuredA, endMeasuredA)) return null;
  const ratio = (thresholdA - startMeasuredA) / (endMeasuredA - startMeasuredA);
  if (ratio < 0 || ratio > 1) return null;
  return startTimeSec + (endTimeSec - startTimeSec) * ratio;
}

function uniqueSortedTimes(values: readonly number[]): number[] {
  const sorted = values.slice().sort((a, b) => a - b);
  const result: number[] = [];
  for (const value of sorted) {
    const previous = result[result.length - 1];
    if (previous === undefined || !sameTime(previous, value)) result.push(value);
  }
  return result;
}

function traceRelay(
  series: CurrentSeries,
  device: OvercurrentProtectionDevice,
  stop?: TraceStop,
): RelayTrace {
  const traceEvents: RelayTraceEvent[] = [];
  let trip: RelayTrip | null = null;
  let timing51 = false;
  let progress51 = 0;

  const pushEvent = (type: RelayTraceEventType, timeSec: number) => {
    traceEvents.push({ type, timeSec: canonicalTime(timeSec), deviceId: device.id });
  };

  const tripRelay = (element: '50' | '51', timeSec: number) => {
    const normalizedTime = canonicalTime(timeSec);
    const normalizedProgress = element === '51' ? 1 : clampProgress(progress51);
    trip = { deviceId: device.id, element, timeSec: normalizedTime, progress51: normalizedProgress };
    progress51 = normalizedProgress;
    timing51 = false;
    pushEvent(element === '50' ? '50_TRIP' : '51_TRIP', normalizedTime);
  };

  const handleEvaluationAtInstant = (
    timeSec: number,
    result: ReturnType<typeof evaluateAtCurrent>,
  ) => {
    if (trip) return;
    const picked51 = result.element51.status === 'PICKUP';
    if (picked51 && !timing51) {
      timing51 = true;
      progress51 = 0;
      pushEvent('51_PICKUP', timeSec);
    }

    // 50 is processed before 51 completion and before reset consequences.
    if (result.element50.status === 'PICKUP') {
      tripRelay('50', timeSec);
      return;
    }

    if (!picked51 && timing51) {
      timing51 = false;
      progress51 = 0;
      pushEvent('51_RESET', timeSec);
      return;
    }

    if (picked51 && progress51 >= 1 - PROGRESS_EPS) tripRelay('51', timeSec);
  };

  const progressIncrement = (
    intervalStart: number,
    intervalEnd: number,
    startTimeSec: number,
    endTimeSec: number,
    startCurrentA: number,
    endCurrentA: number,
    interpolation: 'STEP' | 'LINEAR',
  ): number => {
    if (device.settings.phase51.timingMode === 'DEFINITE') {
      return (intervalEnd - intervalStart) / device.settings.phase51.definiteDelaySec;
    }
    if (interpolation === 'STEP' || nearlyEqual(startCurrentA, endCurrentA)) {
      const result = evaluateAtCurrent(startCurrentA, device);
      const operateTimeSec = result.element51.operateTimeSec;
      return result.element51.status === 'PICKUP' && operateTimeSec !== null
        ? (intervalEnd - intervalStart) / operateTimeSec
        : 0;
    }
    const rateAt = (timeSec: number): number => {
      const primaryCurrentA = primaryCurrentAt(
        startTimeSec,
        endTimeSec,
        startCurrentA,
        endCurrentA,
        interpolation,
        timeSec,
      );
      const result = evaluateAtCurrent(primaryCurrentA, device);
      const operateTimeSec = result.element51.operateTimeSec;
      if (result.element51.status !== 'PICKUP' || operateTimeSec === null) return 0;
      return finiteResult(1 / operateTimeSec, 'timeline.integration', '51 progress rate exceeded the supported numeric range.');
    };
    return adaptiveSimpson(rateAt, intervalStart, intervalEnd, INTEGRATION_TOLERANCE);
  };

  const solveTripTime = (
    intervalStart: number,
    intervalEnd: number,
    requiredProgress: number,
    startTimeSec: number,
    endTimeSec: number,
    startCurrentA: number,
    endCurrentA: number,
    interpolation: 'STEP' | 'LINEAR',
  ): number => {
    if (device.settings.phase51.timingMode === 'DEFINITE') {
      return intervalStart + requiredProgress * device.settings.phase51.definiteDelaySec;
    }
    if (interpolation === 'STEP' || nearlyEqual(startCurrentA, endCurrentA)) {
      const result = evaluateAtCurrent(startCurrentA, device);
      const operateTimeSec = result.element51.operateTimeSec;
      if (result.element51.status !== 'PICKUP' || operateTimeSec === null) {
        throw new TimelineComputationError([
          issue('INVALID_TIMELINE_STATE', `timeline.${device.id}.element51`, 'Cannot solve a 51 trip outside pickup.'),
        ]);
      }
      return intervalStart + requiredProgress * operateTimeSec;
    }
    let lower = intervalStart;
    let upper = intervalEnd;
    for (let iteration = 0; iteration < 56; iteration += 1) {
      const middle = (lower + upper) / 2;
      const accumulated = progressIncrement(
        intervalStart,
        middle,
        startTimeSec,
        endTimeSec,
        startCurrentA,
        endCurrentA,
        interpolation,
      );
      if (accumulated >= requiredProgress) upper = middle;
      else lower = middle;
    }
    return (lower + upper) / 2;
  };

  const processInterval = (
    intervalStart: number,
    intervalEnd: number,
    startCurrentA: number,
    endCurrentA: number,
    interpolation: 'STEP' | 'LINEAR',
  ) => {
    if (trip || !beforeTime(intervalStart, intervalEnd)) return;
    const startResult = evaluateAtCurrent(startCurrentA, device);
    const endResult = evaluateAtCurrent(endCurrentA, device);
    const boundaries = [intervalStart, intervalEnd];

    if (interpolation === 'LINEAR') {
      if (device.settings.phase51.enabled) {
        const crossing51 = thresholdCrossing(
          intervalStart,
          intervalEnd,
          startResult.measurement.measuredSecondaryCurrentA,
          endResult.measurement.measuredSecondaryCurrentA,
          device.settings.phase51.pickupASecondary,
        );
        if (crossing51 !== null) boundaries.push(crossing51);
      }
      if (device.settings.phase50.enabled) {
        const crossing50 = thresholdCrossing(
          intervalStart,
          intervalEnd,
          startResult.measurement.measuredSecondaryCurrentA,
          endResult.measurement.measuredSecondaryCurrentA,
          device.settings.phase50.pickupASecondary,
        );
        if (crossing50 !== null) boundaries.push(crossing50);
      }
    }

    const orderedBoundaries = uniqueSortedTimes(boundaries);
    for (let index = 0; index < orderedBoundaries.length - 1 && !trip; index += 1) {
      const left = orderedBoundaries[index];
      const right = orderedBoundaries[index + 1];
      if (!beforeTime(left, right)) continue;
      const middle = (left + right) / 2;
      const middleCurrentA = primaryCurrentAt(
        intervalStart,
        intervalEnd,
        startCurrentA,
        endCurrentA,
        interpolation,
        middle,
      );
      const middleResult = evaluateAtCurrent(middleCurrentA, device);
      handleEvaluationAtInstant(left, middleResult);
      if (trip || !timing51 || middleResult.element51.status !== 'PICKUP') continue;

      const increment = progressIncrement(
        left,
        right,
        intervalStart,
        intervalEnd,
        startCurrentA,
        endCurrentA,
        interpolation,
      );
      const required = 1 - progress51;
      if (increment > required + PROGRESS_EPS) {
        const root = solveTripTime(
          left,
          right,
          required,
          intervalStart,
          intervalEnd,
          startCurrentA,
          endCurrentA,
          interpolation,
        );
        if (beforeTime(root, right)) {
          progress51 = 1;
          tripRelay('51', root);
          return;
        }
      }
      progress51 = clampProgress(progress51 + increment);
    }
  };

  const points = series.points;
  const firstPoint = points[0];
  if (!firstPoint) {
    throw new TimelineComputationError([issue('INVALID_PROFILE', 'timeline.currentSeries', 'Timeline current series is empty.')]);
  }
  const firstCurrent = firstPoint.currents[device.id];
  if (!Number.isFinite(firstCurrent) || firstCurrent < 0) {
    throw new TimelineComputationError([
      issue('NON_FINITE_INPUT', `timeline.currentSeries.${device.id}`, `Primary current for ${device.id} must be finite and >= 0 A.`),
    ]);
  }

  const stopAtZero = stop && sameTime(stop.timeSec, 0);
  if (!stopAtZero || stop?.instantPolicy === 'AFTER') {
    handleEvaluationAtInstant(0, evaluateAtCurrent(firstCurrent, device));
  }
  if (trip || stopAtZero) return { events: traceEvents, trip, timing51, progress51: clampProgress(progress51) };

  for (let index = 0; index < points.length - 1 && !trip; index += 1) {
    const leftPoint = points[index];
    const rightPoint = points[index + 1];
    const leftCurrent = leftPoint.currents[device.id];
    const rightCurrent = rightPoint.currents[device.id];
    if (!Number.isFinite(leftCurrent) || leftCurrent < 0 || !Number.isFinite(rightCurrent) || rightCurrent < 0) {
      throw new TimelineComputationError([
        issue('NON_FINITE_INPUT', `timeline.currentSeries.${device.id}`, `Primary current for ${device.id} must be finite and >= 0 A.`),
      ]);
    }

    const reachesStop = stop !== undefined && atOrBeforeTime(stop.timeSec, rightPoint.timeSec);
    const intervalEnd = reachesStop ? stop.timeSec : rightPoint.timeSec;
    const endCurrent = series.interpolation === 'STEP'
      ? leftCurrent
      : primaryCurrentAt(leftPoint.timeSec, rightPoint.timeSec, leftCurrent, rightCurrent, 'LINEAR', intervalEnd);
    processInterval(leftPoint.timeSec, intervalEnd, leftCurrent, endCurrent, series.interpolation);
    if (trip) break;

    if (reachesStop) {
      if (stop.instantPolicy === 'AFTER') {
        const instantCurrent = sameTime(stop.timeSec, rightPoint.timeSec) ? rightCurrent : endCurrent;
        handleEvaluationAtInstant(stop.timeSec, evaluateAtCurrent(instantCurrent, device));
      }
      return { events: traceEvents, trip, timing51, progress51: clampProgress(progress51) };
    }

    handleEvaluationAtInstant(rightPoint.timeSec, evaluateAtCurrent(rightCurrent, device));
  }

  if (trip) return { events: traceEvents, trip, timing51, progress51: clampProgress(progress51) };

  const lastPoint = points[points.length - 1];
  const lastCurrent = lastPoint.currents[device.id];
  if (!Number.isFinite(lastCurrent) || lastCurrent < 0) {
    throw new TimelineComputationError([
      issue('NON_FINITE_INPUT', `timeline.currentSeries.${device.id}`, `Primary current for ${device.id} must be finite and >= 0 A.`),
    ]);
  }

  if (stop) {
    if (beforeTime(lastPoint.timeSec, stop.timeSec)) {
      processInterval(lastPoint.timeSec, stop.timeSec, lastCurrent, lastCurrent, 'STEP');
      if (!trip && stop.instantPolicy === 'AFTER') {
        handleEvaluationAtInstant(stop.timeSec, evaluateAtCurrent(lastCurrent, device));
      }
    }
    return { events: traceEvents, trip, timing51, progress51: clampProgress(progress51) };
  }

  const finalResult = evaluateAtCurrent(lastCurrent, device);
  if (!trip && finalResult.element50.status === 'PICKUP') tripRelay('50', lastPoint.timeSec);
  if (!trip && timing51 && finalResult.element51.status === 'PICKUP') {
    const operateTimeSec = finalResult.element51.operateTimeSec;
    if (operateTimeSec === null) {
      throw new TimelineComputationError([
        issue('INVALID_TIMELINE_STATE', `timeline.${device.id}.element51`, 'Picked-up 51 element has no operating time.'),
      ]);
    }
    const remainingTimeSec = finiteResult(
      (1 - progress51) * operateTimeSec,
      `timeline.${device.id}.tripTimeSec`,
      `51 trip time for ${device.id} exceeded the supported numeric range.`,
    );
    const tripTimeSec = finiteResult(
      lastPoint.timeSec + remainingTimeSec,
      `timeline.${device.id}.tripTimeSec`,
      `51 trip time for ${device.id} exceeded the supported numeric range.`,
    );
    progress51 = 1;
    tripRelay('51', tripTimeSec);
  }

  return { events: traceEvents, trip, timing51, progress51: clampProgress(progress51) };
}

function eventPriority(type: TimelineEvent['type']): number {
  switch (type) {
    case 'FAULT_APPLIED':
    case 'CURRENT_PROFILE_CHANGED': return 1;
    case '51_PICKUP': return 2;
    case '50_TRIP': return 3;
    case '51_TRIP': return 4;
    case 'BREAKER_OPENING': return 5;
    case 'BREAKER_OPEN': return 6;
    case 'FAULT_ISOLATED': return 7;
    case '51_RESET': return 8;
  }
}

function relayStateFromEvents(
  deviceId: ProtectionDeviceId,
  events: readonly TimelineEvent[],
): RelayTimelineSnapshot['state'] {
  let state: RelayTimelineSnapshot['state'] = 'BELOW_PICKUP';
  for (const event of events) {
    if (!('deviceId' in event) || event.deviceId !== deviceId) continue;
    switch (event.type) {
      case '51_PICKUP': state = '51_TIMING'; break;
      case '50_TRIP': state = '50_TRIPPED'; break;
      case '51_TRIP': state = '51_TRIPPED'; break;
      case 'BREAKER_OPENING': state = 'BREAKER_OPENING'; break;
      case 'BREAKER_OPEN': state = 'BREAKER_OPEN'; break;
      case '51_RESET': state = 'RESET'; break;
      default: break;
    }
  }
  return state;
}

function selectedPostFaultCurrents(
  study: OvercurrentStudyDefinition,
  faultCase: FaultCase,
): DomainEvaluation<{ readonly profile: CurrentProfile; readonly currents: DevicePrimaryCurrentMap }> {
  if (!faultCase.postFaultProfileId) {
    return {
      status: 'INVALID',
      issues: [issue(
        'MISSING_REFERENCE',
        `faultCases.${faultCase.id}.postFaultProfileId`,
        'External clear requires an explicit post-fault current profile; the timeline engine will not invent redistribution.',
      )],
    };
  }
  const profile = findProfile(study, faultCase.postFaultProfileId);
  const first = profile?.samples[0];
  if (!profile || !first) {
    return {
      status: 'INVALID',
      issues: [issue('MISSING_REFERENCE', `faultCases.${faultCase.id}.postFaultProfileId`, `Unknown or empty post-fault profile ${faultCase.postFaultProfileId}.`)],
    };
  }
  return { status: 'VALID', value: { profile, currents: first.primaryCurrentAByDevice } };
}

/**
 * Builds the completed, deterministic O07 engineering timeline.
 *
 * The function is pure and non-throwing at its public boundary. Constant-current
 * 51 expiry is analytic; LINEAR profile progress uses deterministic adaptive
 * quadrature and bisection bounded by profile/threshold events.
 */
export function evaluateOvercurrentTimeline(
  run: OvercurrentTimelineRunDefinition,
): DomainEvaluation<TimelineSnapshot> {
  const studyValidation = validateOvercurrentStudyDefinition(run.study);
  const inputIssues = [
    ...(studyValidation.status === 'INVALID' ? studyValidation.issues : []),
    ...validatePlaybackSpeed(run.playbackSpeed),
  ];
  const faultCase = findFaultCase(run.study, run.faultCaseId);
  if (!faultCase) {
    inputIssues.push(issue('MISSING_REFERENCE', 'faultCaseId', `Unknown fault case ${run.faultCaseId}.`));
  }
  if (faultCase?.externalClearTimeSec !== undefined && !faultCase.postFaultProfileId) {
    inputIssues.push(issue(
      'MISSING_REFERENCE',
      `faultCases.${faultCase.id}.postFaultProfileId`,
      'External clear requires an explicit post-fault current profile.',
    ));
  }
  if (inputIssues.length > 0 || !faultCase) return { status: 'INVALID', issues: inputIssues };

  try {
    const series = makeCurrentSeries(run.study, faultCase);
    const externalClearTimeSec = faultCase.externalClearTimeSec;
    const traces = new Map<ProtectionDeviceId, RelayTrace>();
    const devices: OvercurrentProtectionDevice[] = [];

    for (const deviceId of run.study.topology.deviceIds) {
      const device = run.study.devicesById[deviceId];
      if (!device) {
        throw new TimelineComputationError([
          issue('MISSING_REFERENCE', `devicesById.${deviceId}`, `Missing protection device ${deviceId}.`),
        ]);
      }
      devices.push(device);
      traces.set(deviceId, traceRelay(
        series,
        device,
        externalClearTimeSec === undefined
          ? undefined
          : { timeSec: externalClearTimeSec, instantPolicy: 'BEFORE' },
      ));
    }

    const chainOrder = [faultCase.protectionChain.primaryDeviceId, ...faultCase.protectionChain.backupDeviceIds];
    const chainSet = new Set(chainOrder);
    const preClearTrips = devices
      .map((device) => traces.get(device.id)?.trip ?? null)
      .filter((trip): trip is RelayTrip => trip !== null);

    const breakerIsolationCandidates = preClearTrips
      .filter((trip) => chainSet.has(trip.deviceId))
      .map((trip) => {
        const device = run.study.devicesById[trip.deviceId];
        if (!device) throw new TimelineComputationError([issue('MISSING_REFERENCE', `devicesById.${trip.deviceId}`, 'Trip references a missing device.')]);
        const breakerOpenTimeSec = finiteResult(
          trip.timeSec + device.settings.breaker.clearingTimeSec,
          `timeline.${trip.deviceId}.breakerOpenTimeSec`,
          `Breaker-open time for ${trip.deviceId} exceeded the supported numeric range.`,
        );
        return { trip, breakerOpenTimeSec: canonicalTime(breakerOpenTimeSec) };
      })
      .sort((a, b) => {
        if (!sameTime(a.breakerOpenTimeSec, b.breakerOpenTimeSec)) return a.breakerOpenTimeSec - b.breakerOpenTimeSec;
        return chainOrder.indexOf(a.trip.deviceId) - chainOrder.indexOf(b.trip.deviceId);
      });

    const earliestBreakerIsolation = breakerIsolationCandidates[0];
    const externalWins = externalClearTimeSec !== undefined
      && (!earliestBreakerIsolation || atOrBeforeTime(externalClearTimeSec, earliestBreakerIsolation.breakerOpenTimeSec));
    const breakerWins = !externalWins && earliestBreakerIsolation !== undefined;
    const isolationTimeSec = externalWins
      ? canonicalTime(externalClearTimeSec)
      : breakerWins
        ? earliestBreakerIsolation.breakerOpenTimeSec
        : null;

    const acceptedTrips = new Map<ProtectionDeviceId, RelayTrip>();
    for (const trip of preClearTrips) {
      const accepted = isolationTimeSec === null
        || (externalWins ? beforeTime(trip.timeSec, isolationTimeSec) : atOrBeforeTime(trip.timeSec, isolationTimeSec));
      if (accepted) acceptedTrips.set(trip.deviceId, trip);
    }

    const queued: QueuedEvent[] = [];
    let serial = 0;
    const queue = (event: TimelineEvent, phase = eventPriority(event.type)) => {
      queued.push({ event: { ...event, timeSec: canonicalTime(event.timeSec) } as TimelineEvent, phase, serial });
      serial += 1;
    };

    queue({ id: '', type: 'FAULT_APPLIED', timeSec: 0, faultCaseId: faultCase.id }, 1);
    if (series.profileId) {
      for (const timeSec of series.changeTimes) {
        const include = isolationTimeSec === null
          || (externalWins ? beforeTime(timeSec, isolationTimeSec) : atOrBeforeTime(timeSec, isolationTimeSec));
        if (include) queue({ id: '', type: 'CURRENT_PROFILE_CHANGED', timeSec, profileId: series.profileId }, 1);
      }
    }

    for (const device of devices) {
      const trace = traces.get(device.id);
      if (!trace) continue;
      for (const traceEvent of trace.events) {
        if (traceEvent.type === '50_TRIP' || traceEvent.type === '51_TRIP') continue;
        const include = isolationTimeSec === null
          || (externalWins
            ? beforeTime(traceEvent.timeSec, isolationTimeSec)
            : atOrBeforeTime(traceEvent.timeSec, isolationTimeSec));
        if (!include) continue;
        queue({ id: '', type: traceEvent.type, timeSec: traceEvent.timeSec, deviceId: device.id } as TimelineEvent);
      }
    }

    let postFaultCurrents: DevicePrimaryCurrentMap | null = null;
    let postFaultProfile: CurrentProfile | null = null;
    const postProgress = new Map<ProtectionDeviceId, number>();
    if (externalWins && isolationTimeSec !== null) {
      const selectedPostFault = selectedPostFaultCurrents(run.study, faultCase);
      if (selectedPostFault.status === 'INVALID') return selectedPostFault;
      postFaultCurrents = selectedPostFault.value.currents;
      postFaultProfile = selectedPostFault.value.profile;
      queue({
        id: '',
        type: 'CURRENT_PROFILE_CHANGED',
        timeSec: isolationTimeSec,
        profileId: postFaultProfile.id,
      }, 1);

      for (const device of devices) {
        if (acceptedTrips.has(device.id)) continue;
        const trace = traces.get(device.id);
        const current = postFaultCurrents[device.id];
        if (!trace || !Number.isFinite(current) || current < 0) {
          throw new TimelineComputationError([
            issue('NON_FINITE_INPUT', `currentProfiles.${postFaultProfile.id}.${device.id}`, `Post-fault current for ${device.id} must be finite and >= 0 A.`),
          ]);
        }
        const result = evaluateAtCurrent(current, device);
        let timing = trace.timing51;
        let progress = trace.progress51;
        if (result.element51.status === 'PICKUP' && !timing) {
          timing = true;
          progress = 0;
          queue({ id: '', type: '51_PICKUP', timeSec: isolationTimeSec, deviceId: device.id }, 2);
        }

        if (result.element50.status === 'PICKUP') {
          const trip: RelayTrip = {
            deviceId: device.id,
            element: '50',
            timeSec: isolationTimeSec,
            progress51: clampProgress(progress),
          };
          acceptedTrips.set(device.id, trip);
          postProgress.set(device.id, trip.progress51);
          continue;
        }

        if (result.element51.status !== 'PICKUP' && timing) {
          progress = 0;
          timing = false;
          queue({ id: '', type: '51_RESET', timeSec: isolationTimeSec, deviceId: device.id }, 8);
        } else if (result.element51.status === 'PICKUP' && progress >= 1 - PROGRESS_EPS) {
          const trip: RelayTrip = { deviceId: device.id, element: '51', timeSec: isolationTimeSec, progress51: 1 };
          acceptedTrips.set(device.id, trip);
          progress = 1;
        }
        postProgress.set(device.id, clampProgress(progress));
      }
    }

    for (const trip of acceptedTrips.values()) {
      queue({
        id: '',
        type: trip.element === '50' ? '50_TRIP' : '51_TRIP',
        timeSec: trip.timeSec,
        deviceId: trip.deviceId,
      } as TimelineEvent, trip.element === '50' ? 3 : 4);
      queue({ id: '', type: 'BREAKER_OPENING', timeSec: trip.timeSec, deviceId: trip.deviceId }, 5);
    }

    const breakerOpenTimes = new Map<ProtectionDeviceId, number>();
    for (const trip of acceptedTrips.values()) {
      const device = run.study.devicesById[trip.deviceId];
      if (!device) continue;
      const breakerOpenTimeSec = canonicalTime(finiteResult(
        trip.timeSec + device.settings.breaker.clearingTimeSec,
        `timeline.${trip.deviceId}.breakerOpenTimeSec`,
        `Breaker-open time for ${trip.deviceId} exceeded the supported numeric range.`,
      ));
      breakerOpenTimes.set(trip.deviceId, breakerOpenTimeSec);
      queue({ id: '', type: 'BREAKER_OPEN', timeSec: breakerOpenTimeSec, deviceId: trip.deviceId }, 6);
    }

    if (isolationTimeSec !== null) {
      const clearingDeviceId = breakerWins ? earliestBreakerIsolation.trip.deviceId : undefined;
      queue({
        id: '',
        type: 'FAULT_ISOLATED',
        timeSec: isolationTimeSec,
        faultCaseId: faultCase.id,
        ...(clearingDeviceId ? { clearingDeviceId } : {}),
      }, 7);

      if (breakerWins && faultCase.postFaultProfileId) {
        const profile = findProfile(run.study, faultCase.postFaultProfileId);
        const first = profile?.samples[0];
        if (!profile || !first) {
          throw new TimelineComputationError([
            issue('MISSING_REFERENCE', `faultCases.${faultCase.id}.postFaultProfileId`, `Unknown or empty post-fault profile ${faultCase.postFaultProfileId}.`),
          ]);
        }
        postFaultProfile = profile;
        postFaultCurrents = first.primaryCurrentAByDevice;
        queue({ id: '', type: 'CURRENT_PROFILE_CHANGED', timeSec: isolationTimeSec, profileId: profile.id }, 7.1);
      }

      if (breakerWins) {
        for (const device of devices) {
          if (acceptedTrips.has(device.id)) continue;
          const stateAtIsolation = traceRelay(series, device, { timeSec: isolationTimeSec, instantPolicy: 'AFTER' });
          let shouldReset = stateAtIsolation.timing51;
          let retainedProgress = stateAtIsolation.progress51;
          if (postFaultCurrents) {
            const postCurrent = postFaultCurrents[device.id];
            if (!Number.isFinite(postCurrent) || postCurrent < 0) {
              throw new TimelineComputationError([
                issue('NON_FINITE_INPUT', `currentProfiles.${postFaultProfile?.id ?? 'postFault'}.${device.id}`, `Post-fault current for ${device.id} must be finite and >= 0 A.`),
              ]);
            }
            const postResult = evaluateAtCurrent(postCurrent, device);
            shouldReset = stateAtIsolation.timing51 && postResult.element51.status !== 'PICKUP';
          }
          // O01 simple-radial policy is zero current after an isolating breaker
          // unless explicit post-fault profile data says otherwise.
          if (!postFaultCurrents) shouldReset = stateAtIsolation.timing51;
          if (shouldReset) {
            retainedProgress = 0;
            queue({ id: '', type: '51_RESET', timeSec: isolationTimeSec, deviceId: device.id }, 8);
          }
          postProgress.set(device.id, clampProgress(retainedProgress));
        }
      }
    }

    const deviceRank = new Map(run.study.topology.deviceIds.map((deviceId, index) => {
      const order = run.study.devicesById[deviceId]?.order ?? index;
      return [deviceId, order] as const;
    }));
    queued.sort((a, b) => {
      if (!sameTime(a.event.timeSec, b.event.timeSec)) return a.event.timeSec - b.event.timeSec;
      if (a.phase !== b.phase) return a.phase - b.phase;
      const aDevice = 'deviceId' in a.event ? deviceRank.get(a.event.deviceId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const bDevice = 'deviceId' in b.event ? deviceRank.get(b.event.deviceId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      if (aDevice !== bDevice) return aDevice - bDevice;
      return a.serial - b.serial;
    });

    const events = queued.map(({ event }, index) => ({
      ...event,
      id: `${faultCase.id}:EVENT:${String(index + 1).padStart(4, '0')}`,
    } as TimelineEvent));

    const engineeringTimeSec = events.reduce((latest, event) => Math.max(latest, event.timeSec), 0);
    const relays: Record<ProtectionDeviceId, RelayTimelineSnapshot> = {};
    for (const device of devices) {
      const trip = acceptedTrips.get(device.id) ?? null;
      const trace = traces.get(device.id);
      const progress = trip
        ? trip.progress51
        : postProgress.get(device.id) ?? trace?.progress51 ?? 0;
      relays[device.id] = {
        deviceId: device.id,
        state: relayStateFromEvents(device.id, events),
        operateProgress51: clampProgress(progress),
        tripOutputTimeSec: trip?.timeSec ?? null,
        breakerOpenTimeSec: breakerOpenTimes.get(device.id) ?? null,
      };
    }

    return {
      status: 'VALID',
      value: {
        engineeringTimeSec,
        playbackState: 'COMPLETE',
        faultCaseId: faultCase.id,
        relays,
        events,
      },
    };
  } catch (error) {
    if (error instanceof TimelineComputationError) return { status: 'INVALID', issues: error.issues };
    return {
      status: 'INVALID',
      issues: [issue(
        'NUMERICAL_RANGE',
        'timeline',
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Timeline evaluation failed safely because arithmetic left the supported range.',
      )],
    };
  }
}


/** O11 presentation query. Engineering time remains the only clock domain. */
export interface OvercurrentTimelineFrameDefinition extends OvercurrentTimelineRunDefinition {
  readonly engineeringTimeSec: number;
  readonly playbackState?: Exclude<OvercurrentPlaybackState, 'INVALID'>;
}

function latestDeviceEvent(
  events: readonly TimelineEvent[],
  deviceId: ProtectionDeviceId,
): TimelineEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if ('deviceId' in event && event.deviceId === deviceId) return event;
  }
  return null;
}

/**
 * Projects the deterministic completed O07 timeline to an arbitrary engineering
 * timestamp for O11 playback. The projection reuses traceRelay() so 51 progress
 * over STEP/LINEAR current profiles is calculated by the engine, not by UI
 * frame interpolation.
 */
export function evaluateOvercurrentTimelineFrame(
  frame: OvercurrentTimelineFrameDefinition,
): DomainEvaluation<TimelineSnapshot> {
  if (!Number.isFinite(frame.engineeringTimeSec)) {
    return {
      status: 'INVALID',
      issues: [issue('NON_FINITE_INPUT', 'engineeringTimeSec', 'Engineering playback time must be finite.')],
    };
  }
  if (frame.engineeringTimeSec < 0) {
    return {
      status: 'INVALID',
      issues: [issue('INVALID_TIMELINE_STATE', 'engineeringTimeSec', 'Engineering playback time must be >= 0 s.')],
    };
  }

  const completed = evaluateOvercurrentTimeline(frame);
  if (completed.status === 'INVALID') return completed;

  const faultCase = findFaultCase(frame.study, frame.faultCaseId);
  if (!faultCase) {
    return {
      status: 'INVALID',
      issues: [issue('MISSING_REFERENCE', 'faultCaseId', `Unknown fault case ${frame.faultCaseId}.`)],
    };
  }

  try {
    const series = makeCurrentSeries(frame.study, faultCase);
    const endTimeSec = completed.value.engineeringTimeSec;
    const engineeringTimeSec = canonicalTime(Math.min(frame.engineeringTimeSec, endTimeSec));
    const visibleEvents = completed.value.events.filter((event) => atOrBeforeTime(event.timeSec, engineeringTimeSec));
    const isolationEvent = completed.value.events.find((event) => event.type === 'FAULT_ISOLATED');
    const traceEndTimeSec = isolationEvent && atOrBeforeTime(isolationEvent.timeSec, engineeringTimeSec)
      ? isolationEvent.timeSec
      : engineeringTimeSec;
    const relays: Record<ProtectionDeviceId, RelayTimelineSnapshot> = {};

    for (const deviceId of frame.study.topology.deviceIds) {
      const device = frame.study.devicesById[deviceId];
      if (!device) {
        throw new TimelineComputationError([
          issue('MISSING_REFERENCE', `devicesById.${deviceId}`, `Missing protection device ${deviceId}.`),
        ]);
      }

      const externalAtTraceEnd = faultCase.externalClearTimeSec !== undefined
        && sameTime(traceEndTimeSec, faultCase.externalClearTimeSec);
      const trace = traceRelay(series, device, {
        timeSec: traceEndTimeSec,
        instantPolicy: externalAtTraceEnd ? 'BEFORE' : 'AFTER',
      });
      const deviceEvents = visibleEvents.filter((event) => 'deviceId' in event && event.deviceId === deviceId);
      const latest = latestDeviceEvent(visibleEvents, deviceId);
      const tripEvent = deviceEvents.find((event) => event.type === '50_TRIP' || event.type === '51_TRIP');
      const breakerOpenEvent = deviceEvents.find((event) => event.type === 'BREAKER_OPEN');

      let operateProgress51 = clampProgress(trace.progress51);
      if (latest?.type === '51_RESET') operateProgress51 = 0;
      if (deviceEvents.some((event) => event.type === '51_TRIP')) operateProgress51 = 1;

      relays[deviceId] = {
        deviceId,
        state: relayStateFromEvents(deviceId, visibleEvents),
        operateProgress51,
        tripOutputTimeSec: tripEvent?.timeSec ?? null,
        breakerOpenTimeSec: breakerOpenEvent?.timeSec ?? null,
      };
    }

    const requestedPlaybackState = frame.playbackState ?? 'RUNNING';
    // COMPLETE is the terminal state of the projected timeline; honour it
    // whenever the requested engineering time is at-or-before the deterministic
    // end (within the TIME_EPS_FACTOR tolerance shared with other comparisons).
    // A mid-timeline COMPLETE request — engineeringTimeSec well below endTimeSec
    // — stays RUNNING so the playback hook can advance to the end.
    const atOrPastEnd = !beforeTime(engineeringTimeSec, endTimeSec);
    const playbackState: OvercurrentPlaybackState = atOrPastEnd
      ? 'COMPLETE'
      : requestedPlaybackState === 'COMPLETE'
        ? 'RUNNING'
        : requestedPlaybackState;

    return {
      status: 'VALID',
      value: {
        engineeringTimeSec,
        playbackState,
        faultCaseId: frame.faultCaseId,
        relays,
        events: visibleEvents,
      },
    };
  } catch (error) {
    if (error instanceof TimelineComputationError) return { status: 'INVALID', issues: error.issues };
    return {
      status: 'INVALID',
      issues: [issue(
        'NUMERICAL_RANGE',
        'timelineFrame',
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Timeline frame projection failed safely because arithmetic left the supported range.',
      )],
    };
  }
}
