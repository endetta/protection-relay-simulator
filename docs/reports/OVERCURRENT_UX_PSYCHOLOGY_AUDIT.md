# Overcurrent Relay Simulator — Psychology-Driven UX Audit

**Date:** 2026-08-28
**Methodology:** Senior UI/UX Reviewer framework (Layer 1: Surface, Layer 2: Perception, Engineering-UX heuristics)
**Scope:** `/simulator/overcurrent` route and all related components

---

## Executive Summary

The Overcurrent Relay Simulator passes the **identity and subconscious-trust tests** (reads as engineering software in <1 second) but **fails the scanability and cognitive-load tests** (brain has to work too hard to find the answer). The module exhibits the classic "wall of knobs" anti-pattern common in protection engineering software.

### Scorecard Summary

| Layer | Score | Status |
|---|---|---|
| Layer 1 (Surface) | 10/12 | Strong foundation |
| Layer 2 (Perception) | 7/12 | Eye-tracking and cognitive-load issues |
| Engineering-UX | 6/8 | Direct manipulation excellent; progressive disclosure needs work |
| **Total** | **23/32** | **NEEDS-FIX (P0 architecture)** |

---

## Layer 1 — Surface Audit (12/12)

### 1. Product Identity (2/2)
**PASS** — Dark engineering surface, no marketing language, no gradients, no ornamental icons. Reads as laboratory instrumentation.

### 2. Information Hierarchy (1/2)
**PARTIAL** — Header status good; but TCC, SLD, Operating Sequence stacked vertically compete for primacy in the Live column.

### 3. Engineering-Data Prominence (2/2)
**PASS** — `font-eng` (IBM Plex Mono) on numbers, units present, CTI/trip times readable.

### 4. Responsive (2/2)
**PASS** — 24% / 49% / 27% desktop → 42% / 58% tablet → stacked mobile. No overflow detected at 414px.

### 5. Accessibility (2/2)
**PASS** — P0+P1 a11y audit fixes applied: skip link, focus-visible, ARIA labels, WCAG AA contrast.

### 6. Consistency (1/2)
**PARTIAL** — SectionSummary uses tokens; raw RGBA still in some places (O16 RC2 override block).

---

## Layer 2 — Perception Audit (7/12)

### 7. Visual Scanability — F/Z-Pattern (1/2)
**PARTIAL** — F-pattern issue: the eye lands on the header, then Parameters (left), but the primary engineering viz (TCC) is buried in the center column with the Analysis competing to its right. At 300ms, the user sees three equal-weight columns; at 800ms, the eye has not yet found the primary visualization.

**Visual scan-trace:**
| Time | Where eye lands | Verdict |
|---|---|---|
| 0ms | Header bar (top-left) | ✓ Identity confirmed |
| 300ms | Header status badge (top-right) | ✓ "READY" → knows relay state |
| 800ms | Left column: Parameters, scrolling begins | ✗ Brain hasn't seen primary viz yet |
| 1500ms | Center column top: TCC, then SLD, then Operating Sequence | ✗ Three stacked panels, no primacy signal |
| 3000ms | Right column: 7 ParameterGroups, equal weight | ✗ Cognitive overload, no clear "answer" |

### 8. Gestalt Closure — Grouping (1/2)
**PARTIAL** — Parameters grouped by ParameterGroup (proximity ✓), but the Analysis zone has 7-8 ParameterGroups stacked with uniform weight; nothing tells the brain which one is the "answer."

### 9. Figure-Ground Separation (1/2)
**PARTIAL** — TCC has a dark plot bg + accent curve. SLD is monochrome. Operating Sequence is a thin progress row. All three blend into the panel. The primary viz should "pop" in grayscale — currently it doesn't dominate.

### 10. Cognitive Load — Hick's Law, Miller's 7±2 (1/2)
**PARTIAL** — Parameters column shows 4+ ParameterGroups with 6-12 fields each (12-20 fields visible). Analysis column shows 7-8 ParameterGroups. Both exceed Miller's 7±2 working memory limit.

### 11. Color Psychology — Engineering Context (2/2)
**PASS** — Red=TRIP, green=RESTRAIN, amber=PICKUP, blue=interaction. No misuses.

### 12. Subconscious Trust — 1-Second Test (2/2)
**PASS** — Compact header, monospace numbers, dark engineering surface. Reads "professional protection workstation" in <1 second.

---

## Engineering-UX Heuristics (6/8)

### 13. Data-Ink Ratio — Tufte (1/2)
**PARTIAL** — Dead CSS duplicate selectors (now removed). The Analysis zone has ~7 micro-cards (8.5px text) — data-ink OK but pixel-heavy.

### 14. Progressive Disclosure (1/2)
**PARTIAL** — ParameterGroup is collapsible ✓, but most are `defaultOpen={true}` so the user sees 4-5 sections at once in Parameters.

### 15. Direct Manipulation (2/2)
**PASS** — NumberField changes dispatch immediately; useReducer updates state; TCC/Analysis re-derive from state. No "Calculate" button.

### 16. Error Prevention — Norman (2/2)
**PASS** — Inline `aria-invalid`, amber border, `overcurrent-invalid-banner` explains the hold.

---

## P0 Psychology Blockers (3)

### P0-1: Three Equal-Weight Visualizations in Live Column
**File:** `src/pages/OvercurrentSimulator.tsx:130-148`
**Psychology:** F-pattern primacy violation. At 0-800ms the eye scans Parameters (left) → TCC (top center) → Analysis (right). All three columns have equal visual mass. The TCC is NOT in the first fixation because the user must first locate it within a tall, scrolling column. The primary engineering viz must be the single brightest/largest element (figure-ground principle).

**Recommended Fix:**
- Make the TCC the full-height primary viz (≥60% of live column first viewport)
- Move SLD to a horizontal strip below TCC (h: 60-80px) with only the active fault path accented
- Move Operating Sequence to a compact horizontal timeline strip at the bottom of the live column
- This frees the TCC to dominate the visual hierarchy

**Effort:** 2-3 hours (layout restructure + responsive testing)

### P0-2: 8 Analysis Sections at Uniform Weight
**File:** `src/components/overcurrent/OvercurrentAnalysisPanel.tsx:69-265`
**Psychology:** Gestalt similarity failure. User sees Status, Guided Challenge, Operating Order, Coordination Audit, Relay Current, Setting Impact, Calculation Details, Events — 8 sections. Brain cannot identify which is the "answer" (working memory overload). Gestalt similarity (all look the same) → brain treats them as equally important.

**Recommended Fix:**
- Reorder by priority: Status (always open, top) → Violations/Worst Case (if any) → Margins → Details
- Collapse low-priority sections by default (events, calculation details)
- Visually distinguish "the answer" (violations) with a left-border accent color (red/amber) that persists when collapsed
- Move Guided Challenge to the bottom or behind a toggle (it's a tutorial, not an answer)

**Effort:** 3-4 hours (state management + visual hierarchy)

### P0-3: 12-20 Parameter Fields Visible Simultaneously
**File:** `src/components/overcurrent/OvercurrentParameterPanel.tsx:205+`
**Psychology:** Miller's 7±2 violation + Hick's law. Each visible control adds decision time; 20 controls = log₂(20)×processing = ~4.3× baseline. User's first-time experience is "wall of knobs."

**Recommended Fix:**
- Show only Study + System + first device on initial load
- Collapse per-device ParameterGroups when the device is not selected
- Use a "reveal advanced" toggle for the 50/instantaneous element, breaker, CTI budget, and Reset controls (group them under "Advanced" subheader)
- Default-open only 2-3 critical sections, collapse the rest

**Effort:** 2-3 hours (default state logic + Advanced toggle component)

---

## P1/P2 Polish Fixes Applied (Phase 1 — Completed)

The following P1 and P2 issues were addressed in the P0+P1 fix pass and in the Option 4 polish pass:

### P1 Fixes Applied
- ✅ Anchor nav active state with `aria-current` and IntersectionObserver (Z-pattern wayfinding)
- ✅ Analysis zone text sizes bumped from 8.5px to 9-9.5px (readability)
- ✅ Speed-control group wrapper removed (Gestalt common-fate)
- ✅ TCC legend dimmed at 70% opacity, full on hover (figure-ground)
- ✅ INPUT INVALID banner deduplication (page-level + analysis-level)
- ✅ CTI margin status markers (● PASS / ▲ FAIL / ■ N/E)
- ✅ aria-pressed on all selection buttons (WCAG 2.1 SC 4.1.2)
- ✅ aria-describedby on NumberField error messages
- ✅ aria-live regions for keyboard navigation announcements
- ✅ Focus-visible on all interactive elements

### P2 Fixes Applied
- ✅ SummaryMetric numeric values wrapped in `font-eng`
- ✅ Redundant `.simulator-theme.overcurrent-analysis-panel` CSS removed
- ✅ Dead O16 RC2 duplicate selectors removed
- ✅ Speed control redundant `<div>` wrapper removed

---

## Recommended Next Steps

1. **Create O17 release** dedicated to P0 architecture work (visual hierarchy + cognitive load)
2. **Coordinate with Differential R10 (FROZEN)** before modifying shared `SimulatorHeader` or `SimulatorLayout` for major layout changes
3. **Run psychology-driven eye-tracking test** with 3-5 protection engineers before/after to validate improvement
4. **Document the new layout patterns** in `docs/frontend-design-guide.md` for future relay modules (Distance, Underfrequency)

---

## 1-Second Test Result

**Before:** Showed the screenshot to a hypothetical engineer for 1 second. They would say: *"That's a protection relay workstation."* — **PASS** for identity. But after 3 seconds: *"Where's the answer? There are a lot of panels."* — **FAIL** for hierarchy.

**After P0 fixes (projected):** The engineer would identify the TCC as the primary viz within 500ms, find the engineering answer (violations) within 2 seconds, and have <7 parameters visible at once. **Expected: PASS** for both identity and hierarchy.

---

## Files Modified in Phase 1 (P1/P2 Polish)

- `src/index.css` — anchor nav active state, focus-visible rules
- `src/layouts/SimulatorLayout.tsx` — IntersectionObserver for active section
- `src/components/overcurrent/OvercurrentParameterPanel.tsx` — speed control wrapper removal
- `src/components/overcurrent/overcurrentAnalysisPanel.css` — text sizes, dead code removal
- `src/components/overcurrent/OvercurrentAnalysisPanel.tsx` — banner dedup, font-eng wrapping
- `src/components/overcurrent/timeCurrentCurve.css` — legend dimming

**Build status:** PASS (113.73 kB CSS, 478.27 kB JS)
**Tests:** 259/260 pass (1 pre-existing failure in `overcurrentAnalysis.test.ts` — unrelated to UI changes)
