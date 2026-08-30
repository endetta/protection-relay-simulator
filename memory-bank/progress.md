# Progress

## Current release status

- O15 production integration is complete and `/simulator/overcurrent` is active.
- O16 independent engineering audit: 494,674 / 494,674 checks PASS.
- O16 static integration/accessibility audit: 80 / 80 PASS.
- No unresolved Overcurrent product P0/P1 found.
- As of 2026-08-29 the dependency-complete Vitest suite (31 files / 260 tests) and Vite production build passed in the current environment; `tsc --noEmit` is clean.
- As of 2026-08-30 the full release gate is closed on this release source: fresh `npm ci` from a clean cache (136 packages), `npm test` (31 files / 260 tests at O16; the live suite is now 43 files / 366 tests with Distance + Underfrequency present), `npm run build` (83 modules at O16; now 105), and a production browser smoke (`/`, `/simulator/differential`, `/simulator/overcurrent` — HTTP 200) all PASS. The module is READY FOR FREEZE.
- Remaining before FINAL/FROZEN: explicit user freeze approval only.


**Last reviewed:** 2026-08-30

## Platform module status

- [~] **Homepage / Protection Lab** — IMPLEMENTED R02 / NOT FROZEN
- [~] **Overcurrent Relay** — **O16 AUDIT PASS / CONDITIONAL RELEASE CANDIDATE; READY FOR FREEZE 2026-08-30; ALL GATE ITEMS PASS; FREEZE NOT YET USER-APPROVED**
- [x] **Differential Relay** — FINAL / COMPLETED at R10
- [~] **Distance Relay** — **IMPLEMENTED / MERGED INTO THIS SOURCE** (`/simulator/distance` + homepage wired); spec D01 READY FOR APPROVAL; partial test coverage (no page/timeline test)
- [~] **Underfrequency Relay** — **COMPLETE / MERGED INTO THIS SOURCE** (`/simulator/underfrequency` + homepage wired, per CLAUDE.md + commits `cec6f11`…`7a19f6f`); spec U01 READY FOR APPROVAL, not frozen
- Baseline re-derived 2026-08-30: `npm test` **43 files / 366 tests PASS**; `npm run build` (tsc strict + Vite) **105 modules** clean.

> Full-project state now spans four relay modules. The Overcurrent phase history below is retained verbatim as the O01–O16 record; Distance/Underfrequency records are appended after it.

**Differential freeze rule:** R10 is the final Differential Relay reference state. Future work must not modify Differential Relay unless its scope is explicitly reopened.

## Differential reference module

### Implemented

- Vite + React + TypeScript + Tailwind application foundation.
- Three-zone Differential simulator layout with Characteristic Curve as the dominant Live Simulation visual.
- Signed scalar RMS differential current model and CT-secondary measurement chain.
- Load Driven system model:
  - transformer MVA;
  - terminal-1/terminal-2 line voltage;
  - pre-fault active MW;
  - power factor;
  - calculated apparent load, loading %, rated terminal current, and operating terminal current.
- Direct Current mode for explicit signed primary-current studies.
- Simplified fault-current multiple referenced to each terminal rated current.
- Piecewise restrained differential characteristic:
  - horizontal `Iset / Min Iop`;
  - Bias Breakpoint 1;
  - Slope 1;
  - Bias Breakpoint 2;
  - Slope 2;
  - optional Bias Breakpoint 3 + Slope 3 in Multi-Slope mode.
- Continuous characteristic mathematics with strict `Idiff > Iop` OPERATE boundary.
- Characteristic-priority graph scaling so extreme operating points do not crush the characteristic into the left edge.
- Off-scale operating-point marker and Fit Point / Characteristic view control.
- Simplified graph axes: Bias / Restraint Current and Differential Current.
- Outline `?` parameter help icon with viewport-aware portal tooltip positioning.
- Compact CT, protected-zone, and measurement-dependency views.
- Invalid draft protection: bad drafts never enter engineering state.
- Canonical startup/reset, Custom/Modified state, and pre-fault restoration.
- Structured event log and semantic scenario transitions.
- Updated engine, load-model, preset-integration, measurement-chain, and workflow-state tests.


### UI/UX R01 — 2026-08-13

Checkpoint version: `diff-sim-2026-08-13-r01`.

- Parameter hierarchy strengthened without changing the homepage or the Differential characteristic priority.
- Numeric fields now reserve separate vertical space for label/help and value/unit, preventing `?` help anchors from colliding with inputs.
- CT1/CT2 remain compact side-by-side cards, with consistent vertical rhythm and aligned controls.
- Parameter/section/analysis contrast increased for the dark theme; secondary metadata remains intentionally muted.
- Load Driven terminology is explicit: transformer rating is `Sn`, derived apparent load is `Sload`, and the active current source is shown in the UI.
- Approved engineering semantics are preserved: normal `LOAD` uses `Sload/(sqrt(3)×VLL)`; simplified fault conditions use the configured multiple `× Irated`. `Sload` remains the pre-fault reference while a fault condition is active.
- Added regression coverage for Load Driven current-source propagation through the CT measurement chain.
- Standalone companion preview synchronized to this UI/UX state.

Verification in the current sandbox:

- changed TS/TSX files: TypeScript parser/transpile syntax check PASS;
- pure engine/workflow compiled runtime regression PASS;
- standalone JavaScript syntax check PASS;
- standalone browser smoke PASS, including 7/7 production scenario decisions, no numeric-field label/control collisions, viewport-contained tooltip, Load Driven dependency checks, Direct Current, and Multi-Slope smoke;
- full `npm test` / Vite build could not be re-run because the mounted working copy has an empty dependency tree and network installation timed out. The authoritative full suite remains required once dependencies are restored.

### Current model limitations

- no complex phasor/vector-group compensation;
- no zero-sequence compensation;
- no CT saturation;
- no inrush/harmonic restraint or blocking;
- no impedance-based short-circuit network calculation;
- no breaker dynamics or post-trip current solution.

These remain specification work, not UI bugs.

## Verification status

- TypeScript type-check: required for every cumulative package.
- Vitest/Vite in the supplied archived dependency tree can be blocked by platform-specific Rolldown/Rollup native bindings; clean platform-correct dependency installation remains the authoritative runner.
- Additional compiled runtime and render smoke checks are used in the audit environment to separate source regressions from archived dependency problems.

## Other relay modules

Differential Relay is complete/frozen at R10. Homepage R02 provides the current navigation shell. Overcurrent Relay has an authoritative module PRD and is the release-frozen candidate (O16 gate closed). Distance and Underfrequency are now implemented and merged into `main` but remain spec-pending (D01 / U01 READY FOR APPROVAL).


### UI/UX R03 — 2026-08-13

Checkpoint version: `diff-sim-2026-08-13-r03`.

- Protected Zone side-current arrows no longer occupy a separate row; each is a wide inline SVG indicator placed on the zone-facing side of its terminal card.
- Side 1 uses the right arrow slot; Side 2 uses the left arrow slot. Arrow direction still follows current sign instead of being hard-coded.
- CT labels shortened to `Prim. rated`, `Sec. rated`, and `Ratio error`, preventing the two-line secondary label at narrow widths.
- CT1 and CT2 use identical grid spacing and row rhythm.
- Scenario, input-mode, characteristic controls, and paired parameter grids use normalized spacing.
- Analysis hierarchy was audited and retained because it already uses the shared ParameterGroup/Metric rhythm introduced by R01/R02.
- No engineering files changed.

R03 verification: source syntax-transpile PASS (29 TS/TSX files), standalone JS syntax PASS, 414 px CT label/symmetry check PASS, tooltip viewport check PASS, 7/7 production scenario decision smoke PASS, Protected Zone inline-card height check PASS, internal-fault trip-state highlight PASS, no standalone page errors.

### UI/UX R04 — 2026-08-13

Checkpoint version: `diff-sim-2026-08-13-r04`.

- Fixed the CT spacing root cause structurally by giving the actual CT input stack its own deterministic 10 px field-to-field gap; CT1 and CT2 remain symmetric and labels remain one line.
- Measurement Dependency now uses semantic green for RESTRAIN/NO TRIP and red for OPERATE/TRIP instead of using interaction blue as a relay-state color.
- Protected Zone healthy/current-path treatment follows the same green/red semantic language while signed current direction remains unchanged.
- Curve segment hover now follows the pointer in real time, flips around viewport edges, uses a structured industrial data-card layout, and highlights the active characteristic segment.
- `RESTRAIN (NO TRIP)` has collision-safe lower-corner placement when the operating point or pointer occupies the default lower-right annotation area.
- Engineering calculations and source-of-truth semantics were not changed.

R04 verification: 29 TS/TSX files syntax-transpile PASS; engineering/utils hashes unchanged; standalone JS syntax PASS; 414 px CT spacing measured at 10 px/10 px for both CT cards; 7/7 production scenarios runtime PASS; RESTRAIN green path PASS; OPERATE red path PASS; fault clear restores RESTRAIN green; curve tooltip pointer-follow, viewport containment, and annotation collision relocation PASS.

### UI/UX R05 — 2026-08-13

Checkpoint version: `diff-sim-2026-08-13-r05`.

- Converted `Fit Point / Characteristic` into an absolute graph overlay; showing/hiding it no longer changes graph height or pushes the SVG downward.
- Introduced a stronger graphite/charcoal surface hierarchy and steel-cyan structural accent without repurposing relay-state colors.
- Increased typography contrast and readable type scale across Parameters, Live Simulation, Analysis, CT cards, metrics, help/tooltips, and current-source explanations.
- Major columns and parameter groups now have clear accent markers and stronger header hierarchy.
- System derived/current-source information was promoted from microtext into an explanatory engineering card while preserving `Sn` vs `Sload` semantics.
- Characteristic remains the dominant visual; supporting Protected Zone and Measurement Dependency stay compact.
- No engineering files changed.

R05 verification: 29 TS/TSX syntax-transpile PASS; engineering/utils unchanged; standalone JavaScript syntax PASS; 414 px CT 10 px/10 px spacing PASS; graph overlay no-layout-shift PASS; tooltip pointer-follow/viewport PASS; 7/7 production scenario runtime PASS; Load Driven propagation, Direct Current, BP3 continuity, Reset, trip highlighting, and fault restoration PASS.

### UI/Workflow R06 — 2026-08-13

Checkpoint version: `diff-sim-2026-08-13-r06`.

- Shortened long parameter display labels so the compact parameter grid remains one line at narrow/full-screen panel widths.
- Normal Load startup/reset now defaults to Direct Current while preserving the same reference physical currents; Load Driven remains an explicit selectable source mode.
- Added custom navy/graphite numeric stepper controls and removed browser-native number spinners.
- Reduced engineering scrollbars to 2 px square position indicators.
- Re-anchored Fit Point / Characteristic inside the plot region below the characteristic separator with no layout shift.
- Reworked curve hover data-card ranges to single-line `start → end` values with `A sec` units.
- Retained explicit CT Ratio Mismatch (CT2 800/1) and CT Measurement Error (+4%) production preset defaults.
- Full source runtime audit found no arithmetic change required in the approved simplified model; system/CT/differential equations, breakpoint continuity, and scenario decisions remain consistent.

R06 verification: TS/TSX syntax-transpile PASS (29 files); source runtime audit PASS; 7/7 production scenarios PASS; Direct Current/Load Driven workflow PASS; fault takeover and exact restoration PASS; Reset PASS; CT defaults PASS; 414 px compact-label/browser check PASS; custom stepper PASS; Fit overlay plot-relative position/no-layout-shift PASS; pointer-follow curve tooltip single-line ranges PASS; 2 px square scrollbar CSS PASS.

### UX Finalization R08 — 2026-08-13

Checkpoint version: `diff-sim-2026-08-13-r08`.

- Added persistent hide/show for parameter groups, Characteristic Curve, Protected Zone, Measurement Dependency, and Analysis groups, including compact closed summaries and semantic badges.
- Fixed the hidden-invalid-draft failure mode by retaining collapsed content in the DOM/component tree rather than unmounting it.
- Added Parameters/Analysis Collapse all / Expand all and Live Hide support / Show support controls with state-aware labels.
- Added Direct Current reference-system/fault-injection context and an optional reference editor.
- Locked Input Mode while simplified fault override is active, with reducer-level protection and exact Clear Fault restoration.
- Improved graph comprehension, semantic trip-output/margin terminology, input-help interaction targets, Help-modal keyboard behavior, and responsive navigation/breakpoints.
- Standalone preview was brought into R08 behavior parity for section controls, collapsed summaries/badges, Direct Current reference context, fault-mode lock, and responsive layout.

R08 verification: 31/31 TS/TSX syntax-transpile PASS; pure-engine/state strict TypeScript PASS; engine/homepage files unchanged; 7/7 production scenarios PASS; Direct Current fault override/lock/restore PASS; extreme numeric guard PASS; 100k randomized engineering calculations PASS; 50k randomized breakpoint-continuity PASS; standalone JS syntax PASS; Chromium standalone UI smoke PASS including hidden-invalid persistence, collapse/expand controls, fault lock/restore, and no horizontal overflow from 414 to 1536 px.

### Information-Density Refinement R09 — 2026-08-13

Checkpoint version: `diff-sim-2026-08-13-r09`.

- Replaced low-contrast collapsed debug strings with structured summary metrics and CT1/CT2 micro-cards.
- Moved per-section state badges into a stable right-aligned status slot independent of title length.
- Stabilized Parameters / Live Simulation / Analysis heading geometry with equal left/right utility slots; utility-label changes no longer move the centered heading.
- Added a compact shared curve-inspector card for curve segments and the operating point; operating point now exposes Ibias, Idiff, Iop and margin with hover/touch-target halo.
- Kept summary information state-aware and limited to decision-useful values rather than mirroring the entire expanded form.
- Standalone preview brought into visual/behavior parity for structured summaries, badge alignment, stable column headings, compact segment tooltip and operating-point tooltip.

R09 verification: engine files unchanged; 33 TS/TSX syntax PASS; semantic type-check with dependency stubs PASS; 7/7 scenario/runtime workflow PASS; standalone JS syntax PASS; no horizontal overflow at tested responsive widths; Parameters title shift on Collapse/Expand = 0 px; point/segment tooltip viewport behavior PASS.

### Homepage / Protection Lab R01 — 2026-08-13

- Replaced the previous generic module-card landing page with a fixed, no-scroll relay selector.
- Homepage now shows only `PROTECTION SYSTEM` and the four planned relay names.
- Added a data-driven module registry so future relay routes can be enabled without changing the visual architecture.
- Added Differential-R10-aligned hover/focus motion and a short transition into the active Differential simulator route.
- Removed the separate homepage laboratory header; simulator workspace/header behavior is unchanged.
- Differential R10 remains frozen and unchanged by this homepage workstream.

### Overcurrent Relay PRD v1.0 — 2026-08-13

- Added authoritative `docs/PRD-overcurrent-relay.md` defining Overcurrent as a 50/51 Protection & Coordination Laboratory.
- Locked the learning workflow: Explore → Coordinate → Validate.
- Locked core product modes: Single Relay Study, Coordination Lab, Guided Study, Free Study.
- Locked architecture layers: Overcurrent Element Engine, Measurement Engine, Study Engine, Coordination Engine, Timeline Engine, Presentation Model.
- Locked coordination features from the start: primary/backup, CTI/budget, corridor, envelope, worst-case scan, sensitivity/selectivity/load-security, instantaneous reach, all-cases audit.
- Locked TCC as primary visual with generic layer architecture, clickable radial SLD and Operating Sequence as supporting visuals.
- Locked time-domain semantics: pickup → timing → trip output → breaker clearing → fault isolation.
- Locked current-profile-ready architecture while keeping first release study currents simple and explicit.
- Locked Differential R10 as the visual/UI reference; no alternate Overcurrent design language.
- Explicitly deferred directional 67, ground/sequence, full short-circuit network solving, ring networks, CT saturation, vendor emulation, auto-optimization, and communications/adaptive protection.
- Next gate: O01 Engineering Specification. No production Overcurrent calculation code should be written before O01 approval.


## overcurrent-o01-2026-08-13-v1-draft

- Date: 2026-08-13.
- Parent: authoritative Overcurrent PRD v1.0; Differential Relay frozen at R10; Homepage R02 shell.
- Scope: engineering specification only. Completed `docs/engineering-specs/overcurrent-relay.md` as O01 v1.0 Draft Complete / Ready for Approval. No production Overcurrent source/engine implementation was started.
- Locked engineering decisions: scalar RMS phase-current magnitude; CT ratio/error convention; strict `>` pickup boundaries; IEC SI/VI/EI + IEEE MI/VI/EI equations/constants; definite-time 51; zero-intentional-delay 50; 50 priority over 51; TMS/TD common time-scale model; immediate V1 reset; varying-current integral contract; separate relay-trip/breaker-clear timeline; CTI equation/budget/equality semantics; sensitivity/selectivity/load-security/instantaneous-overreach checks; configured fault-study data; safe invalid/overflow handling.
- Added canonical Single Relay and 3-relay radial study presets plus numerical reference vectors for equation, boundary, CT, coordination, and timeline tests.
- Rollback checkpoint: `/mnt/data/protection_checkpoints/overcurrent-o01-2026-08-13-pre`.
- Next gate: explicit O01 approval, then O02 Domain Types & Data Model.


## overcurrent-o02-2026-08-13-v1

- O01 approved/frozen and project advanced to O02.
- Added generic UI-independent Overcurrent domain contracts in `src/types/overcurrent.ts` and architecture rationale in `docs/engineering-specs/overcurrent-domain-model-o02.md`.
- Contracts cover ProtectionDevice, 50/51/CT/breaker settings, StudyTopology/Location, FaultCase, static and sampled CurrentProfile, fault-location profiles, explicit ProtectionChain, CoordinationPair/Requirement/CTI budget, OperatingResult, structured violations/audit, timeline states/events/snapshots, generic TCC layers, study snapshots, learning metadata, and simulator state.
- Strict TypeScript compile PASS. Separate four-relay contract compile PASS, proving no three-relay hard-coding. Static contract checks for curve IDs, TCC layers, accumulated timing and breaker/trip separation PASS.
- No production Overcurrent engine/preset/UI code added. Next phase O03.

## Overcurrent Relay — O03 Measurement + 50/51 Pure Engine

- Status: COMPLETE / READY FOR O04.
- Added pure CT measurement engine, six-curve inverse-time registry/evaluator, definite-time 51, instantaneous 50, strict O01 boundaries, 50-priority arbitration, and non-throwing static device evaluation.
- Added explicit `DISABLED` 51 result status as an O02 semantic completeness refinement.
- Added contract tests for canonical vectors, CT measurement/error, equality boundaries, definite timing, 50 priority, and invalid/numerical-range handling.
- Independent verification: 18/18 reference curve vectors PASS; 150,000 monotonic curve samples PASS; 100,000 randomized static-device cases PASS; strict O03 production/test semantic TypeScript PASS.
- No Study Engine, coordination engine, timeline, TCC/SLD, or React UI implemented yet.
- Next: O04 Engine Unit Tests / Numerical Hardening.


## Overcurrent O04 — 2026-08-13

- Engine Unit Tests / Numerical Hardening PASSED.
- Fixed latent breaker setting validation: clearing time must be finite and >= 0 s.
- Hardened CT scaling so extreme finite intermediate underflow/overflow does not reject a mathematically representable result when an equivalent operation ordering remains representable.
- Added permanent deterministic hardening test suite.
- Runtime hardening harness: 1,301,031 explicit checks PASS, including 300k curve points, 100k pickup-boundary cases, 100,004 CT cases, 500k static-device fuzz cases, and 1,000 determinism repetitions.
- No coordination, timeline, TCC, SLD, or UI added.
- Next phase: O05 Study Engine & Preset Registry.


## Overcurrent O05 — 2026-08-13

- Study Engine & Preset Registry COMPLETE / PASSED.
- Added `src/studies/overcurrentStudy.ts` and `src/studies/overcurrentPresets.ts`.
- Added explicit load/reference cases, load-security case registry, generic study current definition, default study selections, and configured fault-location protection segments as O05 integration refinements to O02. No O01 relay equations changed.
- Registered OVC-01 through OVC-08, COORD-01 two-relay time grading, COORD-02 canonical three-relay radial, and COORD-05 instantaneous-overreach challenge data.
- Study validation rejects missing per-device current data, invalid topology/backup direction, broken profile references/order, invalid pair references, and non-reconciling CTI budgets.
- Current-profile STEP/LINEAR lookup and configured fault-location current/role interpolation implemented.
- O01 numeric parity retained, including COORD-02 F3 MAX intentional CTI deficit.
- Verification: strict production/test TypeScript PASS; runtime regression 440,165 checks PASS; generic four-relay radial study validation PASS.
- No Coordination Engine, Timeline Engine, TCC, SLD, or Overcurrent UI yet.
- Next phase: O06 Coordination Engine.


## Overcurrent Relay — O06 Coordination Engine

- Status: COMPLETE / PASSED.
- Added UI-independent coordination engine for operating order, primary/backup CTI, selectivity, time grading, minimum-fault sensitivity, maximum-load security, backup availability and upstream instantaneous-overreach classification.
- Added configured fault-location coordination corridor/envelope scanning and deterministic configured-study worst-point selection.
- `RUN COORDINATION TEST` domain result now returns explicit validation-case pass count, six audit dimensions, structured violations and worst configured CTI case.
- Added an explicit `allowedBackupInstantaneousDeviceIds` study-policy exception without weakening selectivity/CTI mathematics.
- Study validation now requires exactly one authoritative CTI requirement for every coordination pair.
- O06 envelope audit exposed and fixed pedagogically misleading scrubber transition interpolation; canonical O01 MIN/NOM/MAX fault vectors and relay mathematics remain unchanged.
- Verification: strict TypeScript PASS; 604,515 O06 runtime checks PASS; O05 440,165-check regression rerun PASS; COORD-02 initial 5/6 intentional failure preserved; corrected R2 TMS 0.19 gives 6/6 COORDINATED; COORD-05 50 overreach detected; generic four-relay coordination PASS.
- Next phase: O07 Timeline Engine.


## Overcurrent Relay — O07 Timeline Engine

- Status: COMPLETE / PASSED (2026-08-14).
- Added `src/engines/overcurrentTimeline.ts` and permanent O07 tests.
- Implemented deterministic engineering-time pickup, accumulated 51 timing,
  50-priority trip, breaker opening/open, fault isolation, backup reset, and
  multiple-trip sequencing.
- Static/STEP segments use analytic timing. LINEAR inverse profiles use
  deterministic adaptive Simpson integration and bisection; the IEC SI analytic
  reference vector passes.
- External clear requires explicit post-fault profile metadata and is processed
  before same-time timer completion. Missing/invalid inputs return structured
  INVALID results without throwing.
- O05 STEP exact-sample lookup is now explicitly right-continuous; preset values
  and O01 relay equations are unchanged.
- Verification: O07 23/23 PASS (including a deterministic 1,000-case static parity sweep); combined O03–O07 regression 8 files / 94 tests PASS; all O05 static
  fault cases retain pure-engine parity; strict TypeScript PASS; production
  build PASS; generic four-relay and 1x/5x/10x determinism PASS.
- Repository note: one frozen Differential R10 overflow assertion fails in the
  supplied pre-O07 baseline because its numeric vector remains finite. O07 did
  not modify Differential source/tests.
- Stop condition reached. Next planned phase: O08 Parameter UI, only on request.


## Overcurrent Relay — O08 Parameter UI

- Status: COMPLETE / PASSED (2026-08-14).
- Added immutable `overcurrentState` controller and full-study
  `evaluateOvercurrentParameters` validation/active-evaluation boundary.
- Added a reusable, route-independent `OvercurrentParameterPanel` plus scoped
  R10-compatible CSS; shared Differential components were reused unchanged.
- Parameter coverage includes mode/preset/guidance, explicit per-device
  load/fault current data, CT, inverse/definite 51, IEC/IEEE curve family,
  TMS/Time Dial, 50 high-set, breaker clearing, CTI budget, playback speed,
  deterministic run lock, Clear, and preset-local Reset.
- Forms are generated from topology/device/requirement registries. Permanent
  SSR coverage includes a synthetic four-relay study; there is no R1/R2/R3
  form duplication.
- Invalid drafts stay outside engineering state and remain mounted through
  collapse. Structural, setting, and derived numerical-range failures block
  Apply Fault and expose INPUT INVALID / OUTPUT HELD state.
- Verification: O08 2 files / 12 tests PASS; combined O03–O08 10 files / 106
  tests PASS; strict TypeScript PASS; active production build PASS; isolated
  O08 React/CSS Vite bundle PASS.
- Differential R10, `App.tsx`, and homepage navigation are unchanged. O09 SLD,
  O10 TCC, O11 Operating Sequence, O12 Analysis, and O15 route activation were
  not started.
- Stop condition reached. Next planned phase: O09 SLD, only on request.


## Overcurrent Relay — O09 Radial SLD

- Status: COMPLETE / PASSED (2026-08-14).
- Added pure `overcurrentSld` presentation model and route-independent
  `RadialProtectionDiagram` React component with scoped R10-language styling.
- Renders generic 1/2/3/N-device radial topology, source/load, segmented breaker
  conductors, CT/relay identity, configured fault locations, current path, and
  explicit primary/backup roles.
- Relay and fault buttons use existing O08 state actions. Fault selection
  preserves the active MIN/NOMINAL/MAX category where configured.
- Configured fault-location scrubber uses O05 interpolation and role metadata;
  it is labelled Explore-only/configured study data and cannot start O07
  playback as though it were a discrete FaultCase.
- Breaker OPENING/OPEN and fault-isolated state consume only a matching O07
  timeline snapshot; stale snapshots and invalid engineering output are safely
  contained.
- Verification: O09 2 files / 14 tests PASS; combined O03–O09 12 files / 120
  tests PASS; strict TypeScript, active Vite build, and isolated O09 React/CSS
  client bundle PASS.
- Differential R10/shared shell/homepage/route and O01–O07 engineering behavior
  remain unchanged. Repository-wide: 175 PASS / 1 pre-existing Differential
  assertion failure.
- Next phase: O10 TCC.

## Overcurrent Relay — O10 Time-Current Characteristic

- Status: COMPLETE / PASSED (2026-08-14).
- Added pure `overcurrentTcc` presentation model and route-independent
  `TimeCurrentCurve` React/SVG component with scoped R10-language styling.
- Curves sample O03/O04 engine functions. Operating points retain exact 50/51
  arbitration, measured current, current multiple, and reference 51 time.
- Generic layers cover relay curves, pickup/high-set boundaries, load and fault
  references, O06 CTI boundaries/violations, study markers, and initial-setting
  ghosts.
- Characteristic and Fit Point scales use deterministic log bounds. A 0-second
  50 result stays below the positive log axis and keeps its exact value.
- Pointer-follow, keyboard focus, touch pin/outside dismiss, viewport-safe
  tooltip placement, and shared O09/O10 relay selection are implemented.
- Verification: O10 2 files / 15 tests PASS; combined O03–O10 14 files / 135
  tests PASS; strict TypeScript, active Vite build, and isolated O10 React/CSS
  client bundle PASS.
- Differential R10/shared shell/homepage/route remain unchanged. Repository-wide:
  190 PASS / 1 pre-existing Differential assertion failure.
- Next phase: O11 Operating Sequence. Work stops at O10 for this delivery.

## Overcurrent Relay — O10H TCC Hardening

- Status: COMPLETE / PASSED (2026-08-14).
- Closed pre-O11 TCC audit defects: adjacent-tier CTI, active coordination bracket, below-pickup/Fit semantics, letterboxed pointer mapping, scrollbar and relay-series semantic-color cleanup.
- Added generic `COORDINATION_BRACKET` TCC layer kind and deterministic fallback geometry utility.
- No O03-O09 engineering behavior changed.
- O10H is the trusted baseline. Next phase: O11 Operating Sequence.


## Overcurrent O11 — Operating Sequence — 2026-08-14

- Parent: trusted `overcurrent-o10h-2026-08-14-v1`.
- Added an additive O07 timeline-frame query, generic 1..N Operating Sequence presentation model, React progress/timeline component, scoped UI styling, and permanent tests.
- Engineering-time frame projection reuses O07 tracing/progress; React does not interpolate relay operation. Playback speed affects wall-clock playback only.
- IDLE is explicitly READY TO APPLY FAULT; no fault sequence is implied before a discrete timed experiment starts.
- Canonical COORD-02 concurrent timing, primary breaker clearing with backup continuation, post-isolation reset, exact-zero 50, OVC-07 clear-before-trip, STEP/LINEAR profiles, speed independence, and O09 SLD snapshot parity verified.
- Verification in current audit runtime: strict pure TypeScript PASS; O11 73 runtime checks PASS; source syntax audit PASS. Fresh npm/Vitest/Vite was unavailable because offline dependency tarballs are incomplete.
- Gate verdict: PASS.

## Overcurrent O12 — Analysis / Learning Layer — 2026-08-14

- Parent: O11 PASS result.
- Added pure Analysis presentation model and R10-language Analysis panel implementing the PRD hierarchy: status, active study/fault, operating order, relay current/M, coordination margins, sensitivity/selectivity/time-grading/50 reach/load security/backup checks, violations/worst case, Setting Impact, progressive hints, calculation details, and events.
- Added explicit `RUN_COORDINATION_TEST` reducer action using O06 `runOvercurrentCoordinationStudy`; it is blocked during a timed run and automatically becomes stale/IDLE after engineering-setting mutations.
- Initial-vs-current comparison runs the same O06 engine against the initial snapshot/current study; no second coordination formula or optimizer exists in O12.
- Canonical initial COORD-02 remains coordination-incomplete; R2 TMS 0.18 -> 0.19 yields all configured cases passing. COORD-05 overreach/selectivity faults and OVC-08 CT +5% measurement effect surface correctly.
- Verification in current audit runtime: strict pure TypeScript PASS; O12 1,057 runtime/model/state checks PASS; O11/O12 parent parity 137 PASS; 74 TS/TSX syntax-transpile / 0 diagnostics; deterministic setting fuzz and generic 4-relay analysis PASS.
- Gate verdict: PASS. Next planned gate: O13 Coordination Guided Challenges. O13 was not started.

## Overcurrent O13 — Coordination Guided Challenges — 2026-08-14

- Status: COMPLETE / PASSED. Parent: trusted O12.
- Completed Guided Coordination progression COORD-01..COORD-06; added COORD-03 Pickup + Time, COORD-04 Curve Selection, and COORD-06 Full Coordination without changing O03/O04/O06 equations.
- Every challenge has a deterministic intentional initial failure and a test-only full solution; solutions are regression fixtures only and are not exposed through hints.
- Added pure Guided Challenge presentation model and compact Analysis-column `GuidedChallengeCard`. Completion requires explicit Run Coordination Test plus all configured cases and required O06 dimensions PASS.
- Progressive hints are state-owned and limited to Location -> Parameter Family -> Direction; Why This Works appears only after VERIFIED. No optimizer, score, exact-answer hint, or gamification was added.
- Corrected O12 workflow semantics: Guided/Free is learning metadata rather than an engineering mutation, and selection-only fault scrubber movement preserves a completed run-all audit. Genuine engineering edits still invalidate stale validation. Reset restores canonical preset, IDLE validation, and zero hints.
- Verification: strict pure TypeScript PASS; 78 TS/TSX syntax-transpile / 0 diagnostics; O12 parent runtime 1,063 PASS; O13 runtime 2,118 PASS; 1,000 deterministic fuzz iterations PASS; existing SLD/TCC/Operating Sequence compatibility for all six coordination presets PASS; protected O03–O12/Differential/Homepage source parity PASS.
- At the time of writing, fresh npm/Vitest/Vite was environment-blocked by missing offline `yallist-3.1.1`; permanent tests were included and have since passed (2026-08-29).
- Next phase: O14 Responsive / Accessibility / UX Refinement. O14 not started.


## Overcurrent O14 — Responsive / Accessibility / UX Refinement — 2026-08-14

- Status: COMPLETE / PASSED. Parent: trusted O13.
- Added responsive/touch/keyboard/accessibility hardening only; no O03–O13 engineering equation/state/study semantics changed.
- Added same-state expanded engineering overlay used by Radial SLD and TCC, with dialog semantics, Escape, focus trap, background scroll lock, and focus restoration.
- Hardened SLD/TCC/Operating Sequence/Parameters/Analysis/Guided Challenge for narrow viewports, coarse pointers, focus visibility, reduced motion, and high-level accessible status/progress semantics.
- TCC adds keyboard point inspection and a non-visual textual engineering equivalent while retaining O10H curve/CTI/Fit Point semantics.
- O15 route/Homepage integration was intentionally not started; shared SimulatorLayout/App/Homepage remain parent-identical.
- Verification: pure TypeScript PASS; targeted O14 component TypeScript PASS; 80 TS/TSX syntax-transpile / 0 diagnostics; 2,018,517 runtime/parent checks PASS; 1,000 deterministic fuzz iterations PASS; UX/accessibility static audit 28/28 PASS; protected source parity PASS.
- At the time of writing, fresh npm/Vitest/Vite was environment-blocked because the offline npm cache lacked `yallist-3.1.1`; permanent O14 tests were included and the full suite has since passed (2026-08-29).
- Next phase: O15 Page / Route / Homepage integration.

## Overcurrent O15 — Page / Route / Homepage Integration — 2026-08-14

- Status: COMPLETE / PASSED. Parent: O14 trusted source content.
- Added production Overcurrent page and `/simulator/overcurrent` route; activated only Overcurrent on the existing Homepage alongside frozen Differential.
- Composed Parameters, SLD, TCC, Operating Sequence, Analysis, and Guided Challenge through one authoritative reducer state and one shared timeline snapshot.
- Added module-specific shared-header identity/help while preserving Differential defaults. Added concise Overcurrent reference Help required by the PRD.
- Integration hardening: invalid text drafts block coordination validation; engineering/fault/profile changes clear stale COMPLETE playback; IDLE global header reports READY instead of a predicted static trip.
- Verification: 1,350,661 runtime checks PASS; 53/53 static integration/accessibility checks PASS; strict pure TypeScript PASS; 82 TS/TSX syntax-transpile / 0 diagnostics; 80 protected parent files parity PASS; source diff expected-only.
- At the time of writing, dependency-complete Vitest/Vite was environment-blocked by missing offline `yallist-3.1.1`; permanent O15 tests were included and the full suite has since passed (2026-08-29).
- Next phase: O16 final engineering + UX audit / release freeze.

## Overcurrent O16 — Final Engineering + UX Audit / Release Freeze — 2026-08-14

- Status: COMPLETE / PASSED. Parent: O15 trusted source content.
- Final engineering/source/state/UX audit and release-candidate documentation; no new Overcurrent protection feature.
- Independent runtime audit: 494,674 / 494,674 PASS; static integration/accessibility audit: 80 / 80 PASS; pure production TypeScript PASS; 82 TS/TSX syntax-transpile / 0 diagnostics.
- Corrected one invalid historical Differential overflow test vector; Differential production source unchanged.
- No open Overcurrent product P0/P1 found.
- Release gate fully closed (2026-08-30): fresh `npm ci` from a clean cache (136 packages), dependency-complete Vitest (31 files / 260 tests), Vite production build (83 modules), and production browser smoke (`/`, `/simulator/differential`, `/simulator/overcurrent` — HTTP 200) all PASS.
- Status: **CONDITIONAL RELEASE CANDIDATE — READY FOR FREEZE; NOT YET FINAL/FROZEN**.
- Freeze requires explicit user approval only; all dependency/build/smoke gate items now PASS.


## Distance Relay — D03/D04/D05/D06 implemented — 2026-08-28

- Status: **IMPLEMENTED / MERGED INTO `main`**; spec NOT FROZEN.
- Spec `docs/engineering-specs/distance-relay.md` (D01 v1.0) is **READY FOR APPROVAL** — declares no production Distance engine code is authorized before approval, yet source exists and is wired: `/simulator/distance` route in `App.tsx` + homepage item in `SimulatorHome`.
- Source present: `src/types/distance.ts`, `src/engines/distanceMeasurement.ts` (D02 pure engine), `src/engines/distanceTimeline.ts`, `src/utils/distanceState.ts` (D03 study-state reducer), `src/studies/distancePresets.ts`, `src/pages/DistanceSimulator.tsx` (composes D04 one-line, D05 R/X plane, D06 Analysis panel + Operating Sequence), `src/components/distance/*` (RxPlane, DistanceOneLine, DistanceAnalysisPanel, DistanceOperatingSequence).
- Model: non-pilot, single-line, three-zone mho-style distance protection; VT/CT measurement (ratio + scalar error), apparent impedance Z = V/I (complex scalar study form), per-zone mho circle reach + timing, zone arbitration (lowest-num occupied zone wins with timer), load-encroachment / out-of-reach checks. Not vendor-specific, not a full short-circuit solver.
- Test coverage: only `src/engines/distanceMeasurement.test.ts` exists. No `DistanceSimulator.test.tsx` page test and no `distanceTimeline.test.ts` engine test. No distance presentation-model layer equivalent to Overcurrent's `overcurrentSld`/`overcurrentTcc`.
- Verified as part of the 366-test / 43-file passing suite (2026-08-30). Not frozen; spec not approved.


## Underfrequency Relay — U01 spec + full module — 2026-08-30

- Status: **COMPLETE / MERGED INTO `main`**; spec NOT FROZEN.
- Spec `docs/engineering-specs/underfrequency-relay.md` (U01 v1.0) is **READY FOR APPROVAL** — declares no production Underfrequency engine code is authorized before approval, yet CLAUDE.md marks the module complete and commits `cec6f11`…`7a19f6f` build it.
- Source present: `src/types/underfrequency.ts`, `src/engines/underfrequency.ts` (aggregate / droop / steady-state solver / UFLS / validation), `src/engines/underfrequencyTimeline.ts`, `src/utils/underfrequencyState.ts` + `src/utils/evaluateUnderfrequencyParameters.ts`, `src/studies/underfrequencyStudy.ts` + `underfrequencyPresets.ts`, `src/presentation/underfrequencyAnalysis.ts`, `src/components/underfrequency/*`, `src/pages/UnderfrequencySimulator.tsx`.
- Implemented physics: single-area generator-coherent frequency model; per-generator inertia `H`, droop `R`, headroom, poles → RPM; disturbance events (GENERATOR_LOSS / LOAD_STEP / GENERATOR_BLOCK); swing-equation closed-form segment integration; piecewise-linear saturation steady-state solver incl. `COLLAPSE`/`DEFICIT_EXCEEDS_AVAILABLE_GENERATION` status; staged UFLS ladder (strict `f < threshold && !nearlyEqual` pickup, reset-definite-time delay, latched trip, shed = fraction of pre-disturbance load); static closed-form evaluator for static↔timeline parity.
- Page/route wired: `App.tsx` + `SimulatorHome` both route `/simulator/underfrequency`.
- Tests present: `underfrequency.test.ts`, `underfrequency.hardening.test.ts`, `underfrequencyTimeline.test.ts`, Underfrequency component tests, `UnderfrequencySimulator.test.tsx` — all part of the passing 366-test suite.
- **U01 not frozen; PLN-verification requirement active** — UFLS thresholds/shed amounts are "typical global practice" flagged `plnVerificationRequired: true`, rendered as an amber note until an official PLN grid code is supplied.
