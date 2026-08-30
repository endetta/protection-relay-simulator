# Overcurrent Relay O14 — Responsive / Accessibility / UX Refinement

**Status:** IMPLEMENTED / PASS  
**Date:** 2026-08-14  
**Parent:** O13 Coordination Guided Challenges trusted baseline  
**Scope owner:** presentation and interaction hardening only

## 1. Objective

O14 hardens the accepted Overcurrent presentation for responsive, keyboard, touch, focus, reduced-motion, invalid-state, and expanded-engineering-view use without changing relay calculations or study semantics.

The engineering flow remains:

`Input → Validation → Engineering Model → Protection Logic → Simulator State → Output → Visualization`

O14 changes only the final interaction/visualization boundary. O03–O13 numerical and study results remain authoritative.

## 2. Scope boundaries

Included:
- responsive reflow inside the existing Overcurrent SLD, TCC, Operating Sequence, Parameter, Analysis, and Guided Challenge components;
- larger coarse-pointer/touch targets;
- visible keyboard focus;
- high-level accessible status semantics;
- progress semantics for the Operating Sequence;
- non-visual textual TCC engineering equivalent;
- keyboard TCC point inspection;
- SLD/TCC expanded engineering overlay;
- modal Escape/Tab/focus-return/body-scroll behavior;
- reduced-motion presentation behavior;
- narrow-screen internal graph/SLD scrolling where preserving engineering readability is preferable to shrinking the diagram.

Explicitly excluded:
- Overcurrent page/route activation;
- Homepage modification;
- O15 composition/integration;
- O16 release/freeze work;
- relay, CT, coordination, timeline, challenge, or preset engineering changes;
- new protection functions;
- persistent user progress or report/export features.

## 3. Protected engineering baseline

O14 does not modify:
- `src/engines/*`;
- `src/studies/*`;
- `src/types/*`;
- `src/presentation/*` engineering/presentation models;
- `src/utils/overcurrentState.ts`;
- Differential source;
- `src/App.tsx`, existing pages, routes, and layouts.

This is intentional. Route-level Overcurrent page composition remains O15.

## 4. Expanded engineering view

A reusable additive component was introduced:

- `src/components/shared/EngineeringViewOverlay.tsx`
- `src/components/shared/engineeringViewOverlay.css`

Consumers in O14:
- Radial SLD;
- Time-Current Characteristic.

Behavior:
- React portal inside the same simulator state tree;
- no `window.open()` and no new route;
- modal dialog semantics;
- Escape closes;
- Tab is trapped within the overlay;
- background body scroll is locked while open;
- focus returns to the originating Expand button after close;
- most of the viewport is used while preserving a visible close control;
- overlay z-index stays below existing high-priority tooltip layers so engineering inspection remains readable.

No duplicate engineering state is created.

## 5. Radial SLD refinement

O14 keeps O09's engineering model unchanged and refines only the component/CSS:
- explicit Expand control;
- keyboard-focusable scroll region;
- accessible diagram status;
- internal horizontal scrolling on very narrow viewports instead of page overflow or unreadable scaling;
- larger coarse-pointer device/fault interaction areas;
- touch-safe fault scrubber behavior;
- reduced decorative motion when `prefers-reduced-motion: reduce` is active.

Current-path, primary/backup, breaker, isolation, and fault-location semantics remain O05/O07/O09-owned.

## 6. TCC refinement

O10H remains the source of engineering truth. O14 adds:
- Expand control;
- correct SVG-to-client focus-tooltip conversion through `getScreenCTM()` with deterministic `xMidYMid meet` fallback;
- keyboard inspection with Left/Right and Home/End;
- textual engineering equivalent for operating current, current multiple, operating time, and active CTI brackets;
- responsive control wrapping and compact readout behavior;
- minimum readable graph area in expanded mode;
- coarse-pointer target expansion;
- narrow-screen internal graph scrolling rather than destructive chart shrinking.

O10H semantics remain unchanged:
- adjacent-tier CTI brackets;
- strict below-pickup vs finite off-scale distinction;
- 50 exact-zero representation;
- Fit Point rules;
- engine-sampled 51 curves;
- initial/current comparison.

## 7. Operating Sequence refinement

O11 timing semantics are unchanged. O14 adds:
- high-level `role=status` live state;
- overall and per-device `role=progressbar` semantics;
- responsive row reflow that retains Expected and Trip engineering times on narrow screens;
- larger coarse-pointer playback targets;
- visible keyboard focus.

Playback speed continues to affect wall-clock animation only, never engineering time.

## 8. Parameter / Analysis / Guided Challenge refinement

Parameter UI:
- responsive one-column fallbacks for narrow form groups;
- larger touch targets for number fields, selects, speed, actions, and collapsible section headers;
- high-level status live region;
- engineering locks/validation/reducer behavior unchanged.

Analysis:
- responsive measurement, margin, and event rows;
- visible focus on selectable rows and Run Coordination Test;
- high-level status live region;
- O12 calculation/coordination content unchanged.

Guided Challenge:
- visible keyboard focus;
- coarse-pointer controls;
- challenge status live region;
- disabled Run Coordination Test title clarifies active-run/invalid-state lock;
- O13 objective, completion, hint, and Why This Works semantics unchanged.

## 9. Accessibility principles applied

O14 uses native controls where they already exist and adds semantics only where they convey meaningful state.

Implemented contracts include:
- visible `:focus-visible` treatment;
- keyboard-operable Expand/Close controls;
- modal focus containment and restoration;
- high-level polite state announcements instead of high-frequency engineering-detail announcements;
- textual TCC equivalent for critical graph information;
- progressbar semantics for sequence progress;
- status continues to include text labels, not color alone;
- coarse-pointer media rules for touch targets;
- reduced-motion rules without modifying engineering timing.

O14 does not claim formal WCAG certification. It records the concrete interactions and static semantics tested in this gate.

## 10. Responsive composition boundary

The Overcurrent page/route is intentionally still absent in O14. Therefore O14 cannot truthfully claim final route-level three-column page composition testing. That integration is O15 by approved roadmap.

O14 instead makes every currently accepted Overcurrent visual/control component responsive and overlay-capable while leaving the shared `SimulatorLayout`, `App.tsx`, and Homepage frozen. O15 may compose these accepted components without reopening their engineering logic.

## 11. Verification

Executed in the current environment:
- O13 SHA baseline verification — PASS;
- global TypeScript pure Overcurrent compile — PASS;
- targeted modified-component TypeScript compile using temporary React environment declarations — PASS;
- 80 TS/TSX syntax-transpile files / 0 diagnostics — PASS;
- O14 runtime/parent regression — 2,018,517 explicit checks PASS;
- 14 preset model sweep — PASS;
- COORD-01..06 intentional-initial-failure contracts — PASS;
- COORD-01..06 test-only solved-reference VERIFIED contracts — PASS;
- 1,000 deterministic setting-fuzz iterations — PASS;
- no NaN/Infinity leakage through state/SLD/TCC/sequence/analysis/guided models — PASS;
- UX/accessibility static audit — 28/28 PASS;
- CSS balance audit — PASS;
- protected parent source parity — PASS.

At the time of writing, fresh `npm ci → Vitest → Vite build` could not be executed because the runtime npm cache did not contain `yallist-3.1.1`; `npm ci --offline` returned `ENOTCACHED`. O14 therefore did not claim a fresh dependency-complete Vitest/Vite run. Permanent O14 Vitest coverage is included in source for a dependency-complete environment, and the dependency-complete Vitest suite (31 files / 260 tests), the Vite production build, a fresh `npm ci` from a clean cache, and a production browser smoke all now PASS in the current environment (2026-08-29 / 2026-08-30), alongside a clean `tsc --noEmit`. The module is READY FOR FREEZE pending only explicit user approval.

## 12. Acceptance verdict

O14 is PASS if:
- engineering parity is preserved;
- O14 presentation sources compile in the available TypeScript gates;
- responsive/accessibility contracts pass static and runtime audits;
- no O15 route/homepage work is introduced;
- package/source-diff integrity passes.

All executable O14 acceptance gates above passed. The dependency-install limitation is recorded rather than hidden.

**Next gate:** O15 — Overcurrent page / route / Homepage integration. O15 has not started.
