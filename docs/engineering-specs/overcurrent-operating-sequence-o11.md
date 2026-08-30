# Overcurrent Relay — O11 Operating Sequence Engineering Specification

**Status:** IMPLEMENTED / PASSED  
**Gate:** O11  
**Date:** 2026-08-14  
**Parent baseline:** O10H — trusted TCC hardening baseline  
**Next gate:** O12 Analysis / Learning Layer

## 1. Objective

O11 implements the PRD Operating Sequence as a deterministic presentation of the already-approved O07 engineering timeline. It must teach the difference between pickup, relay timing, trip output, breaker clearing, breaker open, fault isolation, and backup reset without duplicating 50/51 timing mathematics in React/UI code.

The visible sequence is generic for one through N relays and uses the protection chain supplied by the Study Engine.

## 2. Architectural boundary

O11 uses:

`O05 study data -> O03/O04 device engine -> O07 timeline engine -> O11 frame query -> O11 presentation model -> OperatingSequence React view`

O11 does not change the final result semantics of `evaluateOvercurrentTimeline()`. A new read/query API, `evaluateOvercurrentTimelineFrame()`, projects the authoritative O07 model at an arbitrary engineering time. The projection reuses O07 relay tracing and accumulated-progress logic, including STEP and LINEAR current profiles.

Wall-clock playback speed is a UI transport concern only. Engineering results remain invariant at 1x, 5x, and 10x.

## 3. Implemented contracts

### 3.1 Timeline frame query

`OvercurrentTimelineFrameDefinition` extends the accepted timeline run definition with:

- `engineeringTimeSec`;
- optional playback state.

`evaluateOvercurrentTimelineFrame()`:

- rejects non-finite or negative engineering time;
- obtains the completed authoritative O07 timeline;
- exposes only events visible up to requested engineering time;
- computes each relay's 51 progress from O07 tracing, not UI interpolation;
- preserves exact 50 instantaneous operation at zero seconds;
- preserves trip-output versus breaker-open separation;
- preserves external-clear ordering and immediate reset behavior;
- forces completed/reset progress consistently with visible timeline events;
- never multiplies engineering time by playback speed.

### 3.2 Operating Sequence presentation model

The model exposes:

- study/fault identity;
- engineering time and total timeline time;
- overall progress;
- primary/backup roles in configured protection-chain order;
- selected relay/active element;
- measured relay current and current multiple;
- 51 operating progress;
- expected static operation time when applicable;
- actual trip-output time and breaker-open state;
- precise protection-state vocabulary;
- visible milestones/events;
- fault-isolation state and clearing device.

The model is data-driven and not tied to R1/R2/R3.

### 3.3 Idle / Explore semantics

A critical presentation rule is explicit:

- `IDLE` means **READY TO APPLY FAULT**, not a fault already in progress;
- no O11 fault timeline/events are shown while the simulator is idle;
- configured fault-profile scrubber positions are Explore data only and cannot masquerade as timed discrete FaultCases;
- a timed sequence begins only for a valid discrete fault experiment.

### 3.4 Playback component

The Operating Sequence component:

- displays `OPERATING SEQUENCE` using the frozen simulator design language;
- uses `requestAnimationFrame` only to map wall-clock elapsed time to engineering time;
- supports Pause/Resume through the existing playback state;
- exposes the exact O07-derived timeline snapshot through a callback so later page composition can synchronize the SLD without a second engineering clock;
- uses the shared selected-device state for relay-row interaction;
- keeps settings locking under O08 state ownership;
- honors reduced-motion preferences.

## 4. Canonical behavior verified

### COORD-02 / F3 MAX

- R3 primary reaches relay trip first.
- During R3 breaker clearing, upstream R2/R1 continue timing.
- Fault current remains active until the isolating breaker opens.
- After fault isolation, upstream timing resets according to O07 rules.

### OVC-05 Instantaneous

- element 50 operates at engineering time `0 s`;
- breaker clearing remains a separate later interval/event.

### OVC-07 Clear Before Trip

- 51 timing is visible before configured external clear;
- no relay trip is created;
- progress resets after clear.

### Varying current

- LINEAR-profile timing/progress is engine-derived;
- no visual approximation replaces the O07 accumulated-progress calculation.

## 5. Acceptance / verification

Current audit environment:

- strict pure TypeScript compile: PASS;
- O11 runtime contract checks: **73 PASS**;
- canonical concurrent primary/backup timing: PASS;
- breaker clearing / fault-isolation separation: PASS;
- backup reset after isolation: PASS;
- 50 exact-zero branch: PASS;
- OVC-07 clear-before-trip/reset: PASS;
- STEP/LINEAR progress projection: PASS;
- 1x/5x/10x engineering-frame invariance: PASS;
- O11 snapshot -> O09 SLD breaker/fault-state parity: PASS;
- invalid engineering-time containment: PASS;
- TypeScript syntax-transpile audit across current source: PASS.

Fresh repository `npm ci -> Vitest -> Vite build` could not be rerun in this runtime because the required dependency tarballs are not present in the offline cache. This does not change O11 engineering acceptance evidence above; the parent O10H baseline has unchanged previously accepted production code outside the additive O11 boundary, and parent-parity checks are retained for O12 handoff.

## 6. Scope exclusions

O11 does not implement:

- Analysis / learning hierarchy;
- guided challenge workflow;
- route/page composition;
- homepage activation;
- breaker mechanical dynamics;
- any new relay equation.

**O11 verdict: PASS.**
