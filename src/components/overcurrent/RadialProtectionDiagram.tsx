import { useId, useMemo, useRef, useState } from 'react';
import type { TimelineSnapshot } from '../../types/overcurrent';
import {
  buildOvercurrentSldModel,
  type OvercurrentSldDeviceNode,
} from '../../presentation/overcurrentSld';
import { formatEngineeringNumber } from '../../utils/engineering';
import type {
  OvercurrentParameterAction,
  OvercurrentParameterState,
} from '../../utils/overcurrentState';
import { EngineeringViewOverlay } from '../shared/EngineeringViewOverlay';
import './radialProtectionDiagram.css';

export interface RadialProtectionDiagramProps {
  readonly state: OvercurrentParameterState;
  readonly dispatch: (action: OvercurrentParameterAction) => void;
  /** Optional O07 snapshot. O09 displays it but never derives breaker state itself. */
  readonly timelineSnapshot?: TimelineSnapshot | null;
  readonly onDeviceFocus?: (deviceId: string) => void;
  readonly className?: string;
}

const VIEWBOX_WIDTH = 1000;
/**
 * Drawn feeder content spans y 93-185 and the HTML device-card overlay runs to
 * y 250, so the viewBox is cropped to y 88-250 instead of 0-250. That removes the
 * empty band above the diagram. `overcurrent-sld-canvas` keeps the same 1000/162
 * ratio so the SVG is never letterboxed, and the overlay `top` percentages are
 * re-derived from the same box so cards keep their exact viewBox-unit positions.
 */
const VIEWBOX_Y = 88;
const VIEWBOX_HEIGHT = 162;
const FEEDER_START_X = 92;
const FEEDER_END_X = 920;
const FEEDER_Y = 116;

function feederX(position: number): number {
  return FEEDER_START_X + (FEEDER_END_X - FEEDER_START_X) * position;
}

function breakerGeometry(device: OvercurrentSldDeviceNode) {
  const x = feederX(device.normalizedPosition);
  const gap = 8;
  if (device.breakerState === 'OPEN') {
    return {
      left: `${x - 16},${FEEDER_Y} ${x - gap},${FEEDER_Y}`,
      right: `${x + gap},${FEEDER_Y} ${x + 16},${FEEDER_Y}`,
      blade: `${x - gap},${FEEDER_Y} ${x + gap - 1},${FEEDER_Y - 15}`,
    };
  }
  const bladeLift = device.breakerState === 'OPENING' ? 8 : 0;
  return {
    left: `${x - 16},${FEEDER_Y} ${x - gap},${FEEDER_Y}`,
    right: `${x + gap},${FEEDER_Y} ${x + 16},${FEEDER_Y}`,
    blade: `${x - gap},${FEEDER_Y} ${x + gap},${FEEDER_Y - bladeLift}`,
  };
}

function roleLabel(device: OvercurrentSldDeviceNode): string {
  if (device.role === 'PRIMARY') return 'PRIMARY';
  if (device.role === 'BACKUP') return `BACKUP ${device.backupOrder ?? ''}`.trim();
  return 'STANDBY';
}

function deviceStatusLabel(device: OvercurrentSldDeviceNode): string {
  if (device.breakerState === 'OPEN') return 'BREAKER OPEN';
  if (device.breakerState === 'OPENING') return 'BREAKER OPENING';
  if (device.timelineState === '50_TRIPPED') return '50 TRIP';
  if (device.timelineState === '51_TRIPPED') return '51 TRIP';
  if (device.timelineState === '51_TIMING') return '51 TIMING';
  return device.carriesCurrent ? 'CURRENT PATH' : 'NO CURRENT';
}

export function RadialProtectionDiagram({
  state,
  dispatch,
  timelineSnapshot = null,
  onDeviceFocus,
  className = '',
}: RadialProtectionDiagramProps) {
  const titleId = useId();
  const descriptionId = useId();
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const model = useMemo(
    () => buildOvercurrentSldModel(state, timelineSnapshot),
    [state, timelineSnapshot],
  );
  const currentPathEndX = feederX(model.currentPathEnd);
  const feederSegments = useMemo(() => {
    const breakerPositions = model.devices
      .map((device) => feederX(device.normalizedPosition))
      .sort((left, right) => left - right);
    const segments: Array<{ x1: number; x2: number }> = [];
    let cursor = FEEDER_START_X;
    breakerPositions.forEach((x) => {
      segments.push({ x1: cursor, x2: x - 16 });
      cursor = x + 16;
    });
    segments.push({ x1: cursor, x2: FEEDER_END_X });
    return segments.filter((segment) => segment.x2 > segment.x1);
  }, [model.devices]);

  const selectDevice = (deviceId: string) => {
    dispatch({ type: 'SELECT_DEVICE', deviceId });
    onDeviceFocus?.(deviceId);
  };

  const content = (
    <section
      className={`overcurrent-sld simulator-theme ${className}`.trim()}
      aria-labelledby={titleId}
      data-expanded={expanded}
    >
      <div className='overcurrent-sld-header'>
        <div>
          <span className='overcurrent-sld-kicker'>Topology · single-line diagram</span>
          <h3 id={titleId}>{model.topologyLabel}</h3>
        </div>
        <div className='overcurrent-sld-header-actions'>
          <div
            className='overcurrent-sld-source'
            data-tone={model.faultIsolated ? 'success' : model.activeLocationId ? 'danger' : 'normal'}
            role='status'
            aria-live='polite'
            aria-atomic='true'
          >
            <span>{model.faultIsolated ? 'FAULT ISOLATED' : model.activeLocationId ? 'FAULT STUDY' : 'LOAD STUDY'}</span>
            <b>{model.sourceLabel}</b>
          </div>
          {!expanded && (
            <button
              ref={expandButtonRef}
              type='button'
              className='overcurrent-engineering-expand'
              onClick={() => setExpanded(true)}
              aria-label='Expand single-line diagram'
            >
              Expand
            </button>
          )}
        </div>
      </div>

      {model.status === 'INVALID' ? (
        <div className='overcurrent-sld-invalid' role='status'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>{model.issues[0]?.detail ?? model.issues[0]?.code ?? 'Unable to build the configured study diagram.'}</span>
        </div>
      ) : (
        <>
          <div className='overcurrent-sld-canvas-scroll' tabIndex={0} aria-label='Scrollable single-line diagram'>
            <div className='overcurrent-sld-canvas'>
            <div className='overcurrent-sld-stage'>
            <svg
              viewBox={`0 ${VIEWBOX_Y} ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              role='img'
              aria-labelledby={`${titleId} ${descriptionId}`}
              preserveAspectRatio='xMidYMid meet'
            >
              <desc id={descriptionId}>
                Radial feeder from source to load with selectable protection relays, breaker states, configured fault locations, and the active current path.
              </desc>

              <g className='overcurrent-sld-source-symbol' aria-hidden='true'>
                <circle cx='52' cy={FEEDER_Y} r='23' />
                <path d={`M36 ${FEEDER_Y} q8 -13 16 0 t16 0`} />
              </g>
              <text className='overcurrent-sld-equipment-label' x='52' y='161' textAnchor='middle'>SOURCE</text>

              {feederSegments.map((segment) => (
                <line
                  key={`${segment.x1}:${segment.x2}`}
                  className='overcurrent-sld-feeder'
                  x1={segment.x1}
                  y1={FEEDER_Y}
                  x2={segment.x2}
                  y2={FEEDER_Y}
                />
              ))}
              {model.currentPathActive && (
                <line
                  className='overcurrent-sld-current-path'
                  x1={FEEDER_START_X}
                  y1={FEEDER_Y}
                  x2={currentPathEndX}
                  y2={FEEDER_Y}
                  pathLength='1'
                />
              )}

              {model.devices.map((device) => {
                const x = feederX(device.normalizedPosition);
                const breaker = breakerGeometry(device);
                return (
                  <g key={device.id} className='overcurrent-sld-device-geometry' aria-hidden='true'>
                    <polyline className='overcurrent-sld-breaker-wire' points={breaker.left} />
                    <polyline className='overcurrent-sld-breaker-wire' points={breaker.right} />
                    <polyline className='overcurrent-sld-breaker-blade' data-state={device.breakerState} points={breaker.blade} />
                    <circle className='overcurrent-sld-breaker-contact' cx={x - 8} cy={FEEDER_Y} r='2.8' />
                    <circle className='overcurrent-sld-breaker-contact' cx={x + 8} cy={FEEDER_Y} r='2.8' />
                    <circle className='overcurrent-sld-ct' cx={x + 25} cy={FEEDER_Y} r='10' />
                    <line className='overcurrent-sld-relay-lead' x1={x + 25} y1={FEEDER_Y + 10} x2={x + 25} y2='169' />
                  </g>
                );
              })}

              {model.faults.map((fault) => {
                const x = feederX(fault.normalizedPosition);
                return (
                  <g key={fault.id} aria-hidden='true'>
                    <line className='overcurrent-sld-fault-drop' data-active={fault.active} x1={x} y1={FEEDER_Y + 4} x2={x} y2='177' />
                    <path className='overcurrent-sld-fault-bolt' data-active={fault.active} d={`M${x + 5} 147 l-13 20 h10 l-8 18 20-25 h-10 z`} />
                  </g>
                );
              })}

              {model.activeFaultPosition !== null && (
                <circle className='overcurrent-sld-active-fault-ring' cx={feederX(model.activeFaultPosition)} cy={FEEDER_Y} r='17' />
              )}

              <g className='overcurrent-sld-load-symbol' aria-hidden='true'>
                <line x1={FEEDER_END_X} y1={FEEDER_Y} x2='946' y2={FEEDER_Y} />
                <rect x='946' y={FEEDER_Y - 21} width='34' height='42' />
                <path d={`M954 ${FEEDER_Y - 10} h18 M954 ${FEEDER_Y} h18 M954 ${FEEDER_Y + 10} h18`} />
              </g>
              <text className='overcurrent-sld-equipment-label' x='963' y='161' textAnchor='middle'>LOAD</text>
            </svg>

            <div className='overcurrent-sld-device-layer'>
              {model.devices.map((device) => (
                <button
                  key={device.id}
                  type='button'
                  className='overcurrent-sld-device'
                  data-selected={device.selected}
                  data-role={device.role}
                  data-breaker={device.breakerState}
                  style={{ left: `${device.normalizedPosition * 82.8 + 9.2}%` }}
                  aria-pressed={device.selected}
                  aria-label={`${device.label}, ${roleLabel(device)}, breaker ${device.breakerState.toLowerCase()}, ${device.primaryCurrentA === null ? 'current unavailable' : `${formatEngineeringNumber(device.primaryCurrentA)} amperes primary`}`}
                  onClick={() => selectDevice(device.id)}
                >
                  <span className='overcurrent-sld-device-id'>{device.label}</span>
                  <span className='overcurrent-sld-device-role'>{roleLabel(device)}</span>
                  <span className='overcurrent-sld-device-current font-eng'>
                    {device.primaryCurrentA === null ? '—' : formatEngineeringNumber(device.primaryCurrentA)} <small>A pri</small>
                  </span>
                  <span className='overcurrent-sld-device-state'>{deviceStatusLabel(device)}</span>
                </button>
              ))}
            </div>

            <div className='overcurrent-sld-fault-layer'>
              {model.faults.map((fault) => (
                <button
                  key={fault.id}
                  type='button'
                  className='overcurrent-sld-fault'
                  data-active={fault.active}
                  disabled={fault.selectableFaultCaseId === null || state.playbackState === 'RUNNING' || state.playbackState === 'PAUSED'}
                  style={{ left: `${fault.normalizedPosition * 82.8 + 9.2}%` }}
                  aria-pressed={fault.active}
                  aria-label={`${fault.label}${fault.active ? ', active fault location' : ''}`}
                  onClick={() => {
                    if (fault.selectableFaultCaseId) {
                      dispatch({ type: 'SELECT_FAULT_CASE', faultCaseId: fault.selectableFaultCaseId });
                    }
                  }}
                >
                  <span>{fault.id}</span>
                  <small>{fault.label}</small>
                </button>
              ))}
            </div>
            </div>
          </div>
          </div>

          {model.scrubber && (
            <label className='overcurrent-sld-scrubber'>
              <span>
                <b>Configured fault-location profile</b>
                <em className='font-eng'>{formatEngineeringNumber(model.scrubber.normalizedPosition * 100)} %</em>
              </span>
              <input
                type='range'
                min={model.scrubber.minPosition}
                max={model.scrubber.maxPosition}
                step='0.001'
                value={model.scrubber.normalizedPosition}
                disabled={state.playbackState === 'RUNNING' || state.playbackState === 'PAUSED'}
                aria-label={`${model.scrubber.label} position`}
                onChange={(event) => dispatch({
                  type: 'SET_FAULT_LOCATION_POSITION',
                  profileId: model.scrubber!.profileId,
                  normalizedPosition: Number(event.target.value),
                })}
              />

            </label>
          )}

          <div className='overcurrent-sld-legend' aria-label='SLD status legend'>
            <span><i data-tone='selected' /> Selected relay</span>
            <span><i data-tone='primary' /> Primary</span>
            <span><i data-tone='backup' /> Backup</span>
            <span><i data-tone='fault' /> Active fault</span>
            <span><i data-tone='open' /> Open breaker</span>
          </div>
        </>
      )}
    </section>
  );

  if (!expanded) return content;

  return (
    <EngineeringViewOverlay
      open={expanded}
      title='Single-Line Diagram'
      onClose={() => setExpanded(false)}
      returnFocusRef={expandButtonRef}
      className='engineering-view-overlay-sld'
    >
      {content}
    </EngineeringViewOverlay>
  );
}
