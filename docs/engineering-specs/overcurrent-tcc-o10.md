# Overcurrent Relay O10: Time-Current Characteristic

**Status:** IMPLEMENTED / PASSED  
**Date:** 2026-08-14  
**Parents:** Overcurrent PRD v1.0, O01 Engineering Specification v1.0,
accepted O02 through O09 source

## 1. Gate boundary

O10 adds a route-independent TCC presentation model and React/SVG component.
The implementation consumes accepted O03 through O09 state and engine results.

O10 includes:

- generic relay-curve layers for one or more devices;
- log/log current and operating-time axes;
- current-multiple and common primary-current domains;
- 51 pickup and 50 high-set boundaries;
- load region, active fault, and MIN/MAX fault references;
- exact active operating points;
- O06 CTI boundaries and violation envelopes;
- pointer, keyboard, and touch inspection;
- characteristic and Fit Point scales;
- initial-setting comparison;
- shared relay selection with the O09 SLD.

O10 does not add the O11 Operating Sequence, O12 Analysis and learning UI,
O13 challenges, O14 integrated browser refinement, or O15 page and route.

## 2. Production source

Pure presentation model:

- `src/presentation/overcurrentTcc.ts`

React component and scoped styling:

- `src/components/overcurrent/TimeCurrentCurve.tsx`
- `src/components/overcurrent/timeCurrentCurve.css`

Permanent verification:

- `src/presentation/overcurrentTcc.test.ts`
- `src/components/overcurrent/TimeCurrentCurve.test.tsx`

O10 did not change O03 through O09 production behavior. Differential, the
shared shell, homepage, application route table, and main entry remain
byte-identical to the accepted O08 baseline.

## 3. Source-of-truth audit

| Graph value | Source |
|---|---|
| measured relay current | O03/O04 device evaluation |
| 51 inverse or definite time | `calculateOvercurrent51()` or `evaluateOvercurrentDevice()` |
| active 50/51 arbitration | O03/O04 `OperatingResult` |
| active primary current and role | O08/O09 active-parameter evaluation |
| CTI at the active point | O06 `evaluateCoordinationPair()` |
| corridor and violation samples | O06 `runOvercurrentCoordinationStudy()` envelopes |
| fault-profile current and chain | O05 resolver through O09 active selection |
| initial comparison | immutable preset `initialSnapshot` |
| selected relay | shared `selectedDeviceId` |

The React component performs coordinate transforms, clipping, label placement,
and hit testing. It contains no CT, inverse-time, definite-time, 50, CTI, or
coordination equation.

## 4. Curve construction and domains

The model samples each enabled 51 characteristic at 181 log-spaced points.
Each sample calls an accepted engine function:

- `CURRENT_MULTIPLE` calls `calculateOvercurrent51()` with the sampled multiple;
- `PRIMARY_A` calls `evaluateOvercurrentDevice()` with the sampled primary
  current and reads the returned 51 reference time.

The renderer joins those engine points in log space. It does not interpolate a
second relay equation.

Default domains:

| Study mode | Default domain |
|---|---|
| Single Relay | current multiple, `× pickup` |
| Coordination Lab | common primary current, `A primary` |

Axis labels state the domain, unit, and log scale. The model builds deterministic
1/2/5 ticks for each decade.

## 5. Generic layers

The model returns `TCCLayer[]` plus render-ready geometry. Device IDs drive all
relay layers; the code contains no R1/R2/R3 rendering branches.

O10 renders these accepted layer kinds when data exists:

- `RELAY_CURVE`;
- `INITIAL_SETTING_GHOST`;
- `PICKUP_BOUNDARY`;
- `INSTANTANEOUS_BOUNDARY`;
- `LOAD_REGION`;
- `FAULT_CURRENT_LINE`;
- `MINIMUM_FAULT_REFERENCE`;
- `MAXIMUM_FAULT_REFERENCE`;
- `OPERATING_POINT` or `STUDY_MARKER`;
- `COORDINATION_CORRIDOR`;
- `COORDINATION_VIOLATION_ENVELOPE`.

Stable layer IDs combine the layer purpose, configured device or pair ID, and
active study ID. The model sorts layers by z-index and ID.

## 6. Operating-point semantics

Each device on the active current path receives an operating point with:

- primary and relay-secondary current;
- 51 current multiple;
- selected element;
- selected trip time;
- theoretical 51 reference time;
- primary or ordered-backup role;
- O06 CTI, required CTI, and status when the device is a configured backup.

The graph draws a 51 point at its positive engine time. A below-pickup device
uses a study marker at the lower boundary and retains `selectedTripTimeSec =
null`. A selected 50 element retains the exact engine result of `0 s`, uses the
50 high-set boundary, and appears below the positive log axis as `OFF-SCALE`.
The tooltip keeps the theoretical 51 time visible for comparison.

## 7. Scale policy

Characteristic mode uses fixed, readable operating-time bounds of 0.01 to 100
seconds. Single-relay current-multiple mode uses 0.5 to 20 times pickup. The
primary-current characteristic domain derives stable log bounds from configured
study currents and relay thresholds.

An extreme active point receives an edge marker and explicit `OFF-SCALE` text.
The graph does not expand its characteristic scale near pickup.

`FIT POINT` expands deterministic log bounds to include positive operating and
51-reference times. A 0-second 50 result stays off-scale because a logarithmic
axis cannot represent zero. The `FIT POINT / CHARACTERISTIC` button sits in an
absolute overlay inside the plot and consumes no graph height.

## 8. Interaction and accessibility

Visible curves use distinct color, dash, device text, and accessible labels.
Each current curve and operating point supports pointer, keyboard, and touch
input.

- Pointer movement follows the nearest engine-sampled curve point.
- Focus opens the same compact inspector with a representative engine point.
- Touch or pen tap pins the inspector.
- A tap outside an inspector target dismisses a pinned inspector.
- Tooltip placement flips and clamps against viewport edges.
- Curve or point activation dispatches `SELECT_DEVICE`.

O09 and O10 read the same `selectedDeviceId`. Selecting a relay on either visual
therefore highlights the corresponding relay on both visuals when a later gate
composes them.

The SVG has a description, explicit axis units, focusable targets, and text for
role, element, time, and off-scale state. Color does not carry state alone.

## 9. Initial comparison

An accepted setting mutation preserves the preset `initialSnapshot` and marks
the parameter state modified. O10 samples that initial device through the same
engine path and renders a dashed `INITIAL_SETTING_GHOST`. The comparison toggle
can hide or show the ghost. Reset returns to the registry preset and removes the
comparison layer.

## 10. Invalid-state containment

O10 calls the O08 full-state validation boundary before it builds coordinates.
An invalid result returns an empty graph model with domain issues. The component
shows `INPUT INVALID · GRAPH HELD` and emits no curve, point, `NaN`, or
`Infinity` coordinate.

## 11. Verification evidence

O10 permanent suites:

- **2 files, 15 tests passed**;
- curve-sample and active-point parity with O03/O04;
- definite-time and 50 behavior;
- O06 CTI, corridor, and violation parity;
- characteristic and Fit Point scaling;
- initial-setting comparison;
- O09 fault-profile consumption;
- one, three, and synthetic four-relay coverage;
- invalid-state containment;
- SSR layer, unit, selection, keyboard, and scope checks.

Cumulative Overcurrent O03 through O10:

- **14 files, 135 tests passed**.

Build and source checks:

- strict TypeScript: **PASS**;
- active Vite production build: **PASS**;
- isolated O10 React/CSS client bundle: **PASS**;
- no dependency or configuration change;
- Differential, shell, homepage, route table, and entry point: **UNCHANGED**.

Repository-wide execution produced **190 passed and 1 failed**. The lone failure
is the unchanged Differential overflow assertion reproduced at the O08 baseline.
Its chosen input values keep the operate threshold finite, so the function does
not throw.

## 12. Acceptance

- [x] generic data-driven layer architecture;
- [x] engine-parity 51 curves and operating points;
- [x] log/log axes with explicit domain and units;
- [x] 51 pickup and 50 zero-second semantics;
- [x] load, fault, MIN/MAX, CTI corridor, and violation layers;
- [x] viewport-safe pointer inspector and touch pin contract;
- [x] deterministic off-scale and Fit Point behavior;
- [x] initial/current comparison;
- [x] shared O09/O10 relay selection;
- [x] invalid-state containment;
- [x] no O11, O12, or route leakage;
- [x] TypeScript, build, runtime, regression, and frozen-source audit.

O10 passes. The next approved development gate in the PRD is O11. This delivery
stops at O10 as requested.
