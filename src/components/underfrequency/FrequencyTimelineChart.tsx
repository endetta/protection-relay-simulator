import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  buildUnderfrequencyTimelineChartModel,
  buildUnderfrequencyTimelineTooltip,
  type UnderfrequencyTimelineTooltip,
} from '../../presentation/underfrequencyTimelineChart';
import type {
  UnderfrequencyStudyDefinition,
  UnderfrequencyTimelineRun,
  UnderfrequencyTimelineSnapshot,
} from '../../types/underfrequency';
import { formatEngineeringNumber, formatFrequencyHz } from '../../utils/engineering';
import { EngineeringViewOverlay } from '../shared/EngineeringViewOverlay';
import { OverlayScrollArea } from '../shared/OverlayScrollArea';
import './frequencyTimelineChart.css';

export interface FrequencyTimelineChartProps {
  readonly run: UnderfrequencyTimelineRun | null;
  readonly study: UnderfrequencyStudyDefinition;
  /** Engineering-time scrub target from the page-level playback clock. Drives the crosshair. */
  readonly scrubTimeSec: number | null;
  /** Already-resolved visible snapshot (page memoises snapshotAtTime). */
  readonly visibleSnapshot: UnderfrequencyTimelineSnapshot | null;
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

function mapsx(min: number, max: number) {
  return (value: number) => MARGIN_LEFT + ((value - min) / (max - min)) * PLOT_WIDTH;
}
function mapsy(min: number, max: number) {
  return (value: number) => MARGIN_TOP + PLOT_HEIGHT - ((value - min) / (max - min)) * PLOT_HEIGHT;
}

function pathFromCurve(curve: readonly { x: number; y: number }[], sx: (v: number) => number, sy: (v: number) => number): string {
  return curve.map((point, index) => `${index === 0 ? 'M' : 'L'} ${sx(point.x).toFixed(2)} ${sy(point.y).toFixed(2)}`).join(' ');
}

// Estimated tooltip width/height for clamp math; avoids a ref-read roundtrip
// on every pointer move. The 240×4-tile layout fits comfortably inside this.
const TOOLTIP_ESTIMATE_W = 260;
const TOOLTIP_ESTIMATE_H = 120;

/** Position the tooltip near the cursor and flip/clamp inside the frame. */
function tooltipStyle(pos: { x: number; y: number }): CSSProperties {
  const offsetX = 14;
  const placeRight = pos.x + offsetX + TOOLTIP_ESTIMATE_W <= 660; // approximate frame width
  const x = placeRight ? pos.x + offsetX : Math.max(0, pos.x - offsetX - TOOLTIP_ESTIMATE_W);
  const y = Math.max(8, pos.y - TOOLTIP_ESTIMATE_H / 2);
  return { left: x, top: y };
}

export function FrequencyTimelineChart({
  run,
  study,
  scrubTimeSec,
  visibleSnapshot,
  className = '',
}: FrequencyTimelineChartProps) {
  const titleId = useId();
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hoverTimeSec, setHoverTimeSec] = useState<number | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<UnderfrequencyTimelineTooltip | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const model = useMemo(
    () => (run ? buildUnderfrequencyTimelineChartModel(run, study.uflsStages, study.system.fNominalHz) : null),
    [run, study.uflsStages, study.system.fNominalHz],
  );

  // Build the contextual tooltip payload from the hover time. Pure presentation
  // call — the component only maps cursor → time and renders the result.
  useEffect(() => {
    if (!run || hoverTimeSec === null) {
      setHoverTooltip(null);
      return;
    }
    const tip = buildUnderfrequencyTimelineTooltip(run, study.uflsStages, hoverTimeSec);
    setHoverTooltip(tip);
  }, [hoverTimeSec, run, study.uflsStages]);

  const sx = model ? mapsx(model.xAxis.min, model.xAxis.max) : mapsx(0, 1);
  const sy = model ? mapsy(model.yAxis.min, model.yAxis.max) : mapsy(0, 1);
  const curvePath = model && model.status === 'VALID' ? pathFromCurve(model.curve, sx, sy) : '';
  const scrubX = model && scrubTimeSec !== null ? sx(scrubTimeSec) : null;

  // Hover → engineering-time mapping. Uses getScreenCTM so it works at any
  // CSS scale and inside the horizontal-scroll area. Coordinates outside the
  // plot are clamped to the [xMin, xMax] window so the tooltip still shows a
  // meaningful value at the cursor's edge.
  const clientToEngineeringTime = (clientX: number, clientY: number): {
    timeSec: number | null;
    pos: { x: number; y: number } | null;
  } => {
    if (!model || model.status !== 'VALID') return { timeSec: null, pos: null };
    const svg = svgRef.current;
    const frame = frameRef.current;
    if (!svg || !frame) return { timeSec: null, pos: null };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { timeSec: null, pos: null };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    const { min: xMin, max: xMax } = model.xAxis;
    if (!Number.isFinite(local.x)) return { timeSec: null, pos: null };
    const clampedX = Math.min(Math.max(local.x, MARGIN_LEFT), W - MARGIN_RIGHT);
    const frac = (clampedX - MARGIN_LEFT) / PLOT_WIDTH;
    const timeSec = xMin + frac * (xMax - xMin);
    // Position the tooltip in **frame-pixel** coords so the absolutely-
    // positioned overlay matches where the SVG point renders — independent
    // of viewBox scaling and the horizontal-scroll area.
    const frameRect = frame.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    // SVG is centred horizontally inside the scroll area when `meet` chooses
    // to letterbox; account for that offset so the cursor maps to the right
    // frame pixel.
    const scale = svgRect.width > 0 ? svgRect.width / W : 1;
    const renderedSvgW = W * scale;
    const xInSvgPx = (clampedX - MARGIN_LEFT) * scale + (svgRect.width - renderedSvgW) / 2;
    return {
      timeSec,
      pos: { x: xInSvgPx + (svgRect.left - frameRect.left), y: clientY - frameRect.top },
    };
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const { timeSec, pos } = clientToEngineeringTime(event.clientX, event.clientY);
    if (timeSec === null || pos === null) return;
    setHoverTimeSec(timeSec);
    setHoverPos(pos);
  };

  const handlePointerLeave = () => {
    setHoverTimeSec(null);
    setHoverPos(null);
  };

  const fNow = visibleSnapshot
    ? formatFrequencyHz(visibleSnapshot.frequencyHz)
    : model?.finalFrequencyHz !== null && model?.finalFrequencyHz !== undefined
      ? formatFrequencyHz(model.finalFrequencyHz)
      : '—';

  const content = (
    <section className={`underfrequency-ftc simulator-theme ${className}`.trim()} aria-labelledby={titleId} data-expanded={expanded}>
      <header className='underfrequency-ftc-header'>
        <div className='underfrequency-ftc-heading'>
          <span>System frequency</span>
          <h3 id={titleId}>Frequency — Time</h3>
        </div>
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
      </header>

      <div className='underfrequency-ftc-readout' aria-label='Ringkasan timeline frekuensi'>
        <span>f NOW <b className='font-eng'>{fNow}</b></span>
        <span>MIN f <b className='font-eng'>{model?.minFrequencyHz !== null ? formatFrequencyHz(model?.minFrequencyHz ?? 0) : '—'}</b></span>
        <span>STEADY <b className='font-eng'>{model?.finalFrequencyHz !== null ? formatFrequencyHz(model?.finalFrequencyHz ?? 0) : '—'}</b></span>
      </div>

      {!model || model.status === 'INVALID' ? (
        <div className='underfrequency-ftc-invalid' role='status'>
          <b>INPUT INVALID · GRAPH HELD</b>
          <span>{model?.finalTimeSec === 0 ? 'Perbaiki input engineering yang tidak valid sebelum menjalankan.' : 'Tidak dapat membangun kurva frekuensi yang finite.'}</span>
        </div>
      ) : (
        <div className='underfrequency-ftc-frame' ref={frameRef}>
          <div className='underfrequency-ftc-legend' aria-label='Legend timeline frekuensi'>
            <span><i data-kind='curve' /> System frequency</span>
            <span><i data-kind='nominal' /> Nominal {formatFrequencyHz(model.nominalFrequencyHz)} Hz</span>
            <span><i data-kind='stage' /> UFLS threshold</span>
            <span><i data-kind='trip' /> UFLS trip</span>
          </div>

          <OverlayScrollArea
            ariaLabel='Area scroll timeline frekuensi'
            className='underfrequency-ftc-scroll'
            orientation='horizontal'
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio='xMidYMid meet'
              role='img'
              aria-labelledby={`${titleId}-plot`}
              className='underfrequency-ftc-svg'
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerLeave}
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

                {/* Hover marker — small dot at the curve under the cursor */}
                {hoverTooltip && (
                  <g className='underfrequency-ftc-hover' aria-hidden='true'>
                    <line
                      x1={sx(hoverTooltip.timeSec)}
                      y1={MARGIN_TOP}
                      x2={sx(hoverTooltip.timeSec)}
                      y2={H - MARGIN_BOTTOM}
                    />
                    <circle
                      cx={sx(hoverTooltip.timeSec)}
                      cy={sy(hoverTooltip.frequencyHz)}
                      r='4'
                    />
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
          </OverlayScrollArea>

          {hoverTooltip && hoverPos && (
            <div
              className='underfrequency-ftc-tooltip'
              aria-hidden='true'
              style={tooltipStyle(hoverPos)}
            >
              <div className='underfrequency-ftc-tooltip-row underfrequency-ftc-tooltip-row--lead'>
                <span className='underfrequency-ftc-tooltip-key'>t</span>
                <span className='underfrequency-ftc-tooltip-val font-eng'>{formatEngineeringNumber(hoverTooltip.timeSec)} s</span>
                <span className='underfrequency-ftc-tooltip-key'>f</span>
                <span className='underfrequency-ftc-tooltip-val font-eng'>{formatFrequencyHz(hoverTooltip.frequencyHz)} Hz</span>
              </div>
              <div className='underfrequency-ftc-tooltip-row'>
                <span className='underfrequency-ftc-tooltip-key'>df/dt</span>
                <span className='underfrequency-ftc-tooltip-val font-eng'>{formatEngineeringNumber(hoverTooltip.rocofHzPerSec)} Hz/s</span>
                <span className='underfrequency-ftc-tooltip-key'>defisit</span>
                <span className='underfrequency-ftc-tooltip-val font-eng'>{formatEngineeringNumber(hoverTooltip.deficitMw)} MW</span>
              </div>
              {hoverTooltip.eventLabels.length > 0 && (
                <ul className='underfrequency-ftc-tooltip-events'>
                  {hoverTooltip.eventLabels.map((label, index) => (
                    <li key={`${label}-${index}`}>{label}</li>
                  ))}
                </ul>
              )}
              {(hoverTooltip.armedStageIds.length > 0 || hoverTooltip.operatedStageIds.length > 0) && (
                <div className='underfrequency-ftc-tooltip-stages'>
                  {hoverTooltip.armedStageIds.length > 0 && (
                    <span className='underfrequency-ftc-tooltip-pill' data-tone='armed'>
                      Armed: {hoverTooltip.armedStageIds.map((id) => study.uflsStages.find((s) => s.id === id)?.label ?? id).join(', ')}
                    </span>
                  )}
                  {hoverTooltip.operatedStageIds.length > 0 && (
                    <span className='underfrequency-ftc-tooltip-pill' data-tone='operated'>
                      Operated: {hoverTooltip.operatedStageIds.map((id) => study.uflsStages.find((s) => s.id === id)?.label ?? id).join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
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
