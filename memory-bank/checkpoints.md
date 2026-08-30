# Differential Simulator Checkpoints

## diff-sim-2026-08-13-r01

- Date: 2026-08-13
- Parent: authoritative reconstructed latest cumulative Differential state.
- Scope: Differential UI/UX hierarchy, tooltip/input collision removal, dark-theme contrast, CT field spacing, Load Driven dependency clarity, and propagation regression tests.
- Pre-change archive: `/mnt/data/protection_checkpoints/diff-uiux-r01-pre-20260813T1006+0700.tar.gz`
- Engineering-model change: none. Approved `LOAD -> Sload` and `fault -> × Irated` semantics preserved.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R01_Preview.html`

- 2026-08-13 R02: UI/UX revision for Differential Relay. Curve auto-scale stabilized, zone labels updated (Operate/Trip, Restrain/No Trip), curve segment hover tooltips added, parameter spacing normalized, trip-state highlights added to Measurement Dependency and Protected Zone, current arrows enlarged, preview companion updated to R02.

## diff-sim-2026-08-13-r03

- Date: 2026-08-13
- Parent: `diff-sim-2026-08-13-r02`.
- Scope: Differential UI consistency pass only. Protected Zone current arrows are now wide inline SVG indicators (Side 1 arrow slot on the right, Side 2 arrow slot on the left) without adding card height. CT labels are abbreviated to `PRIM. RATED` / `SEC. RATED`, CT1/CT2 vertical rhythm is deterministic and symmetric, and paired parameter/select spacing is normalized.
- Engineering-model change: none. Differential engine, system model, CT measurement model, reducer/presets, characteristic math, and source-of-truth semantics are unchanged.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/diff-sim-2026-08-13-r03-pre-ui-spacing`.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R03_Preview.html`.
- Verification: 29 TS/TSX files syntax-transpile PASS; narrow 414 px CT labels are one line and symmetric; tooltip remains viewport-contained; 7/7 production scenario decision smoke PASS; internal-fault trip highlighting PASS; preview page errors: none. Full npm/Vite suite was blocked in this sandbox at the time of writing by unavailable local dependencies and has since passed (2026-08-29).

## diff-sim-2026-08-13-r04

- Date: 2026-08-13
- Parent: `diff-sim-2026-08-13-r03`.
- Scope: final Differential UI consistency pass. CT field spacing is structural/deterministic in both React source and standalone preview; no-trip Measurement Dependency and Protected Zone use semantic green while trip uses red; curve segment tooltip is an industrial data card that follows the pointer and flips at viewport edges; hovered curve segment is highlighted; `RESTRAIN (NO TRIP)` automatically moves to the alternate lower corner when the operating point or active pointer would collide with the default lower-right label.
- Engineering-model change: none. Engine, system model, CT measurement math, presets/reducer, breakpoint continuity, Load Driven/Direct Current semantics, and fault model are unchanged.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/diff-sim-2026-08-13-r04-pre-final-ui`.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R04_Preview.html`.
- Verification: TS/TSX syntax-transpile PASS (29 files); engineering/utils SHA-256 unchanged from pre-R04 checkpoint; standalone JS syntax PASS; browser DOM smoke at 414 px PASS with exact 10 px CT row gaps and single-line CT labels; no-trip dependency semantic green PASS; curve pointer-follow tooltip movement/viewport containment PASS; lower-right collision relocation PASS; 7/7 production scenario runtime smoke PASS; internal-fault red trip highlighting and clear-fault restoration PASS.

## diff-sim-2026-08-13-r05

- Date: 2026-08-13
- Parent: `diff-sim-2026-08-13-r04`.
- Scope: Differential UI hierarchy/readability pass. `Fit Point / Characteristic` is now an absolute overlay control so its appearance does not consume a new row or shift the graph. Major columns and parameter groups use a stronger graphite/charcoal surface hierarchy with restrained steel-cyan structural accent. Typography, field labels, explanatory current-source text, metrics, supporting strips, and Analysis hierarchy were raised to readable sizes/contrast while green/red/amber remain reserved for relay state, trip/fault, and warning semantics.
- Engineering-model change: none. Engine, measurement chain, system model, reducer/presets, characteristic math, Load Driven/Direct Current semantics, and fault behavior are unchanged.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/diff-sim-2026-08-13-r05-pre-hierarchy`.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R05_Preview.html`.
- Verification: TS/TSX syntax-transpile PASS (29 files); engineering/utils diff unchanged; standalone JS syntax PASS; 414 px CT gaps remain 10 px/10 px; hierarchy font-size checks PASS; Fit Point overlay is absolute and curve viewport height/top remain unchanged when the control appears; pointer-follow tooltip/viewport containment PASS; 7/7 production scenario runtime PASS; Load Driven propagation, Direct Current explicit input, Multi-Slope BP3 continuity, Reset, trip highlighting, and fault restoration PASS.

## diff-sim-2026-08-13-r06

- Date: 2026-08-13
- Parent: `diff-sim-2026-08-13-r05`.
- Scope: compact-parameter and workflow pass. Normal Load now starts in Direct Current mode with the same physically derived reference currents; selecting Load Driven explicitly re-enables system-derived current propagation. Numeric fields use custom navy/graphite steppers instead of browser-native spinners. Parameter display labels were shortened (`Rated MVA (Sn)`, `V1 (L-L)`, `V2 (L-L)`, `Load P`, `PF`, `Bias BP1/BP2/BP3`). Fit Point / Characteristic is anchored inside the plot area below the separator. Curve hover ranges are presented inline as `start → end` in A sec. Engineering scrollbars are 2 px square indicators.
- CT scenario defaults retained: CT Ratio Mismatch uses CT2 800/1; CT Measurement Error uses CT2 +4% ratio error.
- Engineering-model change: no formula change. System, CT measurement, percentage-restraint characteristic, breakpoint continuity, and strict `Idiff > Iop` decision remain unchanged. Workflow change only: canonical Normal Load startup/reset mode is Direct Current.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/diff-sim-2026-08-13-r06-pre`.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R06_Preview.html`.
- Verification: TS/TSX syntax-transpile PASS (29 files); source runtime audit PASS for system equations, CT chain, 7/7 production scenarios, Dual/Multi breakpoint continuity, Direct Current source-of-truth, Load Driven transition, internal-fault takeover/restoration, Reset, and CT mismatch/error defaults; browser/UI regression PASS at 414 px and desktop; Fit overlay offset inside plot = 12 px with no plot-height shift; curve tooltip range layout and pointer-follow PASS; scrollbar CSS 2 px square PASS.

## diff-sim-2026-08-13-r07

- Date: 2026-08-13
- Parent: `diff-sim-2026-08-13-r06`.
- Scope: final release-hardening pass. Added a non-throwing simulation evaluation boundary, finite/overflow guards across system/CT/differential arithmetic, overflow-resistant Ibias averaging, and a unified `OPERATE | RESTRAIN | INVALID` display status. Invalid/overflowing states now hold the last valid engineering result and suppress active-trip semantics until inputs recover.
- Workflow/UI hardening: Apply Fault is blocked while the simulation is invalid; Protected Zone, Measurement Dependency, curve and Analysis use amber `INVALID / HELD` semantics instead of stale red trip semantics. Help dialog gains Escape-to-close, initial close-button focus and labelled-dialog semantics. Characteristic/current calculation units are standardized to `A sec` where the CT-secondary domain is intended.
- Toolchain: root Vite aligned to 8.2.1, Vitest remains 4.1.10, and `@vitejs/plugin-react` aligned to 6.0.1; package-lock updated and npm-ci dry-run accepts the lock without dependency/peer mismatch warnings. Node 20.19+ / 22.12+ is required by the Vite 8 toolchain.
- Engineering-model change: no new relay physics. Percentage-restraint equations, CT ratio/error model, system/load model, sign convention, fault ×Irated study model, strict `Idiff > Iop`, presets and expected scenario decisions remain unchanged.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/diff-sim-2026-08-13-r07-pre-hardening`.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R07_Preview.html`.
- Verification: pure-engine strict TypeScript PASS; TS/TSX syntax-transpile PASS (31 files); 7/7 production scenarios PASS; Direct Current/Load Driven/fault restoration/Reset PASS; CT mismatch/error defaults PASS; extreme numeric guards PASS; 100,000 randomized calculation cases PASS; 50,000 randomized breakpoint-continuity cases PASS; standalone JS syntax PASS; browser/UI regression PASS including OPERATE → invalid/overflow state coherently becoming `INPUT INVALID / HELD`, no stale `Trip condition active`, Fit Point no-layout-shift, tooltip pointer-follow, narrow labels, custom stepper and 2 px square scrollbar. Full dependency install/Vitest/Vite build was not executed in this sandbox because package tarballs are not locally cached and registry/DNS access is unavailable.

## diff-sim-2026-08-13-r08

- Date: 2026-08-13
- Parent: `diff-sim-2026-08-13-r07`.
- Scope: final Differential UX-finalization pass. Major Parameters, Live Simulation supporting cards, Characteristic Curve, and Analysis sections now support persistent hide/show without unmounting field drafts. Collapsed sections expose compact summaries/status badges, and Parameters/Analysis provide Collapse all / Expand all controls while Live Simulation provides Hide support / Show support. Invalid drafts remain discoverable while their section is collapsed.
- Direct Current UX: added a compact reference-system/fault-injection card and optional reference editor. The reference makes the stored Sn/V1/V2/Irated dependency visible while Direct Current controls I1/I2. During an active simplified fault, Input Mode is disabled and reducer-guarded so the `× terminal Irated` override cannot be silently replaced before Clear Fault restores the exact pre-fault source.
- Graph/analysis clarity: Characteristic supports hide/show, A-sec axis labels, compact legend, explicit OFF-SCALE Ib/Id coordinates, previous-point fade, and touch/pen segment-tooltip pinning in the React source. Trip output terminology is `ASSERTED / DEASSERTED / HELD`; Margin uses semantic operate/restrain/warning tones. Protected Zone and Measurement Dependency are independently collapsible.
- Accessibility/responsive: InfoDot keeps a compact visual mark with a larger interaction hitbox and touch/outside/Escape handling; Help dialog traps Tab focus and returns focus on close. Three-column layout now begins at 1180 px; 760–1179 px uses a two-column Parameters/Simulation layout with Analysis below, and narrow layouts expose a sticky Parameters/Simulation/Analysis anchor navigator. Engineering scrollbar remains 2 px square.
- Engineering-model change: none. `src/engines` is byte-identical to R07. Only workflow hardening in `differentialState.ts` prevents Input Mode changes while a fault override is active; percentage-restraint, CT, system, sign-convention, preset, and fault-current equations are unchanged.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/diff-sim-2026-08-13-r08-pre-ux`.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R08_Preview.html`.
- Verification: TS/TSX syntax-transpile PASS (31/31); pure-engine/state strict TypeScript PASS; `src/engines` and protected homepage files unchanged from R07; 7/7 production scenarios PASS; fault override lock/exact Direct Current restoration PASS; extreme finite-overflow guard PASS; 100,000 randomized calculation cases PASS; 50,000 randomized breakpoint-continuity cases PASS; standalone JS syntax PASS. Chromium standalone UI smoke via Playwright `set_content` PASS with no page errors, persistent hidden-invalid badge behavior, fault-mode lock/restore, group/support controls, and zero horizontal overflow at 414/759/760/1024/1179/1180/1366/1536 px.

## diff-sim-2026-08-13-r09

- Date: 2026-08-13
- Parent: `diff-sim-2026-08-13-r08`.
- Scope: collapsed-state readability and graph-inspector refinement only. Collapsed section summaries are now structured mini-metrics / CT entity cards instead of flat debug-style strings; section status badges use a dedicated right-aligned slot; major column titles use fixed symmetric action slots so `Expand all / Collapse all` and `Show support / Hide support` do not shift headings. Curve inspection uses a compact shared industrial tooltip for both curve segments and the operating point, with pointer-follow positioning, viewport-edge flipping, point hover halo, and operating-point Ibias/Idiff/Iop/Margin data.
- Engineering-model change: none. `src/engines` and engineering/state utilities remain byte-identical to R08 except the UI page uses a more explicit discriminated-union check for displaying the existing evaluation error.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/diff-sim-2026-08-13-r09-pre-ux`.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R09_Preview.html`.
- Verification: 33 TS/TSX syntax-transpile PASS; semantic TypeScript pass with external-library stubs PASS; engines/utils diff unchanged; 7/7 production scenarios PASS; Direct Current fault takeover/mode-lock/exact restore PASS; standalone JS syntax PASS; browser smoke at 414/760/1024/1179/1180/1366/1536 px PASS with no horizontal overflow/page errors; collapsed badge right edges align; Parameters title movement across Expand/Collapse = 0 px; curve-segment tooltip width <=246 px; operating-point tooltip width 210 px and exposes Ibias/Idiff/Iop/Margin.

## diff-sim-2026-08-13-r10

- Date: 2026-08-13
- Parent: `diff-sim-2026-08-13-r09`.
- Scope: minimal layout/interaction polish with the R09 visual composition intentionally preserved. Native per-column scrollbars are hidden and replaced by reusable 2 px square overlay indicators that live in the right-side visual gutter without reducing the content width. Parameters, Live Simulation, and Analysis retain their existing hierarchy and column composition.
- Layout correction: the desktop visual ratio remains `24 / 49 / 27` from the same 1180 px breakpoint, but is expressed as gap-safe fractional tracks (`24fr / 49fr / 27fr`) so grid gaps no longer push/crop the Analysis column. No intentional widening/rebalancing of the three major columns was retained.
- Numeric controls: custom stepper width reduced to 18 px; unit/control spacing tightened without restructuring field layout. Pointer press-and-hold repeats after 380 ms and accelerates by cadence (130 ms -> 75 ms -> 45 ms); pointer release/cancel, browser blur, hidden state, or min/max stops repetition. Normal click remains one step, keyboard activation remains supported, and focused number inputs blur on wheel to prevent accidental changes while scrolling.
- Engineering-model change: none. `src/engines`, reducer/state, safe evaluator, presets, and engineering utilities are byte-identical to R09.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/diff-sim-2026-08-13-r10-pre-layout-interaction`.
- Standalone preview: `/mnt/data/Differential_Relay_UIUX_R10_Preview.html`.
- Verification: TS/TSX syntax-transpile PASS (35 files); pure engine/state TypeScript PASS; engines/utils unchanged from R09; 7/7 production scenarios PASS; standalone browser smoke PASS at 414/760/1024/1179/1180/1366/1536 px with no horizontal overflow or Analysis clipping; overlay indicator width 2 px and Parameters content width remains stable when scrolling is required; numeric stepper width 18 px; one click applies exactly one step; hold repeats/accelerates and stops immediately after release. Full npm/Vitest execution remains unavailable because local dependencies are absent and the sandbox registry configuration is invalid.

## project-2026-08-13-homepage-start

- Date: 2026-08-13
- Parent/freeze point: `diff-sim-2026-08-13-r10`.
- Scope: project-status/sourcebook transition only. Differential Relay is marked **FINAL / COMPLETED (R10)** and frozen. Homepage / Protection Lab is now the active workstream. Overcurrent, Distance, and Underfrequency remain planned/not started.
- Homepage code change is limited to changing the Differential module status label from `Reference` to `Completed`; no homepage redesign has been performed yet.
- Differential Relay implementation files are unchanged.

## homepage-2026-08-13-r01

- Date: 2026-08-13
- Parent platform state: Differential Relay frozen/final at R10.
- Scope: Homepage / Protection Lab navigation only. Replaced the legacy card/status landing page with a fixed no-scroll relay selector using the same graphite/navy, steel-cyan, type and motion language as Differential R10.
- Homepage content is intentionally limited to `PROTECTION SYSTEM` plus four relay names: Overcurrent, Differential, Distance, and Underfrequency.
- Differential is currently the only routed module. The module registry is data-driven so future relay routes can be enabled without redesigning the homepage.
- Added precise hover/focus interaction (cyan rail, small label translation, engineering line reveal, low-opacity surface tint) and a short route-exit wipe before entering Differential.
- AppShell no longer adds a separate marketing/laboratory header on the homepage. Simulator routes retain their own simulator header and workspace unchanged.
- Engineering-model change: none. Differential R10 source remains frozen.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/homepage-2026-08-13-r01-pre`.

## homepage-2026-08-13-r02

- Date: 2026-08-13.
- Parent: `homepage-2026-08-13-r01`; Differential engineering remains frozen at R10.
- Scope: simulator navigation-shell refinement only. Renamed the Differential simulator header brand from `Power System Protection Simulator` to `Protection System Simulator` and styled it as an explicit home button linking to `/`.
- Interaction: the home control uses the existing graphite/steel-cyan simulator language with bordered dark surface, cyan hover/focus state, and a subtle 1 px lift. The combined standalone preview supports a working return-to-home action from inside the embedded Differential preview.
- Engineering/model change: none. Differential engines, characteristic logic, state, measurement chain, workflow, and parameter UI are unchanged.
- Pre-change rollback checkpoint: `/mnt/data/protection_checkpoints/homepage-2026-08-13-r02-pre-homebutton`.
- Combined preview: `/mnt/data/Protection_System_Combined_Preview_Home_R02_Differential_R10.html`.

## overcurrent-prd-2026-08-13-v1

- Date: 2026-08-13.
- Parent platform state: Homepage R02 navigation shell; Differential Relay FINAL / frozen at R10.
- Scope: planning/sourcebook only. Added authoritative `docs/PRD-overcurrent-relay.md` v1.0 and the required O01 engineering-spec scaffold `docs/engineering-specs/overcurrent-relay.md`.
- Product definition: Overcurrent is a **50/51 Protection & Coordination Laboratory**, not a static TCC calculator. Locked learning sequence is Explore → Coordinate → Validate.
- Core scope locked from architecture start: Single Relay Study, 2/3-relay radial Coordination Lab, Guided/Free studies, CT measurement, IEC/IEEE/Definite 51 timing, instantaneous 50, TCC layer system, clickable SLD, primary/backup CTI, CTI budget, coordination corridor/envelope, worst-case scan, sensitivity/selectivity/load-security checks, instantaneous reach, time-domain trip/breaker sequence, all-cases coordination audit, hints, parameter-impact inspector, and initial/current comparison.
- Architecture locked: Overcurrent Element Engine → Measurement Engine → Study Engine → Coordination Engine → Timeline Engine → Presentation Model. Current-profile-ready timeline and generic TCC layers are required to prevent future rewrites.
- UI constraint: Differential R10 remains the exact visual/interaction language reference; Overcurrent may have unique engineering visualizations but no alternate design system.
- Explicit non-goals: directional 67, ground/sequence expansion, full short-circuit network solver, ring/meshed coordination, CT saturation, vendor-specific emulation, auto-optimization, communications-assisted/adaptive protection.
- Engineering implementation status: NOT STARTED. Immediate next gate is O01 Engineering Specification; no production 50/51 formula code is authorized before O01 approval.
- Pre-PRD planning checkpoint: `/mnt/data/protection_checkpoints/overcurrent-prd-2026-08-13-v1-pre`.


## overcurrent-o01-2026-08-13-v1-draft

- O01 Engineering Specification drafted and audited; no production engine code added.
- Source of truth: `docs/engineering-specs/overcurrent-relay.md`.
- Approval state: READY FOR APPROVAL, not yet frozen.
- Pre-spec rollback: `/mnt/data/protection_checkpoints/overcurrent-o01-2026-08-13-pre`.


## overcurrent-o02-2026-08-13-v1

- Date: 2026-08-13.
- Parent: O01 Engineering Specification v1.0 approved/frozen.
- Scope: O02 Domain Types & Data Model only; no Overcurrent production calculations or UI.
- Added `src/types/overcurrent.ts`, `docs/engineering-specs/overcurrent-domain-model-o02.md`, and `OVERCURRENT_O02_README.md`.
- Pre-O02 rollback checkpoint: `/mnt/data/protection_checkpoints/overcurrent-o02-2026-08-13-pre`.
- Verification: strict TypeScript type compile PASS; generic four-relay compile contract PASS; no React/Differential dependency; no production Overcurrent engine files added.
- Next phase: O03 Measurement + 50/51 Pure Engine.

## overcurrent-o03-2026-08-13-v1

- Date: 2026-08-13.
- Parent: `overcurrent-o02-2026-08-13-v1`.
- Scope: O03 Measurement + 50/51 Pure Engine.
- Added `src/engines/overcurrentMeasurement.ts`, `src/engines/overcurrent.ts`, `src/utils/evaluateOvercurrentDevice.ts` plus O03 tests and engineering documentation.
- O02 semantic refinement: `Overcurrent51StaticStatus` now includes `DISABLED`; no O01 mathematics changed.
- Pre-O03 rollback checkpoint: `/mnt/data/protection_checkpoints/overcurrent-o03-2026-08-13-pre`.
- Verification: strict O03 TypeScript PASS; 18/18 O01 inverse vectors PASS; 150,000 monotonic curve samples PASS; 100,000 randomized device evaluations PASS; CT overflow/underflow and safe-evaluator guards PASS.
- Next phase: O04 Engine Unit Tests / Numerical Hardening.


## overcurrent-o04-2026-08-13-v1

- Date: 2026-08-13.
- Parent: `overcurrent-o03-2026-08-13-v1`.
- Scope: O04 Engine Unit Tests / Numerical Hardening.
- Defect fixed: invalid negative/non-finite breaker clearing times could cross the O03 static safe-evaluation boundary.
- Numerical hardening: CT ideal-secondary calculation now tries algebraically equivalent operation orderings to preserve extreme finite results when a single intermediate ratio would underflow/overflow.
- Added `src/engines/overcurrent.hardening.test.ts` and expanded measurement/evaluator tests.
- O01 validation clarification: breaker clearing time is finite and >= 0; zero is allowed as an idealized study case. No relay/timeline formula semantics changed.
- Pre-O04 rollback checkpoint: `/mnt/data/protection_checkpoints/overcurrent-o04-pre-2026-08-13`.
- Verification: strict production TypeScript PASS; test semantic TypeScript PASS; 1,301,031 explicit dependency-independent runtime checks PASS.
- Next phase: O05 Study Engine & Preset Registry.


## overcurrent-o05-2026-08-13-v1

- Date: 2026-08-13.
- Parent: `overcurrent-o04-2026-08-13-v1`.
- Scope: O05 Study Engine & Preset Registry.
- Added production study validation/resolution, load/fault case registry, current-profile resolution, configured fault-location interpolation/zone metadata, explicit preset initialization, and canonical single/coordination study registry.
- O02 semantic refinements: first-class LoadCase/load-security references, generic StudyCurrentDefinition, explicit initialization refs, fault-location profile protection segments. O01 relay mathematics unchanged.
- Pre-O05 rollback checkpoint: `/mnt/data/protection_checkpoints/overcurrent-o05-2026-08-13-pre`.
- Verification: strict TypeScript PASS; preset registry PASS; O01 parity PASS; 440,165 dependency-independent runtime checks PASS; generic four-relay study PASS.
- Next phase: O06 Coordination Engine.


## overcurrent-o06-2026-08-13-v1

- Date: 2026-08-13.
- Parent: `overcurrent-o05-2026-08-13-v1`.
- Scope: O06 Coordination Engine only; no Timeline or React UI.
- Added `src/engines/overcurrentCoordination.ts` plus permanent coordination tests and O06 engineering documentation.
- Domain refinements: structured O06 result/envelope types; explicit per-fault backup-50 permission metadata; every coordination pair now requires one authoritative CTI requirement.
- Study-data refinement: configured scrubber samples now use close transition points so radial in-series devices receive legible through-current values after zone changes; canonical explicit fault cases remain unchanged.
- Pre-O06 rollback checkpoint: `/mnt/data/protection_checkpoints/overcurrent-o06-2026-08-13-pre`.
- Verification: strict production/test TypeScript PASS; 604,515 O06 runtime checks PASS; O05 440,165 regression PASS.
- Next phase: O07 Timeline Engine.


## overcurrent-o07-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o06-2026-08-13-v1`.
- Scope: O07 deterministic Timeline Engine only; no React UI, TCC, or SLD.
- Added `src/engines/overcurrentTimeline.ts`,
  `src/engines/overcurrentTimeline.test.ts`, O07 engineering documentation, and
  the O07 handoff README.
- Implemented static/STEP analytic timing, LINEAR accumulated inverse/definite
  progress, strict pickup/high-set crossings, 50 priority, immediate reset,
  deterministic event phases/IDs, trip-vs-breaker-vs-isolation separation,
  backup continuation, multiple-trip preservation, external clear, and
  playback-speed separation.
- O05 integration refinement: exact STEP sample timestamps now resolve to the
  new sample (right-continuous boundary). No O01 equations or preset values
  changed.
- Verification: strict TypeScript PASS; O07 23/23 PASS including a deterministic
  1,000-case static parity sweep; combined O03–O07 regression 8 files / 94 tests PASS; production build PASS; full O05 static registry parity,
  canonical timeline vectors, generic four-relay behavior, invalid-input
  containment, repeated-run determinism, and speed independence PASS.
- Baseline note: the archive contains one unrelated Differential R10 test whose
  asserted overflow input remains finite; it reproduces before O07 and frozen
  Differential files remain unchanged.
- Stop after O07. Next planned gate: O08 Parameter UI when requested.


## overcurrent-o08-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o07-2026-08-14-v1`.
- Scope: O08 Parameter UI/controller only; no SLD, TCC, Operating Sequence,
  Analysis/learning, homepage navigation, or route activation.
- Added immutable preset-backed Overcurrent state, full-study/device validation,
  reusable R10-language parameter component, and scoped CSS.
- Device and CTI forms are registry-generated and verified with a synthetic
  four-relay topology. No hard-coded R1/R2/R3 form implementations were added.
- Run locking preserves deterministic O07 integration: engineering settings
  lock during RUNNING/PAUSED; playback speed, device focus, Clear, and Reset
  remain available. Reset restores the selected canonical preset.
- Verification: strict TypeScript PASS; O08 12/12 PASS; combined O03–O08 10
  files / 106 tests PASS; active Vite production build PASS; isolated O08
  React/CSS bundle PASS.
- Differential R10 shared components are reused but unchanged. `App.tsx` and
  Homepage R02 remain unchanged.
- Next phase: O09 SLD, only when requested.


## overcurrent-o09-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o08-2026-08-14-v1` exact accepted source.
- Scope: O09 radial SLD only; no TCC, Operating Sequence, Analysis/learning,
  page/route, or homepage activation.
- Added pure generic SLD presentation model, React/SVG diagram, scoped styling,
  configured fault-profile interaction, and permanent tests.
- SLD current/role data remains O05/O08-derived; breaker/isolation state remains
  O07-owned. Stale timeline snapshots and invalid engineering output are not
  rendered as live state.
- Required O09 integration refinement: selected SLD device opens its existing
  O08 parameter section; profile positions are stored separately from discrete
  FaultCase selection and cannot begin timeline playback.
- Verification: strict TypeScript PASS; O09 14/14 PASS; combined O03–O09 120/120
  PASS; active production build and isolated O09 React/CSS client bundle PASS.
- Repository-wide: 175 PASS / 1 pre-existing frozen Differential assertion
  failure. Differential/shared shell/homepage/route are unchanged.
- Next phase: O10 TCC.


## overcurrent-o10-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o09-2026-08-14-v1` exact accepted result.
- Scope: O10 TCC only; no Operating Sequence, Analysis/learning, page/route, or
  homepage activation.
- Added pure generic TCC presentation model, React/SVG graph, scoped styling,
  compact curve/point inspection, Fit Point, and initial-setting comparison.
- Curves and operating points consume O03/O04 engine results. Active CTI and
  corridor/violation layers consume O06 results. O10 adds no engineering
  formula.
- O09/O10 share O08 `selectedDeviceId` for later bidirectional composition.
- Verification: strict TypeScript PASS; O10 15/15 PASS; combined O03–O10
  135/135 PASS; active production build and isolated O10 React/CSS client
  bundle PASS.
- Repository-wide: 190 PASS / 1 pre-existing frozen Differential assertion
  failure. Differential/shared shell/homepage/route remain unchanged.
- Stop after O10. Next PRD gate: O11 Operating Sequence.

## overcurrent-o10h-2026-08-14-v1

- Date: 2026-08-14.
- Parent: exact uploaded O10 archive SHA-256 `c61323d78ed844ef96ae0080c33c2453293f80faebc0d7ac5a1ec6096e5bcf92`.
- Scope: TCC hardening only; no O11 Operating Sequence or later-gate UI.
- Fixed adjacent-tier active CTI mapping for Backup 2+ and added generic active coordination brackets.
- Below-pickup no longer counts as time off-scale; exact 0 s 50 remains off-scale on the log axis.
- Pointer mapping now follows actual SVG transform with deterministic xMidYMid/meet fallback.
- TCC scrollbar and relay-series identity styling aligned with the frozen UI grammar.
- Pure runtime and source-diff audits passed; O03-O09 production behavior remains unchanged.
- Next phase: O11 Operating Sequence.


## overcurrent-o11-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o10h-2026-08-14-v1`.
- Scope: O11 Operating Sequence only; no Analysis, Guided Challenges, route, or homepage activation.
- Added O07 engineering-time frame projection, generic Operating Sequence presentation/component, scoped styling, and permanent tests.
- Existing completed O07 timeline semantics remain parent-identical; the new API is a presentation query.
- Verification: strict pure TypeScript PASS; 73 O11 runtime checks PASS; canonical primary/backup/breaker/reset, 50 zero-time, OVC-07, STEP/LINEAR, speed invariance, and O09 SLD snapshot parity PASS.
- Result became the baseline for O12.

## overcurrent-o12-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o11-2026-08-14-v1`.
- Scope: O12 Analysis / Learning Layer only; O13+ not started.
- Added Analysis presentation/component and explicit `RUN_COORDINATION_TEST` action.
- O12 reads O03/O04/O06/O07/O11 engineering outputs; no duplicate relay/CTI formula or automatic optimizer was added.
- Verification: strict pure TypeScript PASS; 1,057 O12 checks PASS; 137 parent-parity checks PASS; 74 source files syntax-transpile with 0 diagnostics; finite preset sweep/fuzz and generic 4-relay checks PASS.
- Next planned gate: O13 Coordination Guided Challenges.

## overcurrent-o13-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o12-2026-08-14-v1`.
- Scope: O13 Coordination Guided Challenges only; no O14 responsive/accessibility final polish, O15 route/Homepage integration, or O16 release work.
- Completed COORD-01..COORD-06 Guided challenge registry, including new Pickup + Time, Curve Selection, and Full Coordination capstone presets.
- Added pure challenge lifecycle model, reducer-owned progressive hints, compact Analysis Guided card, explicit verified completion, and Why This Works.
- Guided/Free now changes learning metadata only; selection-only scrubber interaction preserves run-all validation, while engineering mutations continue to invalidate stale validation.
- Verification: strict pure TypeScript PASS; 2,118 O13 runtime checks PASS; O12 parent runtime 1,063 PASS; 78 source files syntax-transpile with 0 diagnostics; protected engineering/UI parent files byte-identical; deterministic fuzz and synthetic four-relay challenge model PASS.
- Environment note: at the time of writing fresh npm/Vitest/Vite was unavailable because the offline npm cache lacked `yallist-3.1.1`; permanent O13 tests are present and the dependency-complete suite has since passed (2026-08-29).
- Result is the authoritative baseline for O14.


## overcurrent-o14-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o13-2026-08-14-v1`.
- Scope: O14 Responsive / Accessibility / UX Refinement only; no page/route/Homepage activation and no O16 release work.
- Added reusable EngineeringViewOverlay and responsive/accessibility refinements to route-independent Overcurrent SLD, TCC, Operating Sequence, Parameters, Analysis, and Guided Challenge components.
- No O03–O13 engine/study/pure presentation/reducer engineering behavior changed. Differential, App, Homepage, pages, routes, and shared layout remain protected.
- Verification: pure/targeted TypeScript PASS; 80 TS/TSX syntax-transpile / 0 diagnostics; 2,018,517 runtime/parent checks PASS; 28/28 UX/accessibility static audit PASS; protected parent parity PASS.
- Dependency note: at the time of writing fresh npm/Vitest/Vite was unavailable because the offline npm cache lacked `yallist-3.1.1`; permanent O14 test source is present and the dependency-complete suite has since passed (2026-08-29).
- Result is the authoritative baseline for O15.

## overcurrent-o15-2026-08-14-v1

- Date: 2026-08-14.
- Parent: `overcurrent-o14-2026-08-14-v1` trusted source content.
- Scope: O15 production page, route, Homepage activation, shared-shell integration, and page-level state/workflow hardening only; no O16 release work.
- Activated `/simulator/overcurrent` and the Overcurrent Homepage item while leaving Distance/Underfrequency inactive and Differential engineering/page behavior protected.
- Added one-state production composition for Parameters/SLD/TCC/Operating Sequence/Analysis/Guided Challenge and shared O11 timeline snapshot flow.
- Corrected invalid-draft validation leakage and stale COMPLETE playback after engineering/fault/profile changes; global header separates READY/predicted state from executed/validated state.
- Added concise PRD-required Overcurrent Help using the accepted focus-safe overlay infrastructure.
- Verification: pure TypeScript PASS; 1,350,661 runtime integration checks PASS; 53/53 static audit PASS; 82 TS/TSX syntax-transpile / 0 diagnostics; 80 protected parent files parity PASS; expected-only source diff.
- Fresh Vitest/Vite was not claimed at the time of writing because dependency reconstruction was blocked by a missing cached `yallist-3.1.1`; the dependency-complete suite and production build now PASS in the current environment (2026-08-29).
- Result is the authoritative baseline for O16.


## overcurrent-o16-rc-2026-08-14

- Date: 2026-08-14.
- Parent: `overcurrent-o15-2026-08-14-v1`, source SHA-256 `7398eacc552bafe71a7e41677abc3e63ec13f361c1f8fcac0fd36423ff8382aa`.
- Scope: final engineering/source/state/UX audit and release-candidate documentation; no new Overcurrent protection feature.
- Independent runtime audit: 494,674 / 494,674 PASS; static integration/accessibility audit: 80 / 80 PASS; pure production TypeScript PASS; 82 TS/TSX syntax-transpile / 0 diagnostics.
- Corrected one invalid historical Differential overflow test vector; Differential production source unchanged.
- No open Overcurrent product P0/P1 found.
- Release gate fully closed (2026-08-30): fresh `npm ci` from a clean cache (136 packages), dependency-complete Vitest (31 files / 260 tests), Vite production build (83 modules), and production browser smoke (`/`, `/simulator/differential`, `/simulator/overcurrent` — HTTP 200) all PASS. Earlier progress (2026-08-29) had covered test/build/tsc.
- Status: **CONDITIONAL RELEASE CANDIDATE — READY FOR FREEZE; NOT YET FINAL/FROZEN**.
- Freeze requires explicit user approval only; all dependency/build/smoke gate items now PASS.
