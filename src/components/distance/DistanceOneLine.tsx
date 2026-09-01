import { memo, type FC } from 'react';
import { buildSldLayout, topologyLabel, schemeLabel } from '../../presentation/distancePresentation';
import type { DistanceStudyDefinition } from '../../types/distance';
import './distanceOneLine.css';

export interface DistanceOneLineProps {
  readonly study: DistanceStudyDefinition;
  readonly className?: string;
}

const DISTANCE_VIEWBOX_W = 640;
const DISTANCE_VIEWBOX_H = 260;
const BUS_Y = 130;
const BUS_LEFT_X = 80;
const BUS_RIGHT_X = 560;

function busX(xNorm: number): number {
  return BUS_LEFT_X + (BUS_RIGHT_X - BUS_LEFT_X) * xNorm;
}

export const DistanceOneLine: FC<DistanceOneLineProps> = memo(function DistanceOneLine({
  study,
  className = '',
}: DistanceOneLineProps) {
  const layout = buildSldLayout(study.topology, study.scheme);
  const lineLengthKm = layout.lines[0]?.lengthKm ?? 0;
  const relayCount = layout.relays.length;

  return (
    <section className={`distance-sld simulator-theme ${className}`.trim()} aria-label='Single-line diagram'>
      <div className='distance-sld-header'>
        <div>
          <span className='distance-sld-kicker'>Topology · single-line diagram</span>
          <h3 className='distance-sld-title'>{topologyLabel(layout.topology)}</h3>
        </div>
        <div className='distance-sld-meta'>
          <span className='distance-sld-line-meta'>{lineLengthKm} km line</span>
          <span className='distance-sld-scheme-meta'>{schemeLabel(study.scheme)}</span>
          <span className='distance-sld-ct-meta'>
            {study.settings.ct.primaryRatedA}:{study.settings.ct.secondaryRatedA} CT · {study.settings.vt.primaryRatedKv} kV VT
          </span>
        </div>
      </div>

      <div className='distance-sld-canvas'>
        <svg
          width={DISTANCE_VIEWBOX_W}
          height={DISTANCE_VIEWBOX_H}
          viewBox={`0 0 ${DISTANCE_VIEWBOX_W} ${DISTANCE_VIEWBOX_H}`}
          role='img'
          aria-label={`${topologyLabel(layout.topology)} — ${study.scheme === 'NONE' ? 'direct tripping, no teleprotection' : schemeLabel(study.scheme)}`}
        >
          {layout.lines.map((line) => {
            const from = layout.buses.find((b) => b.id === line.fromBusId);
            const to = layout.buses.find((b) => b.id === line.toBusId);
            if (!from || !to) return null;
            const x1 = busX(from.xNorm);
            const x2 = busX(to.xNorm);
            const midX = (x1 + x2) / 2;
            return (
              <g key={line.id} className='distance-sld-line' aria-hidden='true'>
                <line x1={x1} y1={BUS_Y} x2={x2} y2={BUS_Y} />
                <text className='distance-sld-line-label' x={midX} y={BUS_Y - 10} textAnchor='middle'>
                  {line.lengthKm} km
                </text>
              </g>
            );
          })}

          {layout.tappedLoads.map((load) => {
            const x = busX(load.xNorm);
            return (
              <g key={load.busId} className='distance-sld-tapped' aria-hidden='true'>
                <line x1={x} y1={BUS_Y} x2={x} y2={BUS_Y + 42} />
                <rect x={x - 16} y={BUS_Y + 42} width='32' height='26' rx='3' />
                <path
                  className='distance-sld-tapped-arrow'
                  d={`M${x - 7} ${BUS_Y + 56} h14 M${x} ${BUS_Y + 51} l-7 5 h14 z`}
                />
                <text className='distance-sld-tapped-label' x={x} y={BUS_Y + 84} textAnchor='middle'>
                  {load.label}
                </text>
              </g>
            );
          })}

          {layout.buses.map((bus) => {
            const x = busX(bus.xNorm);
            return (
              <g key={bus.id} className='distance-sld-bus' aria-hidden='true'>
                <rect x={x - 16} y={BUS_Y - 16} width='32' height='32' rx='4' />
                <line x1={x - 22} y1={BUS_Y} x2={x + 22} y2={BUS_Y} />
                <line x1={x} y1={BUS_Y - 22} x2={x} y2={BUS_Y + 22} />
                <text className='distance-sld-bus-label' x={x} y={BUS_Y + 44} textAnchor='middle'>
                  {bus.label}
                </text>
              </g>
            );
          })}

          {layout.schemeLink && (
            <g className='distance-sld-scheme-link' aria-hidden='true'>
              <line
                x1={busX(layout.relays[0].xNorm)}
                y1={BUS_Y - 34}
                x2={busX(layout.relays[relayCount - 1].xNorm)}
                y2={BUS_Y - 34}
                strokeDasharray='4 4'
              />
              <text
                className='distance-sld-scheme-label'
                x={(busX(layout.relays[0].xNorm) + busX(layout.relays[relayCount - 1].xNorm)) / 2}
                y={BUS_Y - 42}
                textAnchor='middle'
              >
                {layout.schemeLink.scheme}
              </text>
            </g>
          )}

          {layout.relays.map((relay) => {
            const x = busX(relay.xNorm);
            const y = BUS_Y + (relay.facing === 'forward' ? -34 : 34);
            return (
              <g key={relay.id} className='distance-sld-relay' aria-hidden='true'>
                <line x1={x} y1={BUS_Y} x2={x} y2={y} />
                <circle cx={x} cy={y} r='13' />
                <text className='distance-sld-relay-label' x={x} y={y + 4} textAnchor='middle'>
                  {relay.label}
                </text>
                <text className='distance-sld-relay-facing' x={x} y={y + (relay.facing === 'forward' ? -18 : 26)} textAnchor='middle'>
                  {relay.facing === 'forward' ? 'FWD' : 'REV'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
});
