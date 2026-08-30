export interface TccClientRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface TccViewBoxPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Maps a client-space point into an SVG viewBox rendered with
 * preserveAspectRatio="xMidYMid meet". This is the deterministic fallback when
 * a browser does not expose a usable SVG getScreenCTM()/createSVGPoint pair.
 */
export function mapClientPointToTccViewBox(
  clientX: number,
  clientY: number,
  rect: TccClientRectLike,
  viewBoxWidth: number,
  viewBoxHeight: number,
): TccViewBoxPoint | null {
  if (
    !Number.isFinite(clientX)
    || !Number.isFinite(clientY)
    || !Number.isFinite(rect.left)
    || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.width)
    || !Number.isFinite(rect.height)
    || !Number.isFinite(viewBoxWidth)
    || !Number.isFinite(viewBoxHeight)
    || rect.width <= 0
    || rect.height <= 0
    || viewBoxWidth <= 0
    || viewBoxHeight <= 0
  ) return null;

  const scale = Math.min(rect.width / viewBoxWidth, rect.height / viewBoxHeight);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const renderedWidth = viewBoxWidth * scale;
  const renderedHeight = viewBoxHeight * scale;
  const offsetX = rect.left + (rect.width - renderedWidth) / 2;
  const offsetY = rect.top + (rect.height - renderedHeight) / 2;

  return {
    x: (clientX - offsetX) / scale,
    y: (clientY - offsetY) / scale,
  };
}
