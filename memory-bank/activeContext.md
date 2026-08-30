# Active context

**Last updated:** 2026-08-30

## Current focus

**All four relay modules now have working production routes.** Overcurrent O15/O16 is the release-frozen candidate; Distance is implemented but spec-pending; Underfrequency is implemented and complete per CLAUDE.md. The immediate open item is the **Overcurrent freeze approval** — the O16 release gate is fully closed and the module is READY FOR FREEZE, pending only explicit user approval.

Differential Relay remains FINAL / FROZEN at R10 and must not be modified unless its scope is explicitly reopened.

## Project module status — 2026-08-30

- [~] Homepage / Protection Lab — IMPLEMENTED R02 / NOT FROZEN
- [~] **Overcurrent Relay — O16 AUDIT PASS / ALL RELEASE-GATE ITEMS PASS 2026-08-30 / READY FOR FREEZE / FREEZE NOT YET USER-APPROVED**
- [x] Differential Relay — FINAL / COMPLETED (R10)
- [~] **Distance Relay — IMPLEMENTED / MERGED into `main`** (`/simulator/distance` + homepage wired); spec D01 READY FOR APPROVAL; partial test coverage (no page / timeline test)
- [~] **Underfrequency Relay — COMPLETE** (`/simulator/underfrequency` + homepage wired, per CLAUDE.md + commits `cec6f11`…`7a19f6f`); spec U01 READY FOR APPROVAL

## Baseline verification (authoritative)

Re-derived on 2026-08-30 from `main`:

- `npm test` — **43 files / 366 tests PASS** (5.51 s).
- `npm run build` — `tsc` strict clean + Vite prod build, **105 modules transformed**, `dist/` emitted (554.78 kB JS / 160.39 kB CSS).
- Overcurrent O16 release gate (fresh `npm ci` from clean cache, Vitest 31 files/260 tests at that point, Vite build 83 modules, production browser smoke `/` `/simulator/differential` `/simulator/overcurrent` HTTP 200) — all PASS 2026-08-30.

> The Overcurrent gate numbers (31 files / 260 tests) are the O16 snapshot; the current suite is larger (43 files / 366 tests) because Distance + Underfrequency source and tests are now present in `main`.

## Overcurrent implementation baseline

- PRD v1.0 is authoritative.
- O01 Engineering Specification v1.0 is APPROVED / FROZEN.
- O02 generic domain model is implemented and refined only where later approved phases required explicit study contracts.
- O03/O04 own the hardened CT measurement and single-device 50/51 calculation boundary.
- O05 owns explicit study topology, load/fault cases, current profiles, fault-location interpolation, protection-chain metadata, preset registry, and initialization.
- O06 owns coordination evaluation: operating order, CTI, selectivity, time grading, sensitivity, load security, backup availability, instantaneous overreach, configured-profile corridor/envelope, worst-point scan, and all-case audit.
- O07 owns the deterministic engineering-time timeline: pickup/timing/trip, breaker opening, fault isolation, backup continuation/reset, STEP/LINEAR accumulated progress, same-timestamp ordering, external clear, and playback-speed separation.
- O08 owns the data-driven Overcurrent parameter reducer, full-study/device validation boundary, and reusable R10-language Parameter UI.
- O09 owns the generic radial SLD presentation model/component.
- O10/O10H own the generic TCC presentation model/component.
- O11 owns the Operating Sequence projection/presentation boundary.
- O12 owns the Analysis / Learning presentation layer and explicit Run Coordination Test action.
- O13 Coordination Guided Challenges is complete.
- O14 owns responsive/accessibility/UX hardening.
- O15 Page / Route / Homepage integration is complete; the production Overcurrent route is active at `/simulator/overcurrent`.
- O16 final engineering + UX audit is complete and the release gate is fully closed; the module is READY FOR FREEZE, pending only explicit user freeze approval.
- UI language remains locked to Differential R10.

## Distance implementation baseline

- D01 Engineering Specification `docs/engineering-specs/distance-relay.md` is **READY FOR APPROVAL** — no production Distance code was authorized under a frozen spec, yet source exists in `main` and is wired (`/simulator/distance`).
- Source present: `src/types/distance.ts`, `src/engines/distanceMeasurement.ts`, `src/engines/distanceTimeline.ts`, `src/utils/distanceState.ts`, `src/studies/distancePresets.ts`, `src/pages/DistanceSimulator.tsx`, `src/components/distance/*` (RxPlane, DistanceOneLine, DistanceAnalysisPanel, DistanceOperatingSequence).
- Only `distanceMeasurement.test.ts` exists — the page and the timeline engine have **no** tests, and there is no distance presentation-model layer analogous to Overcurrent's `overcurrentSld`/`overcurrentTcc`.
- D01 is a non-pilot, single-line, three-zone mho-style distance protection model (D02 pure engine, D03 study-state reducer, D04 one-line, D05 R/X plane, D06 Analysis panel). Not vendor-specific, no full short-circuit solver.
- 366-test suite passes; Distance is **not** frozen and the spec is not approved.

## Underfrequency implementation baseline

- U01 Engineering Specification `docs/engineering-specs/underfrequency-relay.md` is **READY FOR APPROVAL**; it declares **no production Underfrequency engine code is authorized before approval**, yet the full module is implemented and wired in `main` and CLAUDE.md marks it **complete**.
- Source present: `src/types/underfrequency.ts`, `src/engines/underfrequency.ts` (aggregate/droop/solver/UFLS/validation), `src/engines/underfrequencyTimeline.ts`, `src/utils/underfrequencyState.ts`, `src/utils/evaluateUnderfrequencyParameters.ts`, `src/studies/underfrequencyStudy.ts` + `underfrequencyPresets.ts`, `src/presentation/underfrequencyAnalysis.ts`, `src/components/underfrequency/*` (FrequencyTimelineChart, GeneratorDiagram, SheddingChart, ParameterPanel, AnalysisPanel), `src/pages/UnderfrequencySimulator.tsx`.
- Implemented: single-area generator-coherent frequency model, per-generator droop/headroom/inertia, swing-equation closed-form segment integration, piecewise-linear saturation steady-state solver (incl. COLLAPSE status), staged UFLS ladder (strict `f < threshold && !nearlyEqual` pickup, reset-definite-time delay, latched trip), and a static closed-form evaluator for parity.
- Underfrequency page/route wired: `App.tsx` + `SimulatorHome` both include `/simulator/underfrequency`.
- Tests present: `underfrequency.test.ts`, `underfrequencyHardening`-style `underfrequency.hardening.test.ts`, `underfrequencyTimeline.test.ts`, component tests, and `UnderfrequencySimulator.test.tsx` — all part of the passing 366-test suite.
- **U01 not frozen; PLN-verification requirement active** — UFLS thresholds/shed amounts are "typical global practice" flagged `plnVerificationRequired: true`, rendered as an amber note until an official PLN grid code is supplied.

## Current decisions

- Differential remains a simplified two-terminal percentage-restraint study model, not a vendor-specific 87T emulation.
- Signed scalar RMS current convention remains: positive current enters the protected zone.
- CT-secondary amperes remain the relay calculation unit.
- The Differential operating characteristic is `Iset horizontal -> Slope 1 -> Slope 2`, with optional `Breakpoint 3 -> Slope 3` in Multi-Slope mode.
- Overcurrent/underfrequency/distance all reuse the Differential R10 visual + interaction language; Underfrequency deliberately re-balances/scale-ups for readability (light-mode-first, collapsed-by-default groups, larger type, blue accent + semantic green/amber/red).
- Decision inequalities matter throughout: `M <= 1` is no-pickup for Overcurrent, `Observed CTI >= Required CTI` passes, Underfrequency UFLS pickup is strict `f < threshold && !nearlyEqual`.

## Still outside scope (all modules)

Complex phasor/vector-group processing, zero-sequence compensation (except Distance SLG `k0`), CT saturation, harmonic/inrush logic, true network short-circuit calculation, breaker/post-trip dynamics, multi-machine transient stability, and automatic load restoration following UFLS.

## Verification gate

Before declaring any module REFERENCE READY: TypeScript strict type-check passes; engine/system/preset/workflow runtime checks pass; Vitest + Vite build pass in a clean platform-correct dependency install; manual browser smoke confirms the dominant visual, scenario animation, mode switching, fault restoration, and Reset.

## Overcurrent O16 audit state

`docs/engineering-specs/overcurrent-final-audit-o16.md` — Status **AUDIT PASS / CONDITIONAL RELEASE CANDIDATE — READY FOR FREEZE 2026-08-30; ALL GATE ITEMS PASS; FREEZE NOT YET USER-APPROVED**. No new Overcurrent protection feature was added. One invalid historical Differential test vector was corrected without changing production behavior; Differential production source unchanged.
