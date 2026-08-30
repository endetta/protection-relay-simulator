# Active context

**Last updated:** 2026-08-30

## Current focus

Overcurrent O15 production integration is complete. **O16 final engineering/source audit has passed and the module is a CONDITIONAL RELEASE CANDIDATE. As of 2026-08-30 the full release gate is closed on this release source: fresh `npm ci` from a clean cache (136 packages), the dependency-complete Vitest suite (31 files / 260 tests), the Vite production build (83 modules), and a production browser smoke (`/`, `/simulator/differential`, `/simulator/overcurrent` — HTTP 200) all PASS. The module is READY FOR FREEZE. The only remaining item is explicit user freeze approval.** No O16 protection feature was added.

Differential Relay remains FINAL / FROZEN at R10; O16 corrected one invalid historical Differential test vector without changing production behavior. Homepage R02/O15 remains the navigation shell.

## Project module status — 2026-08-30

- [~] Homepage / Protection Lab — IMPLEMENTED R02 / NOT FROZEN
- [~] **Overcurrent Relay — O16 AUDIT PASS / CONDITIONAL RELEASE CANDIDATE / READY FOR FREEZE 2026-08-30 / ALL GATE ITEMS PASS / FREEZE NOT YET USER-APPROVED**
- [x] Differential Relay — FINAL / COMPLETED (R10)
- [~] Distance Relay — PARALLEL BRANCH D05 PASS / NOT MERGED INTO THIS SOURCE
- [ ] Underfrequency Relay — PLANNED

## Overcurrent implementation baseline

- PRD v1.0 is authoritative.
- O01 Engineering Specification v1.0 is APPROVED / FROZEN.
- O02 generic domain model is implemented and refined only where later approved phases required explicit study contracts.
- O03/O04 own the hardened CT measurement and single-device 50/51 calculation boundary.
- O05 owns explicit study topology, load/fault cases, current profiles, fault-location interpolation, protection-chain metadata, preset registry, and initialization.
- O06 owns coordination evaluation: operating order, CTI, selectivity, time grading, sensitivity, load security, backup availability, instantaneous overreach, configured-profile corridor/envelope, worst-point scan, and all-case audit.
- O06 refined scrubber transition samples so in-series devices use physically legible configured through-current values after protection-zone transitions; it did not change canonical fault vectors or O01 equations.
- O07 owns the deterministic engineering-time timeline: pickup/timing/trip, breaker opening, fault isolation, backup continuation/reset, STEP/LINEAR accumulated progress, same-timestamp ordering, external clear, and playback-speed separation.
- O07 clarified O05 STEP lookup at an exact sample boundary as right-continuous; no preset values or relay equations changed.
- O08 owns the data-driven Overcurrent parameter reducer, full-study/device validation boundary, and reusable R10-language Parameter UI for study current, CT, 51, 50, breaker, CTI budget, speed, lock/Clear, and preset-local Reset.
- O09 owns the generic radial SLD presentation model/component: device/fault selection, current path, configured fault-profile scrubber, primary/backup roles, and O07-owned breaker/isolation display.
- O10/O10H own the generic TCC presentation model/component: engine-sampled 51 curves, exact 50/51 operating points, log domains, study references, O06 CTI corridor/envelope layers, generic adjacent-tier coordination brackets, correct off-scale/Fit Point behavior, tooltip inspection, SVG-coordinate pointer mapping, and initial-setting comparison.
- O11 owns the Operating Sequence projection/presentation boundary. It queries O07 at arbitrary engineering time, displays generic 1..N relay timing/progress, preserves trip-vs-breaker-vs-isolation semantics, and keeps playback speed out of engineering calculations.
- O12 owns the Analysis / Learning presentation layer and explicit Run Coordination Test action: status, operating order, current/M, CTI margins, audit checks, violations/worst configured case, initial/current Setting Impact, progressive hints, details, and events. It consumes O03–O07 results rather than reimplementing formulas.
- O13 Coordination Guided Challenges is complete.
- O14 owns responsive/accessibility/UX hardening of the accepted route-independent Overcurrent components, including expanded SLD/TCC overlays; it does not change engineering models or activate a route.
- O15 Page / Route / Homepage integration is complete. O16 audit is complete; dependency-complete release build/test/browser smoke has passed (2026-08-30) and the module is READY FOR FREEZE, pending only explicit user freeze approval.
- The production Overcurrent page/route is active at `/simulator/overcurrent` and composes Parameters, SLD, TCC, Operating Sequence, Analysis, and Guided learning through one authoritative reducer state.
- UI language remains locked to Differential R10 once UI implementation begins.

## Current decisions

- Differential remains a simplified two-terminal percentage-restraint study model, not a vendor-specific 87T emulation.
- Signed scalar RMS current convention remains: positive current enters the protected zone.
- CT-secondary amperes remain the relay calculation unit.
- The operating characteristic is now explicitly `Iset horizontal -> Slope 1 -> Slope 2`, with optional `Breakpoint 3 -> Slope 3` in Multi-Slope study mode.
- Characteristic turning points must remain continuous and ordered.
- System operating inputs support Load Driven and Direct Current modes.
- Load Driven uses transformer MVA, terminal kV, active MW, and power factor to calculate three-phase terminal current.
- Simplified fault current is represented as a user-set multiple of rated terminal current; it is not a network fault calculation.
- Characteristic readability has priority over automatically forcing every operating point inside the graph. Extreme points use an off-scale indicator and optional Fit Point view.
- Tooltip help uses a subtle outline `?` icon and viewport-aware portal positioning.
- Differential parameter fields use a stacked label/help → input/unit rhythm so tooltip anchors cannot compete with narrow input columns.
- Protected Zone current-direction indicators use mirrored inline horizontal arrows: Side 1 arrow slot on the right, Side 2 arrow slot on the left, with direction still driven by the signed-current convention.
- CT cards use single-line `Prim. rated` / `Sec. rated` labels and symmetric deterministic spacing.
- CT input stacks use an explicit field-to-field spacing container so nested standalone/React DOM cannot collapse the intended vertical rhythm.
- Measurement Dependency and Protected Zone use semantic green for RESTRAIN/NO TRIP and red for OPERATE/TRIP; blue remains an interaction/focus color only.
- Curve segment hover uses a pointer-follow industrial data card with viewport-edge flipping, active-segment highlight, and collision-safe `RESTRAIN (NO TRIP)` annotation placement.
- UI explicitly distinguishes transformer rating `Sn` from derived load `Sload`, and shows the active Load Driven current source (`Sload` under LOAD or `× Irated` during simplified faults).
- `OPERATE/RESTRAIN` remains the relay decision; breaker opening is outside the model.

## Implemented in the cumulative Differential revision

- defensive engine and CT validation;
- canonical presets/reset/fault restoration;
- load-driven transformer/load current model plus Direct Current study mode;
- horizontal Iset region and dual/multi-slope piecewise characteristic;
- characteristic-priority graph scaling and off-scale operating-point representation;
- simplified axis labels: Bias / Restraint Current and Differential Current;
- viewport-safe outline question-mark tooltips;
- compact parameter panel with technical definitions/ranges in Help/tooltip;
- compact protected-zone and measurement-dependency supporting strips;
- production preset integration and workflow tests updated for the new model.

## Verification gate

Before declaring REFERENCE MODULE READY:

1. TypeScript type-check passes.
2. Engine/system/preset/workflow runtime checks pass.
3. Vitest and Vite build pass in a clean platform-correct dependency install.
4. Manual browser smoke-test confirms full-screen tooltip placement, characteristic/off-scale scaling, scenario animation, Load Driven/Direct Current switching, fault restoration, and Reset.

## Still outside scope

Complex phasor/vector-group processing, zero-sequence compensation, CT saturation, harmonic/inrush logic, true network short-circuit calculation, and breaker/post-trip dynamics.

## UI hierarchy state — R05

- Graph utility control `Fit Point / Characteristic` is a floating overlay and must never consume layout height or shift the characteristic viewport.
- Major visual hierarchy uses charcoal/graphite surfaces with steel-cyan only for structural/interaction emphasis.
- Semantic colors remain separate: green = RESTRAIN/NO TRIP, red = OPERATE/TRIP/fault/error, amber = warning/invalid.
- Primary column titles, section titles, field labels, engineering values, helper text, and metadata now have distinct type scale/contrast levels.
- Important explanatory text such as current-source/fault dependency must remain readable at approximately 10 px or higher in the compact desktop/narrow UI.

## R06 current workflow/UI decisions

- Canonical Normal Load startup and Reset now use **Direct Current** as the active input mode. The initial I1/I2 values remain the physically derived healthy 60% reference-load currents.
- System data remains visible as reference data in Direct Current mode; it becomes the active current source only after Load Driven is selected.
- Applying the simplified internal fault temporarily switches the active source to the `× Irated` fault model; Clear Fault restores the exact pre-fault Direct Current/Load Driven state.
- Production CT scenario defaults remain explicit: CT Ratio Mismatch = CT2 800/1, CT Measurement Error = CT2 +4% ratio error. Normal Load remains the matched zero-error reference case.
- Parameter display labels are intentionally compact and one-line; full engineering meaning stays in tooltips/help.
- Numeric inputs use custom dark stepper buttons; native browser spinners are hidden.
- Engineering scrollbars are intentionally 2 px square position indicators.
- Fit Point / Characteristic is positioned relative to the plot region, not the characteristic summary/header.
- Curve hover range cards use single-line `start → end` ranges in CT-secondary amperes (`A sec`).

## R08 final UX state

- Major Differential sections are persistently collapsible: collapsing hides content without unmounting NumberField drafts, so invalid input cannot become an invisible stale state. Collapsed sections expose summaries and semantic badges; Parameters/Analysis have Collapse all / Expand all, and Live Simulation has Hide support / Show support.
- Direct Current remains the canonical Normal Load startup mode. A compact reference-system card makes the stored rated-system dependency visible for fault injection and later Load Driven use. Input Mode is UI-disabled and reducer-locked during an active simplified fault; Clear Fault restores the exact pre-fault mode/state.
- Characteristic remains the primary visual and can be hidden independently. Protected Zone and Measurement Dependency are supporting collapsible sections. Graph labels explicitly use A sec; OFF-SCALE coordinates identify Ib and Id; previous operating point fades; touch/pen curve inspection is supported in the source.
- Responsive layout uses one column below 760 px, Parameters + Simulation with Analysis below from 760–1179 px, and the production three-column layout from 1180 px upward. A narrow-screen anchor navigator provides fast movement between Parameters, Simulation, and Analysis.
- R08 is intended as the Differential Relay UX freeze point; do not introduce new relay physics unless explicitly specified.

## R09 information-density state

- Collapsed mode is treated as an overview/dashboard state: summaries expose only decision-useful current values, relay settings or equipment ratios rather than flat debug strings.
- Section status/mode badges occupy a dedicated right-aligned slot; badge width/state changes must not shift the section title.
- Major column headings use symmetric fixed utility slots so changing `Expand all / Collapse all` or `Show support / Hide support` does not move the heading.
- Curve segment and operating-point inspection share the same compact industrial tooltip language. Segment inspection shows characteristic range data; operating-point inspection shows Ibias, Idiff, Iop and operate margin.
- Characteristic/relay calculations remain unchanged from R08.

## Homepage R01 implementation state

- Homepage is a fixed 100vw/100vh protection-relay selector with no page scrolling.
- Visible content is intentionally limited to the title `PROTECTION SYSTEM` and four relay names; no descriptions, status text, cards, footer, or marketing copy are shown.
- Relay list order is Overcurrent, Differential, Distance, Underfrequency. The registry is data-driven for future module additions.
- Hover/focus motion reuses Differential R10 interaction grammar: steel-cyan rail, subtle surface tint, short horizontal translation, and line reveal. Motion is disabled/reduced under `prefers-reduced-motion`.
- Differential selection uses a short locked selected-state + horizontal route wipe before navigating to `/simulator/differential`; simulator entry uses a subtle settle animation outside the frozen Differential module source.
- Differential Relay remains FINAL / COMPLETED at R10 and must not be modified unless its scope is explicitly reopened.

### Homepage R02 navigation-shell refinement
- Differential simulator header brand is now `PROTECTION SYSTEM SIMULATOR` and acts as the Home control back to `/`.
- This is a platform navigation-shell change only; Differential engineering remains frozen at R10.


## Overcurrent O01 engineering-spec state

- `docs/engineering-specs/overcurrent-relay.md` is O01 v1.0 **APPROVED / FROZEN FOR IMPLEMENTATION**. Implementation has advanced through O08 without changing its equations.
- Current model is scalar RMS non-directional phase 50/51: primary A -> CT ratio/error -> relay A sec -> strict 51 pickup -> definite/inverse timing -> strict 50 high-set -> 50-priority arbitration.
- Locked inverse registry: IEC SI/VI/EI and IEEE MI/VI/EI using `T = S * [k/(M^alpha-1)+c]`; inverse time is undefined/no-pickup at `M <= 1`; robust evaluation uses an `expm1(alpha*ln(M))` denominator near pickup.
- V1 reset is immediate when current falls to/below 51 pickup. Architecture is varying-current-ready via accumulated inverse operating quantity `integral dt/T(I)` in engineering simulation time.
- Relay trip output and breaker clearing are separate. Backup relays continue timing until study current is actually removed at fault isolation.
- Coordination uses `Observed CTI = t_backup_trip - t_primary_trip`; PASS is `Observed CTI >= Required CTI`. Guided default budget is 0.10 s breaker + 0.05 s timing allowance + 0.15 s study margin = 0.30 s, explicitly a preset rather than a universal rule.
- Study currents are configured data, never a hidden short-circuit solution. Validation cases remain authoritative; optional profile interpolation/envelope is identified as preset study interpolation.
- Canonical presets/test vectors are now specified, including the intentional 3-relay F3 high-current CTI violation used for guided coordination learning.
- Differential R10 remains frozen and is still the exact visual/interaction-language reference for future Overcurrent UI work.


## Overcurrent O02 domain-model state

- O01 Engineering Specification v1.0 is now APPROVED / FROZEN FOR IMPLEMENTATION after the project explicitly advanced beyond its approval gate.
- O02 is COMPLETE. Authoritative contracts are `src/types/overcurrent.ts` and `docs/engineering-specs/overcurrent-domain-model-o02.md`.
- Domain architecture is generic: no `R1Settings/R2Settings/R3Settings`; devices and study relationships use IDs/records and can represent 1/2/3+ radial relays.
- Locked O02 concepts include CT/50/51 settings, static/profile per-device currents, radial topology/locations, explicit primary-backup chains, CTI requirements/budget, structured operating/coordination results, coordination violations/audit dimensions, current-profile-ready timeline events/progress, generic TCC layers, study snapshots, guided hints/objectives, and non-throwing `DomainEvaluation<T>`.
- O02 contains no relay equations and no React dependency. Its contracts are now consumed by the implemented O03–O10 layers.
- O03 Measurement + 50/51 Pure Engine, O04 hardening, O05 Study Engine, O06 Coordination Engine, O07 Timeline Engine, O08 Parameter UI, O09 SLD, and O10 TCC have passed in sequence.


## Overcurrent O05 study-engine state

- O05 Study Engine & Preset Registry is implemented and verified; O06 and O07 now consume its contracts.
- Production study data is immutable `OvercurrentStudyDefinition` data; relay equations remain owned by O03/O04.
- O05 adds explicit `LoadCase` / load-security references so maximum load is never hidden in UI defaults or mislabeled as a fault.
- All static study cases carry explicit per-device primary-current maps; missing device currents are INVALID rather than inferred.
- Primary/backup roles come from `ProtectionChain`. Sequential grading pairs are adjacent tiers (for F3: R3→R2, then R2→R1), never inferred from relay names.
- Fault-location scrubber current uses configured LINEAR samples; optional configured profile segments supply protection-zone/chain changes. This is study interpolation, not short-circuit calculation.
- Production preset registry now includes OVC-01…OVC-08 and the complete O13 Guided progression COORD-01…COORD-06.
- Canonical COORD-02 F3 MAX remains byte/number consistent with O01: R3 ≈ 0.207692308 s, R2 = 0.486 s, CTI ≈ 0.278307692 s < 0.30 s.
- O05 does not implement CTI calculation, coordination verdicts, timeline playback, TCC, SLD, or React UI.


## Overcurrent O07 timeline-engine state

- O07 Timeline Engine is implemented and PASSED. Authoritative production and
  verification files are `src/engines/overcurrentTimeline.ts`,
  `src/engines/overcurrentTimeline.test.ts`, and
  `docs/engineering-specs/overcurrent-timeline-o07.md`.
- The engine is pure, UI-independent, and event-driven in engineering time.
  Constant/STEP intervals are analytic; LINEAR inverse progress uses
  deterministic adaptive integration and fixed-iteration root finding.
- O01 strict pickup, 50 priority, immediate reset, breaker clearing, fault
  isolation, backup continuation, and multiple-trip semantics are preserved.
- Same-timestamp phase ordering and event IDs are deterministic. Playback speed
  changes wall-clock mapping only and leaves snapshots/events byte-structurally
  equal.
- O07 clarified exact STEP sample timestamps as right-continuous in the O05
  resolver. All O03–O07 Overcurrent regressions and the production build pass.
- One unrelated Differential overflow assertion already fails in the supplied
  O06 baseline because its test values remain finite; frozen R10 code/tests were
  not modified.
- O07 remains frozen as the engineering-time source for later playback; O08 did
  not change its timeline semantics.

## Overcurrent O08 parameter-UI state

- O08 Parameter UI is implemented and PASSED. Authoritative production and
  verification files are `src/utils/overcurrentState.ts`,
  `src/utils/evaluateOvercurrentParameters.ts`,
  `src/components/overcurrent/OvercurrentParameterPanel.tsx`, its scoped CSS,
  the two O08 test files, and
  `docs/engineering-specs/overcurrent-parameter-ui-o08.md`.
- The reducer initializes and resets from the selected O05 preset, applies
  immutable edits, keeps registry data unchanged, reconciles CTI budgets, and
  locks engineering controls during RUNNING/PAUSED while leaving device focus,
  speed, Clear, and Reset available.
- Validation covers the O05 structure, every CT/51/50/breaker setting, state
  reference consistency, and every configured load/fault/profile current vector
  through the approved O03/O04 device evaluator. Invalid drafts or derived
  numerical range failures block Apply Fault.
- The React form maps `topology.deviceIds` and coordination requirements; a
  synthetic four-relay render passes without relay-specific form code. It
  directly reuses frozen R10 shared ParameterGroup, NumberField, InfoDot, and
  SectionSummary behavior without modifying Differential source.
- O08 verification: 2 files / 12 tests PASS; combined O03–O08 10 files / 106
  tests PASS; strict TypeScript, active production build, and isolated O08
  React/CSS Vite bundle PASS.
- O09 continuation was explicitly requested and passed without changing O08
  relay-setting semantics.

## Overcurrent O09 SLD state

- O09 SLD is implemented and PASSED. Authoritative files are
  `src/presentation/overcurrentSld.ts`,
  `src/components/overcurrent/RadialProtectionDiagram.tsx`, its scoped CSS and
  tests, and `docs/engineering-specs/overcurrent-sld-o09.md`.
- Topology, locations, device identity, active study current, and
  primary/backup roles come from O05/O08 state. The component contains no relay
  or network equation.
- Fault-location profile interaction uses the existing O05 resolver; profile
  points are Explore-only and cannot start a discrete O07 run.
- Breaker state and fault isolation consume only a matching O07 timeline
  snapshot; stale snapshots are ignored.
- SLD relay selection and later TCC selection share `selectedDeviceId` for the
  O10 bidirectional-highlighting contract.
- O09 verification: 2 files / 14 tests PASS; combined O03–O09 12 files / 120
  tests PASS; strict TypeScript, production build, and isolated O09 client
  bundle PASS.
- O10 verification: 2 files / 15 tests PASS; combined O03–O10 14 files / 135
  tests PASS; strict TypeScript, production build, and isolated O10 client
  bundle PASS.
- O11 Operating Sequence, O12 Analysis, O13 Guided Challenges, and O14 UX hardening have since passed; O09 engineering semantics remain frozen.

## Overcurrent O10 TCC state

- O10 TCC is implemented and PASSED. Authoritative files are
  `src/presentation/overcurrentTcc.ts`,
  `src/components/overcurrent/TimeCurrentCurve.tsx`, its scoped CSS and tests,
  and `docs/engineering-specs/overcurrent-tcc-o10.md`.
- The presentation model samples accepted O03/O04 curve and operating results;
  it consumes O06 pair/envelope results for CTI layers and duplicates no relay
  or coordination formula.
- Single Relay defaults to current multiple. Coordination Lab defaults to a
  common primary-current domain. Both axes use deterministic log scaling.
- The 50 result remains exactly 0 s and appears below the positive log axis with
  a high-set boundary and 51 reference time.
- Characteristic mode holds stable bounds; Fit Point expands only for positive
  engine points and remains an in-plot overlay.
- O09 and O10 share `selectedDeviceId`; a later composition gate can provide
  bidirectional SLD/TCC highlighting without a second selection store.
- O11 sequence, O12 Analysis, O13 Guided Challenges, and O14 UX hardening are implemented. The Overcurrent page/route remains intentionally unimplemented until O15.

## Overcurrent O10H TCC hardening state

- O10H is implemented and PASSED. It is now the trusted baseline for O11.
- Active backup CTI is always evaluated against the immediately preceding device in the configured protection chain, not always against the physical primary.
- TCC exposes generic `COORDINATION_BRACKET` layers for active adjacent-tier pair margins.
- Below-pickup markers are not off-scale operating points and must not trigger Fit Point.
- Exact 0-second 50 remains a true lower off-scale result on the positive log-time axis.
- Pointer mapping must use SVG coordinates, not raw CSS-rectangle ratios.
- O11 and later O12–O14 have since passed; O10H TCC engineering semantics remain frozen.

## Overcurrent O13 Coordination Guided Challenges state

- O13 is implemented and PASSED on the trusted O12 baseline. Authoritative files are `src/presentation/overcurrentGuidedChallenge.ts`, `src/components/overcurrent/GuidedChallengeCard.tsx`, `src/studies/overcurrentPresets.ts`, the additive Guided workflow state in `src/utils/overcurrentState.ts`, and `docs/engineering-specs/overcurrent-guided-challenges-o13.md`.
- Guided challenge progression is complete from COORD-01 through COORD-06. COORD-03 Pickup + Time, COORD-04 Curve Selection, and COORD-06 Full Coordination were added with deterministic intentional failures and test-only solved references. Exact solution values are not stored in runtime hint metadata.
- Completion is outcome-based and requires explicit `RUN_COORDINATION_TEST`, O06 `COORDINATED`, every configured validation case passing, and every objective-required audit dimension PASS. `NOT_EVALUABLE` can never verify.
- Hints are reducer-owned and reveal only Location -> Parameter Family -> Direction. Reset restores zero hints and IDLE validation. Guided/Free is learning metadata only; engineering validation is preserved across guidance switching and selection-only fault scrubber movement, while genuine engineering edits still invalidate stale verification.
- `WHY THIS WORKS` appears only after VERIFIED and is derived from accepted audit dimensions rather than a hidden optimizer. Free Study remains the full engineering simulator without challenge ceremony.
- O13 verification: strict pure TypeScript PASS; 78 TS/TSX syntax-transpile with 0 diagnostics; O12 parent runtime harness 1,063 PASS; O13 runtime contracts 2,118 PASS including 1,000 deterministic fuzz iterations; protected O03–O12/Differential/Homepage production source parity PASS.
- At the time of writing, fresh npm/Vitest/Vite was not claimed because the offline npm cache lacked `yallist-3.1.1`; permanent O13 Vitest files were still included. The current environment has since passed the full Vitest suite and production Vite build (2026-08-29), so this environment no longer observes that blocker.
- O13 engineering/challenge semantics remain accepted and frozen under the O14 presentation-hardening baseline.


## Overcurrent O14 Responsive / Accessibility / UX state

- O14 is implemented and PASSED on the trusted O13 baseline. Authoritative implementation changes are limited to route-independent Overcurrent React/CSS components plus the additive shared `EngineeringViewOverlay`; no engine/study/pure presentation/reducer engineering logic changed.
- Radial SLD and TCC support same-state expanded modal engineering views with Escape, focus trap, body-scroll lock, and focus restoration. No browser window or route is opened.
- TCC adds keyboard inspection and a textual engineering equivalent; SLD/TCC preserve readability on narrow viewports via controlled internal scrolling rather than destructive shrinking.
- Operating Sequence exposes high-level status and progress semantics while preserving O11 engineering timing. Parameter, Analysis, and Guided Challenge controls gain responsive/coarse-pointer/focus refinements without altering reducer or audit results.
- Reduced-motion affects presentation only. Status continues to be expressed with text in addition to semantic color.
- Verification: pure TypeScript PASS; targeted O14 component TypeScript PASS; 80 TS/TSX syntax-transpile / 0 diagnostics; 2,018,517 runtime/parent checks PASS; 1,000 deterministic fuzz iterations PASS; UX/accessibility static audit 28/28 PASS; 40 protected parent files byte-identical.
- At the time of writing, fresh npm/Vitest/Vite was not claimed because offline npm cache lacked `yallist-3.1.1`; permanent O14 Vitest coverage was still included. The current environment has since passed the full Vitest suite and production Vite build (2026-08-29), so this environment no longer observes that blocker.
- O14 is the authoritative baseline for O15. O15 Page / Route / Homepage integration has not started.

## Overcurrent O15 page / route / Homepage integration state

- O15 is implemented and PASSED on the trusted O14 source content. The production route is `/simulator/overcurrent`; Homepage activates Overcurrent and Differential only, while Distance/Underfrequency remain planned.
- `OvercurrentSimulator` owns one `OvercurrentParameterState` reducer and composes Parameters, SLD, TCC, Operating Sequence, Analysis, and Guided Challenge. No page-level relay/CTI formula is introduced.
- O11 publishes the accepted O07/O11 timeline snapshot to the page; the same snapshot feeds O09 SLD and O12 Analysis.
- O15 closes integration defects discovered only after composition: invalid visible numeric drafts block run-all validation; genuine engineering edits/new fault/profile selection reset stale COMPLETE playback to IDLE; global header stays READY before an executed/validated result.
- Overcurrent header now has Home, module identity, Reset, and concise Help. Shared `SimulatorHeader` and `EngineeringViewOverlay` were generalized additively with defaults preserving existing Differential behavior.
- Verification: strict pure TypeScript PASS; full source/test contract compile with temporary dependency declarations PASS; 82 TS/TSX syntax-transpile / 0 diagnostics; 1,350,661 runtime integration checks PASS; 53/53 static integration/accessibility checks PASS; 80 protected parent files parity PASS; source-diff scope PASS.
- At the time of writing, fresh dependency-complete Vitest/Vite was not claimed because the runtime npm cache lacked `yallist-3.1.1`; permanent O15 tests were still included. The current environment has since passed the full Vitest suite and production Vite build (2026-08-29), so this environment no longer observes that blocker.
- Next phase: O16 Final Engineering + UX Audit / release freeze. O16 is not started by O15.
