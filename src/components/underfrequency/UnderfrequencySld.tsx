import { useId, type CSSProperties } from 'react';
import type { UnderfrequencySldModel } from '../../presentation/underfrequencySld';
import { formatEngineeringNumber, formatFrequencyHz } from '../../utils/engineering';
import './underfrequencySld.css';

export interface UnderfrequencySldProps {
  /** Built by the page via buildUnderfrequencySldModel (memoised per snapshot). */
  readonly model: UnderfrequencySldModel;
  readonly className?: string;
}

// ───────────────────────────── Layout constants ──────────────────────────────
// Fixed viewBox; the SVG scales via CSS. ~50 SVG nodes, transitions in CSS.

const W = 560;
const H = 320;

// Generator bays (4 columns)
const GEN_Y = 18;
const GEN_H = 96;
const GEN_W = 104;
const GEN_GAP = 24;
const GEN_X0 = (W - 4 * GEN_W - 3 * GEN_GAP) / 2; // centre 4 bays

// Bus bar
const BUS_Y = GEN_Y + GEN_H + 42;
const BUS_X0 = 84;
const BUS_X1 = W - 84;

// Feeder breakers + load blocks
const FEEDER_Y = BUS_Y + 56;
const BLOCK_W = 104;
const BLOCK_H = 58;
const BLOCK_GAP = 24;
const BLOCK_X0 = GEN_X0; // align with the generator columns

/** Lowercase form of a generator status for data-status attributes. */
function genDataStatus(status: UnderfrequencySldModel['generators'][number]['status']): string {
  switch (status) {
    case 'TRIPPED': return 'tripped';
    case 'AT_GOVERNOR_LIMIT': return 'limit';
    default: return 'online';
  }
}

export function UnderfrequencySld({ model, className = '' }: UnderfrequencySldProps) {
  const titleId = useId();
  const clipId = `sld-clip-${titleId.replace(/:/g, '')}`;

  // Bus readout strings — tabular-nums via CSS class font-eng, so 60fps
  // snapshot updates don't jitter the layout.
  const fNow = formatFrequencyHz(model.bus.frequencyHz);
  const rocof = `${model.bus.rocofHzPerSec >= 0 ? '+' : '−'}${formatEngineeringNumber(Math.abs(model.bus.rocofHzPerSec))}`;
  const deficit = formatEngineeringNumber(model.bus.deficitMw);
  const genX = (index: number) => GEN_X0 + index * (GEN_W + GEN_GAP);
  const blockX = (index: number) => BLOCK_X0 + index * (BLOCK_W + BLOCK_GAP);

  return (
    <section
      className={`underfrequency-sld simulator-theme ${className}`.trim()}
      aria-label='Diagram satu garis sistem underfrequency'
      role='status'
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio='xMidYMid meet'
        role='img'
        aria-labelledby={`${titleId}-plot`}
        className='underfrequency-sld-svg'
      >
        <title id={`${titleId}-plot`}>
          Diagram satu garis: generator, bus frekuensi, dan blok beban UFLS.
        </title>
        <defs>
          <clipPath id={clipId}>
            <rect x='0' y='0' width={W} height={H} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* ─────────── Generator bays ─────────── */}
          {model.generators.map((gen, index) => {
            const x = genX(index);
            const dataStatus = genDataStatus(gen.status);
            const outputFrac = gen.mwRated > 0
              ? Math.min(1, Math.max(0, gen.outputMw / gen.mwRated))
              : 0;
            const respFrac = gen.headroomMw + gen.governorResponseMw > 0
              ? Math.min(1, Math.max(0, gen.governorResponseMw / (gen.headroomMw + gen.governorResponseMw)))
              : 0;

            return (
              <g key={gen.generatorId} data-gen={gen.generatorId} data-status={dataStatus} className='underfrequency-sld-gen'>
                <rect
                  className='underfrequency-sld-gen-frame'
                  x={x}
                  y={GEN_Y}
                  width={GEN_W}
                  height={GEN_H}
                  rx='6'
                />
                <circle
                  className='underfrequency-sld-gen-symbol'
                  cx={x + GEN_W / 2}
                  cy={GEN_Y + 26}
                  r='16'
                />
                <text className='underfrequency-sld-gen-symbol-g font-eng' x={x + GEN_W / 2} y={GEN_Y + 30} textAnchor='middle'>
                  {gen.generatorId}
                </text>
                <rect className='underfrequency-sld-gen-track' x={x + 12} y={GEN_Y + 50} width={GEN_W - 24} height={6} rx='3' />
                <rect
                  className='underfrequency-sld-gen-fill'
                  style={{ '--fill': `${outputFrac}` } as unknown as CSSProperties}
                  x={x + 12}
                  y={GEN_Y + 50}
                  width={GEN_W - 24}
                  height={6}
                  rx='3'
                />
                <rect className='underfrequency-sld-gen-track' x={x + 12} y={GEN_Y + 62} width={GEN_W - 24} height={4} rx='2' />
                <rect
                  className='underfrequency-sld-gen-resp'
                  style={{ '--fill': `${respFrac}` } as unknown as CSSProperties}
                  x={x + 12}
                  y={GEN_Y + 62}
                  width={GEN_W - 24}
                  height={4}
                  rx='2'
                />
                <text className='underfrequency-sld-gen-mw font-eng' x={x + GEN_W / 2} y={GEN_Y + 84} textAnchor='middle'>
                  {formatEngineeringNumber(gen.outputMw)} MW
                </text>
                <text className='underfrequency-sld-gen-rpm font-eng' x={x + GEN_W / 2} y={GEN_Y + 97} textAnchor='middle'>
                  {formatEngineeringNumber(gen.rpm)} rpm
                </text>
                <text className='underfrequency-sld-gen-chip' data-status={dataStatus} x={x + GEN_W / 2} y={GEN_Y - 6} textAnchor='middle'>
                  {gen.status === 'TRIPPED' ? 'TRIPPED' : gen.status === 'AT_GOVERNOR_LIMIT' ? 'AT LIMIT' : 'ONLINE'}
                </text>
                <line
                  className='underfrequency-sld-tie'
                  x1={x + GEN_W / 2}
                  y1={GEN_Y + GEN_H}
                  x2={x + GEN_W / 2}
                  y2={BUS_Y}
                />
              </g>
            );
          })}

          {/* ─────────── Bus bar ─────────── */}
          <g className='underfrequency-sld-bus' data-tone={model.bus.tone}>
            <rect className='underfrequency-sld-bus-bar' x={BUS_X0} y={BUS_Y} width={BUS_X1 - BUS_X0} height={10} rx='2' />
            <text className='underfrequency-sld-bus-freq font-eng' x={W / 2} y={BUS_Y + 34} textAnchor='middle'>
              {fNow} Hz
            </text>
            <text className='underfrequency-sld-bus-sub font-eng' x={W / 2} y={BUS_Y + 52} textAnchor='middle'>
              df/dt {rocof} Hz/s · defisit {deficit} MW
            </text>
            {model.bus.collapse && (
              <text className='underfrequency-sld-bus-collapse' x={W / 2} y={BUS_Y + 70} textAnchor='middle'>
                COLLAPSE
              </text>
            )}
          </g>

          {/* ─────────── Feeder breakers + load blocks ─────────── */}
          {model.blocks.map((block, index) => {
            const x = blockX(index);
            const busDropY = FEEDER_Y - 14;
            return (
              <g
                key={block.id}
                data-block={block.id}
                data-status={block.shed ? 'SHED' : 'energized'}
                data-critical={block.critical || undefined}
                className='underfrequency-sld-block'
              >
                <line className='underfrequency-sld-feeder' x1={x + BLOCK_W / 2} y1={BUS_Y + 10} x2={x + BLOCK_W / 2} y2={busDropY} />
                <g className='underfrequency-sld-breaker' data-open={block.shed ? 'true' : 'false'}>
                  <rect className='underfrequency-sld-breaker-terminal' x={x + BLOCK_W / 2 - 9} y={busDropY} width='4' height='4' />
                  <rect className='underfrequency-sld-breaker-terminal' x={x + BLOCK_W / 2 + 5} y={busDropY} width='4' height='4' />
                  <line className='underfrequency-sld-breaker-blade' x1={x + BLOCK_W / 2 - 5} y1={busDropY + 2} x2={x + BLOCK_W / 2 + 5} y2={busDropY + 2} />
                </g>
                <rect className='underfrequency-sld-block-frame' x={x} y={FEEDER_Y} width={BLOCK_W} height={BLOCK_H} rx='6' />
                <text className='underfrequency-sld-block-id' x={x + 10} y={FEEDER_Y + 20}>
                  {block.id}
                  {block.critical && <tspan className='underfrequency-sld-block-critical'> ★</tspan>}
                </text>
                <text className='underfrequency-sld-block-mw font-eng' x={x + 10} y={FEEDER_Y + 38}>
                  {formatEngineeringNumber(block.baseMw)} MW · {block.fractionPct.toFixed(0)}%
                </text>
                {block.shed && (
                  <text className='underfrequency-sld-block-shedchip' x={x + 10} y={FEEDER_Y + 52}>
                    SHED
                  </text>
                )}
              </g>
            );
          })}

          {/* Unserved MW overflow note (D8) */}
          {model.bus.unservedMw > 0 && (
            <text className='underfrequency-sld-unserved' x={W / 2} y={H - 6} textAnchor='middle'>
              UNSERVED {formatEngineeringNumber(model.bus.unservedMw)} MW — beban melebihi kapasitas shed A+B+C
            </text>
          )}
        </g>
      </svg>
    </section>
  );
}
