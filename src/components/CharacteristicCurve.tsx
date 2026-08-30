import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { CurveDataTooltip, type CurveTooltipTone } from './shared/CurveDataTooltip';
import { operateLimit, type DifferentialSettings } from '../engines/differential';
import type { DifferentialDisplayStatus } from '../types/simulator';
import { formatEngineeringNumber } from '../utils/engineering';

interface Props {
  iDiff: number;
  iBias: number;
  iOpLimit: number;
  status: DifferentialDisplayStatus;
  settings: DifferentialSettings;
  prev?: { x: number; y: number } | null;
  highlighted?: boolean;
}

type ViewMode = 'characteristic' | 'fit-point';

interface SegmentMeta {
  key: string;
  title: string;
  primaryLabel: string;
  primaryValue: string;
  startBiasText: string;
  endBiasText: string;
  startThresholdText: string;
  endThresholdText: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface HoverPointer {
  clientX: number;
  clientY: number;
  localXRatio: number;
  localYRatio: number;
}

interface HoveredSegment extends SegmentMeta, HoverPointer {}
interface HoveredPoint extends HoverPointer {}

interface TooltipPosition {
  left: number;
  top: number;
}

function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const steps = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7.5, 8, 10];
  const selected = steps.find((step) => n <= step) ?? 10;
  return selected * base;
}

function niceAxisMax(rawMax: number, min: number, sections = 4): number {
  if (!Number.isFinite(rawMax) || rawMax <= min) return min;
  const step = niceStep(rawMax / sections);
  return Math.max(min, step * sections);
}

const W = 640;
const H = 380;
const mL = 54;
const mR = 18;
const mT = 20;
const mB = 42;
const pw = W - mL - mR;
const ph = H - mT - mB;
const VIEWPORT_GAP = 8;
const TOOLTIP_GAP = 16;


function formatCurveTooltipNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs < 1 ? 3 : abs < 10 ? 3 : 2;
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

export function CharacteristicCurve({ iDiff, iBias, iOpLimit, status, settings, prev, highlighted = false }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('characteristic');
  const [hoveredSegment, setHoveredSegment] = useState<HoveredSegment | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [pinnedSegmentKey, setPinnedSegmentKey] = useState<string | null>(null);
  const [pointPinned, setPointPinned] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ left: VIEWPORT_GAP, top: VIEWPORT_GAP });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hoverFrameRef = useRef<number | null>(null);

  const scale = useMemo(() => {
    const finalBreakpoint = settings.characteristicMode === 'multi' ? settings.biasBreakpoint3 : settings.biasBreakpoint2;
    const characteristicXRaw = Math.max(2, finalBreakpoint + Math.max(0.75, finalBreakpoint * 0.2));
    const characteristicX = niceAxisMax(characteristicXRaw, 2);
    const characteristicYRaw = Math.max(
      0.75,
      settings.iSet * 1.18,
      operateLimit(characteristicX, settings) * 1.14,
      operateLimit(finalBreakpoint, settings) * 1.18,
    );
    const characteristicY = niceAxisMax(characteristicYRaw, 1);

    if (viewMode === 'characteristic') return { xMax: characteristicX, yMax: characteristicY };

    const xBasis = Math.max(characteristicX, iBias, prev?.x ?? 0);
    const xMax = niceAxisMax(xBasis * 1.1, characteristicX);
    const yBasis = Math.max(characteristicY, iDiff, prev?.y ?? 0, operateLimit(Math.max(xMax, iBias), settings));
    const yMax = niceAxisMax(yBasis * 1.1, characteristicY);
    return { xMax, yMax };
  }, [iBias, iDiff, prev?.x, prev?.y, settings, viewMode]);

  const { xMax, yMax } = scale;
  const sx = (x: number) => mL + (x / xMax) * pw;
  const sy = (y: number) => mT + ph - (y / yMax) * ph;

  const characteristicPoints = [
    { x: 0, y: settings.iSet },
    { x: settings.biasBreakpoint1, y: settings.iSet },
    { x: settings.biasBreakpoint2, y: operateLimit(settings.biasBreakpoint2, settings) },
    ...(settings.characteristicMode === 'multi'
      ? [{ x: settings.biasBreakpoint3, y: operateLimit(settings.biasBreakpoint3, settings) }]
      : []),
    { x: xMax, y: operateLimit(xMax, settings) },
  ].filter((point, index, points) => index === 0 || point.x > points[index - 1].x);

  const linePath = characteristicPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${sx(point.x)} ${sy(point.y)}`).join(' ');
  const operateRegion = [
    `M ${sx(0)} ${sy(yMax)}`,
    `L ${sx(0)} ${sy(settings.iSet)}`,
    ...characteristicPoints.slice(1).map((point) => `L ${sx(point.x)} ${sy(point.y)}`),
    `L ${sx(xMax)} ${sy(yMax)}`,
    'Z',
  ].join(' ');
  const restrainRegion = [
    `M ${sx(0)} ${sy(0)}`,
    `L ${sx(0)} ${sy(settings.iSet)}`,
    ...characteristicPoints.slice(1).map((point) => `L ${sx(point.x)} ${sy(point.y)}`),
    `L ${sx(xMax)} ${sy(0)}`,
    'Z',
  ].join(' ');

  const xTicks = Array.from({ length: 5 }, (_, i) => (xMax / 4) * i);
  const yTicks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);
  const operate = status === 'OPERATE';
  const invalid = status === 'INVALID';
  const accent = invalid ? 'var(--sim-amber)' : operate ? 'var(--sim-red)' : 'var(--sim-green)';

  const currentOffScale = iBias > xMax || iDiff > yMax;
  const plottedCurrent = {
    x: Math.min(iBias, xMax * 0.985),
    y: Math.min(iDiff, yMax * 0.985),
  };
  const previousVisible = prev && prev.x <= xMax && prev.y <= yMax && (prev.x !== iBias || prev.y !== iDiff);

  const summary = [
    `Iset ${formatEngineeringNumber(settings.iSet)} A sec`,
    `BP1 ${formatEngineeringNumber(settings.biasBreakpoint1)}`,
    `S1 ${formatEngineeringNumber(settings.slope1)}%`,
    `BP2 ${formatEngineeringNumber(settings.biasBreakpoint2)}`,
    `S2 ${formatEngineeringNumber(settings.slope2)}%`,
    ...(settings.characteristicMode === 'multi'
      ? [`BP3 ${formatEngineeringNumber(settings.biasBreakpoint3)}`, `S3 ${formatEngineeringNumber(settings.slope3)}%`]
      : []),
  ];

  const segmentMeta = useMemo<SegmentMeta[]>(() => {
    const segments: SegmentMeta[] = [
      {
        key: 'pickup',
        title: 'Pickup / Minimum Operate',
        primaryLabel: 'Iset / Min Iop',
        primaryValue: `${formatCurveTooltipNumber(settings.iSet)} A sec`,
        startBiasText: '0 A sec',
        endBiasText: `${formatCurveTooltipNumber(settings.biasBreakpoint1)} A sec`,
        startThresholdText: `${formatCurveTooltipNumber(settings.iSet)} A sec`,
        endThresholdText: `${formatCurveTooltipNumber(settings.iSet)} A sec`,
        start: { x: 0, y: settings.iSet },
        end: { x: settings.biasBreakpoint1, y: settings.iSet },
      },
      {
        key: 's1',
        title: 'Slope 1',
        primaryLabel: 'Restraint slope',
        primaryValue: `${formatCurveTooltipNumber(settings.slope1)}%`,
        startBiasText: `${formatCurveTooltipNumber(settings.biasBreakpoint1)} A sec`,
        endBiasText: `${formatCurveTooltipNumber(settings.biasBreakpoint2)} A sec`,
        startThresholdText: `${formatCurveTooltipNumber(settings.iSet)} A sec`,
        endThresholdText: `${formatCurveTooltipNumber(operateLimit(settings.biasBreakpoint2, settings))} A sec`,
        start: { x: settings.biasBreakpoint1, y: settings.iSet },
        end: { x: settings.biasBreakpoint2, y: operateLimit(settings.biasBreakpoint2, settings) },
      },
      {
        key: 's2',
        title: 'Slope 2',
        primaryLabel: 'Restraint slope',
        primaryValue: `${formatCurveTooltipNumber(settings.slope2)}%`,
        startBiasText: `${formatCurveTooltipNumber(settings.biasBreakpoint2)} A sec`,
        endBiasText: settings.characteristicMode === 'multi'
          ? `${formatCurveTooltipNumber(settings.biasBreakpoint3)} A sec`
          : `${formatCurveTooltipNumber(xMax)} A sec · scale`,
        startThresholdText: `${formatCurveTooltipNumber(operateLimit(settings.biasBreakpoint2, settings))} A sec`,
        endThresholdText: settings.characteristicMode === 'multi'
          ? `${formatCurveTooltipNumber(operateLimit(settings.biasBreakpoint3, settings))} A sec`
          : `${formatCurveTooltipNumber(operateLimit(xMax, settings))} A sec`,
        start: { x: settings.biasBreakpoint2, y: operateLimit(settings.biasBreakpoint2, settings) },
        end: settings.characteristicMode === 'multi'
          ? { x: settings.biasBreakpoint3, y: operateLimit(settings.biasBreakpoint3, settings) }
          : { x: xMax, y: operateLimit(xMax, settings) },
      },
      ...(settings.characteristicMode === 'multi'
        ? [{
          key: 's3',
          title: 'Slope 3',
          primaryLabel: 'Restraint slope',
          primaryValue: `${formatCurveTooltipNumber(settings.slope3)}%`,
          startBiasText: `${formatCurveTooltipNumber(settings.biasBreakpoint3)} A sec`,
          endBiasText: `${formatCurveTooltipNumber(xMax)} A sec · scale`,
          startThresholdText: `${formatCurveTooltipNumber(operateLimit(settings.biasBreakpoint3, settings))} A sec`,
          endThresholdText: `${formatCurveTooltipNumber(operateLimit(xMax, settings))} A sec`,
          start: { x: settings.biasBreakpoint3, y: operateLimit(settings.biasBreakpoint3, settings) },
          end: { x: xMax, y: operateLimit(xMax, settings) },
        }]
        : []),
    ];

    return segments.filter((segment) => segment.end.x > segment.start.x);
  }, [settings, xMax]);

  useEffect(() => () => {
    if (hoverFrameRef.current !== null) window.cancelAnimationFrame(hoverFrameRef.current);
  }, []);

  const activePointer = hoveredPoint ?? hoveredSegment;

  useLayoutEffect(() => {
    if (!activePointer || !tooltipRef.current) return;
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const placeLeft = activePointer.clientX + TOOLTIP_GAP + tooltip.width > window.innerWidth - VIEWPORT_GAP;
    const placeAbove = activePointer.clientY + TOOLTIP_GAP + tooltip.height > window.innerHeight - VIEWPORT_GAP;

    const left = placeLeft
      ? activePointer.clientX - TOOLTIP_GAP - tooltip.width
      : activePointer.clientX + TOOLTIP_GAP;
    const top = placeAbove
      ? activePointer.clientY - TOOLTIP_GAP - tooltip.height
      : activePointer.clientY + TOOLTIP_GAP;

    setTooltipPosition({
      left: Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - tooltip.width - VIEWPORT_GAP)),
      top: Math.max(VIEWPORT_GAP, Math.min(top, window.innerHeight - tooltip.height - VIEWPORT_GAP)),
    });
  }, [activePointer]);

  const handleSegmentPointerMove = (segment: SegmentMeta, event: ReactPointerEvent<SVGLineElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    const next: HoveredSegment = {
      ...segment,
      clientX: event.clientX,
      clientY: event.clientY,
      localXRatio: rect && rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0,
      localYRatio: rect && rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0,
    };

    if (hoverFrameRef.current !== null) window.cancelAnimationFrame(hoverFrameRef.current);
    hoverFrameRef.current = window.requestAnimationFrame(() => {
      setHoveredSegment(next);
      hoverFrameRef.current = null;
    });
  };

  const handlePointPointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    const next: HoveredPoint = {
      clientX: event.clientX,
      clientY: event.clientY,
      localXRatio: rect && rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0,
      localYRatio: rect && rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0,
    };
    if (hoverFrameRef.current !== null) window.cancelAnimationFrame(hoverFrameRef.current);
    hoverFrameRef.current = window.requestAnimationFrame(() => {
      setHoveredPoint(next);
      setHoveredSegment(null);
      hoverFrameRef.current = null;
    });
  };

  const operatingPointOccupiesLowerRight = plottedCurrent.x >= xMax * 0.68 && plottedCurrent.y <= yMax * 0.24;
  const pointerOccupiesLowerRight = Boolean(
    activePointer
    && activePointer.localXRatio >= 0.64
    && activePointer.localYRatio >= 0.58,
  );
  const restrainLabelLeft = operatingPointOccupiesLowerRight || pointerOccupiesLowerRight;

  const pointTone: CurveTooltipTone = invalid ? 'warning' : operate ? 'operate' : 'restrain';
  const tooltip = activePointer && typeof document !== 'undefined'
    ? createPortal(
      hoveredPoint ? (
        <CurveDataTooltip
          ref={tooltipRef}
          title='Operating Point'
          context={status === 'INVALID' ? 'Last valid · held' : status === 'OPERATE' ? 'Operate / trip' : 'Restrain'}
          tone={pointTone}
          rows={[
            { label: 'Ibias', value: `${formatCurveTooltipNumber(iBias)} A sec` },
            { label: 'Idiff', value: `${formatCurveTooltipNumber(iDiff)} A sec` },
            { label: 'Iop', value: `${formatCurveTooltipNumber(iOpLimit)} A sec` },
            { label: 'Margin', value: `${formatCurveTooltipNumber(iDiff - iOpLimit)} A sec`, tone: pointTone },
          ]}
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        />
      ) : hoveredSegment ? (
        <CurveDataTooltip
          ref={tooltipRef}
          title={hoveredSegment.title}
          context='Curve segment'
          tone='info'
          primaryLabel={hoveredSegment.primaryLabel}
          primaryValue={hoveredSegment.primaryValue}
          rows={[
            { label: 'Ibias', value: `${hoveredSegment.startBiasText} → ${hoveredSegment.endBiasText}` },
            { label: 'Iop', value: `${hoveredSegment.startThresholdText} → ${hoveredSegment.endThresholdText}` },
          ]}
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        />
      ) : null,
      document.body,
    )
    : null;

  return (
    <div className={`relative flex h-full min-h-0 flex-col rounded transition-[box-shadow] duration-300 ${highlighted ? 'ring-1 ring-[var(--sim-accent)]' : ''}`}>
      <div className='flex min-h-[25px] shrink-0 items-center border-b border-[var(--sim-border)] px-2 py-1.5'>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5 font-eng text-[9px] leading-4 text-[var(--sim-text-muted)]'>
          {summary.map((item) => <span key={item} className='whitespace-nowrap'>{item}</span>)}
        </div>
      </div>

      <div className='relative min-h-0 flex-1'>
        {(currentOffScale || viewMode === 'fit-point') && (
          <button
            type='button'
            onClick={() => setViewMode((mode) => mode === 'characteristic' ? 'fit-point' : 'characteristic')}
            className='curve-view-overlay absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.055em]'
          >
            {viewMode === 'characteristic' ? 'Fit Point' : 'Characteristic'}
          </button>
        )}

        <div className='curve-legend pointer-events-none absolute right-2 top-2 z-10 hidden min-[560px]:flex'>
          <span><i className='curve-legend-dot' data-kind='point' />Operating</span>
          <span><i className='curve-legend-dot' data-kind='threshold' />Iop</span>
          {previousVisible && <span><i className='curve-legend-dot' data-kind='previous' />Previous</span>}
        </div>

        <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio='xMidYMid meet'
        className='h-full min-h-[250px] min-w-0 w-full'
        role='img'
        aria-label='Differential characteristic showing differential current versus bias or restraint current'
        onPointerLeave={() => {
          if (!pinnedSegmentKey) setHoveredSegment(null);
          if (!pointPinned) setHoveredPoint(null);
        }}
        onPointerDown={() => {
          if (pinnedSegmentKey || pointPinned) {
            setPinnedSegmentKey(null);
            setPointPinned(false);
            setHoveredSegment(null);
            setHoveredPoint(null);
          }
        }}
      >
        <path d={operateRegion} fill='var(--sim-red)' fillOpacity={0.10} />
        <path d={restrainRegion} fill='var(--sim-green)' fillOpacity={0.065} />

        <text x={mL + 10} y={mT + 15} fontSize={10} fill='var(--sim-red)' opacity={0.95}>OPERATE (TRIP)</text>
        <text
          x={restrainLabelLeft ? mL + 10 : W - mR - 10}
          y={mT + ph - 10}
          textAnchor={restrainLabelLeft ? 'start' : 'end'}
          fontSize={10}
          fill='var(--sim-green)'
          opacity={0.95}
        >
          RESTRAIN (NO TRIP)
        </text>

        {yTicks.map((tick, i) => (
          <g key={`y${i}`}>
            <line x1={mL} y1={sy(tick)} x2={W - mR} y2={sy(tick)} stroke='var(--sim-border)' />
            <text x={mL - 7} y={sy(tick) + 3} textAnchor='end' fontSize={9} fill='var(--sim-text-muted)' className='font-eng'>{formatEngineeringNumber(tick)}</text>
          </g>
        ))}
        {xTicks.map((tick, i) => (
          <g key={`x${i}`}>
            <line x1={sx(tick)} y1={mT} x2={sx(tick)} y2={mT + ph} stroke='var(--sim-border)' />
            <text x={sx(tick)} y={mT + ph + 15} textAnchor='middle' fontSize={9} fill='var(--sim-text-muted)' className='font-eng'>{formatEngineeringNumber(tick)}</text>
          </g>
        ))}

        <line x1={mL} y1={mT} x2={mL} y2={mT + ph} stroke='var(--sim-text-dim)' />
        <line x1={mL} y1={mT + ph} x2={W - mR} y2={mT + ph} stroke='var(--sim-text-dim)' />

        {[settings.biasBreakpoint1, settings.biasBreakpoint2, ...(settings.characteristicMode === 'multi' ? [settings.biasBreakpoint3] : [])]
          .filter((x) => x <= xMax)
          .map((x, index) => (
            <line
              key={`bp-${x}-${index}`}
              x1={sx(x)}
              y1={mT}
              x2={sx(x)}
              y2={mT + ph}
              stroke='var(--sim-text-dim)'
              strokeDasharray='3 4'
              opacity={0.55}
            />
          ))}

        <path d={linePath} fill='none' stroke='var(--sim-text)' strokeWidth={2.35} strokeLinejoin='round' />

        {segmentMeta.map((segment) => hoveredSegment?.key === segment.key && (
          <line
            key={`highlight-${segment.key}`}
            x1={sx(segment.start.x)}
            y1={sy(segment.start.y)}
            x2={sx(segment.end.x)}
            y2={sy(segment.end.y)}
            stroke='var(--sim-accent)'
            strokeWidth={4.2}
            strokeLinecap='round'
            opacity={0.95}
            pointerEvents='none'
          />
        ))}

        {segmentMeta.map((segment) => (
          <line
            key={segment.key}
            x1={sx(segment.start.x)}
            y1={sy(segment.start.y)}
            x2={sx(segment.end.x)}
            y2={sy(segment.end.y)}
            stroke='transparent'
            strokeWidth={16}
            style={{ cursor: 'crosshair' }}
            onPointerEnter={(event) => handleSegmentPointerMove(segment, event)}
            onPointerMove={(event) => { if (event.pointerType === 'mouse' || pinnedSegmentKey === segment.key) handleSegmentPointerMove(segment, event); }}
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse') return;
              event.stopPropagation();
              event.preventDefault();
              if (pinnedSegmentKey === segment.key) {
                setPinnedSegmentKey(null);
                setHoveredSegment(null);
              } else {
                handleSegmentPointerMove(segment, event);
                setPinnedSegmentKey(segment.key);
              }
            }}
            onPointerLeave={() => { if (pinnedSegmentKey !== segment.key) setHoveredSegment(null); }}
          />
        ))}

        <line
          x1={sx(Math.min(iBias, xMax))}
          y1={sy(0)}
          x2={sx(Math.min(iBias, xMax))}
          y2={sy(Math.min(iOpLimit, yMax))}
          stroke='var(--sim-accent)'
          strokeDasharray='3 3'
          strokeWidth={1}
          opacity={currentOffScale ? 0.55 : 1}
        />
        {!currentOffScale && <circle cx={sx(iBias)} cy={sy(iOpLimit)} r={3.2} fill='var(--sim-accent)' />}

        {previousVisible && (
          <circle cx={sx(prev.x)} cy={sy(prev.y)} r={4.5} fill='none' stroke='var(--sim-text-muted)' strokeWidth={1} opacity={0.55} />
        )}

        {hoveredPoint && (
          <circle
            cx={sx(plottedCurrent.x)}
            cy={sy(plottedCurrent.y)}
            r={11}
            fill='none'
            stroke={accent}
            strokeWidth={1.2}
            opacity={0.34}
            pointerEvents='none'
          />
        )}
        <circle
          cx={sx(plottedCurrent.x)}
          cy={sy(plottedCurrent.y)}
          r={hoveredPoint ? (currentOffScale ? 7.4 : 6.9) : currentOffScale ? 6.5 : 6}
          fill={currentOffScale ? 'var(--sim-bg)' : accent}
          stroke={accent}
          strokeWidth={currentOffScale ? 2.4 : 1.8}
          className='operating-point-transition'
          pointerEvents='none'
        />
        <circle
          cx={sx(plottedCurrent.x)}
          cy={sy(plottedCurrent.y)}
          r={15}
          fill='transparent'
          style={{ cursor: 'crosshair' }}
          aria-label={`Operating point: Ibias ${formatEngineeringNumber(iBias)} A sec, Idiff ${formatEngineeringNumber(iDiff)} A sec, Iop ${formatEngineeringNumber(iOpLimit)} A sec, ${status === 'INVALID' ? 'output held on last valid data' : status.toLowerCase()}.`}
          onPointerEnter={(event) => handlePointPointerMove(event)}
          onPointerMove={(event) => { if (event.pointerType === 'mouse' || pointPinned) handlePointPointerMove(event); }}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.pointerType === 'mouse') return;
            event.preventDefault();
            if (pointPinned) {
              setPointPinned(false);
              setHoveredPoint(null);
            } else {
              handlePointPointerMove(event);
              setPointPinned(true);
              setPinnedSegmentKey(null);
            }
          }}
          onPointerLeave={() => { if (!pointPinned) setHoveredPoint(null); }}
        />

        {currentOffScale && (
          <g>
            <text
              x={sx(plottedCurrent.x) - 8}
              y={Math.max(mT + 14, sy(plottedCurrent.y) - 10)}
              textAnchor='end'
              fontSize={8}
              fontWeight={600}
              fill={accent}
            >
              OFF-SCALE
            </text>
            <text
              x={sx(plottedCurrent.x) - 8}
              y={Math.max(mT + 25, sy(plottedCurrent.y) + 1)}
              textAnchor='end'
              fontSize={7.5}
              fill='var(--sim-text-muted)'
              className='font-eng'
            >
              Ib {formatEngineeringNumber(iBias)} · Id {formatEngineeringNumber(iDiff)}
            </text>
          </g>
        )}

        <text x={mL + pw / 2} y={H - 5} textAnchor='middle' fontSize={10.5} fill='var(--sim-text-muted)'>Bias / Restraint Current (A sec)</text>
        <text x={13} y={mT + ph / 2} textAnchor='middle' fontSize={10.5} fill='var(--sim-text-muted)' transform={`rotate(-90 13 ${mT + ph / 2})`}>Differential Current (A sec)</text>
        </svg>
      </div>

      {tooltip}

      <div className='grid shrink-0 grid-cols-4 gap-1 border-t border-[var(--sim-border)] px-2 py-1.5 font-eng text-[9.5px] text-[var(--sim-text-muted)]'>
        <span>Ibias <b className='text-[var(--sim-text)]'>{formatEngineeringNumber(iBias)} A sec</b></span>
        <span>Idiff <b className='text-[var(--sim-text)]'>{formatEngineeringNumber(iDiff)} A sec</b></span>
        <span>Iop <b className='text-[var(--sim-text)]'>{formatEngineeringNumber(iOpLimit)} A sec</b></span>
        <span>State <b style={{ color: accent }}>{status === 'INVALID' ? 'INVALID · HELD' : status}</b></span>
      </div>
    </div>
  );
}
