# Overcurrent Relay — O07 Timeline Engine

**Status:** IMPLEMENTED / PASSED  
**Date:** 2026-08-14  
**Parents:** Overcurrent PRD v1.0; O01 Engineering Specification v1.0;
O02 Domain Model; O03/O04 Pure Engine + Hardening; O05 Study Engine; O06
Coordination Engine

## 1. Purpose and boundary

O07 is the deterministic engineering-time source of truth for pickup, timing,
trip output, breaker clearing, fault isolation, and reset. It is not browser
animation and does not render React, TCC, or SLD content.

The production API is in:

`src/engines/overcurrentTimeline.ts`

It consumes an explicit `OvercurrentTimelineRunDefinition`:

- approved `OvercurrentStudyDefinition`;
- selected `faultCaseId`;
- supported presentation `playbackSpeed` (`1 | 5 | 10`).

It returns a non-throwing `DomainEvaluation<TimelineSnapshot>` with:

- completed engineering timestamp;
- playback state;
- evaluated fault case;
- per-device relay state;
- normalized 51 progress;
- trip-output time;
- breaker-open time;
- chronologically and phase-ordered event history.

## 2. Source-of-truth reuse

O07 does not duplicate CT or relay equations. Every sampled current is evaluated
through `evaluateOvercurrentDevice()`, which owns the O03/O04 measurement and
50/51 calculation boundary.

The timeline consumes O05 current/profile data and explicit protection-chain
metadata. It never solves a network fault or infers roles from labels such as
R1/R2/R3.

O06 remains the source for coordination audit/CTI results. For a constant-current
device that actually trips before isolation, O07 uses the same selected element
and trip-output time as O06.

## 3. Engineering-time strategy

The engine is event-driven. It does not accumulate browser frames.

Intervals are bounded by:

- fault application;
- current-profile sample timestamps;
- 51 pickup crossings;
- 50 high-set crossings;
- 51 progress completion;
- breaker-open timestamps;
- explicit external clear.

Constant-current and STEP segments use analytic progress:

`deltaQ = deltaT / T51(I)`

Definite-time LINEAR segments use the same exact constant progress rate while
the element is above pickup.

Inverse-time LINEAR segments integrate:

`Q = integral(dt / T51(I(t)))`

using deterministic adaptive Simpson quadrature. If `Q` reaches one inside a
segment, fixed-iteration bisection locates the trip timestamp. The integration
is bounded by pickup/high-set/profile transitions, so discontinuities are not
smoothed across a visual frame.

## 4. Pickup, reset, and arbitration

51 and 50 retain the O01 strict boundaries:

- 51 picks up only when `Irelay > Ipickup51`;
- 50 operates only when `Irelay > Ipickup50`;
- equality is non-pickup;
- 50 has priority when 50 and 51 are eligible at the same instant.

While 51 is eligible, normalized progress is clamped to `[0,1]`. When current
falls to or below pickup before trip, progress resets immediately to zero and a
`51_RESET` event is emitted. A later rise creates a fresh timing episode.

## 5. Same-timestamp event phases

The locked O01 ordering is implemented independently of object iteration order:

1. `FAULT_APPLIED` / `CURRENT_PROFILE_CHANGED`;
2. `51_PICKUP`;
3. `50_TRIP`;
4. `51_TRIP`;
5. `BREAKER_OPENING`;
6. `BREAKER_OPEN`;
7. `FAULT_ISOLATED` and breaker-isolation current consequence;
8. `51_RESET`.

Within one phase, stable device `order` is the deterministic tie-breaker. Event
IDs are assigned only after final sorting, using the fault-case ID and a padded
sequence number. Repeated runs therefore produce structurally identical output.

## 6. Trip output, breaker opening, and isolation

Relay trip output does not clear fault current.

For each accepted trip:

`breakerOpenTime = relayTripTime + breakerClearingTime`

`BREAKER_OPENING` is recorded at relay trip time. `BREAKER_OPEN` is recorded at
the calculated opening time. A breaker belonging to the explicit protection
chain isolates the fault only when it opens.

If multiple chain breakers open together, the chain/device ordering is stable.
Zero breaker clearing remains valid; trip, opening, open, and isolation are
separate ordered events even when their numeric timestamp is identical.

## 7. Backup behavior

Every device is evaluated independently against its configured current. Backup
progress continues after the primary trip and throughout the primary breaker
clearing interval.

At the first isolating breaker open:

- a backup that has not tripped is reset when its current is removed/below
  pickup;
- a backup trip that occurred before or exactly at breaker isolation remains in
  the event history;
- that accepted backup's breaker-open event remains scheduled even if another
  breaker isolates the fault first.

This distinguishes relay selectivity from breaker clearing and preserves the
O01 multiple-trip teaching case.

## 8. External clear and post-fault current

An explicit external clear is processed as a current change before same-time 50
or 51 completion. Therefore a post-fault drop below pickup at the exact timer
expiry resets 51 and does not create a trip.

O07 requires `postFaultProfileId` when `externalClearTimeSec` is configured. A
missing profile returns `MISSING_REFERENCE`; the engine does not invent
post-fault redistribution.

For breaker isolation, the O01 simple-radial policy removes current in the
isolated branch unless an explicit post-fault profile supplies another value.
No impedance or switching-network solution is inferred.

## 9. O05 STEP boundary refinement

O07 exposed an ambiguity in exact-sample STEP lookup. O05 already defined the
left/latest sample between timestamps. The resolver now makes that convention
explicitly right-continuous at a sample boundary:

- just before `tn`: the prior sample applies;
- exactly at `tn`: the sample at `tn` applies.

This small integration correction is covered by an O05 regression test and
aligns profile lookup with O01 phase-1 current-change ordering. LINEAR
interpolation and all preset values are unchanged.

## 10. Playback separation

`engineeringDeltaToWallClockSec()` implements only:

`wallClockDelta = engineeringDelta / playbackSpeed`

Playback speed is validated but never enters relay timing, progress, breaker
clearing, isolation, or event ordering. Completed snapshots at 1x, 5x, and 10x
are structurally equal.

## 11. Validation and numerical safety

The public boundary first validates the complete O05 study and selected fault.
Invalid speed, profile values, references, settings, CT data, breaker values, or
unsupported arithmetic return structured `DomainIssue` records.

Internal numerical exceptions are contained and converted to
`DomainEvaluation.INVALID`; invalid inputs do not escape as UI crashes.

## 12. Permanent verification matrix

`src/engines/overcurrentTimeline.test.ts` covers:

- normal/no-pickup and exact 51 equality;
- exact 50 equality and above-high-set t=0 operation;
- simultaneous 50/51 eligibility with 50 priority;
- definite-time magnitude independence;
- O03/O04 inverse static parity;
- O06 selected-element/time parity;
- every configured O05 static fault case;
- deterministic 1,000-case static pure-engine parity sweep;
- reset-before-trip canonical vector;
- STEP pickup and STEP reset;
- LINEAR pickup crossing;
- analytic-reference inverse accumulation over LINEAR current;
- reset followed by a fresh timing episode;
- canonical primary-clearing/backup-reset sequence;
- canonical multiple-trip-before-isolation sequence;
- zero breaker clearing;
- simultaneous trip and breaker-open ordering;
- external clear exactly at timer completion;
- missing post-fault metadata;
- non-finite profile rejection;
- repeated-run structural determinism;
- generic four-relay radial topology;
- 1x/5x/10x speed independence and wall-clock mapping.

Verification result:

- O07 permanent suite: **23/23 PASS**;
- combined O03/O04/O05/O06/O07 regression: **8 files / 94 tests PASS**;
- strict TypeScript: **PASS**;
- production Vite build: **PASS**.

The supplied source has one pre-existing, unrelated Differential R10 test
failure: its asserted overflow vector remains finite after percentage scaling.
Repository-wide execution is 149 PASS / 1 pre-existing FAIL. O07 does not alter
frozen Differential code or tests; the failure reproduces on the untouched O06
source baseline.

## 13. Acceptance and next gate

O07 is complete:

- [x] deterministic engineering-time engine;
- [x] constant-current pure-engine parity;
- [x] coordination trip parity;
- [x] STEP and LINEAR accumulated progress;
- [x] strict boundary and 50 priority semantics;
- [x] relay trip / breaker open / isolation separation;
- [x] backup continuation, reset, and multiple-trip preservation;
- [x] external-clear ordering and explicit post-fault data;
- [x] speed-independent engineering output;
- [x] invalid-input containment;
- [x] generic N-relay behavior;
- [x] no React/UI formula ownership;
- [x] sourcebook and checkpoint update.

Stop after O07. The next planned gate is **O08 — Parameter UI**, only when
explicitly requested.
