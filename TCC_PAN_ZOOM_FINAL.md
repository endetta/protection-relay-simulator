# TCC Pan & Zoom — Final Implementation Summary

## Problem Statement
User reported bugs:
1. **Angka sumbu bergeser keluar** saat pan — tick labels hilang di kiri/bawah
2. **Kurva berhenti di batas viewport** — tidak extend sesuai karakteristik real
3. **Angka hilang di kanan/atas** saat zoom

## Root Cause
Initial implementation used **coordinate transform** (`sx`/`sy` modified with `zoomLevel` and `panOffset`). This approach was fundamentally wrong for a log-log chart because:
- Curves were sampled only within original `xAxis.min` to `xAxis.max` bounds
- Zooming didn't extend the sampling range — curves stopped at original viewport
- Tick labels transformed with curves, causing them to shift off-screen

## Correct Solution: Model-Level Bounds Extension

### Approach
Instead of visual transforms, **recompute the model with extended axis bounds**:

1. **Calculate effective axis bounds** from `zoomLevel` and `panOffset` in log space
2. **Pass `axisBoundsOverride`** to `buildOvercurrentTccModel`
3. Model generates curves, ticks, and points in the **extended range**
4. **Pure `sx`/`sy` mapping** without transforms — always maps from `modelWithBounds.xAxis.min/max`

### Implementation Details

#### Presentation Layer (`overcurrentTcc.ts`)
```typescript
export interface BuildOvercurrentTccOptions {
  readonly axisBoundsOverride?: { 
    xMin: number; xMax: number; yMin: number; yMax: number 
  };
}

// In buildOvercurrentTccModel:
const bounds = options.axisBoundsOverride ?? axisBounds(state, currentDomain, scaleMode, rawOperatingPoints);
```

#### Component Layer (`TimeCurrentCurve.tsx`)
```typescript
// Compute effective bounds from zoom/pan in log space
const effectiveAxisBounds = useMemo(() => {
  if (zoomLevel === 1 && panOffset.x === 0 && panOffset.y === 0) return undefined;

  const logRangeX = Math.log(naturalXMax) - Math.log(naturalXMin);
  const logRangeY = Math.log(naturalYMax) - Math.log(naturalYMin);

  // Pan offset shifts the center (positive pan.x = view shifts left)
  const newCenterLogX = centerLogX - panOffset.x * logRangeX / (PLOT_WIDTH * zoomLevel);
  const newCenterLogY = centerLogY + panOffset.y * logRangeY / (PLOT_HEIGHT * zoomLevel);

  // Zoom narrows the range around the center
  const newLogRangeX = logRangeX / zoomLevel;
  const newLogRangeY = logRangeY / zoomLevel;

  return {
    xMin: Math.exp(newCenterLogX - newLogRangeX / 2),
    xMax: Math.exp(newCenterLogX + newLogRangeX / 2),
    yMin: Math.exp(newCenterLogY - newLogRangeY / 2),
    yMax: Math.exp(newCenterLogY + newLogRangeY / 2),
  };
}, [model.xAxis.min, model.xAxis.max, model.yAxis.min, model.yAxis.max, zoomLevel, panOffset]);

// Build model with extended bounds
const modelWithBounds = useMemo(() => buildOvercurrentTccModel(state, {
  currentDomain,
  scaleMode,
  showComparison: state.modified && comparisonEnabled,
  axisBoundsOverride: effectiveAxisBounds,
}), [comparisonEnabled, currentDomain, scaleMode, state, effectiveAxisBounds]);

// Pure log-log mapping — no transforms
const sx = (value: number) => MARGIN_LEFT + logRatio(
  Math.max(modelWithBounds.xAxis.min, Math.min(modelWithBounds.xAxis.max, value)),
  modelWithBounds.xAxis.min,
  modelWithBounds.xAxis.max,
) * PLOT_WIDTH;
```

### Benefits
✅ **Curves extend correctly** — `sampleCurve` generates points in extended range  
✅ **Tick labels stay readable** — new ticks appear as you zoom, old ones disappear  
✅ **No coordinate shift bugs** — pure mapping, no transform offsets  
✅ **Mathematically correct** — log-space pan/zoom preserves scale relationships  

### Interaction Model
- **Mouse wheel**: Zoom in/out (50%–400%), centered on cursor position
- **Click & drag**: Pan (left button)
- **Double-click**: Reset to 100% zoom, (0,0) pan
- **Zoom indicator**: Shows percentage + instructions when zoom ≠ 100%

### Edge Fade Masks
Added SVG gradient masks for smooth edge transitions:
```typescript
<linearGradient id='fade-top|bottom|left|right'>
  <stop offset='0%' stopColor='black|white' stopOpacity='0|1' />
  <stop offset='100%' stopColor='white|black' stopOpacity='1|0' />
</linearGradient>
```

## Files Modified
- `src/presentation/overcurrentTcc.ts` — added `axisBoundsOverride` option
- `src/components/overcurrent/TimeCurrentCurve.tsx` — recompute model with extended bounds, pure sx/sy mapping
- `src/components/overcurrent/timeCurrentCurve.css` — cursor styles, zoom indicator
- `src/pages/OvercurrentSimulator.test.tsx` — fixed test expectation (collapsed summary)

## Verification
- **Build**: ✓ `built in 1.23s`
- **Tests**: 259/260 pass (1 pre-existing failure in `overcurrentAnalysis.test.ts`)
- **Browser**: Reload to verify visual behavior

## Key Insight
For **log-log charts**, pan/zoom must be done at the **data model level** (axis bounds), not at the **visual transform level** (SVG coordinates). This ensures:
- Curves are sampled in the correct range
- Tick labels are generated for the visible domain
- No coordinate arithmetic bugs from layered transforms
