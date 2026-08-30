# Overcurrent Relay Pure Engine — O03

**Module:** Overcurrent Relay Simulator — ANSI 50/51 Protection & Coordination Laboratory  
**Phase:** O03 — Measurement + 50/51 Pure Engine  
**Version:** O03 v1.0  
**Date:** 2026-08-13  
**Status:** **IMPLEMENTED / READY FOR O04**  
**Parent behavior:** `overcurrent-relay.md` O01 v1.0 — APPROVED / FROZEN  
**Parent data model:** `overcurrent-domain-model-o02.md` O02 v1.0

---

## 1. Purpose

O03 implements the first production engineering calculations for Overcurrent without React, TCC rendering, study scanning, coordination logic, presets, or timeline playback.

Implemented calculation chain:

```text
Primary RMS current [A primary]
        ↓
CT ratio + scalar ratio error
        ↓
Measured relay current [A sec]
        ↓
51 static evaluation
        ↓
50 static evaluation
        ↓
50-priority arbitration
        ↓
OperatingResult
```

The safe evaluation boundary converts invalid/non-representable arithmetic into `DomainEvaluation<T>` so later UI code never needs to catch numeric exceptions during render.

---

## 2. Production source

```text
src/engines/overcurrentMeasurement.ts
src/engines/overcurrent.ts
src/utils/evaluateOvercurrentDevice.ts
```

Contract tests added:

```text
src/engines/overcurrentMeasurement.test.ts
src/engines/overcurrent.test.ts
src/utils/evaluateOvercurrentDevice.test.ts
```

---

## 3. CT measurement implementation

O03 implements the O01 convention exactly:

```text
Iideal = Iprimary × CTsecondaryRated / CTprimaryRated
factor = 1 + ratioErrorPct / 100
Irelay = Iideal × factor
```

Validation includes:

- finite non-negative primary current;
- CT primary/secondary ratings > 0;
- finite ratio error;
- error factor > 0;
- derived finite checks;
- overflow guard;
- representational underflow guard for positive CT ratios/currents.

No CT saturation, burden, phase error, transient response, or remanence is modeled.

---

## 4. 51 inverse characteristic registry

Production registry is `OVERCURRENT_INVERSE_CURVES` and contains only the O01-approved six curves:

| ID | Name | k | c | α |
|---|---|---:|---:|---:|
| IEC_SI | IEC Standard Inverse | 0.14 | 0 | 0.02 |
| IEC_VI | IEC Very Inverse | 13.5 | 0 | 1 |
| IEC_EI | IEC Extremely Inverse | 80 | 0 | 2 |
| IEEE_MI | IEEE Moderately Inverse | 0.0515 | 0.114 | 0.02 |
| IEEE_VI | IEEE Very Inverse | 19.61 | 0.491 | 2 |
| IEEE_EI | IEEE Extremely Inverse | 28.2 | 0.1217 | 2 |

Inverse function:

```text
T = S × [ k / (M^α - 1) + c ]
```

The implementation uses `expm1(α ln M)` near pickup and a stable reciprocal representation for very large exponents to avoid avoidable overflow.

`M <= 1` / numerical equality with 1 returns no characteristic operating time.

---

## 5. 51 static behavior

Production function:

```text
calculateOvercurrent51(relayCurrentASecondary, settings)
```

Rules:

- explicit `DISABLED` state when the O02 `enabled` flag is false;
- strict pickup: `Irelay > Ipickup` and not numerically equal;
- below/equal pickup: `BELOW_PICKUP`, no trip time;
- inverse mode: same production inverse function used later by TCC;
- definite mode: configured delay independent of current magnitude above pickup;
- time scale supported range: 0.05–15.00;
- pickup and definite delay must be positive finite values.

### O02 compatibility refinement

O02 originally exposed an `enabled` field for 51 but its result-status union contained only `BELOW_PICKUP | PICKUP`. O03 adds `DISABLED` to `Overcurrent51StaticStatus`. This is a semantic completeness fix, not a change to O01 relay mathematics.

---

## 6. 50 static behavior

Production function:

```text
calculateOvercurrent50(relayCurrentASecondary, settings)
```

Rules:

- disabled -> `DISABLED`;
- enabled and exact threshold -> `BELOW_PICKUP`;
- enabled and `Irelay > Iinst` -> `PICKUP`;
- O01 theoretical relay delay -> `0 s`.

Breaker clearing remains outside O03.

---

## 7. 50 / 51 device arbitration

Production function:

```text
calculateOvercurrentDevice(primaryCurrentA, device)
```

Priority:

```text
50 eligible -> selectedElement = 50
else 51 picked up -> selectedElement = 51
else selectedElement = null
```

The 51 result remains exposed even when 50 wins so later TCC/Analysis can show the 51 theoretical reference.

---

## 8. Non-throwing boundary

Production function:

```text
evaluateOvercurrentDevice(primaryCurrentA, device)
```

Result:

```text
VALID(OperatingResult)
```

or:

```text
INVALID(DomainIssue[])
```

Static validation issues retain paths and domain issue codes. Finite user inputs that produce derived overflow/underflow are converted to `NUMERICAL_RANGE` instead of escaping as an uncaught exception.

---

## 9. Verification completed in O03

Because the sandbox does not contain the npm dependency tree, Vitest itself could not be executed. O03 therefore used an independent compile/runtime gate in addition to committing Vitest test files.

Completed gates:

- strict TypeScript semantic compile of O03 production files: PASS;
- TypeScript semantic compile of O03 test files using a local Vitest declaration stub: PASS;
- O01 inverse reference vectors: **18/18 PASS**;
- inverse monotonic sweep: **6 curves × 25,000 points = 150,000 PASS**;
- randomized static-device evaluation: **100,000 cases PASS**;
- OVC-01 Normal Load: PASS;
- OVC-02 Near Pickup: PASS;
- OVC-03 Moderate Overcurrent: PASS;
- OVC-04 High Fault: PASS;
- OVC-05 50 priority: PASS;
- OVC-08 CT error crossing pickup: PASS;
- exact 51 pickup equality: PASS;
- exact 50 threshold equality: PASS;
- definite-time magnitude independence: PASS;
- CT overflow/underflow guards: PASS;
- safe evaluation of non-finite/extreme inputs: PASS.

O04 remains responsible for the formal numerical-hardening suite, boundary fuzzing, cross-function invariants, and expanded regression matrix.

---

## 10. Explicitly not implemented in O03

- Study Engine / preset registry;
- coordination pair evaluation;
- CTI calculation;
- coordination corridor/envelope;
- validation-case scanning;
- varying-current integration/timeline;
- breaker events;
- SLD;
- TCC presentation;
- React UI.

These remain owned by later phases.

---

## 11. Next gate

**O04 — Engine Unit Tests / Numerical Hardening**

O04 must harden the O03 production functions before Study Engine development begins. It should include exhaustive boundary tests, randomized/property checks, cross-curve invariants, numerical extreme cases, safe-evaluator issue semantics, and an executable regression harness independent of React.
