# Overcurrent Relay — O12 Analysis / Learning Layer Engineering Specification

**Status:** IMPLEMENTED / PASSED  
**Gate:** O12  
**Date:** 2026-08-14  
**Parent:** O11 Operating Sequence PASS  
**Next gate:** O13 Coordination Guided Challenges

## 1. Objective

O12 implements the PRD Analysis / Learning Layer without introducing a second calculation engine. The panel explains what the accepted Overcurrent engines already determined: status, operating order, relay current/current multiple, coordination margins, audit dimensions, violations, worst configured case, setting impact, progressive hints, calculation details, event history, and all-case validation.

The panel is an engineering explanation surface, not an optimizer and not a substitute for O06 coordination logic.

## 2. Architectural boundary

`O03/O04 measurement + device result`  
`+ O05 configured study metadata`  
`+ O06 coordination/audit result`  
`+ O11/O07 active timeline snapshot`  
`-> O12 presentation model -> Analysis React panel`

Rules:

- no relay equation is duplicated in presentation code;
- no CTI formula is reimplemented in React;
- violation status is read from O06 results;
- timeline status is read from the O07/O11 snapshot;
- initial/current comparison reruns the same accepted O06 engine against the initial snapshot and current study;
- hints use configured learning metadata and violation context; they do not provide an exact recommended setting value.

## 3. PRD hierarchy implemented

The default Analysis reading order is:

1. Relay / Coordination Status
2. Active Study / Fault
3. Operating Order
4. Relay Current / Current Multiple
5. Coordination Margins
6. Sensitivity / Selectivity Checks
7. Violations / Worst Case
8. Setting Impact
9. Hints
10. Calculation Details — collapsed by default
11. Events — collapsed by default

Single Relay mode suppresses irrelevant coordination-only content.

## 4. Run Coordination Test

O12 adds the reducer action `RUN_COORDINATION_TEST`.

Behavior:

- available only for Coordination Lab;
- invokes pure `runOvercurrentCoordinationStudy()`;
- stores COMPLETE validation state with audit on success;
- stores INVALID with issues on invalid study input;
- is blocked while timed playback is RUNNING/PAUSED through the existing O08 lock boundary;
- any subsequent engineering-setting mutation invalidates the prior run-all result back to IDLE, preventing stale PASS/FAIL claims.

This action does not modify relay settings.

## 5. Analysis presentation contracts

### 5.1 Status

Uses precise vocabulary such as:

- COORDINATED;
- COORDINATION INCOMPLETE;
- 51 TIMING;
- BREAKER CLEARING;
- FAULT ISOLATED;
- INPUT INVALID / OUTPUT HELD.

An active O11 timeline snapshot takes precedence over static study headline when a timed experiment is in progress.

### 5.2 Operating order and measurements

For each relevant device the model exposes accepted engineering outputs including:

- primary current;
- measured relay current in A sec;
- current multiple M;
- selected operating element;
- operating time when finite.

### 5.3 Coordination margins and audit checks

O06 results are surfaced as explicit primary/backup pairs and dimensions:

- sensitivity;
- selectivity;
- time grading;
- instantaneous 50 reach;
- load security;
- backup availability.

The panel does not collapse these into an arbitrary percentage score.

### 5.4 Violations and worst case

O12 maps structured O06 violations including:

- `TIME_GRADING`;
- `SELECTIVITY_FAIL`;
- `INSTANTANEOUS_OVERREACH`;
- `SENSITIVITY_RISK`;
- `LOAD_SECURITY_FAIL`;
- `BACKUP_NOT_AVAILABLE`.

Worst-case language remains scoped to configured study cases/profile data; it is never described as network-wide proof.

### 5.5 Setting Impact

Initial versus current settings are compared structurally. The inspector identifies which parameter changed and the engineering area it affects, including CT, pickup, curve/time scale, definite delay, 50, breaker clearing, and CTI requirement.

The impact inspector does not invent a mathematical sensitivity coefficient and does not claim that changing breaker clearing time automatically changes required CTI unless the CTI budget itself changes.

### 5.6 Hints

Guided mode reveals progressive metadata in the approved sequence:

1. location;
2. parameter family;
3. direction.

No default hint supplies an exact setting answer such as `set TMS to 0.19`.

## 6. Canonical validation

### COORD-02 initial

- headline: `COORDINATION INCOMPLETE`;
- R3 is primary for F3;
- two adjacent coordination margins are exposed;
- R3 -> R2 observed CTI is approximately `0.278307692 s` against `0.300 s` required, therefore FAIL;
- the time-grading failure is surfaced;
- three guided-hint metadata levels are available in Guided mode.

Changing R2 TMS from `0.18` to `0.19` through the accepted state path results in:

- `COORDINATED`;
- all configured validation cases passing;
- initial/current comparison showing fewer violations and the changed R2 time scale.

### COORD-05

The Analysis layer surfaces the accepted O06 findings:

- instantaneous overreach;
- selectivity failure;
- 50-reach failure.

### OVC-08

CT +5% measurement effect remains visible from the accepted engine output (`0.819 A sec`, M > 1) rather than recalculated in the panel.

## 7. Verification

Current audit environment:

- strict pure TypeScript compile: PASS;
- O12 runtime/model/state checks: **1,057 PASS**;
- every accepted preset builds a finite/valid Analysis model: PASS;
- 500-iteration deterministic setting fuzz: PASS with no NaN/Infinity serialization;
- synthetic four-relay analysis: PASS;
- run-all blocked during timed run: PASS;
- setting mutation invalidates stale validation result: PASS;
- O11 active timeline -> O12 status parity: PASS;
- invalid engineering state -> OUTPUT HELD: PASS;
- O11/O12 parent parity against O10H: **137 PASS**;
- current source syntax-transpile: **74 files / 0 diagnostics**.

The parent-parity check verifies the accepted preset registry, every existing final O07 timeline across preset/fault/speed combinations, and existing reducer actions remain unchanged from O10H. O12 adds a new explicit action rather than altering older action semantics.

At the time of writing, fresh repository `npm ci -> Vitest -> Vite build` was not claimed in this runtime because the offline dependency cache was incomplete. Permanent Vitest test files were added for O11/O12, and the dependency-complete Vitest suite (31 files / 260 tests), the Vite production build, a fresh `npm ci` from a clean cache, and a production browser smoke all now PASS in the current environment (2026-08-29 / 2026-08-30), alongside a clean `tsc --noEmit`. The module is READY FOR FREEZE pending only explicit user approval.

## 8. Scope exclusions

O12 does not implement:

- O13 intentional-miscoordination challenge orchestration/completion workflow;
- automatic setting optimization;
- exact-answer hints;
- O14 responsive/accessibility final polish;
- O15 page/route activation;
- O16 release freeze.

**O12 verdict: PASS.**
