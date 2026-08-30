# Overcurrent Relay O15 — Page / Route / Homepage Integration

**Gate:** O15  
**Date:** 2026-08-14  
**Parent:** O14 trusted source content  
**Verdict:** PASS within the executable verification gates documented below  
**Next gate:** O16 Final Engineering + UX Audit / release freeze

## 1. Objective

O15 composes the accepted O03–O14 Overcurrent work into one production simulator route without introducing a second engineering state or duplicating protection formulas. The required flow is:

`Homepage → /simulator/overcurrent → Parameters / SLD / TCC / Operating Sequence / Analysis → Homepage`.

O15 is an integration gate. O03/O04 measurement and 50/51 equations, O05 study data, O06 coordination mathematics, O07/O11 timeline mathematics, O09 SLD semantics, O10H TCC semantics, O12 Analysis engineering derivations, O13 Guided completion semantics, and O14 component-level accessibility/responsive behavior remain authoritative.

## 2. Production page composition

`src/pages/OvercurrentSimulator.tsx` owns one `OvercurrentParameterState` through `overcurrentParameterReducer`.

The same state is passed to:
- `OvercurrentParameterPanel`;
- `RadialProtectionDiagram`;
- `TimeCurrentCurve`;
- `OperatingSequence`;
- `OvercurrentAnalysisPanel`.

The page contains no CT, current-multiple, operating-time, or CTI equation.

The live visual hierarchy is preserved:
1. radial SLD — supporting topology/state visual;
2. TCC — primary engineering visual;
3. Operating Sequence — time-domain supporting visual.

## 3. Timeline bridge

O11 `OperatingSequence` publishes the current accepted O07/O11 `TimelineSnapshot` to the O15 page. The exact same snapshot is supplied to SLD and Analysis.

This prevents page-level reconstruction of breaker/fault/timer state. A completed or active time-domain experiment therefore has one temporal source of truth.

## 4. Route and Homepage integration

O15 registers:

`/simulator/overcurrent`

through the existing React Router tree.

Homepage registry now activates only:
- Overcurrent Relay;
- Differential Relay.

Distance Relay and Underfrequency Relay remain inactive/planned.

The existing Homepage transition mechanism is preserved. No `window.open`, forced new tab, or additional marketing content is introduced.

## 5. Shared header integration

`SimulatorHeader` is generalized additively with optional module label, module-specific status label/tone, and optional Help callback. Existing Differential defaults remain:
- module label `Differential Relay`;
- Differential status tone mapping;
- Differential help accessible label.

Overcurrent uses:
- Home control `PROTECTION SYSTEM SIMULATOR`;
- module identity `OVERCURRENT RELAY`;
- Reset;
- Help;
- high-level executed/validated status.

The global header deliberately does **not** present a predicted static trip as if a timed fault had already been applied. While playback is IDLE and no run-all validation result exists, the header reports `READY`. Static predicted pickup/trip remains visible in TCC and Analysis.

## 6. Help reference

The production Overcurrent header now exposes concise Help as required by the PRD. The dialog reuses the O14 focus-safe overlay infrastructure and covers:
- 50 vs 51;
- pickup vs trip;
- current multiple;
- IEC TMS vs IEEE Time Dial;
- supported IEC/IEEE inverse curves and Definite Time;
- primary/backup and CTI;
- maximum-load / minimum-fault window;
- Apply Fault vs Run Coordination Test;
- configured-study-data limitations.

Help is descriptive only. It does not contain a protection calculation engine or setting optimizer.

## 7. Invalid draft integration guard

O08 intentionally keeps an invalid text draft local until it becomes a valid engineering value. In an integrated page this creates a boundary where the reducer may still hold the last valid engineering state while the visible draft is invalid.

O15 therefore passes page-level draft validity into Analysis. While a draft is invalid:
- page status is `INPUT INVALID / OUTPUT HELD`;
- Run Coordination Test is disabled;
- Guided validation is disabled;
- engineering output remains held at the accepted last-valid reducer state.

This guard does not change O03/O06 calculations.

## 8. Timed-run stale-state correction

O15 integration exposed one real pre-existing state-lifecycle bug: after a run had reached `COMPLETE`, an engineering edit or a new fault/profile selection could leave `playbackState = COMPLETE`. O11 could then display a newly recalculated study as though that new state had already completed a timed experiment.

The reducer is hardened so:
- genuine engineering mutations reset playback to `IDLE`;
- selecting another discrete fault resets playback to `IDLE`;
- selecting an Explore fault-location point resets prior discrete playback to `IDLE`;
- load-case selection also returns playback to `IDLE`.

Guided/Free remains learning metadata and does not reset valid engineering settings or run-all validation by itself. Device focus also remains selection-only.

This is a lifecycle correctness fix, not a relay-equation change.

## 9. Reset contract

Page Reset dispatches the accepted reducer `RESET` action and additionally clears local presentation-only state:
- timeline snapshot;
- invalid draft indication;
- parameter-panel synchronization key.

The selected preset returns to its canonical registry state. Reset does not navigate away from Overcurrent.

## 10. Responsive and accessibility integration

O15 uses the accepted O14 component behavior inside the production page and keeps `SimulatorLayout` as the three-zone product grammar.

The integrated page provides:
- medium layout with Analysis on its own row;
- narrow single-column layout with section anchor navigation;
- page-level invalid-state banner;
- responsive context/header treatment;
- same-state expanded SLD/TCC overlays;
- keyboard/focus behavior inherited from O14;
- a Help overlay with Escape, focus containment, body-scroll lock, and focus restoration;
- text status in addition to semantic color.

O15 does not claim formal WCAG certification.

## 11. Verification

Executed in the current runtime:
- O14 source-content baseline verification against accepted parent hash inventory — PASS;
- strict pure TypeScript compile — PASS;
- full source/test TypeScript contract compile using temporary external React/router/Vitest declarations — PASS;
- TS/TSX syntax-transpile — **82 files / 0 diagnostics**;
- O15 pure integration runtime harness — **1,350,661 checks PASS**;
- accepted preset sweep — **14/14**;
- deterministic setting fuzz — **1,000 iterations**;
- canonical OVC-03/O05/O08 parity — PASS;
- COORD-02 5/6 initial and 6/6 corrected journey — PASS;
- SLD/TCC/Analysis selected-device synchronization — PASS;
- Explore selection preserves run-all validation — PASS;
- stale timed-run invalidation checks — PASS;
- static integration/accessibility contract audit — **53/53 PASS**;
- CSS balance — **9/9 PASS**;
- protected parent parity — **80 files PASS**;
- source-diff scope audit — PASS.

## 12. Dependency-complete build limitation

At the time of writing, the current environment did not contain a complete `node_modules`. `npm test` could not find Vitest, and `npm ci --offline --no-audit --no-fund` was blocked because `yallist-3.1.1.tgz` was not present in the local npm cache (`ENOTCACHED`).

O15 therefore did **not** claim a fresh dependency-complete Vitest or Vite production build in that runtime. Permanent O15 Vitest integration tests are included in source and the dependency-complete Vitest suite (31 files / 260 tests), the Vite production build, a fresh `npm ci` from a clean cache, and a production browser smoke all now PASS in the current environment (2026-08-29 / 2026-08-30), alongside a clean `tsc --noEmit`. The module is READY FOR FREEZE pending only explicit user approval.

No standalone integrated HTML is fabricated without a trusted production build. The production build now succeeds in the current environment; the final release/preview artifact can be produced from the now-certified build.

## 13. Scope exclusions preserved

O15 does not add:
- directional 67;
- ground/sequence overcurrent;
- CT saturation;
- short-circuit network solving;
- ring/meshed coordination;
- automatic optimization;
- persistence/export/reporting;
- Distance or Underfrequency routes;
- O16 release/freeze work.

## 14. Acceptance verdict

O15 integration acceptance criteria are satisfied within the available runtime evidence:
- production route active;
- Homepage route active only for approved modules;
- one authoritative Overcurrent state;
- all accepted Overcurrent visuals and analysis composed;
- timeline snapshot shared across temporal consumers;
- Reset/Home navigation integrated;
- Help requirement closed;
- invalid-draft false validation blocked;
- completed timed-run stale-state bug fixed;
- parent engineering formulas and presentation models protected;
- integration/runtime/static/parity audits pass.

**O15 verdict: PASS.**

Next gate: **O16 — Final Engineering + UX Audit / release freeze.** O16 has not been started by O15.
