import { useMemo } from 'react';
import type { DistanceImpedanceResult, DistanceZoneSettings, DistanceLoadEncroachmentSettings } from '../../types/distance';

/**
 * R / X plane for the Distance Relay (D05).
 *
 * Pure presentation: drawing only. Reads pre-computed impedance and
 * per-zone settings; never recomputes relay math. Renders:
 *   - axis frame, gridlines, axis labels (R / X in Ω secondary);
 *   - per-zone mho circle (Zone 1 / 2 / 3);
 *   - load-encroachment line (when enabled);
 *   - apparent-impedance operating point with status color.
 *
 * Coordinate mapping is done in the same scale space used by
 * `isInsideMhoCharacteristic`; the circle is drawn via SVG `path`
 * arc commands so the diameter vector is exact and the rendering is
 * resolution-independent.
 *
 * Colors are read from CSS custom properties defined in index.css
 * so the diagram honours theme tokens. Uses only 1 accent color
 * (--sim-accent) + semantic colors (green/amber/red).
 */

const TOKEN = {
  accent: 'var(--sim-accent)',
  green: 'var(--sim-green)',
  amber: 'var(--sim-amber)',
  red: 'var(--sim-red)',
  textMuted: 'var(--sim-text-muted)',
  grid: 'var(--sim-border)',
  gridSubtle: 'var(--sim-grid-line)',
  surface: 'var(--sim-panel)',
} as const;

export interface RxPlaneProps {
  readonly impedance: DistanceImpedanceResult;
  readonly zone1: DistanceZoneSettings;
  readonly zone2: DistanceZoneSettings;
  readonly zone3: DistanceZoneSettings;
  readonly load: DistanceLoadEncroachmentSettings;
  /** True when the apparent impedance falls in the load region. */
  readonly loadRegion: boolean;
  /** R/X plane half-extent in secondary Ω. */
  readonly domainHalfOhm: number;
}

const GRID_DIVISIONS = 5;

interface ViewBox { x: number; y: number; size: number }

function makeViewBox(half: number): ViewBox {
  return { x: -half, y: -half, size: half * 2 };
}

function impedanceInDomain(
  impedance: DistanceImpedanceResult,
  half: number,
): { inDomain: boolean; rPlot: number; xPlot: number } {
  const inDomain =
    Number.isFinite(impedance.rOhmSecondary) &&
    Number.isFinite(impedance.xOhmSecondary) &&
    Math.abs(impedance.rOhmSecondary) <= half &&
    Math.abs(impedance.xOhmSecondary) <= half;
  return {
    inDomain,
    rPlot: Number.isFinite(impedance.rOhmSecondary) ? impedance.rOhmSecondary : 0,
    xPlot: Number.isFinite(impedance.xOhmSecondary) ? impedance.xOhmSecondary : 0,
  };
}

function mhoCirclePath(zone: DistanceZoneSettings, half: number): string {
  if (!zone.enabled) return '';
  const reach = zone.reachOhmSecondary;
  if (!Number.isFinite(reach) || reach <= 0) return '';
  const theta = (zone.thetaCharDeg * Math.PI) / 180;
  const r = reach / 2;
  // SVG arc: radius rx=ry=r, x-axis-rotation=0, large-arc=0, sweep=1.
  // The diameter endpoints are (0, 0) and (reach*cosθ, reach*sinθ).
  const x0 = 0;
  const y0 = 0;
  const x1 = reach * Math.cos(theta);
  const y1 = reach * Math.sin(theta);
  // Clamp the endpoints to the visible domain so off-reach circles still
  // render at least their visible portion.
  const clamp = (v: number) => Math.max(-half, Math.min(half, v));
  const sx0 = clamp(x0);
  const sy0 = clamp(y0);
  const sx1 = clamp(x1);
  const sy1 = clamp(y1);
  return `M ${sx0} ${-sy0} A ${r} ${r} 0 0 1 ${sx1} ${-sy1}`;
}

function loadLineEndpoints(load: DistanceLoadEncroachmentSettings, half: number): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!load.enabled) return null;
  if (!Number.isFinite(load.thetaLoadDeg) || load.thetaLoadDeg < 0 || load.thetaLoadDeg > 90) return null;
  const slope = Math.tan((load.thetaLoadDeg * Math.PI) / 180);
  if (!Number.isFinite(slope)) return null;
  // Line through origin with slope `m_load`. Endpoint at the right edge of
  // the visible domain: x = half, y = slope · half.
  return { x0: -half, y0: -slope * half, x1: half, y1: slope * half };
}

export function RxPlane({ impedance, zone1, zone2, zone3, load, loadRegion, domainHalfOhm }: RxPlaneProps) {
  const viewBox = useMemo(() => makeViewBox(domainHalfOhm), [domainHalfOhm]);
  const point = useMemo(() => impedanceInDomain(impedance, domainHalfOhm), [impedance, domainHalfOhm]);

  const z1Path = useMemo(() => mhoCirclePath(zone1, domainHalfOhm), [zone1, domainHalfOhm]);
  const z2Path = useMemo(() => mhoCirclePath(zone2, domainHalfOhm), [zone2, domainHalfOhm]);
  const z3Path = useMemo(() => mhoCirclePath(zone3, domainHalfOhm), [zone3, domainHalfOhm]);
  const loadLine = useMemo(() => loadLineEndpoints(load, domainHalfOhm), [load, domainHalfOhm]);

  const pointColor = loadRegion ? TOKEN.amber : (Number.isFinite(impedance.rOhmSecondary) ? TOKEN.accent : TOKEN.textMuted);

  // Gridline positions and labels.
  const gridStep = viewBox.size / GRID_DIVISIONS;
  const gridlines: number[] = [];
  for (let i = 0; i <= GRID_DIVISIONS; i++) gridlines.push(viewBox.x + i * gridStep);

  return (
    <div className='rx-plane flex h-full w-full flex-col gap-2'>
      <div className='flex items-center justify-between text-[11px] text-[color:var(--sim-text-muted)]'>
        <span>R / X Plane (Ω secondary)</span>
        <span>Domain: ±{domainHalfOhm} Ω</span>
      </div>
      <div className='relative flex-1 overflow-hidden rounded border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)]'>
        <svg
          viewBox={`${viewBox.x - 0.1} ${viewBox.y - 0.1} ${viewBox.size + 0.2} ${viewBox.size + 0.2}`}
          preserveAspectRatio='xMidYMid meet'
          className='block h-full w-full'
        >
          {/* Gridlines */}
          {gridlines.map((g) => (
            <line key={`v${g.toFixed(2)}`} x1={g} y1={viewBox.y} x2={g} y2={viewBox.y + viewBox.size} stroke={TOKEN.gridSubtle} strokeWidth={0.04} />
          ))}
          {gridlines.map((g) => (
            <line key={`h${g.toFixed(2)}`} x1={viewBox.x} y1={g} x2={viewBox.x + viewBox.size} y2={g} stroke={TOKEN.gridSubtle} strokeWidth={0.04} />
          ))}
          {/* Axes */}
          <line x1={viewBox.x} y1={0} x2={viewBox.x + viewBox.size} y2={0} stroke={TOKEN.grid} strokeWidth={0.06} />
          <line x1={0} y1={viewBox.y} x2={0} y2={viewBox.y + viewBox.size} stroke={TOKEN.grid} strokeWidth={0.06} />
          {/* Axis labels */}
          <text x={viewBox.x + viewBox.size - 0.6} y={-0.3} fontSize={0.5} fill={TOKEN.textMuted} textAnchor='end'>R (Ω sec)</text>
          <text x={0.3} y={viewBox.y + 0.6} fontSize={0.5} fill={TOKEN.textMuted}>X (Ω sec)</text>

          {/* Load-encroachment line */}
          {loadLine && (
            <line
              x1={loadLine.x0}
              y1={-loadLine.y0}
              x2={loadLine.x1}
              y2={-loadLine.y1}
              stroke={TOKEN.amber}
              strokeWidth={0.08}
              strokeDasharray='0.4 0.3'
              opacity={0.7}
            />
          )}

          {/* Mho circles: Z3 (dash), Z2 (dash-dot), Z1 (solid) — differentiated by pattern, not multiple random colors */}
          {z3Path && <path d={z3Path} fill='none' stroke={TOKEN.textMuted} strokeWidth={0.08} strokeDasharray='0.3 0.2' opacity={0.6} />}
          {z2Path && <path d={z2Path} fill='none' stroke={TOKEN.accent} strokeWidth={0.10} strokeDasharray='0.6 0.3' opacity={0.7} />}
          {z1Path && <path d={z1Path} fill='none' stroke={TOKEN.green} strokeWidth={0.12} opacity={0.85} />}

          {/* Apparent-impedance operating point */}
          {point.inDomain && (
            <g>
              <circle cx={point.rPlot} cy={-point.xPlot} r={0.45} fill={pointColor} fillOpacity={0.18} />
              <circle cx={point.rPlot} cy={-point.xPlot} r={0.18} fill={pointColor} />
            </g>
          )}

          {!point.inDomain && (
            <text x={viewBox.x + viewBox.size - 0.4} y={viewBox.y + 0.6} fontSize={0.5} fill={TOKEN.amber} textAnchor='end'>OFF-SCALE</text>
          )}
        </svg>
        <div className='absolute bottom-1 right-2 text-[10px] text-[color:var(--sim-text-muted)]'>
          Z1 (solid) <span className='text-[color:var(--sim-green)]'>●</span> Z2 (dash) <span className='text-[color:var(--sim-accent)]'>●</span> Z3 (dot) <span className='text-[color:var(--sim-text-muted)]'>●</span>
        </div>
      </div>
    </div>
  );
}
