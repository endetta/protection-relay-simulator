import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
} from 'react';
import {
  buildOvercurrentOperatingSequenceModel,
  createOvercurrentOperatingSequencePlan,
  type OperatingSequenceRole,
} from '../../presentation/overcurrentOperatingSequence';
import type { TimelineSnapshot } from '../../types/overcurrent';
import { formatEngineeringNumber } from '../../utils/engineering';
import type {
  OvercurrentParameterAction,
  OvercurrentParameterState,
} from '../../utils/overcurrentState';
import './operatingSequence.css';

export interface OperatingSequenceProps {
  readonly state: OvercurrentParameterState;
  readonly dispatch: Dispatch<OvercurrentParameterAction>;
  /** Lets O15 composition feed the same O07 frame to the SLD. */
  readonly onTimelineSnapshotChange?: (snapshot: TimelineSnapshot | null) => void;
  readonly onDeviceFocus?: (deviceId: string) => void;
  readonly className?: string;
}

function roleLabel(role: OperatingSequenceRole, backupOrder: number | null): string {
  if (role === 'PRIMARY') return 'PRIMARY';
  if (role === 'BACKUP') return `BACKUP ${backupOrder ?? ''}`.trim();
  return 'OTHER';
}

function numberText(value: number | null, unit = 's'): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${formatEngineeringNumber(value)} ${unit}`;
}

export function OperatingSequence({
  state,
  dispatch,
  onTimelineSnapshotChange,
  onDeviceFocus,
  className = '',
}: OperatingSequenceProps) {
  const plan = useMemo(() => createOvercurrentOperatingSequencePlan(state), [state]);
  const totalTimeSec = plan.status === 'VALID' ? plan.value.completedTimeline.engineeringTimeSec : 0;
  const [engineeringTimeSec, setEngineeringTimeSec] = useState(0);
  const previousFrameMs = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    setEngineeringTimeSec(state.playbackState === 'COMPLETE' ? totalTimeSec : 0);
    previousFrameMs.current = null;
  }, [state.activeFaultCaseId, state.studyPresetId]);

  useEffect(() => {
    if (state.playbackState === 'IDLE') {
      setEngineeringTimeSec(0);
      previousFrameMs.current = null;
    } else if (state.playbackState === 'COMPLETE') {
      setEngineeringTimeSec(totalTimeSec);
      previousFrameMs.current = null;
    }
  }, [state.playbackState, totalTimeSec]);

  useEffect(() => {
    if (state.playbackState !== 'RUNNING' || plan.status !== 'VALID') return undefined;
    if (totalTimeSec <= 0) {
      dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
      return undefined;
    }

    const tick = (timestampMs: number) => {
      if (previousFrameMs.current === null) previousFrameMs.current = timestampMs;
      const wallDeltaSec = Math.max(0, (timestampMs - previousFrameMs.current) / 1000);
      previousFrameMs.current = timestampMs;
      setEngineeringTimeSec((current) => Math.min(
        totalTimeSec,
        current + wallDeltaSec * state.simulationSpeed,
      ));
      animationFrame.current = window.requestAnimationFrame(tick);
    };

    animationFrame.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      previousFrameMs.current = null;
    };
  }, [dispatch, plan, state.playbackState, state.simulationSpeed, totalTimeSec]);


  useEffect(() => {
    if (state.playbackState === 'RUNNING' && totalTimeSec > 0 && engineeringTimeSec >= totalTimeSec) {
      dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'COMPLETE' });
    }
  }, [dispatch, engineeringTimeSec, state.playbackState, totalTimeSec]);

  const model = useMemo(
    () => buildOvercurrentOperatingSequenceModel(state, engineeringTimeSec, plan),
    [engineeringTimeSec, plan, state],
  );

  useEffect(() => {
    onTimelineSnapshotChange?.(model.snapshot);
  }, [model.snapshot, onTimelineSnapshotChange]);

  return (
    <section className={`overcurrent-sequence simulator-theme ${className}`.trim()} aria-label='Operating Sequence'>
      <div className='overcurrent-sequence-header'>
        <div>
          <span className='overcurrent-sequence-kicker'>Protection timing</span>
          <h3>Operating Sequence</h3>
        </div>
        <div className='overcurrent-sequence-status' data-tone={model.globalTone} role='status' aria-live='polite' aria-atomic='true'>
          <span>{model.faultLabel}</span>
          <b>{model.globalStatusLabel}</b>
        </div>
      </div>

      {model.status === 'INVALID' ? (
        <div className='overcurrent-sequence-message' data-tone='danger' role='status'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>{model.issues[0]?.detail ?? model.issues[0]?.code ?? 'Unable to build Operating Sequence.'}</span>
        </div>
      ) : model.status === 'READY' ? (
        <div className='overcurrent-sequence-message' role='status'>
          <b>SELECT A DISCRETE FAULT CASE</b>

        </div>
      ) : (
        <>
          <div className='overcurrent-sequence-clock'>
            <div>
              <span>ENGINEERING TIME</span>
              <b className='font-eng'>{numberText(model.engineeringTimeSec)}</b>
            </div>
            <div>
              <span>PLAYBACK</span>
              <b className='font-eng'>{state.simulationSpeed}×</b>
            </div>
            <div>
              <span>FINAL EVENT</span>
              <b className='font-eng'>{numberText(model.totalEngineeringTimeSec)}</b>
            </div>
            <div className='overcurrent-sequence-playback-controls'>
              {state.playbackState === 'RUNNING' && (
                <button type='button' onClick={() => dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'PAUSED' })}>Pause</button>
              )}
              {state.playbackState === 'PAUSED' && (
                <button type='button' onClick={() => dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'RUNNING' })}>Resume</button>
              )}
            </div>
          </div>

          <div
            className='overcurrent-sequence-master-progress'
            role='progressbar'
            aria-label='Overall engineering timeline progress'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(model.progress * 100)}
          >
            <span style={{ width: `${model.progress * 100}%` }} />
          </div>

          <div className='overcurrent-sequence-rows'>
            {model.rows.map((row) => {
              const progress = row.selectedElement === '50' && row.actualTripOutputTimeSec !== null
                ? 1
                : row.operateProgress51;
              return (
                <button
                  key={row.deviceId}
                  type='button'
                  className='overcurrent-sequence-row'
                  data-selected={row.selected}
                  data-tone={row.tone}
                  onClick={() => {
                    dispatch({ type: 'SELECT_DEVICE', deviceId: row.deviceId });
                    onDeviceFocus?.(row.deviceId);
                  }}
                  aria-label={`${row.deviceLabel}, ${roleLabel(row.role, row.backupOrder)}, ${row.stateLabel}`}
                >
                  <span className='overcurrent-sequence-row-identity'>
                    <b>{row.deviceLabel}</b>
                    <small>{roleLabel(row.role, row.backupOrder)}</small>
                  </span>
                  <span className='overcurrent-sequence-row-progress'>
                    <span
                      className='overcurrent-sequence-row-track'
                      role='progressbar'
                      aria-label={`${row.deviceLabel} operating progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(Math.max(0, Math.min(100, progress * 100)))}
                    >
                      <span style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />
                    </span>
                    <small className='font-eng'>
                      {row.selectedElement === '50'
                        ? row.actualTripOutputTimeSec !== null ? '50 · TRIPPED' : '50 · ARMED'
                        : `${formatEngineeringNumber(row.operateProgress51 * 100)} % · 51`}
                    </small>
                  </span>
                  <span className='overcurrent-sequence-row-time'>
                    <small>EXPECTED</small>
                    <b className='font-eng'>{numberText(row.expectedOperateTimeSec)}</b>
                  </span>
                  <span className='overcurrent-sequence-row-time'>
                    <small>TRIP</small>
                    <b className='font-eng'>{numberText(row.actualTripOutputTimeSec)}</b>
                  </span>
                  <span className='overcurrent-sequence-row-state'>{row.stateLabel}</span>
                </button>
              );
            })}
          </div>

          <div className='overcurrent-sequence-events' aria-label='Visible engineering events'>
            <div className='overcurrent-sequence-events-head'>
              <b>EVENTS</b>
              <span>{model.milestones.length} recorded</span>
            </div>
            {model.milestones.length === 0 ? (
              <div className='overcurrent-sequence-event-empty'>Waiting for fault application.</div>
            ) : (
              <ol>
                {model.milestones.map((milestone) => (
                  <li key={milestone.eventId} data-tone={milestone.tone}>
                    <time className='font-eng'>{formatEngineeringNumber(milestone.timeSec)} s</time>
                    <span>{milestone.label}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </section>
  );
}
