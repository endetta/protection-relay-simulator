import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  buildOvercurrentTccModel,
  type TccCurvePoint,
  type TccCurveSeries,
  type TccOperatingPoint,
  type TccScaleMode,
} from '../../presentation/overcurrentTcc';
import { mapClientPointToTccViewBox } from '../../presentation/overcurrentTccGeometry';
import { formatEngineeringNumber } from '../../utils/engineering';
import type {
  OvercurrentParameterAction,
  OvercurrentParameterState,
} from '../../utils/overcurrentState';
import { CurveDataTooltip, type CurveTooltipRow } from '../shared/CurveDataTooltip';
import { EngineeringViewOverlay } from '../shared/EngineeringViewOverlay';
import { OverlayScrollArea } from '../shared/OverlayScrollArea';
import './timeCurrentCurve.css';

export interface TimeCurrentCurveProps {
  readonly state: OvercurrentParameterState;
  readonly dispatch: (action: OvercurrentParameterAction) => void;
  readonly onDeviceFocus?: (deviceId: string) => void;
  readonly className?: string;
}

type TccDomain = 'CURRENT_MULTIPLE' | 'PRIMARY_A';

interface PointerPosition {
  readonly clientX: number;
  readonly clientY: number;
}

interface CurveInspector extends PointerPosition {
  readonly kind: 'CURVE';
  readonly curve: TccCurveSeries;
  readonly point: TccCurvePoint;
}

interface PointInspector extends PointerPosition {
  readonly kind: 'POINT';
  readonly point: TccOperatingPoint;
}

type InspectorTarget = CurveInspector | PointInspector;

interface TooltipPosition {
  readonly left: number;
  readonly top: number;
}

const W = 900;
const H = 520;
const MARGIN_LEFT = 72;
const MARGIN_RIGHT = 28;
const MARGIN_TOP = 30;
const MARGIN_BOTTOM = 58;
const PLOT_WIDTH = W - MARGIN_LEFT - MARGIN_RIGHT;
const PLOT_HEIGHT = H - MARGIN_TOP - MARGIN_BOTTOM;
const VIEWPORT_GAP = 8;
const TOOLTIP_GAP = 16;
// Restrained engineering palette: only ONE accent (primary blue) + one neutral (muted slate).
// Semantic green/amber/red remain reserved for status. Dash patterns distinguish series.
const SERIES_COLORS = ['#38bdf8', '#8E98A7'];
const SERIES_DASH = [undefined, '9 4', '2.5 3.5', '11 3 2 3', '5 3', '1.5 3'];
const useViewportLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Audio context for engineering sound feedback. Lazy-initialized on first user gesture
// because browsers block AudioContext until user interaction.
let audioContext: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (Ctor) audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return audioContext;
}
function playTone(frequency: number, durationMs: number, volume: number = 0.06): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}
function playPickupChirp(): void {
  playTone(680, 80, 0.04);
  setTimeout(() => playTone(880, 60, 0.035), 60);
}
function playClick(): void {
  playTone(1100, 35, 0.04);
}
function playTripAlarm(): void {
  playTone(220, 200, 0.05);
  setTimeout(() => playTone(165, 200, 0.05), 110);
  setTimeout(() => playTone(220, 300, 0.05), 220);
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function logRatio(value: number, min: number, max: number): number {
  if (!finitePositive(value) || !finitePositive(min) || !finitePositive(max) || max <= min) return 0;
  return (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min));
}

function inverseLogRatio(ratio: number, min: number, max: number): number {
  return Math.exp(Math.log(min) + Math.max(0, Math.min(1, ratio)) * (Math.log(max) - Math.log(min)));
}


function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  try {
    const matrix = svg.getScreenCTM?.();
    if (matrix && typeof svg.createSVGPoint === 'function') {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const mapped = point.matrixTransform(matrix.inverse());
      if (Number.isFinite(mapped.x) && Number.isFinite(mapped.y)) {
        return { x: mapped.x, y: mapped.y };
      }
    }
  } catch {
    // Fall back to explicit xMidYMid/meet mapping below.
  }

  return mapClientPointToTccViewBox(clientX, clientY, svg.getBoundingClientRect(), W, H);
}

function clientXToSvgX(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): number | null {
  return clientToSvgPoint(svg, clientX, clientY)?.x ?? null;
}

function svgPointToClientPosition(
  svg: SVGSVGElement | null,
  x: number,
  y: number,
): PointerPosition {
  if (!svg) return { clientX: VIEWPORT_GAP, clientY: VIEWPORT_GAP };
  try {
    const matrix = svg.getScreenCTM?.();
    if (matrix && typeof svg.createSVGPoint === 'function') {
      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      const mapped = point.matrixTransform(matrix);
      if (Number.isFinite(mapped.x) && Number.isFinite(mapped.y)) {
        return { clientX: mapped.x, clientY: mapped.y };
      }
    }
  } catch {
    // Fall back to the explicit xMidYMid/meet geometry below.
  }

  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / W, rect.height / H);
  const renderedWidth = W * scale;
  const renderedHeight = H * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  return {
    clientX: rect.left + offsetX + x * scale,
    clientY: rect.top + offsetY + y * scale,
  };
}

function displayNumber(value: number): string {
  return Number.isFinite(value) ? formatEngineeringNumber(value) : '—';
}

function timeText(value: number | null): string {
  if (value === null) return 'Below pickup';
  if (value === 0) return '0 s · instantaneous';
  return `${displayNumber(value)} s`;
}

function pointRole(point: TccOperatingPoint): string {
  if (point.role === 'PRIMARY') return 'PRIMARY';
  if (point.role === 'BACKUP') return `BACKUP ${point.backupOrder ?? ''}`.trim();
  return 'OTHER';
}

function nearestCurvePoint(curve: TccCurveSeries, x: number): TccCurvePoint | null {
  if (curve.points.length === 0) return null;
  return curve.points.reduce((nearest, candidate) => (
    Math.abs(Math.log(candidate.x) - Math.log(x)) < Math.abs(Math.log(nearest.x) - Math.log(x))
      ? candidate
      : nearest
  ));
}

function pathFromPoints(
  points: readonly TccCurvePoint[],
  sx: (value: number) => number,
  sy: (value: number) => number,
): string {
  return points
    .filter((point) => finitePositive(point.x) && finitePositive(point.operateTimeSec))
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${sx(point.x)} ${sy(point.operateTimeSec)}`)
    .join(' ');
}

function keyboardActivate(
  event: ReactKeyboardEvent<SVGGElement | SVGPathElement>,
  activate: () => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  activate();
}

function TimeCurrentCurveComponent({
  state,
  dispatch,
  onDeviceFocus,
  className = '',
}: TimeCurrentCurveProps) {
  const titleId = useId();
  const descriptionId = useId();
  const clipId = `tcc-clip-${useId().replace(/:/g, '')}`;
  const hatchId = `tcc-hatch-${useId().replace(/:/g, '')}`;
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const [currentDomain, setCurrentDomain] = useState<TccDomain>(
    state.studyMode === 'SINGLE_RELAY' ? 'CURRENT_MULTIPLE' : 'PRIMARY_A',
  );
  const [scaleMode, setScaleMode] = useState<TccScaleMode>('CHARACTERISTIC');
  const [comparisonEnabled, setComparisonEnabled] = useState(true);
  const [inspector, setInspector] = useState<InspectorTarget | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
    left: VIEWPORT_GAP,
    top: VIEWPORT_GAP,
  });

  // Pan & Zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setCurrentDomain(state.studyMode === 'SINGLE_RELAY' ? 'CURRENT_MULTIPLE' : 'PRIMARY_A');
    setScaleMode('CHARACTERISTIC');
    setInspector(null);
    setPinnedKey(null);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, [state.studyMode, state.studyPresetId]);

  useEffect(() => () => {
    if (hoverFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(hoverFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!pinnedKey || typeof document === 'undefined') return undefined;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && tooltipRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-inspector-target="true"]')) return;
      setPinnedKey(null);
      setInspector(null);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [pinnedKey]);

  const model = useMemo(() => buildOvercurrentTccModel(state, {
    currentDomain,
    scaleMode,
    showComparison: state.modified && comparisonEnabled,
  }), [comparisonEnabled, currentDomain, scaleMode, state]);

  // Pan & Zoom: compute effective axis bounds from zoom level and pan offset
  const effectiveAxisBounds = useMemo(() => {
    if (zoomLevel === 1 && panOffset.x === 0 && panOffset.y === 0) return undefined;

    const naturalXMin = model.xAxis.min;
    const naturalXMax = model.xAxis.max;
    const naturalYMin = model.yAxis.min;
    const naturalYMax = model.yAxis.max;

    const logRangeX = Math.log(naturalXMax) - Math.log(naturalXMin);
    const logRangeY = Math.log(naturalYMax) - Math.log(naturalYMin);
    if (logRangeX <= 0 || logRangeY <= 0) return undefined;

    // Center of viewport in log space
    const centerLogX = Math.log(naturalXMin) + logRangeX / 2;
    const centerLogY = Math.log(naturalYMin) + logRangeY / 2;

    // Pan offset shifts the center in log space
    // pan.x positive = content dragged to the right = center moves to smaller x values
    // (because the user "moved the world right" by dragging right)
    const newCenterLogX = centerLogX - panOffset.x * logRangeX / PLOT_WIDTH;
    // pan.y positive = content dragged down = center moves to larger y values
    const newCenterLogY = centerLogY + panOffset.y * logRangeY / PLOT_HEIGHT;

    // Zoom narrows the range around the center
    const newLogRangeX = logRangeX / zoomLevel;
    const newLogRangeY = logRangeY / zoomLevel;

    // Calculate new min/max without clamping to natural bounds
    // (so the user can pan/zoom freely within the expanded range)
    const MIN_LOG_X = Math.log(naturalXMin) - 0.5;  // Allow 0.5x expansion
    const MAX_LOG_X = Math.log(naturalXMax) + 0.5;
    const MIN_LOG_Y = Math.log(naturalYMin) - 0.5;
    const MAX_LOG_Y = Math.log(naturalYMax) + 0.5;

    const clampedCenterLogX = Math.max(MIN_LOG_X + newLogRangeX / 2, Math.min(MAX_LOG_X - newLogRangeX / 2, newCenterLogX));
    const clampedCenterLogY = Math.max(MIN_LOG_Y + newLogRangeY / 2, Math.min(MAX_LOG_Y - newLogRangeY / 2, newCenterLogY));

    return {
      xMin: Math.exp(clampedCenterLogX - newLogRangeX / 2),
      xMax: Math.exp(clampedCenterLogX + newLogRangeX / 2),
      yMin: Math.exp(clampedCenterLogY - newLogRangeY / 2),
      yMax: Math.exp(clampedCenterLogY + newLogRangeY / 2),
    };
  }, [model.xAxis.min, model.xAxis.max, model.yAxis.min, model.yAxis.max, zoomLevel, panOffset]);

  // When scaleMode changes, reset zoom/pan so Fit Point recomputes from defaults
  useEffect(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, [scaleMode, currentDomain]);

  const modelWithBounds = useMemo(() => (
    effectiveAxisBounds === undefined
      ? model
      : buildOvercurrentTccModel(state, {
        currentDomain,
        scaleMode,
        showComparison: state.modified && comparisonEnabled,
        axisBoundsOverride: effectiveAxisBounds,
      })
  ), [comparisonEnabled, currentDomain, effectiveAxisBounds, model, scaleMode, state]);

  // Pure log-log mapping — no zoom/pan modification
  const sx = (value: number) => MARGIN_LEFT + logRatio(
    Math.max(modelWithBounds.xAxis.min, Math.min(modelWithBounds.xAxis.max, value)),
    modelWithBounds.xAxis.min,
    modelWithBounds.xAxis.max,
  ) * PLOT_WIDTH;
  const sy = (value: number) => MARGIN_TOP + PLOT_HEIGHT - logRatio(
    Math.max(modelWithBounds.yAxis.min, Math.min(modelWithBounds.yAxis.max, value)),
    modelWithBounds.yAxis.min,
    modelWithBounds.yAxis.max,
  ) * PLOT_HEIGHT;

  const selectedCurve = modelWithBounds.curves.find((curve) => curve.selected && !curve.ghost)
    ?? modelWithBounds.curves.find((curve) => !curve.ghost)
    ?? null;
  const hasOffScale = modelWithBounds.operatingPoints.some((point) => (
    point.selectedTripTimeSec !== null && Boolean(point.xOffScale || point.timeOffScale)
  ));

  useViewportLayoutEffect(() => {
    if (!inspector || !tooltipRef.current || typeof window === 'undefined') return;
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const placeLeft = inspector.clientX + TOOLTIP_GAP + tooltip.width > window.innerWidth - VIEWPORT_GAP;
    const placeAbove = inspector.clientY + TOOLTIP_GAP + tooltip.height > window.innerHeight - VIEWPORT_GAP;
    const left = placeLeft
      ? inspector.clientX - TOOLTIP_GAP - tooltip.width
      : inspector.clientX + TOOLTIP_GAP;
    const top = placeAbove
      ? inspector.clientY - TOOLTIP_GAP - tooltip.height
      : inspector.clientY + TOOLTIP_GAP;
    setTooltipPosition({
      left: Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - tooltip.width - VIEWPORT_GAP)),
      top: Math.max(VIEWPORT_GAP, Math.min(top, window.innerHeight - tooltip.height - VIEWPORT_GAP)),
    });
  }, [inspector]);

  const scheduleInspector = (target: InspectorTarget) => {
    if (typeof window === 'undefined') {
      setInspector(target);
      return;
    }
    if (hoverFrameRef.current !== null) window.cancelAnimationFrame(hoverFrameRef.current);
    hoverFrameRef.current = window.requestAnimationFrame(() => {
      setInspector(target);
      hoverFrameRef.current = null;
    });
  };

  const pointerXValue = (event: ReactPointerEvent<SVGElement>): number => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return modelWithBounds.xAxis.min;
    const svgX = clientXToSvgX(svg, event.clientX, event.clientY);
    if (svgX === null) return modelWithBounds.xAxis.min;
    return inverseLogRatio(
      (svgX - MARGIN_LEFT) / PLOT_WIDTH,
      modelWithBounds.xAxis.min,
      modelWithBounds.xAxis.max,
    );
  };

  const inspectCurve = (curve: TccCurveSeries, event: ReactPointerEvent<SVGPathElement>) => {
    const point = nearestCurvePoint(curve, pointerXValue(event));
    if (!point) return;
    scheduleInspector({ kind: 'CURVE', curve, point, clientX: event.clientX, clientY: event.clientY });
    // Soft chirp when a different curve is first inspected
    if (inspector?.kind !== 'CURVE' || inspector.curve.layerId !== curve.layerId) {
      playPickupChirp();
    }
  };

  const inspectCurvePoint = (curve: TccCurveSeries, point: TccCurvePoint, target: SVGPathElement) => {
    const position = svgPointToClientPosition(target.ownerSVGElement, sx(point.x), sy(point.operateTimeSec));
    scheduleInspector({ kind: 'CURVE', curve, point, ...position });
  };

  const inspectCurveAtCenter = (curve: TccCurveSeries, target: SVGPathElement) => {
    const point = curve.points[Math.floor(curve.points.length / 2)];
    if (point) inspectCurvePoint(curve, point, target);
  };

  const inspectPoint = (point: TccOperatingPoint, event: ReactPointerEvent<SVGGElement>) => {
    scheduleInspector({ kind: 'POINT', point, clientX: event.clientX, clientY: event.clientY });
  };

  const inspectPointAtMarker = (point: TccOperatingPoint, target: SVGGElement) => {
    const position = svgPointToClientPosition(target.ownerSVGElement, sx(point.plottedX), sy(point.plottedTimeSec));
    scheduleInspector({ kind: 'POINT', point, ...position });
  };

  const handleCurveKeyDown = (
    curve: TccCurveSeries,
    event: ReactKeyboardEvent<SVGPathElement>,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      keyboardActivate(event, () => selectDevice(curve.deviceId));
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || curve.points.length === 0) return;

    event.preventDefault();
    const currentIndex = inspector?.kind === 'CURVE' && inspector.curve.layerId === curve.layerId
      ? Math.max(0, curve.points.indexOf(inspector.point))
      : Math.floor(curve.points.length / 2);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? curve.points.length - 1
        : event.key === 'ArrowLeft'
          ? Math.max(0, currentIndex - 1)
          : Math.min(curve.points.length - 1, currentIndex + 1);
    const nextPoint = curve.points[nextIndex];
    inspectCurvePoint(curve, nextPoint, event.currentTarget);
    setLiveAnnouncement(
      `${curve.deviceLabel}: ${displayNumber(nextPoint.x)} times pickup, operate time ${displayNumber(nextPoint.operateTimeSec)} seconds`
    );
  };

  const selectDevice = (deviceId: string) => {
    playClick();
    dispatch({ type: 'SELECT_DEVICE', deviceId });
    onDeviceFocus?.(deviceId);
  };

  const pinOrRelease = (key: string, inspect: () => void) => {
    if (pinnedKey === key) {
      setPinnedKey(null);
      setInspector(null);
      return;
    }
    inspect();
    setPinnedKey(key);
  };

  // Pan & Zoom handlers
  const handleWheel = (event: WheelEvent) => {
    if (!svgRef.current) return;
    event.preventDefault();

    const delta = event.deltaY;
    // Smoother zoom: 5% step instead of 10%
    const zoomFactor = delta > 0 ? 0.95 : 1.05;
    const newZoom = Math.max(0.5, Math.min(4, zoomLevel * zoomFactor));

    // Skip if no actual change
    if (Math.abs(newZoom - zoomLevel) < 0.001) return;

    // O10H rule: map the pointer through the SVG CTM (with an exact
    // xMidYMid/meet fallback), never through raw bounding-box ratios.
    const mapped = clientToSvgPoint(svgRef.current, event.clientX, event.clientY);
    if (!mapped) return;
    const mouseSvgX = mapped.x;
    const mouseSvgY = mapped.y;

    // Convert mouse SVG position to current axis value (log space)
    const naturalLogRangeX = Math.log(model.xAxis.max) - Math.log(model.xAxis.min);
    const naturalLogRangeY = Math.log(model.yAxis.max) - Math.log(model.yAxis.min);

    // Current center in log space (accounting for pan)
    const currentCenterLogX = Math.log(model.xAxis.min) + naturalLogRangeX / 2
      - panOffset.x * naturalLogRangeX / (PLOT_WIDTH * zoomLevel);
    const currentCenterLogY = Math.log(model.yAxis.min) + naturalLogRangeY / 2
      + panOffset.y * naturalLogRangeY / (PLOT_HEIGHT * zoomLevel);

    // Current visible range in log space
    const currentLogRangeX = naturalLogRangeX / zoomLevel;
    const currentLogRangeY = naturalLogRangeY / zoomLevel;

    // Mouse position relative to plot area (clamp to [0, 1] to avoid weird jumps)
    const mouseRatioX = Math.max(0, Math.min(1, (mouseSvgX - MARGIN_LEFT) / PLOT_WIDTH));
    const mouseRatioY = Math.max(0, Math.min(1, (mouseSvgY - MARGIN_TOP) / PLOT_HEIGHT));

    // Data value at mouse position (in log space)
    const mouseLogX = currentCenterLogX + (mouseRatioX - 0.5) * currentLogRangeX;
    const mouseLogY = currentCenterLogY - (mouseRatioY - 0.5) * currentLogRangeY;

    // New ranges after zoom
    const newLogRangeX = naturalLogRangeX / newZoom;
    const newLogRangeY = naturalLogRangeY / newZoom;

    // Keep mouse position at the same data value
    const newCenterLogX = mouseLogX - (mouseRatioX - 0.5) * newLogRangeX;
    const newCenterLogY = mouseLogY + (mouseRatioY - 0.5) * newLogRangeY;

    // Convert new center to pan offset
    // positive pan.x = content moved right = center moved left (smaller x) = centerOffsetX negative
    // So: panOffset.x = -centerOffsetX * scale
    const centerOffsetX = newCenterLogX - (Math.log(model.xAxis.min) + naturalLogRangeX / 2);
    const centerOffsetY = newCenterLogY - (Math.log(model.yAxis.min) + naturalLogRangeY / 2);

    const newPanX = -centerOffsetX * PLOT_WIDTH / naturalLogRangeX;
    const newPanY = centerOffsetY * PLOT_HEIGHT / naturalLogRangeY;

    // Clamp to prevent going too far
    const MAX_PAN = PLOT_WIDTH * 0.4;
    const clampedPanX = Math.max(-MAX_PAN, Math.min(MAX_PAN, newPanX));
    const clampedPanY = Math.max(-PLOT_HEIGHT * 0.4, Math.min(PLOT_HEIGHT * 0.4, newPanY));

    setZoomLevel(newZoom);
    setPanOffset({ x: clampedPanX, y: clampedPanY });
  };

  const handlePanStart = (event: ReactPointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (target.closest('[data-inspector-target="true"]')) return;
    if (event.button !== 0) return; // Only left button

    setIsPanning(true);
    setPanStart({ clientX: event.clientX, clientY: event.clientY, panX: panOffset.x, panY: panOffset.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePanMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!isPanning || !panStart) return;

    // Clamp pan to prevent dragging too far (max 40% of plot dimension in each direction)
    const MAX_PAN_X = PLOT_WIDTH * 0.4;
    const MAX_PAN_Y = PLOT_HEIGHT * 0.4;

    // Convert the client-pixel drag delta into viewBox units through the SVG
    // CTM scale so the content tracks the pointer exactly (O10H mapping rule).
    const svg = event.currentTarget;
    let scale = 0;
    try {
      const matrix = svg.getScreenCTM?.();
      if (matrix && Number.isFinite(matrix.a) && matrix.a > 0) scale = matrix.a;
    } catch {
      // Fall back to explicit xMidYMid/meet geometry below.
    }
    if (scale <= 0) {
      const rect = svg.getBoundingClientRect();
      scale = Math.min(rect.width / W, rect.height / H);
    }
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;

    const newX = Math.max(-MAX_PAN_X, Math.min(MAX_PAN_X, panStart.panX + (event.clientX - panStart.clientX) / scale));
    const newY = Math.max(-MAX_PAN_Y, Math.min(MAX_PAN_Y, panStart.panY + (event.clientY - panStart.clientY) / scale));

    setPanOffset({ x: newX, y: newY });
  };

  const handlePanEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    setIsPanning(false);
    setPanStart(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleDoubleClick = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    playClick();
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
    // `expanded` remounts the SVG inside the overlay; the listener must
    // re-attach to the new node or wheel zoom silently dies after Expand.
  }, [zoomLevel, panOffset, expanded]);

  const curveTooltipRows = (target: CurveInspector): CurveTooltipRow[] => [
    {
      label: target.curve.timingMode === 'INVERSE' ? 'TMS / Time Dial' : 'Definite delay',
      value: target.curve.timingMode === 'INVERSE'
        ? displayNumber(target.curve.timeScale)
        : `${displayNumber(target.curve.definiteDelaySec)} s`,
    },
    {
      label: 'At current',
      value: currentDomain === 'CURRENT_MULTIPLE'
        ? `${displayNumber(target.point.x)}× pickup`
        : `${displayNumber(target.point.x)} A primary`,
    },
    { label: 'Operate time', value: `${displayNumber(target.point.operateTimeSec)} s` },
  ];

  const pointTooltipRows = (point: TccOperatingPoint): CurveTooltipRow[] => {
    const rows: CurveTooltipRow[] = [
      { label: 'Primary current', value: `${displayNumber(point.primaryCurrentA)} A pri` },
      { label: 'Relay current', value: `${displayNumber(point.relayCurrentASecondary)} A sec` },
      { label: 'Current multiple', value: `${displayNumber(point.currentMultiple)}×` },
      {
        label: 'Operating time',
        value: timeText(point.selectedTripTimeSec),
        tone: point.selectedElement === '50' ? 'warning' : 'info',
      },
    ];
    if (point.selectedElement === '50' && point.reference51TimeSec !== null) {
      rows.push({ label: '51 reference', value: `${displayNumber(point.reference51TimeSec)} s` });
    }
    if (point.ctiToPreviousSec !== null) {
      rows.push({
        label: point.precedingDeviceId ? `CTI from ${point.precedingDeviceId}` : 'CTI',
        value: `${point.ctiToPreviousSec >= 0 ? '+' : ''}${displayNumber(point.ctiToPreviousSec)} s`,
        tone: point.ctiStatus === 'FAIL' ? 'warning' : 'restrain',
      });
    }
    if (point.requiredCtiSec !== null) {
      rows.push({ label: 'Required CTI', value: `${displayNumber(point.requiredCtiSec)} s` });
    }
    return rows;
  };

  const tooltip = inspector && typeof document !== 'undefined'
    ? createPortal(
      inspector.kind === 'CURVE' ? (
        <CurveDataTooltip
          ref={tooltipRef}
          title={`${inspector.curve.deviceLabel} · ${inspector.curve.curveLabel}`}
          context={inspector.curve.ghost ? 'Initial setting' : 'Relay 51 curve'}
          tone='info'
          primaryLabel='Pickup'
          primaryValue={`${displayNumber(inspector.curve.pickupASecondary)} A sec`}
          rows={curveTooltipRows(inspector)}
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        />
      ) : (
        <CurveDataTooltip
          ref={tooltipRef}
          title={`${inspector.point.deviceLabel} Operating Point`}
          context={pointRole(inspector.point)}
          tone={inspector.point.selectedElement === '50' ? 'warning' : 'info'}
          primaryLabel='Active element'
          primaryValue={inspector.point.selectedElement ?? 'No pickup'}
          rows={pointTooltipRows(inspector.point)}
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        />
      ),
      document.body,
    )
    : null;

  const content = (
    <section
      className={`overcurrent-tcc simulator-theme ${className}`.trim()}
      aria-labelledby={titleId}
      data-expanded={expanded}
    >
      <header className='overcurrent-tcc-header'>
        <div className='overcurrent-tcc-heading'>
          <span>50 / 51 characteristic</span>
          <h3 id={titleId}>Time-Current Characteristic</h3>
        </div>
        <div className='overcurrent-tcc-controls'>
          <div className='overcurrent-tcc-domain' role='group' aria-label='TCC current domain'>
            <button
              type='button'
              data-active={currentDomain === 'CURRENT_MULTIPLE'}
              aria-pressed={currentDomain === 'CURRENT_MULTIPLE'}
              onClick={() => setCurrentDomain('CURRENT_MULTIPLE')}
            >
              × Pickup
            </button>
            <button
              type='button'
              data-active={currentDomain === 'PRIMARY_A'}
              aria-pressed={currentDomain === 'PRIMARY_A'}
              onClick={() => setCurrentDomain('PRIMARY_A')}
            >
              A Primary
            </button>
          </div>
          {state.modified && (
            <button
              type='button'
              className='overcurrent-tcc-comparison'
              data-active={comparisonEnabled}
              aria-pressed={comparisonEnabled}
              onClick={() => setComparisonEnabled((value) => !value)}
            >
              Initial comparison
            </button>
          )}
          {!expanded && (
            <button
              ref={expandButtonRef}
              type='button'
              className='overcurrent-engineering-expand'
              onClick={() => setExpanded(true)}
              aria-label='Expand time-current characteristic'
            >
              Expand
            </button>
          )}
        </div>
      </header>

      <div className='overcurrent-tcc-readout' aria-label='Selected relay characteristic summary'>
        <span>Selected <b>{selectedCurve?.deviceLabel ?? '—'}</b></span>
        <span>Curve <b>{selectedCurve?.curveLabel ?? '—'}</b></span>
        <span>Pickup <b>{selectedCurve ? `${displayNumber(selectedCurve.pickupASecondary)} A sec` : '—'}</b></span>
        <span>
          {selectedCurve?.timingMode === 'DEFINITE' ? 'Delay' : 'TMS'}
          {' '}
          <b>
            {selectedCurve
              ? selectedCurve.timingMode === 'DEFINITE'
                ? `${displayNumber(selectedCurve.definiteDelaySec)} s`
                : displayNumber(selectedCurve.timeScale)
              : '—'}
          </b>
        </span>
      </div>

      {model.status === 'INVALID' ? (
        <div className='overcurrent-tcc-invalid' role='status'>
          <b>INPUT INVALID · GRAPH HELD</b>
          <span>{model.issues[0]?.detail ?? model.issues[0]?.code ?? 'Unable to build a finite time-current characteristic.'}</span>
        </div>
      ) : (
        <div className='overcurrent-tcc-frame'>
          {(hasOffScale || scaleMode === 'FIT_POINT') && (
            <button
              type='button'
              className='overcurrent-tcc-fit-control'
              data-mode={scaleMode}
              onClick={() => setScaleMode((mode) => mode === 'CHARACTERISTIC' ? 'FIT_POINT' : 'CHARACTERISTIC')}
            >
              {scaleMode === 'CHARACTERISTIC' ? 'Fit Point' : 'Characteristic'}
            </button>
          )}

          <div className='overcurrent-tcc-legend' aria-label='TCC legend'>
            {modelWithBounds.curves.filter((curve) => !curve.ghost).map((curve) => (
              <button
                key={curve.layerId}
                type='button'
                data-selected={curve.selected}
                onClick={() => selectDevice(curve.deviceId)}
              >
                <i
                  style={{
                    '--tcc-series': SERIES_COLORS[curve.seriesIndex % SERIES_COLORS.length],
                    '--tcc-dash': SERIES_DASH[curve.seriesIndex % SERIES_DASH.length] ?? 'none',
                  } as CSSProperties}
                />
                {curve.deviceLabel}
              </button>
            ))}
            {modelWithBounds.curves.some((curve) => curve.ghost) && <span><i data-kind='ghost' /> Initial</span>}
            {modelWithBounds.coordinationBands.length > 0 && <span><i data-kind='corridor' /> CTI boundary</span>}
            {modelWithBounds.coordinationBrackets.length > 0 && <span><i data-kind='bracket' /> Active CTI</span>}
          </div>

          <OverlayScrollArea
            ariaLabel='Time-current characteristic scroll area'
            className='overcurrent-tcc-scroll'
            orientation='horizontal'
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio='xMidYMid meet'
              role='img'
              aria-labelledby={`${titleId} ${descriptionId}`}
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
              onPointerDown={(event) => {
                const target = event.target as Element;
                if (pinnedKey && !target.closest('[data-inspector-target="true"]')) {
                  setPinnedKey(null);
                  setInspector(null);
                }
                handlePanStart(event);
              }}
              onPointerMove={(event) => {
                if (isPanning) {
                  handlePanMove(event);
                  return;
                }
                const svgEl = event.currentTarget;
                const mapped = clientToSvgPoint(svgEl, event.clientX, event.clientY);
                if (!mapped) return;
                if (mapped.x < 0 || mapped.x > W || mapped.y < 0 || mapped.y > H) return;
                setCrosshair({ x: mapped.x, y: mapped.y });
              }}
              onPointerUp={handlePanEnd}
              onPointerCancel={handlePanEnd}
              onPointerLeave={() => {
                setCrosshair(null);
                if (!pinnedKey) setInspector(null);
              }}
              onDoubleClick={handleDoubleClick}
            >
              <desc id={descriptionId}>
                Log-log time-current characteristic with generic relay curves, pickup and instantaneous boundaries, configured study references, exact operating points, active coordination brackets, coordination boundaries, and optional initial-setting comparison.
              </desc>
              <defs>
                <clipPath id={clipId}>
                  <rect x={MARGIN_LEFT} y={MARGIN_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
                </clipPath>
                <pattern id={hatchId} width='7' height='7' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>
                  <line x1='0' y1='0' x2='0' y2='7' stroke='#647786' strokeWidth='1' opacity='.24' />
                </pattern>
                {/* Edge fade mask to smoothly transition content at boundaries */}
                <mask id={`${clipId}-fade`}>
                  <rect x={MARGIN_LEFT} y={MARGIN_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} fill='white' />
                  {/* Fade edges */}
                  <rect x={MARGIN_LEFT} y={MARGIN_TOP} width={PLOT_WIDTH} height='15' fill='url(#fade-top)' />
                  <rect x={MARGIN_LEFT} y={H - MARGIN_BOTTOM - 15} width={PLOT_WIDTH} height='15' fill='url(#fade-bottom)' />
                  <rect x={MARGIN_LEFT} y={MARGIN_TOP} width='15' height={PLOT_HEIGHT} fill='url(#fade-left)' />
                  <rect x={W - MARGIN_RIGHT - 15} y={MARGIN_TOP} width='15' height={PLOT_HEIGHT} fill='url(#fade-right)' />
                </mask>
                <linearGradient id='fade-top' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='black' stopOpacity='0' />
                  <stop offset='100%' stopColor='white' stopOpacity='1' />
                </linearGradient>
                <linearGradient id='fade-bottom' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='white' stopOpacity='1' />
                  <stop offset='100%' stopColor='black' stopOpacity='0' />
                </linearGradient>
                <linearGradient id='fade-left' x1='0' y1='0' x2='1' y2='0'>
                  <stop offset='0%' stopColor='black' stopOpacity='0' />
                  <stop offset='100%' stopColor='white' stopOpacity='1' />
                </linearGradient>
                <linearGradient id='fade-right' x1='0' y1='0' x2='1' y2='0'>
                  <stop offset='0%' stopColor='white' stopOpacity='1' />
                  <stop offset='100%' stopColor='black' stopOpacity='0' />
                </linearGradient>
              </defs>

              <rect className='overcurrent-tcc-plot-bg' x={MARGIN_LEFT} y={MARGIN_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} />

              {/* Grid + axis ticks — positioned via transformed sx/sy */}
              {modelWithBounds.yAxis.ticks.map((tick) => (
                <g key={`y:${tick}`}>
                  <line className='overcurrent-tcc-grid' x1={MARGIN_LEFT} y1={sy(tick)} x2={W - MARGIN_RIGHT} y2={sy(tick)} />
                  <text className='overcurrent-tcc-tick font-eng' x={MARGIN_LEFT - 9} y={sy(tick) + 3} textAnchor='end'>
                    {displayNumber(tick)}
                  </text>
                </g>
              ))}
              {modelWithBounds.xAxis.ticks.map((tick) => (
                <g key={`x:${tick}`}>
                  <line className='overcurrent-tcc-grid' x1={sx(tick)} y1={MARGIN_TOP} x2={sx(tick)} y2={H - MARGIN_BOTTOM} />
                  <text className='overcurrent-tcc-tick font-eng' x={sx(tick)} y={H - MARGIN_BOTTOM + 18} textAnchor='middle'>
                    {displayNumber(tick)}
                  </text>
                </g>
              ))}

              {/* Plot content — curves, points, boundaries, bands */}
              <g clipPath={`url(#${clipId})`}>
                {modelWithBounds.loadRegion && (
                  <rect
                    className='overcurrent-tcc-load-region'
                    data-layer-kind='LOAD_REGION'
                    x={sx(modelWithBounds.loadRegion.minX)}
                    y={MARGIN_TOP}
                    width={Math.max(0, sx(modelWithBounds.loadRegion.maxX) - sx(modelWithBounds.loadRegion.minX))}
                    height={PLOT_HEIGHT}
                    fill={`url(#${hatchId})`}
                  />
                )}

                {modelWithBounds.coordinationBands.map((band) => {
                  const corridorPoints = band.points
                    .filter((point) => finitePositive(point.x) && finitePositive(point.minimumBackupTimeSec))
                    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${sx(point.x)} ${sy(point.minimumBackupTimeSec)}`)
                    .join(' ');
                  const failures = band.points.filter((point) => point.status === 'FAIL');
                  const violationPath = failures.length > 0
                    ? [
                      ...failures.map((point, index) => `${index === 0 ? 'M' : 'L'} ${sx(point.x)} ${sy(point.minimumBackupTimeSec)}`),
                      ...failures.slice().reverse().map((point) => `L ${sx(point.x)} ${sy(point.actualBackupTimeSec)}`),
                      'Z',
                    ].join(' ')
                    : '';
                  return (
                    <g key={band.pairId}>
                      {violationPath && (
                        <path
                          className='overcurrent-tcc-violation'
                          data-layer-kind='COORDINATION_VIOLATION_ENVELOPE'
                          data-pair-id={band.pairId}
                          d={violationPath}
                        />
                      )}
                      {failures.map((point) => (
                        <circle
                          key={`${band.pairId}:${point.x}`}
                          className='overcurrent-tcc-violation-point'
                          cx={sx(point.x)}
                          cy={sy(point.actualBackupTimeSec)}
                          r='2.5'
                        />
                      ))}
                      <path
                        className='overcurrent-tcc-corridor'
                        data-layer-kind='COORDINATION_CORRIDOR'
                        data-pair-id={band.pairId}
                        d={corridorPoints}
                      />
                    </g>
                  );
                })}

                {modelWithBounds.studyReferences.map((reference, index) => (
                  <line
                    key={reference.layerId}
                    className='overcurrent-tcc-reference'
                    data-kind={reference.kind}
                    data-layer-kind={reference.kind === 'FAULT_CURRENT' ? 'FAULT_CURRENT_LINE' : `${reference.kind}_REFERENCE`}
                    x1={sx(reference.x)}
                    y1={MARGIN_TOP}
                    x2={sx(reference.x)}
                    y2={H - MARGIN_BOTTOM}
                    style={{ '--reference-index': index } as CSSProperties}
                  />
                ))}

                {modelWithBounds.boundaries.map((boundary) => (
                  <line
                    key={boundary.layerId}
                    className='overcurrent-tcc-boundary'
                    data-kind={boundary.kind}
                    data-device-id={boundary.deviceId}
                    data-layer-kind={boundary.kind === 'PICKUP' ? 'PICKUP_BOUNDARY' : 'INSTANTANEOUS_BOUNDARY'}
                    x1={sx(boundary.x)}
                    y1={MARGIN_TOP}
                    x2={sx(boundary.x)}
                    y2={H - MARGIN_BOTTOM}
                    style={{ '--tcc-series': SERIES_COLORS[boundary.seriesIndex % SERIES_COLORS.length] } as CSSProperties}
                  />
                ))}

                {modelWithBounds.curves.map((curve) => {
                  const d = pathFromPoints(curve.points, sx, sy);
                  if (!d) return null;
                  const curveKey = `curve:${curve.layerId}`;
                  const selected = curve.selected && !curve.ghost;
                  const style = {
                    '--tcc-series': SERIES_COLORS[curve.seriesIndex % SERIES_COLORS.length],
                  } as CSSProperties;
                  return (
                    <g
                      key={curve.layerId}
                      className='overcurrent-tcc-curve-group'
                      data-selected={selected}
                      data-ghost={curve.ghost}
                      data-device-id={curve.deviceId}
                      data-layer-kind={curve.ghost ? 'INITIAL_SETTING_GHOST' : 'RELAY_CURVE'}
                      style={style}
                    >
                      <path
                        className='overcurrent-tcc-curve-visible operating-point-transition'
                        d={d}
                        strokeDasharray={curve.ghost ? '4 5' : SERIES_DASH[curve.seriesIndex % SERIES_DASH.length]}
                      />
                      <path
                        className='overcurrent-tcc-curve-target'
                        data-inspector-target='true'
                        d={d}
                        role='button'
                        tabIndex={0}
                        aria-label={`${curve.deviceLabel}, ${curve.curveLabel}, pickup ${displayNumber(curve.pickupASecondary)} amperes secondary${curve.ghost ? ', initial setting comparison' : ''}${selected ? ', selected' : ''}. Use left and right arrow keys to inspect the characteristic.`}
                        onClick={() => selectDevice(curve.deviceId)}
                        onKeyDown={(event) => handleCurveKeyDown(curve, event)}
                        onFocus={(event) => inspectCurveAtCenter(curve, event.currentTarget)}
                        onBlur={() => { if (pinnedKey !== curveKey) setInspector(null); }}
                        onPointerEnter={(event) => inspectCurve(curve, event)}
                        onPointerMove={(event) => {
                          if (event.pointerType === 'mouse' || pinnedKey === curveKey) inspectCurve(curve, event);
                        }}
                        onPointerDown={(event) => {
                          if (event.pointerType === 'mouse') return;
                          event.preventDefault();
                          event.stopPropagation();
                          selectDevice(curve.deviceId);
                          pinOrRelease(curveKey, () => inspectCurve(curve, event));
                        }}
                        onPointerLeave={() => { if (pinnedKey !== curveKey) setInspector(null); }}
                      />
                    </g>
                  );
                })}

                {modelWithBounds.coordinationBrackets.map((bracket, bracketIndex) => {
                  const primaryPoint = modelWithBounds.operatingPoints.find((point) => point.deviceId === bracket.primaryDeviceId);
                  const backupPoint = modelWithBounds.operatingPoints.find((point) => point.deviceId === bracket.backupDeviceId);
                  if (!primaryPoint || !backupPoint) return null;
                  if (
                    !finitePositive(primaryPoint.selectedTripTimeSec ?? 0)
                    || !finitePositive(backupPoint.selectedTripTimeSec ?? 0)
                    || primaryPoint.timeOffScale
                    || backupPoint.timeOffScale
                  ) return null;
                  const primaryX = sx(primaryPoint.plottedX);
                  const backupX = sx(backupPoint.plottedX);
                  const primaryY = sy(bracket.primaryTripTimeSec);
                  const backupY = sy(bracket.backupTripTimeSec);
                  const candidateX = Math.max(primaryX, backupX) + 22 + bracketIndex * 13;
                  const bracketX = Math.min(W - MARGIN_RIGHT - 8, Math.max(MARGIN_LEFT + 8, candidateX));
                  const midY = (primaryY + backupY) / 2;
                  return (
                    <g
                      key={bracket.layerId}
                      className='overcurrent-tcc-bracket'
                      data-layer-kind='COORDINATION_BRACKET'
                      data-pair-id={bracket.pairId}
                      data-status={bracket.status}
                      aria-label={`${bracket.label} active CTI ${displayNumber(bracket.observedCtiSec)} seconds, required ${displayNumber(bracket.requiredCtiSec)} seconds, ${bracket.status}`}
                    >
                      <path d={`M ${primaryX} ${primaryY} H ${bracketX} M ${backupX} ${backupY} H ${bracketX} M ${bracketX} ${primaryY} V ${backupY}`} />
                      <path d={`M ${bracketX - 4} ${primaryY} H ${bracketX + 4} M ${bracketX - 4} ${backupY} H ${bracketX + 4}`} />
                      <text x={bracketX - 5} y={midY - 3} textAnchor='end'>
                        Δt {bracket.observedCtiSec >= 0 ? '+' : ''}{displayNumber(bracket.observedCtiSec)} s
                      </text>
                      <text className='overcurrent-tcc-bracket-status' x={bracketX - 5} y={midY + 8} textAnchor='end'>
                        {bracket.status} · req {displayNumber(bracket.requiredCtiSec)} s
                      </text>
                    </g>
                  );
                })}

                {modelWithBounds.operatingPoints.map((point) => {
                  const x = sx(point.plottedX);
                  const y = sy(point.plottedTimeSec);
                  const pointKey = `point:${point.layerId}`;
                  const color = SERIES_COLORS[point.seriesIndex % SERIES_COLORS.length];
                  const noPickup = point.selectedElement === null;
                  const offScale = Boolean(point.xOffScale || point.timeOffScale);
                  return (
                    <g
                      key={point.layerId}
                      className='overcurrent-tcc-point'
                      data-selected={point.selected}
                      data-element={point.selectedElement}
                      data-no-pickup={noPickup}
                      data-offscale={offScale}
                      data-device-id={point.deviceId}
                      data-layer-kind={noPickup ? 'STUDY_MARKER' : 'OPERATING_POINT'}
                      data-inspector-target='true'
                      role='button'
                      tabIndex={0}
                      aria-label={`${point.deviceLabel} operating point, ${pointRole(point)}, relay current ${displayNumber(point.relayCurrentASecondary)} amperes secondary, current multiple ${displayNumber(point.currentMultiple)}, ${timeText(point.selectedTripTimeSec)}${offScale ? ', off-scale' : ''}`}
                      style={{ '--tcc-series': color } as CSSProperties}
                      onClick={() => {
                        selectDevice(point.deviceId);
                        if (point.selectedElement === '50' || (point.selectedElement === '51' && offScale)) playTripAlarm();
                      }}
                      onKeyDown={(event) => keyboardActivate(event, () => {
                        selectDevice(point.deviceId);
                        if (point.selectedElement === '50' || (point.selectedElement === '51' && offScale)) playTripAlarm();
                      })}
                      onFocus={(event) => inspectPointAtMarker(point, event.currentTarget)}
                      onBlur={() => { if (pinnedKey !== pointKey) setInspector(null); }}
                      onPointerEnter={(event) => inspectPoint(point, event)}
                      onPointerMove={(event) => {
                        if (event.pointerType === 'mouse' || pinnedKey === pointKey) inspectPoint(point, event);
                      }}
                      onPointerDown={(event) => {
                        if (event.pointerType === 'mouse') return;
                        event.preventDefault();
                        event.stopPropagation();
                        selectDevice(point.deviceId);
                        pinOrRelease(pointKey, () => inspectPoint(point, event));
                      }}
                      onPointerLeave={() => { if (pinnedKey !== pointKey) setInspector(null); }}
                    >
                      {point.selectedElement === '50' ? (
                        <path className='overcurrent-tcc-point-symbol operating-point-transition' d={`M ${x - 7} ${y - 9} L ${x + 7} ${y - 9} L ${x} ${y + 2} Z`} />
                      ) : noPickup ? (
                        <rect className='overcurrent-tcc-point-symbol operating-point-transition' x={x - 5} y={y - 5} width='10' height='10' transform={`rotate(45 ${x} ${y})`} />
                      ) : (
                        <circle className='overcurrent-tcc-point-symbol operating-point-transition' cx={x} cy={y} r={point.selected ? 6.5 : 5.5} />
                      )}
                      <circle className='overcurrent-tcc-point-target' cx={x} cy={y} r='15' />
                      {offScale && (
                        <g className='overcurrent-tcc-offscale' aria-hidden='true'>
                          {point.timeOffScale === 'LOW' && <path d={`M ${x - 4} ${y - 13} L ${x} ${y - 8} L ${x + 4} ${y - 13}`} />}
                          {point.timeOffScale === 'HIGH' && <path d={`M ${x - 4} ${y + 13} L ${x} ${y + 8} L ${x + 4} ${y + 13}`} />}
                          {point.xOffScale === 'LOW' && <path d={`M ${x + 13} ${y - 4} L ${x + 8} ${y} L ${x + 13} ${y + 4}`} />}
                          {point.xOffScale === 'HIGH' && <path d={`M ${x - 13} ${y - 4} L ${x - 8} ${y} L ${x - 13} ${y + 4}`} />}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Labels and reference markers */}
              {modelWithBounds.studyReferences.map((reference, index) => (
                <text
                  key={`label:${reference.layerId}`}
                  className='overcurrent-tcc-reference-label'
                  data-kind={reference.kind}
                  x={sx(reference.x)}
                  y={MARGIN_TOP + 11 + index * 10}
                  textAnchor='middle'
                >
                  {reference.kind === 'FAULT_CURRENT' ? 'FAULT' : reference.kind === 'MINIMUM_FAULT' ? 'MIN' : 'MAX'}
                </text>
              ))}

              {modelWithBounds.boundaries.map((boundary) => (
                <text
                  key={`label:${boundary.layerId}`}
                  className='overcurrent-tcc-boundary-label'
                  data-kind={boundary.kind}
                  x={sx(boundary.x) + 4}
                  y={H - MARGIN_BOTTOM - 8 - boundary.seriesIndex * 11}
                >
                  {boundary.deviceLabel} {boundary.kind === 'PICKUP' ? '51' : '50'}
                </text>
              ))}

              {modelWithBounds.operatingPoints.filter((point) => point.selectedElement === null || point.xOffScale || point.timeOffScale).map((point) => (
                <text
                  key={`offscale:${point.layerId}`}
                  className='overcurrent-tcc-offscale-label'
                  data-kind={point.selectedElement === null ? 'BELOW_PICKUP' : 'OFF_SCALE'}
                  x={sx(point.plottedX) + (point.xOffScale === 'HIGH' ? -8 : 8)}
                  y={sy(point.plottedTimeSec) + (point.timeOffScale === 'HIGH' ? 18 : -16)}
                  textAnchor={point.xOffScale === 'HIGH' ? 'end' : 'start'}
                >
                  {point.selectedElement === '50' ? '50 · 0 s · OFF-SCALE' : point.selectedElement === null ? 'BELOW PICKUP' : 'OFF-SCALE'}
                </text>
              ))}

              <line className='overcurrent-tcc-axis' x1={MARGIN_LEFT} y1={MARGIN_TOP} x2={MARGIN_LEFT} y2={H - MARGIN_BOTTOM} />
              <line className='overcurrent-tcc-axis' x1={MARGIN_LEFT} y1={H - MARGIN_BOTTOM} x2={W - MARGIN_RIGHT} y2={H - MARGIN_BOTTOM} />
              <text className='overcurrent-tcc-axis-label' x={MARGIN_LEFT + PLOT_WIDTH / 2} y={H - 10} textAnchor='middle'>
                {model.xAxis.label} ({model.xAxis.unit}) · log scale
              </text>
              <text
                className='overcurrent-tcc-axis-label'
                x='16'
                y={MARGIN_TOP + PLOT_HEIGHT / 2}
                textAnchor='middle'
                transform={`rotate(-90 16 ${MARGIN_TOP + PLOT_HEIGHT / 2})`}
              >
                Operating Time (s) · log scale
              </text>

              {crosshair && (
                <g className='overcurrent-tcc-crosshair' aria-hidden='true'>
                  <line
                    className='overcurrent-tcc-crosshair-line'
                    x1={MARGIN_LEFT}
                    y1={crosshair.y}
                    x2={W - MARGIN_RIGHT}
                    y2={crosshair.y}
                  />
                  <line
                    className='overcurrent-tcc-crosshair-line'
                    x1={crosshair.x}
                    y1={MARGIN_TOP}
                    x2={crosshair.x}
                    y2={H - MARGIN_BOTTOM}
                  />
                  <circle
                    className='overcurrent-tcc-crosshair-dot'
                    cx={crosshair.x}
                    cy={crosshair.y}
                    r='3'
                  />
                </g>
              )}
            </svg>
          </OverlayScrollArea>
        </div>
      )}

      <div className='overcurrent-visually-hidden' aria-live='polite' aria-atomic='true'>
        {liveAnnouncement}
      </div>

      <div className='overcurrent-visually-hidden'>
        <p>{`TCC domain: ${model.xAxis.label}. Selected relay: ${selectedCurve?.deviceLabel ?? 'none'}.`}</p>
        {modelWithBounds.operatingPoints.map((point) => (
          <p key={`accessible:${point.layerId}`}>
            {`${point.deviceLabel}, ${pointRole(point)}, relay current ${displayNumber(point.relayCurrentASecondary)} A secondary, current multiple ${displayNumber(point.currentMultiple)}, operating time ${timeText(point.selectedTripTimeSec)}.`}
          </p>
        ))}
        {modelWithBounds.coordinationBrackets.map((bracket) => (
          <p key={`accessible:${bracket.layerId}`}>
            {`${bracket.label}, observed CTI ${displayNumber(bracket.observedCtiSec)} seconds, required ${displayNumber(bracket.requiredCtiSec)} seconds, ${bracket.status}.`}
          </p>
        ))}
      </div>

      <footer className='overcurrent-tcc-footer'>
        <span><i data-kind='pickup' /> 51 pickup</span>
        <span><i data-kind='instantaneous' /> 50 high-set / 0 s off-scale</span>
        <span><i data-kind='fault' /> Active fault</span>
        <span><i data-kind='load' /> Configured load region</span>
        <strong>{currentDomain === 'CURRENT_MULTIPLE' ? 'Relay-relative domain' : 'Common primary-current domain'}</strong>
      </footer>
      {tooltip}
    </section>
  );

  if (!expanded) return content;

  return (
    <EngineeringViewOverlay
      open={expanded}
      title='Time-Current Characteristic'
      onClose={() => setExpanded(false)}
      returnFocusRef={expandButtonRef}
      className='engineering-view-overlay-tcc'
    >
      {content}
    </EngineeringViewOverlay>
  );
}

/**
 * O16 performance: playback updates the page-level timeline snapshot every
 * animation frame. The TCC depends only on reducer state, so memoization keeps
 * the 181-point curve tree from re-rendering per frame.
 */
export const TimeCurrentCurve = memo(TimeCurrentCurveComponent);
