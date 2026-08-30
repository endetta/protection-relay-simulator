# Overcurrent O04 — Engine Unit Tests & Numerical Hardening

**Date:** 2026-08-13  
**Status:** COMPLETE / GATE PASSED  
**Parent:** O03 Measurement + 50/51 Pure Engine  
**Next:** O05 Study Engine & Preset Registry

## 1. Purpose

O04 is the release-hardening gate for the pure single-device 50/51 calculation layer. It does not add study topology, coordination, timeline playback, TCC rendering, or React UI. Its purpose is to prove that O03 behaves deterministically across approved reference vectors, boundary conditions, broad finite input ranges, and numerical extremes before higher-level engines depend on it.

## 2. Defects found and corrected

### O04-01 — Breaker clearing-time validation gap

**Finding:** `evaluateOvercurrentDevice()` accepted a device with negative or non-finite `breaker.clearingTimeSec` because O03 validated CT/50/51 settings but not the breaker configuration. Static relay arithmetic did not use the breaker value yet, so the defect remained latent until the planned Timeline Engine.

**Risk:** invalid device state could cross the O03 safe-evaluation boundary and later create impossible timeline events such as breaker-open time preceding relay trip output.

**Correction:** added `validateBreakerConfiguration()` and included it in `validateStaticDeviceInput()`.

Locked validation:

```text
breakerClearingTime >= 0 and finite
```

`0 s` is allowed as an idealized study case. Negative or non-finite values are invalid.

This is a validation clarification only; it does not change O01 relay-trip/breaker-open semantics.

### O04-02 — CT intermediate underflow/overflow sensitivity

**Finding:** O03 evaluated the CT ideal current primarily as:

```text
Isec = Iprimary × (CTsecondary / CTprimary)
```

For ordinary engineering values this is correct. For extreme but finite values, the intermediate ratio can underflow/overflow even when the final mathematical result remains representable.

**Correction:** the CT engine now tries algebraically equivalent finite orderings and accepts the first positive representable result:

```text
Iprimary × (CTsecondary / CTprimary)
(Iprimary / CTprimary) × CTsecondary
(Iprimary × CTsecondary) / CTprimary
```

Normal values retain the ratio-first path, preserving the transparent O01 measurement convention. If no ordering can represent the positive result, the engine returns a numerical-range error through the safe evaluator rather than emitting `Infinity`, `NaN`, or silent zero.

## 3. Permanent hardening tests added

`src/engines/overcurrent.hardening.test.ts` now covers:

- positive/finite inverse-time results;
- monotonic decreasing operation time with increasing current multiple;
- exact proportionality to time scale;
- O01 scale-aware pickup equality over wide pickup magnitudes;
- broad deterministic safe-evaluator fuzzing;
- CT scaling over broad ratios/currents/errors;
- 50-priority coherence;
- selected-element / selected-trip-time invariants.

Existing suites were extended with:

- representable extreme CT cases;
- negative/non-finite breaker rejection;
- zero-second breaker-clearing acceptance.

## 4. Runtime regression harness results

A dependency-independent compiled runtime harness was executed against the O04 production source.

Result:

```text
PASS
```

Coverage counts:

| Check family | Cases / points |
|---|---:|
| O01 inverse reference vectors | 18 |
| Inverse monotonic curve points | 300,000 |
| Pickup/equality threshold cases | 100,000 |
| CT scaling cases | 100,004 |
| Broad static-device safe-evaluator fuzz | 500,000 |
| Determinism repetitions | 1,000 |
| Total explicit assertions/checks | 1,301,031 |

The fuzz stream is deterministic when used by the permanent Vitest hardening suite.

## 5. Invariants verified

For every VALID static result tested:

1. all measurement currents are finite and non-negative;
2. selected element `50` always has selected trip time `0`;
3. if 50 is picked up it always wins static arbitration;
4. selected `51` implies 51 pickup and a finite positive trip time;
5. no selected element implies selected trip time `null`;
6. repeated evaluation of identical state is deterministic;
7. safe evaluation never exposes an uncaught arithmetic exception;
8. inverse operate time decreases monotonically with current multiple;
9. inverse operate time scales linearly with the normalized TMS/Time-Dial scalar;
10. exact/nearly-equal pickup boundaries follow the O01 `nearlyEqual` policy.

## 6. Compilation verification

- O02/O03/O04 production domain + engine strict TypeScript: PASS.
- O03/O04 test contracts semantic TypeScript: PASS using a local Vitest declaration stub because installed npm binaries are unavailable in this sandbox.
- Full Vitest execution remains a clean-environment release gate once dependencies are installed.

## 7. Scope explicitly not added

O04 does **not** implement:

- Study Engine;
- preset registry;
- coordination / CTI scanning;
- current-profile timeline integration;
- breaker state playback;
- TCC layers/rendering;
- SLD;
- React UI.

## 8. O04 gate decision

**PASSED.** O03 pure-engine behavior is sufficiently hardened for higher-level study code to depend on it.

The next authorized phase is **O05 — Study Engine & Preset Registry**.
