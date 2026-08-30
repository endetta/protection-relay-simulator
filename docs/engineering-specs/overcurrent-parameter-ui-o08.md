# Overcurrent Relay — O08 Parameter UI

**Status:** IMPLEMENTED / PASSED  
**Date:** 2026-08-14  
**Parents:** Overcurrent PRD v1.0; O01 Engineering Specification v1.0;
O02 Domain Model; O03/O04 Pure Engine + Hardening; O05 Study Engine; O06
Coordination Engine; O07 Timeline Engine

## 1. Purpose and phase boundary

O08 provides the reusable Overcurrent parameter editor and its immutable
workflow/controller state. It is the first Overcurrent React layer, but it does
not activate `/simulator/overcurrent` and does not implement later visualization
or learning phases.

Included:

- Single Relay / Coordination Lab mode selection;
- authoritative preset and Guided / Free selection;
- active load and fault-case selection;
- explicit per-device primary-current study data;
- generic CT, 51, 50, and breaker settings;
- generic CTI target/budget settings;
- playback speed, Apply Fault lock contract, Clear Fault, and Reset;
- field-draft, structural, numerical, and run-readiness validation;
- data-driven rendering for one, two, three, or more devices.

Explicitly deferred:

- O09 clickable SLD;
- O10 TCC and graph layers;
- O11 Operating Sequence playback visualization;
- O12 Analysis, hints, impact inspector, and Run Coordination Test UI;
- O13 guided challenge completion workflow;
- O14 integrated responsive/browser refinement;
- O15 route/homepage activation.

## 2. Production source

State/controller:

- `src/utils/overcurrentState.ts`

Validation and active parameter-to-engine evaluation:

- `src/utils/evaluateOvercurrentParameters.ts`

React parameter editor and scoped styling:

- `src/components/overcurrent/OvercurrentParameterPanel.tsx`
- `src/components/overcurrent/overcurrentParameterPanel.css`

Permanent verification:

- `src/utils/overcurrentState.test.ts`
- `src/components/overcurrent/OvercurrentParameterPanel.test.tsx`

No Differential source, shared R10 component, route, or homepage file was
modified by O08.

## 3. State and ownership

`OvercurrentParameterState` extends the O02 simulator-state contract with:

- the current immutable `studyDefinition`;
- an explicit `modified` flag.

The current study definition remains the source of truth for device settings,
study current vectors, topology, and coordination requirements. The reducer
updates the matching O02 state references atomically so `devicesById` and
`coordinationRequirements` cannot drift from the current study.

Calculation results are not stored in the reducer. They are derived through
the existing O03–O07 engines.

## 4. Preset and Reset behavior

The canonical startup is `OVC-01`:

- Single Relay Study;
- Guided Study;
- R1 selected;
- reference load selected;
- no active fault case;
- playback IDLE at 1x.

Changing study mode loads the first authoritative registry preset for that
mode. Applying a named preset creates a fresh state from O05 initialization.

Reset restores the currently selected registry preset, not a universal global
default. It also clears modified settings, run state, validation state, and
playback speed back to that preset's canonical initialization.

Registry objects are never mutated. Every edit creates new nested study/device
records and leaves O05 preset constants byte-structurally unchanged.

## 5. Parameter coverage

### Scenario / Study

- Single Relay Study / Coordination Lab;
- scenario preset;
- Guided / Free metadata;
- active device focus.

### System / Current

- explicit pre-fault/load case;
- explicit fault case;
- per-device primary-current values for static cases;
- read-only identification for configured current profiles.

Every current field is labelled `A primary`. The UI states that these values
are configured study data and never implies a network short-circuit solution.

### Device-generated settings

One form section is generated for every ID in `topology.deviceIds`. Each section
contains:

- CT primary rating, secondary rating, and signed ratio error;
- 51 pickup;
- Inverse / Definite timing mode;
- IEC / IEEE family and approved curve registry selection;
- TMS or Time Dial label according to the selected family;
- definite delay;
- 50 enable and high-set pickup;
- breaker clearing time.

There are no `R1Form`, `R2Form`, or `R3Form` implementations. A permanent SSR
test renders a synthetic four-relay topology through the same component.

### Coordination target

One target card is generated per `CoordinationRequirement`. If a requirement
has a budget, the UI edits:

- breaker allowance;
- relay/timing allowance;
- study safety margin.

`requiredCtiSec` is recalculated as the exact sum on every budget edit, so the
authoritative total cannot diverge from its displayed decomposition. A
requirement without a budget exposes direct Required CTI editing.

### Simulation controls

- 1x / 5x / 10x playback speed;
- Apply Fault;
- Clear Fault;
- Reset Preset.

O08's Apply Fault action establishes the deterministic run/parameter-lock
contract. O11 will consume O07 timeline output to render and advance the
Operating Sequence; O08 does not invent a second timer.

## 6. Validation and invalid-draft behavior

`NumberField` remains the R10 draft boundary:

- incomplete, non-finite, or out-of-range drafts do not dispatch into
  engineering state;
- the last valid field value remains available;
- invalid drafts remain mounted when a section is collapsed;
- the affected section badge remains `INVALID`;
- Apply Fault is blocked.

`validateOvercurrentParameterState()` additionally validates:

- the complete O05 study structure;
- every device CT configuration;
- every 51 setting;
- every 50 setting;
- every breaker setting;
- state/study reference consistency;
- every configured load, fault, time-profile, and fault-location current vector
  through `evaluateOvercurrentDevice()`.

The last step catches finite input combinations that overflow or underflow only
after CT conversion or relay evaluation. Invalid engineering state returns
structured issues, shows `INPUT INVALID · OUTPUT HELD`, and cannot begin a run.
The later Analysis layer remains responsible for displaying retained last-valid
results; O08 does not duplicate output calculations.

## 7. Run locking

During `RUNNING` or `PAUSED`, the reducer blocks changes to:

- mode/preset/guidance;
- active study cases;
- study currents;
- CT, 51, 50, breaker, and CTI settings.

The user may still:

- change device focus;
- change playback speed;
- receive a timeline playback-state update;
- Clear Fault;
- Reset.

Clear Fault returns playback to `IDLE`. Reset reconstructs the selected preset.

## 8. Differential R10 UI parity

O08 directly reuses the frozen shared components without modifying them:

- `ParameterGroup` for stable headers, badges, summaries, and mounted collapse;
- `NumberField` for typed numeric drafts, units, range feedback, custom steppers,
  and press-and-hold behavior;
- `InfoDot` for accessible viewport-safe help;
- `SectionSummary` for monitoring-oriented collapsed summaries.

The scoped O08 stylesheet uses the existing graphite/navy surfaces, steel-cyan
interaction accent, semantic green/amber/red states, thin borders, compact
radius, engineering monospace values, visible focus, and reduced-motion policy.
No dependency or design system was added.

## 9. Verification evidence

O08 permanent suites:

- **2 files / 12 tests PASS**;
- canonical startup and mode/preset transitions;
- current/CT/pickup/curve/time/50 engine parity;
- IEC/IEEE and Definite-Time behavior;
- CTI budget reconciliation;
- immutable registry and preset-local Reset;
- run locking and permitted speed/Clear operations;
- invalid setting and derived numerical-range run blocking;
- 1/2/3-relay markup coverage and synthetic four-relay rendering;
- unit labels, semantic controls, accessibility attributes, and later-phase
  scope exclusion.

Combined Overcurrent O03–O08 regression:

- **10 files / 106 tests PASS**.

Build/type evidence:

- strict TypeScript: **PASS**;
- active application Vite production build: **PASS**;
- isolated O08 Vite bundle (React component + scoped CSS): **PASS**;
- no new dependency or configuration change.

The supplied source retains one unrelated frozen Differential R10 assertion
whose selected values remain finite rather than overflowing. It reproduces on
the pre-O08 baseline and Differential source/tests remain untouched.
Repository-wide execution is **161 PASS / 1 pre-existing FAIL**.

## 10. Acceptance and next gate

O08 is complete:

- [x] R10 parameter component/style reuse;
- [x] generic device-registry form generation;
- [x] precise values, units, help, and validation ranges;
- [x] explicit study-current data with no hidden network solver;
- [x] Single Relay and Coordination parameter coverage;
- [x] CTI budget consistency;
- [x] invalid-draft and derived numerical containment;
- [x] deterministic run locking, speed separation, Clear, and Reset;
- [x] engine-derived parity tests;
- [x] no SLD/TCC/sequence/analysis/route scope leakage;
- [x] sourcebook and checkpoint update.

Stop after O08. The next planned gate is **O09 — SLD**, only when explicitly
requested.
