import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
} from 'react';
import { buildUnderfrequencyTimelineChartModel, snapshotAtTime } from '../../presentation/underfrequencyTimelineChart';
import type {
  UnderfrequencyAction,
} from '../../utils/underfrequencyState';
import type {
  UnderfrequencyPlaybackSpeed,
  UnderfrequencyTimelineRun,
  UnderfrequencyTimelineSnapshot,
  UnderfrequencyStudyDefinition,
} from '../../types/underfrequency';
import { formatEngineeringNumber, formatFrequencyHz } from '../../utils/engineering';
import { EngineeringViewOverlay } from '../shared/EngineeringViewOverlay';
import './frequencyTimelineChart.css';

export interface FrequencyTimelineChartProps {
  readonly run: UnderfrequencyTimelineRun | null;
  readonly study: UnderfrequencyStudyDefinition;
  readonly playbackState: string;
  readonly simulationSpeed: UnderfrequencyPlaybackSpeed;
  readonly dispatch: Dispatch<UnderfrequencyAction>;
  /** Lets the page feed the same snapshot to the generator diagram and analysis. */
  readonly onSnapshotChange?: (snapshot: UnderfrequencyTimelineSnapshot | null) => void;
  readonly className?: string;
}

const W = 940;
const H = 440;
const MARGIN_LEFT = 64;
const MARGIN_RIGHT = 26;
const MARGIN_TOP = 30;
const MARGIN_BOTTOM = 54;
const PLOT_WIDTH = W - MARGIN_LEFT - MARGIN_RIGHT;
const PLOT_HEIGHT = H - MARGIN_TOP - MARGIN_BOTTOM;

interface StoryStep {
  readonly id: string;
  readonly label: string;
  readonly timeSec: number;
  readonly tone: 'success' | 'warning' | 'danger' | 'info';
  readonly narrative: string;
}

function mapsx(min: number, max: number) {
  return (value: number) => MARGIN_LEFT + ((value - min) / (max - min)) * PLOT_WIDTH;
}
function mapsy(min: number, max: number) {
  return (value: number) => MARGIN_TOP + PLOT_HEIGHT - ((value - min) / (max - min)) * PLOT_HEIGHT;
}

function pathFromCurve(curve: readonly { x: number; y: number }[], sx: (v: number) => number, sy: (v: number) => number): string {
  return curve.map((point, index) => `${index === 0 ? 'M' : 'L'} ${sx(point.x).toFixed(2)} ${sy(point.y).toFixed(2)}`).join(' ');
}

/** Build a compact phase narrative from the run for story mode. */
function buildStorySteps(run: UnderfrequencyTimelineRun): StoryStep[] {
  if (run.status !== 'VALID' || run.snapshots.length === 0) return [];

  const first = run.snapshots[0];
  const last = run.snapshots[run.snapshots.length - 1];
  const trough = run.snapshots.reduce((worst, s) => (s.frequencyHz < worst.frequencyHz ? s : worst), first);
  const firstTrip = run.events.find((e) => e.type === 'UFLS_TRIP');

  const steps: StoryStep[] = [
    {
      id: 'STORY_PRE',
      label: 'Persiapkan',
      timeSec: first.engineeringTimeSec,
      tone: 'success',
      narrative: `Seimbang pada ${formatFrequencyHz(first.frequencyHz)} Hz; defisit ${first.deficitMw.toFixed(0)} MW.`,
    },
    {
      id: 'STORY_DECAY',
      label: 'Defisit & Inersia',
      timeSec: trough.engineeringTimeSec,
      tone: run.steadyStateStatus === 'COLLAPSE' ? 'danger' : 'warning',
      narrative: `Frekuensi turun ke ${formatFrequencyHz(trough.frequencyHz)} Hz (df/dt ≈ ${trough.rocofHzPerSec.toFixed(2)} Hz/s).`,
    },
  ];

  if (firstTrip) {
    steps.push({
      id: 'STORY_UFLS',
      label: 'UFLS',
      timeSec: firstTrip.timeSec,
      tone: 'danger',
      narrative: `Stage ${firstTrip.stageId ?? ''} menyala, melepas beban untuk menghentikan penurunan.`,
    });
  }

  if (run.steadyStateStatus === 'COLLAPSE') {
    steps.push({
      id: 'STORY_COLLAPSE',
      label: 'Kolaps',
      timeSec: run.finalTimeSec,
      tone: 'danger',
      narrative: 'Frekuensi lepas kendali; governor + UFLS tidak dapat menghentikan defisit.',
    });
  } else {
    steps.push({
      id: 'STORY_SETTLE',
      label: run.finalFrequencyHz !== null && last.frequencyHz > first.frequencyHz ? 'Recovery' : 'Settle',
      timeSec: run.finalTimeSec,
      tone: 'success',
      narrative: `Frekuensi pulih ke ${run.finalFrequencyHz === null ? '—' : formatFrequencyHz(run.finalFrequencyHz)} Hz.`,
    });
  }

  return steps;
}

export function FrequencyTimelineChart({
  run,
  study,
  playbackState,
  simulationSpeed,
  dispatch,
  onSnapshotChange,
  className = '',
}: FrequencyTimelineChartProps) {
  const titleId = useId();
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scrubTimeSec, setScrubTimeSec] = useState<number | null>(null);
  const previousFrameMs = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);
  const scrubTimeSecRef = useRef<number | null>(null);
  scrubTimeSecRef.current = scrubTimeSec;

  const model = useMemo(
    () => (run ? buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz) : null),
    [run, study.uflsStages, study.system.fNominalHz],
  );

  const steps = useMemo(() => (run ? buildStorySteps(run) : []), [run]);
  const totalTimeSec = run?.finalTimeSec ?? 0;

  // Snapshot the currently displayed time. When idle / no scrub, show the final snapshot.
  const visibleSnapshot = useMemo(() => {
    if (!run || run.status !== 'VALID' || run.snapshots.length === 0) return null;
    return snapshotAtTime(run.snapshots, scrubTimeSec);
  }, [run, scrubTimeSec]);

  useEffect(() => {
    onSnapshotChange?.(visibleSnapshot);
  }, [visibleSnapshot, onSnapshotChange]);

  // Playback clock: advances scrubTimeSec toward finalTimeSec while RUNNING.
  useEffect(() => {
    if (playbackState !== 'RUNNING' || totalTimeSec <= 0) return undefined;
    const tick = (timestampMs: number) => {
      if (previousFrameMs.current === null) previousFrameMs.current = timestampMs;
      const wallDeltaSec = Math.max(0, (timestampMs - previousFrameMs.current) / 1000);
      previousFrameMs.current = timestampMs;
      setScrubTimeSec((current) => Math.min(totalTimeSec, (current ?? 0) + wallDeltaSec * simulationSpeed));
      animationFrame.current = window.requestAnimationFrame(tick);
    };
    animationFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      previousFrameMs.current = null;
    };
  }, [dispatch, playbackState, simulationSpeed, totalTimeSec]);

  // When playback reaches the end, latch COMPLETE.
  useEffect(() => {
    if (playbackState === 'RUNNING' && totalTimeSec > 0 && (scrubTimeSec ?? 0) >= totalTimeSec) {
      dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    }
  }, [dispatch, playbackState, scrubTimeSec, totalTimeSec]);

  // Reset the scrub clock when the run (study) changes.
  useEffect(() => {
    setScrubTimeSec(null);
    previousFrameMs.current = null;
  }, [run?.studyId]);

  const sx = model ? mapsx(model.xAxis.min, model.xAxis.max) : mapsx(0, 1);
  const sy = model ? mapsy(model.yAxis.min, model.yAxis.max) : mapsy(0, 1);
  const curvePath = model && model.status === 'VALID' ? pathFromCurve(model.curve, sx, sy) : '';
  const scrubX = model && scrubTimeSec !== null ? sx(scrubTimeSec) : null;
  const activeStep = scrubTimeSec !== null ? steps.reduce((best, s) => (Math.abs(s.timeSec - scrubTimeSec) < Math.abs(best.timeSec - scrubTimeSec) ? s : best), steps[0]) : null;

  const fNow = visibleSnapshot
    ? formatFrequencyHz(visibleSnapshot.frequencyHz)
    : model?.finalFrequencyHz !== null && model?.finalFrequencyHz !== undefined
      ? formatFrequencyHz(model.finalFrequencyHz)
      : '—';

  const startPlayback = () => {
    // From a paused/scrubbed position, resume; otherwise begin from current scrub.
    setScrubTimeSec((current) => current ?? 0);
    dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'RUNNING' });
  };

  const content = (
    <section className={`underfrequency-ftc simulator-theme ${className}`.trim()} aria-labelledby={titleId} data-expanded={expanded}>
      <header className='underfrequency-ftc-header'>
        <div className='underfrequency-ftc-heading'>
          <span>System frequency</span>
          <h3 id={titleId}>Frequency — Time</h3>
        </div>
        <div className='underfrequency-ftc-controls'>
          <button
            type='button'
            className='underfrequency-ftc-toggle'
            data-active={storyOpen}
            aria-pressed={storyOpen}
            onClick={() => setStoryOpen((value) => !value)}
          >
            Story
          </button>
          {!expanded && (
            <button
              ref={expandButtonRef}
              type='button'
              className='underfrequency-ftc-expand'
              onClick={() => setExpanded(true)}
              aria-label='Perluas timeline frekuensi'
            >
              Perluas
            </button>
          )}
        </div>
      </header>

      <div className='underfrequency-ftc-readout' aria-label='Ringkasan timeline frekuensi'>
        <span>f NOW <b className='font-eng'>{fNow}</b></span>
        <span>MIN f <b className='font-eng'>{model?.minFrequencyHz !== null ? formatFrequencyHz(model?.minFrequencyHz ?? 0) : '—'}</b></span>
        <span>STEADY <b className='font-eng'>{model?.finalFrequencyHz !== null ? formatFrequencyHz(model?.finalFrequencyHz ?? 0) : '—'}</b></span>
        <span>RUN <b className='font-eng'>{playbackState}</b></span>
      </div>

      {storyOpen && steps.length > 0 && (
        <div className='underfrequency-ftc-story' aria-label='Langkah fase story'>
          <div className='underfrequency-ftc-story-chips'>
            {steps.map((step) => (
              <button
                key={step.id}
                type='button'
                data-tone={step.tone}
                data-active={activeStep?.id === step.id}
                aria-pressed={activeStep?.id === step.id}
                onClick={() => setScrubTimeSec(step.timeSec)}
              >
                {step.label}
              </button>
            ))}
          </div>
          {activeStep && (
            <p className='underfrequency-ftc-story-narrative'>
              <b>{activeStep.label} · {formatEngineeringNumber(activeStep.timeSec)} s</b>
              {activeStep.narrative}
            </p>
          )}
        </div>
      )}

      {!model || model.status === 'INVALID' ? (
        <div className='underfrequency-ftc-invalid' role='status'>
          <b>INPUT INVALID · GRAPH HELD</b>
          <span>{model?.finalTimeSec === 0 ? 'Perbaiki input engineering yang tidak valid sebelum menjalankan.' : 'Tidak dapat membangun kurva frekuensi yang finite.'}</span>
        </div>
      ) : (
        <>
          <div className='underfrequency-ftc-playback' role='group' aria-label='Kontrol playback Underfrequency'>
            <div className='underfrequency-ftc-playback-buttons'>
              {playbackState === 'RUNNING' ? (
                <button type='button' onClick={() => dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'PAUSED' })}>Pause</button>
              ) : (
                <button type='button' onClick={startPlayback} disabled={playbackState === 'COMPLETE' && scrubTimeSec === null}>{playbackState === 'PAUSED' || playbackState === 'COMPLETE' ? 'Resume' : 'Run'}</button>
              )}
              <button type='button' onClick={() => { dispatch({ type: 'CLEAR_RUN' }); setScrubTimeSec(null); }}>Clear</button>
            </div>
            <div className='underfrequency-ftc-speed' aria-label='Playback speed'>
              {([1, 5, 10] as const).map((speed) => (
                <button
                  key={speed}
                  type='button'
                  aria-pressed={simulationSpeed === speed}
                  data-active={simulationSpeed === speed ? 'true' : 'false'}
                  onClick={() => dispatch({ type: 'SET_SIMULATION_SPEED', speed })}
                >
                  {speed}×
                </button>
              ))}
            </div>
            <input
              className='underfrequency-ftc-scrub'
              type='range'
              min={0}
              max={totalTimeSec || 1}
              step={0.01}
              value={Math.min(totalTimeSec || 0, scrubTimeSec ?? totalTimeSec ?? 0)}
              disabled={totalTimeSec === 0}
              aria-label='Geser timeline underfrequency'
              onChange={(event) => setScrubTimeSec(Number(event.target.value))}
            />
          </div>

          <div className='underfrequency-ftc-frame'>
            <div className='underfrequency-ftc-legend' aria-label='Legend timeline frekuensi'>
              <span><i data-kind='curve' /> System frequency</span>
              <span><i data-kind='nominal' /> Nominal {formatFrequencyHz(model.nominalFrequencyHz)} Hz</span>
              <span><i data-kind='stage' /> UFLS threshold</span>
              <span><i data-kind='trip' /> UFLS trip</span>
            </div>

            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio='xMidYMid meet'
              role='img'
              aria-labelledby={`${titleId}-plot`}
              className='underfrequency-ftc-svg'
            >
              <desc id={`${titleId}-plot`}>
                System frequency terhadap engineering time dengan UFLS thresholds, penanda trip, dan garis frekuensi nominal.
              </desc>

              <defs>
                <clipPath id={`ftc-clip-${titleId.replace(/:/g, '')}`}>
                  <rect x={MARGIN_LEFT} y={MARGIN_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
                </clipPath>
              </defs>

              {model.yAxis.ticks.map((tick) => (
                <g key={`y:${tick}`}>
                  <line className='underfrequency-ftc-grid' x1={MARGIN_LEFT} y1={sy(tick)} x2={W - MARGIN_RIGHT} y2={sy(tick)} />
                  <text className='underfrequency-ftc-tick font-eng' x={MARGIN_LEFT - 9} y={sy(tick) + 3} textAnchor='end'>
                    {tick.toFixed(1)}
                  </text>
                </g>
              ))}
              {model.xAxis.ticks.map((tick) => (
                <g key={`x:${tick}`}>
                  <line className='underfrequency-ftc-grid' x1={sx(tick)} y1={MARGIN_TOP} x2={sx(tick)} y2={H - MARGIN_BOTTOM} />
                  <text className='underfrequency-ftc-tick font-eng' x={sx(tick)} y={H - MARGIN_BOTTOM + 18} textAnchor='middle'>
                    {Number.isInteger(tick) ? tick.toFixed(0) : tick.toFixed(1)}
                  </text>
                </g>
              ))}

              <g clipPath={`url(#ftc-clip-${titleId.replace(/:/g, '')})`}>
                <rect className='underfrequency-ftc-plot-bg' x={MARGIN_LEFT} y={MARGIN_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} />

                {/* Nominal frequency line */}
                <line
                  className='underfrequency-ftc-nominal'
                  x1={MARGIN_LEFT}
                  y1={sy(model.nominalFrequencyHz)}
                  x2={W - MARGIN_RIGHT}
                  y2={sy(model.nominalFrequencyHz)}
                />

                {/* UFLS stage threshold lines */}
                {model.stageLines.filter((s) => s.enabled).map((line) => (
                  <line
                    key={line.stageId}
                    className='underfrequency-ftc-stage'
                    data-operated={line.operated}
                    x1={MARGIN_LEFT}
                    y1={sy(line.thresholdHz)}
                    x2={W - MARGIN_RIGHT}
                    y2={sy(line.thresholdHz)}
                  />
                ))}

                {/* Frequency curve */}
                {curvePath && <path className='underfrequency-ftc-curve' d={curvePath} />}

                {/* UFLS trip markers */}
                {model.tripMarkers.map((marker, index) => (
                  <g key={`${marker.stageId}:${marker.timeSec}:${index}`} className='underfrequency-ftc-trip'>
                    <line x1={sx(marker.timeSec)} y1={MARGIN_TOP} x2={sx(marker.timeSec)} y2={H - MARGIN_BOTTOM} />
                    <circle cx={sx(marker.timeSec)} cy={sy(model.yAxis.max)} r='3' />
                  </g>
                ))}

                {/* Collapse / steady-state marker */}
                {model.collapseEvent && (
                  <g className='underfrequency-ftc-collapse' aria-label='Kolaps frekuensi'>
                    <line x1={sx(model.collapseEvent.timeSec)} y1={MARGIN_TOP} x2={sx(model.collapseEvent.timeSec)} y2={H - MARGIN_BOTTOM} />
                    <text x={sx(model.collapseEvent.timeSec) + 5} y={MARGIN_TOP + 12} className='underfrequency-ftc-event-label'>COLLAPSE</text>
                  </g>
                )}
                {model.steadyStateEvent && (
                  <g className='underfrequency-ftc-steady' aria-label='Steady state tercapai'>
                    <line x1={sx(model.steadyStateEvent.timeSec)} y1={MARGIN_TOP} x2={sx(model.steadyStateEvent.timeSec)} y2={H - MARGIN_BOTTOM} />
                    <text x={sx(model.steadyStateEvent.timeSec) - 5} y={MARGIN_TOP + 12} textAnchor='end' className='underfrequency-ftc-event-label'>STEADY</text>
                  </g>
                )}

                {/* Scrub crosshair */}
                {scrubX !== null && (
                  <g className='underfrequency-ftc-scrub-crosshair' aria-hidden='true'>
                    <line x1={scrubX} y1={MARGIN_TOP} x2={scrubX} y2={H - MARGIN_BOTTOM} />
                    <circle cx={scrubX} cy={visibleSnapshot ? sy(visibleSnapshot.frequencyHz) : MARGIN_TOP} r='4' />
                  </g>
                )}
              </g>

              <line className='underfrequency-ftc-axis' x1={MARGIN_LEFT} y1={MARGIN_TOP} x2={MARGIN_LEFT} y2={H - MARGIN_BOTTOM} />
              <line className='underfrequency-ftc-axis' x1={MARGIN_LEFT} y1={H - MARGIN_BOTTOM} x2={W - MARGIN_RIGHT} y2={H - MARGIN_BOTTOM} />
              <text className='underfrequency-ftc-axis-label' x={MARGIN_LEFT + PLOT_WIDTH / 2} y={H - 8} textAnchor='middle'>
                Engineering Time (s)
              </text>
              <text className='underfrequency-ftc-axis-label' x='16' y={MARGIN_TOP + PLOT_HEIGHT / 2} textAnchor='middle' transform={`rotate(-90 16 ${MARGIN_TOP + PLOT_HEIGHT / 2})`}>
                Frequency (Hz)
              </text>
            </svg>
          </div>
        </>
      )}
    </section>
  );

  if (!expanded) return content;

  return (
    <EngineeringViewOverlay
      open={expanded}
      title='Frequency — Time'
      onClose={() => setExpanded(false)}
      returnFocusRef={expandButtonRef}
      className='engineering-view-overlay-ftc'
    >
      {content}
    </EngineeringViewOverlay>
  );
}
