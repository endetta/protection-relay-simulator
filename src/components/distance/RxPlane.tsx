import { memo, type FC } from 'react';
import { buildRxPlaneLayout } from '../../presentation/distancePresentation';
import type { RxZonePath } from '../../presentation/distancePresentation';
import type { DistanceOperatingResult, DistanceStudyDefinition } from '../../types/distance';
import './rxPlane.css';

export interface RxPlaneProps {
  readonly study: DistanceStudyDefinition;
  readonly result: DistanceOperatingResult;
  readonly className?: string;
}

/** Viewport is a square R/X plane scaled to the active impedance. */
const DOMAIN_HALF_OHM = 50;

export const RxPlane: FC<RxPlaneProps> = memo(function RxPlane({ study, result, className = '' }: RxPlaneProps) {
  const layout = buildRxPlaneLayout(result, study.settings, DOMAIN_HALF_OHM);

  return (
    <section className={`distance-rx simulator-theme ${className}`.trim()} aria-label='Impedance plane'>
      <div className='distance-rx-header'>
        <span className='distance-rx-kicker'>R-X Plane · impedance locus</span>
        <h3 className='distance-rx-title'>Apparent impedance</h3>
      </div>

      <div className='distance-rx-canvas'>
        <svg
          width={520}
          height={460}
          viewBox={`-${DOMAIN_HALF_OHM + 12} -${DOMAIN_HALF_OHM + 8} ${DOMAIN_HALF_OHM * 2 + 24} ${DOMAIN_HALF_OHM * 2 + 16}`}
          role='img'
          aria-label='R-X impedance plane with zone characteristics'
        >
          {gridLines()}
          {axes(DOMAIN_HALF_OHM)}
          {renderZones(layout.zones)}
          {renderLoadRegion(layout.loadLine)}
          {renderFaultPoint(layout.faultPoint, result.displayStatus)}
          {renderTrajectory(layout.trajectory)}
          {renderPreFault(layout.preFaultPoint)}
        </svg>
      </div>
    </section>
  );
});

function gridLines(): JSX.Element {
  const lines: JSX.Element[] = [];
  const step = 10;
  for (let i = -DOMAIN_HALF_OHM; i <= DOMAIN_HALF_OHM; i += step) {
    lines.push(<line key={`v-${i}`} x1={i} y1={-DOMAIN_HALF_OHM} x2={i} y2={DOMAIN_HALF_OHM} className='distance-rx-grid' />);
    lines.push(<line key={`h-${i}`} x1={-DOMAIN_HALF_OHM} y1={i} x2={DOMAIN_HALF_OHM} y2={i} className='distance-rx-grid' />);
  }
  return <g aria-hidden='true'>{lines}</g>;
}

function axes(halfOhm: number): JSX.Element {
  const R = halfOhm + 8;
  const X = halfOhm + 8;
  const Arrow = (props: { x1: number; y1: number; x2: number; y2: number }) => (
    <line x1={props.x1} y1={props.y1} x2={props.x2} y2={props.y2} className='distance-rx-axis-arrow' />
  );
  return (
    <g className='distance-rx-axes' aria-hidden='true'>
      <line x1={-R} y1={0} x2={R} y2={0} className='distance-rx-axis-r' />
      <line x1={0} y1={-X} x2={0} y2={X} className='distance-rx-axis-x' />
      <text className='distance-rx-axis-label' x={R - 2} y='14' textAnchor='end'>
        R
      </text>
      <text className='distance-rx-axis-label' x='-2' y={-X + 6} textAnchor='end'>
        X
      </text>
      <Arrow x1={R} y1={0} x2={R - 4} y2={3} />
      <Arrow x1={R} y1={0} x2={R - 4} y2={-3} />
      <Arrow x1={0} y1={-X} x2={3} y2={-X + 4} />
      <Arrow x1={0} y1={-X} x2={-3} y2={-X + 4} />
      <text className='distance-rx-axis-scale' x={-halfOhm} y={halfOhm - 4} textAnchor='start'>
        grid = 10 Ω
      </text>
      <text className='distance-rx-axis-scale' x={halfOhm} y='-6' textAnchor='end'>
        {halfOhm} Ω
      </text>
    </g>
  );
}

function renderZones(zones: readonly RxZonePath[]): JSX.Element {
  return (
    <g className='distance-rx-zones' aria-hidden='true'>
      {zones.map((zone) => {
        const dash = zone.strokePattern === 'dashed' ? '6 4' : zone.strokePattern === 'dotted' ? '2 4' : undefined;
        return zone.pathD ? (
          <path
            key={zone.zoneId}
            className='distance-rx-zone-path'
            d={zone.pathD}
            stroke={zone.strokeColor}
            strokeWidth='1.5'
            fill='none'
            strokeDasharray={dash}
            style={{ opacity: zone.opacity }}
            data-zone={zone.zoneId}
          />
        ) : null;
      })}
    </g>
  );
}

function renderLoadRegion(loadLine: { enabled: boolean; slopePath: string; rMinPath: string } | null): JSX.Element | null {
  if (!loadLine || !loadLine.enabled) return null;
  return (
    <g className='distance-rx-load-region' aria-hidden='true'>
      {loadLine.slopePath ? (
        <path d={loadLine.slopePath} className='distance-rx-load-slope' strokeWidth='1' fill='none' />
      ) : null}
      {loadLine.rMinPath ? (
        <path d={loadLine.rMinPath} className='distance-rx-load-rmin' strokeWidth='1' fill='none' />
      ) : null}
    </g>
  );
}

function renderFaultPoint(point: { r: number; x: number; inDomain: boolean; fillColor: string }, status: DistanceOperatingResult['displayStatus']): JSX.Element {
  const tone = status === 'OPERATE' ? 'operate' : status === 'INVALID' ? 'invalid' : 'restrain';
  const cx = point.r;
  const cy = -point.x;
  return (
    <g className='distance-rx-fault-point' aria-hidden='true' data-tone={tone} data-in-domain={point.inDomain}>
      <circle cx={cx} cy={cy} r='5' fill={point.fillColor} stroke='white' strokeWidth='1.5' />
      <text className='distance-rx-point-label' x={cx + 8} y={cy - 8}>
        Fault
      </text>
    </g>
  );
}

function renderTrajectory(_trajectory: { pathD: string; strokeColor: string } | null): JSX.Element | null {
  if (!_trajectory || !_trajectory.pathD) return null;
  return <path d={_trajectory.pathD} className='distance-rx-trajectory' fill='none' strokeWidth='1.5' />;
}

function renderPreFault(_pre: { r: number; x: number; fillColor: string } | null): JSX.Element | null {
  if (!_pre) return null;
  return (
    <g className='distance-rx-prefault' aria-hidden='true'>
      <circle cx={_pre.r} cy={-_pre.x} r='3' fill={_pre.fillColor} />
    </g>
  );
}