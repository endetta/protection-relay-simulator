# Overcurrent Relay — O06 Coordination Engine

**Status:** IMPLEMENTED / PASSED  
**Date:** 2026-08-13  
**Parent specifications:** Overcurrent PRD v1.0, O01 Engineering Specification v1.0, O02 Domain Model, O03/O04 Pure Engine + Hardening, O05 Study Engine

## 1. Purpose

O06 converts the explicit O05 study data into deterministic protection-coordination results. It does not render UI, run wall-clock playback, or infer a network short-circuit model.

The production engine added in this phase is:

`src/engines/overcurrentCoordination.ts`

Its responsibilities are limited to:

- evaluate every configured device at an explicit study current;
- determine operating order from actual relay trip-output times;
- evaluate adjacent primary/backup coordination pairs;
- calculate observed CTI and grading surplus;
- enforce O01 sensitivity semantics at configured MIN faults;
- enforce load security at configured load cases;
- classify selectivity and time-grading failures;
- classify upstream instantaneous 50 overreach;
- classify unavailable backup protection;
- scan configured fault-location profiles into coordination-envelope points;
- identify deterministic configured-study worst points;
- assemble a multi-dimension coordination audit used later by Analysis/UI.

O06 deliberately does **not** own:

- relay equations (O03/O04);
- preset fault-current calculation (O05 data only);
- breaker/time-domain playback (O07);
- SLD/TCC rendering (O09/O10);
- guided-hint presentation (O12/O13).

## 2. Coordination pair equation

For an explicit pair `(P,B)` and its authoritative requirement:

`Observed CTI = t_trip(B) - t_trip(P)`

`t_trip` is the selected relay trip-output time from the O03 engine. It is not breaker-open time.

The grading surplus is:

`Surplus = Observed CTI - Required CTI`

Result:

- PASS when `Observed CTI >= Required CTI` within the O01 scale-aware time tolerance;
- FAIL when below the required CTI;
- NOT_EVALUABLE when either required relay has no selected trip-output time.

CTI equality is therefore PASS. Selectivity is intentionally stricter: the primary must be earlier than the backup, so equal trip times fail selectivity.

## 3. Pair and chain semantics

The engine never infers protection roles from labels such as R1/R2/R3.

Roles come from `FaultCase.protectionChain` and `CoordinationPair` metadata.

For a chain:

`R3 primary -> R2 backup 1 -> R1 backup 2`

the grading tiers are evaluated as adjacent pairs:

- R3 -> R2;
- R2 -> R1.

This preserves generic N-relay radial architecture. O06 regression includes a synthetic four-relay chain with three sequential pairs.

## 4. Sensitivity

O01 defines sensitivity on configured MIN-fault cases as a **51 pickup** requirement.

Therefore the primary device passes sensitivity only when:

`element51.status == PICKUP`

A 50 pickup does not substitute for the formal 51 minimum-fault sensitivity test.

Exact current equality at the 51 pickup remains non-pickup and therefore fails sensitivity.

Sensitivity violations are emitted as `SENSITIVITY_RISK` with the observed relay-secondary current and required 51 pickup when available.

## 5. Backup availability

A required backup is available when its selected 50/51 arbitration result has a finite trip-output time for the evaluated fault.

If a required backup has no selected trip time, O06 emits:

`BACKUP_NOT_AVAILABLE`

The corresponding pair result remains `NOT_EVALUABLE`; it is never silently counted as coordinated.

Minimum-fault validation explicitly checks all required backups in the protection chain.

## 6. Selectivity

For every evaluable adjacent coordination pair:

`backup trip time > primary trip time`

must hold with scale-aware comparison.

Equal trip times are a selectivity failure even if numerical noise makes them approximately equal.

A violation is emitted as:

`SELECTIVITY_FAIL`

This is distinct from time grading. A pair may remain selective but still fail the configured CTI target.

## 7. Time grading

For every evaluable pair:

`Observed CTI >= Required CTI`

is required.

Failure emits:

`TIME_GRADING`

This is the core violation intentionally seeded in COORD-01 and COORD-02.

## 8. Instantaneous 50 reach

If an upstream backup device has 50 pickup for a downstream fault, O06 reports:

`INSTANTANEOUS_OVERREACH`

unless that exact backup device is listed in:

`FaultCase.allowedBackupInstantaneousDeviceIds`

The field is an explicit study-policy exception and was added during O06 so the engine does not require hard-coded topology assumptions.

Validation requires every allowed device to be an actual explicit backup in that fault's protection chain.

Removing the overreach classification does not automatically waive selectivity/time-grading mathematics. Those remain separate audit dimensions.

## 9. Load security

For every configured `loadSecurityCaseId`, each device is evaluated through its actual CT configuration.

51 security requires:

`Irelay_load < Ipickup51`

when 51 is enabled.

50 security requires:

`Irelay_load < Ipickup50`

when 50 is enabled.

Equality is deliberately FAIL / zero security margin as locked by O01.

The engine returns for every device:

- measured relay current;
- active 51 pickup and margin;
- active 50 pickup and margin;
- PASS/FAIL.

A failed device emits `LOAD_SECURITY_FAIL`.

## 10. Operating order

Each fault-case result exposes a deterministic `operatingOrder`.

Entries contain:

- device ID;
- role PRIMARY / BACKUP / OTHER;
- backup order;
- selected 50/51 element;
- relay trip-output time.

Finite trip times sort earliest first. Non-operating devices follow. Equal/near-equal times use stable device order as a deterministic tie-breaker; the tie does not imply selectivity PASS.

This result is intended for the future O11 Operating Sequence presentation, while the actual event/time-domain state machine remains O07-owned.

## 11. Coordination audit dimensions

`runOvercurrentCoordinationStudy()` assembles six independent dimensions:

1. SENSITIVITY
2. SELECTIVITY
3. TIME_GRADING
4. INSTANTANEOUS_REACH
5. LOAD_SECURITY
6. BACKUP_AVAILABILITY

Each is PASS / FAIL / NOT_EVALUABLE.

The overall audit is:

- `COORDINATED` when every applicable dimension passes;
- `COORDINATION_INCOMPLETE` when any applicable dimension fails;
- `NOT_EVALUABLE` when no applicable study dimension exists.

`passedCaseCount / totalCaseCount` refers to the explicit `validationCaseIds` fault registry. Load-security cases remain separately represented rather than inflating the fault-case count.

## 12. Explicit validation-case worst point

The authoritative `audit.worstCase` is selected from evaluable configured validation cases using minimum:

`Surplus = Observed CTI - Required CTI`

Ties remain in deterministic study/pair iteration order.

This is the authoritative `RUN COORDINATION TEST` worst configured case.

For COORD-02 initial settings the result is preserved exactly:

- fault: `COORD-02:F3:MAX`;
- pair: `R3 -> R2`;
- observed CTI: `0.27830769230769226 s`;
- required: `0.30 s`;
- surplus: `-0.021692307692307733 s`;
- audit: `COORDINATION_INCOMPLETE`;
- explicit validation cases passed: `5 / 6`.

With only R2 TMS changed from `0.18 -> 0.19`:

- observed worst CTI: `0.3053076923076923 s`;
- surplus: `+0.005307692307692291 s`;
- explicit validation cases passed: `6 / 6`;
- audit: `COORDINATED`.

This remains a regression oracle, not an automatic Guided Study answer.

## 13. Coordination envelope

O06 implements supplementary configured-profile scans through:

`scanCoordinationEnvelope()`

The scan uses only O05 `FaultLocationProfile` data and configured protection-zone segments.

For each scan position it stores:

- normalized configured position;
- configured location and protection chain;
- interpolated per-device primary currents;
- pair primary/backup trip times;
- required CTI;
- minimum acceptable backup time;
- observed CTI;
- grading surplus;
- pair PASS/FAIL/NOT_EVALUABLE;
- instantaneous-overreach state;
- structured violations.

The coordination-corridor boundary is:

`minimumBackupTime = primaryTripTime + requiredCTI`

when primary trip time is finite.

The supplementary profile worst point is the finite point with minimum grading surplus.

The UI must continue to identify this as a **configured study-profile worst point**, never a mathematically proven network-wide worst fault.

## 14. O05 profile refinement discovered by O06

Dense envelope evaluation exposed a data-model issue in the original O05 scrubber samples: linear interpolation across a topology-zone transition could create a wide interval where an upstream and newly in-service downstream relay were assigned very different through-fault currents. That could create an artificial selectivity inversion unrelated to the intended coordination challenge.

O06 therefore refined only the **configured scrubber samples**, not the canonical MIN/NOM/MAX fault cases or relay equations.

The new profiles use close sample pairs around zone transitions:

- just upstream of the transition, downstream devices remain explicitly outside the current path;
- immediately inside the new radial zone, in-series devices receive the same configured through-fault current;
- interpolation within a radial zone remains deterministic and transparent.

This is still configured educational study interpolation, not a hidden impedance/network solver.

The O05 regression suite was rerun after the refinement and remained PASS (`440,165` checks).

## 15. Study-definition hardening

O06 strengthens O05 validation in two ways:

1. every `CoordinationPair` must now have exactly one authoritative `CoordinationRequirement`;
2. `allowedBackupInstantaneousDeviceIds`, when present, must be unique and reference only actual backups in that fault chain.

Missing CTI requirements are rejected before coordination evaluation.

## 16. Public production API

O06 exports:

- `evaluateCoordinationPair()`
- `evaluateCoordinationFaultCase()`
- `evaluateLoadSecurityCase()`
- `scanCoordinationEnvelope()`
- `runOvercurrentCoordinationStudy()`

All study-level APIs return `DomainEvaluation<T>` at the boundary and never require React/UI state.

The pure pair calculator assumes already-valid domain objects and returns a deterministic pair result.

## 17. Numerical behavior

Time comparisons use the O01 scale-aware tolerance:

`1e-9 * max(1, |a|, |b|)`

for CTI/equality decisions.

Load-security strict inequality uses a smaller scale-aware value tolerance to prevent floating noise from turning equality into an apparent positive margin.

All device calculations flow through the hardened O03/O04 non-throwing evaluator.

A non-finite or invalid device/study result returns `DomainEvaluation.INVALID`; the coordination layer does not invent fallback current or trip times.

## 18. O06 regression evidence

Permanent tests:

`src/engines/overcurrentCoordination.test.ts`

Dependency-independent runtime regression:

`Overcurrent_O06_Runtime_Regression_Report.json`

Final O06 runtime result:

- status: PASS;
- explicit checks: `604,515`;
- preset registry: 11 studies;
- CTI boundary fuzz: 300,000 iterations with equality/tolerance and real-deficit assertions;
- deterministic envelope scans: PASS;
- corridor identity: PASS;
- load-security equality: FAIL as specified;
- minimum-fault sensitivity equality: FAIL as specified;
- O01 COORD-02 5/6 intentional failure: PASS;
- corrected R2 TMS 0.19 6/6 coordinated vector: PASS;
- COORD-05 instantaneous overreach/selectivity/time-grading classification: PASS;
- generic four-relay sequential coordination: PASS;
- missing authoritative CTI requirement rejection: PASS.

O05 regression after O06 profile refinement:

- `440,165` checks PASS.

Strict TypeScript production and test-contract compiles also PASS.

## 19. Frozen dependencies

O06 does not change:

- O03 50/51 equations;
- O04 numerical-hardening mathematics;
- O01 pickup boundaries;
- CT measurement convention;
- canonical explicit fault cases;
- CTI definition;
- Differential Relay R10.

## 20. Next gate — O07 Timeline Engine

O07 may now consume O03 device evaluation plus O05 current profiles/studies and O06 protection roles/results.

O07 must implement engineering-time behavior for:

- fault applied;
- 51 pickup;
- accumulated inverse/definite operating progress;
- 50 trip;
- 51 trip;
- breaker opening interval;
- breaker open;
- fault isolation;
- backup timer continuation during primary breaker clearing;
- external fault clear before trip;
- immediate V1 reset;
- multiple-trip sequences when backup trips before fault isolation;
- playback-speed separation from engineering time.

No UI implementation should precede the O07 timeline gate.
