import { useMemo } from 'react';
import type { DistanceDisplayStatus, DistanceZoneId } from '../../types/distance';

/**
 * Distance Relay one-line / SLD (D04).
 *
 * Pure-presentation SVG: the diagram reads a normalized fault position
 * (0–100 %), an optional trip zone, and the display status. It never
 * recomputes relay math. The fault marker color follows the display
 * status (green = RESTRAIN, red = OPERATE, amber = INVALID / load).
 *
 * Colors are read from CSS custom properties defined in index.css
 * so the diagram honours theme tokens (--sim-accent, --sim-green,
 * --sim-amber, --sim-red, --sim-text-muted, --sim-grid, --sim-bg).
 */

export interface DistanceOneLineProps {
  readonly faultPct: number; // 0 = local bus, 100 = remote bus
  readonly tripZone: DistanceZoneId | null;
  readonly displayStatus: DistanceDisplayStatus;
  readonly loadRegion: boolean;
  readonly lineLengthKm: number;
  readonly systemKv: number;
  readonly className?: string;
}

const VIEW_W = 720;
const VIEW_H = 220;
const PADDING_X = 80;
const BUS_Y = VIEW_H / 2;

const TOKEN = {
  accent: 'var(--sim-accent)',
  green: 'var(--sim-green)',
  amber: 'var(--sim-amber)',
  red: 'var(--sim-red)',
  textMuted: 'var(--sim-text-muted)',
  grid: 'var(--sim-border)',
  surface: 'var(--sim-panel)',
} as const;

function faultColor(status: DistanceDisplayStatus, loadRegion: boolean): string {
  if (loadRegion) return TOKEN.amber;
  if (status === 'OPERATE') return TOKEN.red;
  if (status === 'INVALID') return TOKEN.amber;
  return TOKEN.green;
}

export function DistanceOneLine({ faultPct, tripZone, displayStatus, loadRegion, lineLengthKm, systemKv, className }: DistanceOneLineProps) {
  const clampedPct = Math.min(100, Math.max(0, faultPct));
  const xStart = PADDING_X;
  const xEnd = VIEW_W - PADDING_X;
  const xFault = xStart + ((xEnd - xStart) * clampedPct) / 100;
  const color = useMemo(() => faultColor(displayStatus, loadRegion), [displayStatus, loadRegion]);
  const tripBadge = tripZone ? `Z${tripZone.charAt(1)} TRIP` : null;

  return (
    <div className={className ?? 'flex w-full flex-col gap-2'}>
      <div className='flex items-center justify-between text-[11px] text-[color:var(--sim-text-muted)]'>
        <span>Single-line Diagram (D04)</span>
        <span>{lineLengthKm.toFixed(0)} km · {systemKv.toFixed(0)} kV</span>
      </div>
      <div className='relative overflow-hidden rounded border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)]'>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio='xMidYMid meet' className='block h-44 w-full'>
          {/* Local bus */}
          <line x1={xStart} y1={BUS_Y - 18} x2={xStart} y2={BUS_Y + 18} stroke={TOKEN.textMuted} strokeWidth={2} />
          <text x={xStart} y={BUS_Y + 38} fontSize={11} fill={TOKEN.textMuted} textAnchor='middle'>Local bus</text>

          {/* Remote bus */}
          <line x1={xEnd} y1={BUS_Y - 18} x2={xEnd} y2={BUS_Y + 18} stroke={TOKEN.textMuted} strokeWidth={2} />
          <text x={xEnd} y={BUS_Y + 38} fontSize={11} fill={TOKEN.textMuted} textAnchor='middle'>Remote bus</text>

          {/* Transmission line */}
          <line x1={xStart} y1={BUS_Y} x2={xEnd} y2={BUS_Y} stroke={TOKEN.accent} strokeWidth={1.5} />
          {/* Tower markers */}
          {Array.from({ length: 5 }).map((_, i) => {
            const t = (i + 1) / 6;
            const x = xStart + (xEnd - xStart) * t;
            return <line key={i} x1={x} y1={BUS_Y - 6} x2={x} y2={BUS_Y + 6} stroke={TOKEN.accent} strokeWidth={1} />;
          })}

          {/* Relay symbol at local bus */}
          <rect x={xStart - 28} y={BUS_Y - 40} width={28} height={20} fill='none' stroke={TOKEN.green} strokeWidth={1.2} />
          <text x={xStart - 14} y={BUS_Y - 26} fontSize={10} fill={TOKEN.green} textAnchor='middle'>21</text>

          {/* Breaker at local bus */}
          <rect x={xStart + 4} y={BUS_Y - 4} width={10} height={8} fill='none' stroke={TOKEN.textMuted} strokeWidth={1.2} />
          <circle cx={xStart + 9} cy={BUS_Y} r={1.5} fill={TOKEN.textMuted} />

          {/* Fault marker */}
          <g>
            <line x1={xFault} y1={BUS_Y - 30} x2={xFault} y2={BUS_Y + 30} stroke={color} strokeWidth={1.4} strokeDasharray='3 3' />
            <circle cx={xFault} cy={BUS_Y} r={5} fill={color} />
            <text x={xFault} y={BUS_Y - 36} fontSize={10} fill={color} textAnchor='middle'>{clampedPct.toFixed(0)}%</text>
          </g>

          {/* Trip badge */}
          {tripBadge && (
            <g>
              <rect x={xStart - 70} y={12} width={70} height={20} fill={color} rx={2} />
              <text x={xStart - 35} y={26} fontSize={11} fill={TOKEN.surface} fontWeight={700} textAnchor='middle'>{tripBadge}</text>
            </g>
          )}

          {/* Display status text */}
          <text x={VIEW_W / 2} y={28} fontSize={12} fill={color} textAnchor='middle' fontWeight={600}>
            {loadRegion ? 'LOAD ENCROACHMENT' : displayStatus}
          </text>
        </svg>
      </div>
    </div>
  );
}
