# Overcurrent Relay — O09 Radial SLD

**Status:** IMPLEMENTED / PASSED  
**Date:** 2026-08-14  
**Parents:** Overcurrent PRD v1.0; O01 Engineering Specification v1.0;
O02–O08 accepted implementation baseline

## 1. Purpose and phase boundary

O09 adds the route-independent radial single-line diagram and its pure
presentation model. It consumes O05 study topology/current data, O08 parameter
state, and optional O07 timeline snapshots. It does not calculate fault current,
relay operation, or breaker timing.

Included:

- source, radial feeder, load, relay, CT, breaker, and configured fault symbols;
- generic 1/2/3/N-device topology rendering;
- relay selection and explicit fault-case selection;
- current-path display from authoritative active study current;
- primary/backup roles from `ProtectionChain` metadata;
- optional configured fault-location scrubber using the O05 resolver;
- breaker OPENING/OPEN and fault-isolated display from O07 snapshots;
- keyboard-accessible controls, text labels, and reduced-motion handling.

Explicitly deferred:

- O10 TCC and TCC cross-highlighting implementation;
- O11 Operating Sequence playback/controller;
- O12 Analysis/learning layer;
- O14 integrated responsive/browser refinement;
- O15 page/route/homepage activation.

## 2. Production source

Presentation model:

- `src/presentation/overcurrentSld.ts`

React diagram and scoped styling:

- `src/components/overcurrent/RadialProtectionDiagram.tsx`
- `src/components/overcurrent/radialProtectionDiagram.css`

State integration refinements required by O09:

- `src/utils/overcurrentState.ts`
- `src/utils/evaluateOvercurrentParameters.ts`
- `src/components/overcurrent/OvercurrentParameterPanel.tsx`

Permanent verification:

- `src/presentation/overcurrentSld.test.ts`
- `src/components/overcurrent/RadialProtectionDiagram.test.tsx`

No Differential, shared-shell, homepage, route, engine formula, preset current,
coordination, or timeline file was modified.

## 3. Source-of-truth mapping

| SLD information | Authoritative source |
|---|---|
| device order/identity | `StudyTopology.deviceIds` + `devicesById` |
| fault locations | `StudyTopology.locations` |
| discrete active fault | `activeFaultCaseId` + `FaultCase` |
| primary/backup roles | active `ProtectionChain` |
| displayed primary current | `evaluateActiveOvercurrentParameters()` |
| scrubber current/roles | `resolveFaultLocationStudy()` |
| selected relay | O08 `selectedDeviceId` |
| breaker state | matching O07 `TimelineSnapshot` only |
| fault isolated | O07 `FAULT_ISOLATED` event at snapshot time |

The SLD contains no relay equation, CT conversion, current interpolation,
coordination inference, or animation-based engineering timer.

## 4. Device and fault interaction

Relay buttons dispatch the existing O08 `SELECT_DEVICE` action. Parameter UI
now opens the newly selected device section when focus changes; a user may still
collapse the currently selected section manually.

Fault buttons dispatch a real configured `FaultCaseId`. When the user moves
between F1/F2/F3, `chooseFaultCaseForLocation()` preserves the active current
category (MIN/NOMINAL/MAX) when the target location contains that category.
Registry order is the deterministic fallback. No current is synthesized.

O09 and O10 share `selectedDeviceId`, which is the contract for bidirectional
SLD/TCC highlighting when O10 is present.

## 5. Configured fault-location profile

The optional range control dispatches `SET_FAULT_LOCATION_POSITION` and stores:

```text
profileId
normalizedPosition
```

The reducer accepts the position only when O05 `resolveFaultLocationStudy()`
returns VALID. The same resolver supplies currents, location, and
primary/backup roles to the SLD and active parameter evaluation.

A profile point is an Explore-mode interpolated study point, not an O07
`FaultCase`. Selecting it clears `activeFaultCaseId`, blocks Apply Fault, and is
explicitly labelled as configured study interpolation—not a network
short-circuit calculation. Selecting a discrete fault case clears the profile
selection. Reset returns to the selected preset's canonical fault case.

## 6. Breaker and current-path semantics

The diagram reads only a timeline snapshot whose `faultCaseId` matches the
currently selected discrete fault. Stale snapshots are ignored.

- CLOSED is the default before an authoritative opening state exists;
- OPENING comes from `BREAKER_OPENING` relay snapshot state;
- OPEN comes from `BREAKER_OPEN` relay snapshot state;
- current path remains present through relay trip and breaker opening;
- current path disappears after the matching `FAULT_ISOLATED` event.

The feeder base line is segmented around every breaker contact, so an OPEN
blade is not visually contradicted by a continuous conductor drawn beneath it.

## 7. Invalid state and accessibility

If O08 validation/evaluation is invalid, the model returns `INVALID`, emits no
false current path, and the component displays `INPUT INVALID · OUTPUT HELD`.

Relay/fault interaction uses native buttons. The SVG has an accessible title
and description; exact role, breaker state, and primary-current text accompanies
each relay; status never depends on color alone. Current-flow animation is
disabled under `prefers-reduced-motion`.

## 8. Verification evidence

O09 permanent suites:

- **2 files / 14 tests PASS**;
- single, two, three, and synthetic four-relay topology coverage;
- explicit current/role/fault-location parity;
- MIN/NOMINAL/MAX category-preserving fault selection;
- configured profile interpolation and out-of-range rejection;
- run lock, Reset, and profile-point Apply Fault blocking;
- O07 breaker-open/fault-isolated mapping and stale-snapshot rejection;
- invalid-output containment;
- accessible SSR markup and later-gate scope exclusion.

Combined Overcurrent O03–O09 regression:

- **12 files / 120 tests PASS**.

Build evidence:

- strict TypeScript: **PASS**;
- active application production build: **PASS**;
- isolated O09 React/CSS client bundle: **PASS**;
- no dependency or configuration change.

Repository-wide execution is **175 PASS / 1 pre-existing Differential FAIL**.
The unchanged frozen Differential assertion expects overflow from values that
remain finite and reproduced before O09.

## 9. Acceptance and next gate

O09 is complete:

- [x] generic radial SLD for 1/2/3/N devices;
- [x] clickable relay and configured fault locations;
- [x] state-shared selection contract;
- [x] authoritative current path and role labels;
- [x] configured scrubber without hidden network calculation;
- [x] O07-owned breaker and isolation display;
- [x] safe invalid state;
- [x] keyboard/text/reduced-motion accessibility baseline;
- [x] no TCC/sequence/analysis/route scope leakage;
- [x] regression, build, and sourcebook evidence.

The next approved gate is **O10 — TCC**.
