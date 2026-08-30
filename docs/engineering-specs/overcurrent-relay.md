# Overcurrent Relay Engineering Specification — O01

**Module:** Overcurrent Relay Simulator — ANSI 50/51 Protection & Coordination Laboratory  
**Route:** `/simulator/overcurrent`  
**Specification version:** O01 v1.0  
**Date:** 2026-08-13  
**Status:** **APPROVED / FROZEN FOR IMPLEMENTATION**  
**Authoritative product plan:** `../PRD-overcurrent-relay.md`  
**Reference UI language:** Differential Relay R10 (FINAL / FROZEN)

> **Gate status:** APPROVED on 2026-08-13 when the project explicitly advanced to the next Overcurrent implementation phase. O02+ implementation must conform to this specification; changes to locked engineering behavior require a documented specification revision.

---

## 1. Purpose

This document locks the engineering behavior for the first Overcurrent Relay release. It exists to prevent the UI, graph, coordination study, and time-domain playback from evolving separate formulas or hidden assumptions.

The release is a **non-directional phase overcurrent 50/51 educational and coordination study model**. It is not a vendor relay emulator and it is not a short-circuit network solver.

The engineering chain is:

```text
Configured primary current / study current
        ↓
CT measurement model
        ↓
Relay secondary current magnitude
        ↓
51 pickup + characteristic
        ↓
50 instantaneous check
        ↓
50/51 arbitration
        ↓
Static operating result
        ↓
Coordination evaluation
        ↓
Deterministic timeline / breaker clearing
        ↓
Presentation model (SLD, TCC, Analysis)
```

---

## 2. Normative and reference basis

### 2.1 Primary standards

1. **IEC 60255-151:2009** — functional requirements for over/under-current protection, including protection function, measurement characteristics, and time-delay characteristics.
2. **IEEE C37.112-2018** — inverse-time characteristic equations for overcurrent relays and integral behavior for varying-current conditions.

### 2.2 Primary manufacturer/application references used to make product conventions explicit

1. **ABB FC710 Feeder Protection Unit User Manual** — provides the dependent-time equation form and the six initial curve constants used by this simulator:
   - IEC inverse;
   - IEC very inverse;
   - IEC extremely inverse;
   - IEEE moderately inverse;
   - IEEE very inverse;
   - IEEE extremely inverse.
2. **ABB SPAA 120 C / SPAA 121 C Feeder Protection Relay manual** — corroborates the IEC inverse constants and typical TMS concept.
3. **SEL application guidance on protection coordination / PRC-027** — supports the product treatment of CTI as a configurable primary-backup trip-time difference whose required margin accounts for breaker interrupting time, relay/timing allowance, and study margin; it also supports evaluating multiple cases / worst-case coordination rather than a single fault point.

### 2.3 Reference hierarchy

When product behavior must be deterministic, use this hierarchy:

1. this approved Engineering Specification;
2. the Overcurrent PRD;
3. the cited standard/manufacturer reference;
4. implementation detail that does not alter behavior.

A manufacturer-specific feature not explicitly adopted in this specification is **not** implied by citing a manufacturer manual.

---

## 3. Scope locked by O01

### Included

- non-directional phase overcurrent;
- ANSI 51 timed overcurrent;
- ANSI 50 instantaneous overcurrent;
- definite-time 51;
- six inverse-time curves listed in Section 7;
- CT ratio + scalar ratio-error measurement model;
- Single Relay Study;
- 2- and 3-relay radial coordination;
- primary/backup relationship from study metadata;
- CTI / grading margin;
- coordination budget;
- load-security / minimum-fault sensitivity checks;
- instantaneous overreach check;
- configured fault study points and optional interpolation profiles;
- deterministic pickup/timing/trip/breaker sequence;
- graph/engine equation parity;
- architecture ready for varying current `I(t)`.

### Explicitly excluded from this release

- directional overcurrent 67;
- neutral/ground 50N/51N;
- negative-sequence elements;
- CT saturation;
- waveform/phasor transient simulation;
- harmonic restraint/blocking;
- a full short-circuit network solver;
- ring/meshed coordination;
- communication-assisted/adaptive schemes;
- breaker mechanical transient modeling;
- vendor-specific operate-time tolerances/emulation;
- automatic setting optimization.

---

## 4. Engineering current domain and units

### 4.1 Current quantity

The V1 engine uses a **scalar RMS phase-current magnitude**.

- Primary/system current: `I_primary`, unit **A primary**.
- Relay current after CT measurement: `I_relay`, unit **A secondary** (`A sec`).
- Pickup setting: `I_pickup`, unit **A sec**.
- Instantaneous high-set: `I_inst`, unit **A sec**.

The V1 element is non-directional, therefore negative current is not meaningful. User/study currents shall be non-negative magnitudes.

### 4.2 Current multiple

```text
M = I_relay / I_pickup
```

`M` is dimensionless.

### 4.3 TCC display domains

The characteristic engine always evaluates the relay using `M`.

The TCC presentation supports two graph domains:

- **Relay Multiple** (`M`) — preferred/default in Single Relay Study.
- **Primary Current** (`A primary`) — required/default in Coordination Lab so multiple relay curves can be compared on one engineering current axis.

In Coordination Lab, operating-point tooltips shall still expose each relay's `I_relay` and `M`.

### 4.4 Multi-phase future compatibility

The V1 50/51 element is intentionally a scalar element. Future three-phase studies may call the same scalar engine independently for phase A/B/C and aggregate according to a future channel policy. V1 shall not hard-code three-phase phasor logic into the scalar engine.

---

## 5. CT measurement convention

Each protection device has an independent CT configuration:

```text
CT primary rated     I_CT_PRI   [A]
CT secondary rated   I_CT_SEC   [A]
Ratio error           e_CT       [%]
```

### 5.1 Ideal secondary current

```text
I_secondary_ideal = I_primary × I_CT_SEC / I_CT_PRI
```

### 5.2 Ratio-error convention

```text
errorFactor = 1 + e_CT / 100
I_relay = I_secondary_ideal × errorFactor
```

Interpretation:

- positive ratio error -> relay sees a current magnitude higher than ideal;
- negative ratio error -> relay sees a current magnitude lower than ideal;
- `0%` -> ideal ratio.

### 5.3 CT validity

Valid CT configuration requires:

- `I_CT_PRI > 0`;
- `I_CT_SEC > 0`;
- all values finite;
- `errorFactor > 0`.

Therefore `e_CT <= -100%` is invalid.

The engine does not impose a fake accuracy-class limit. UI guardrails may provide practical study ranges, but they must not be described as an IEC/IEEE accuracy requirement unless separately sourced.

### 5.4 No hidden CT physics

V1 does **not** model:

- saturation;
- remanence;
- burden;
- phase error;
- transient CT response.

The Calculation Details view must identify this as a scalar ratio/error model.

---

## 6. 51 pickup boundary

51 is picked up only when the measured relay current **exceeds** the pickup setting.

```text
51 pickup if I_relay > I_pickup
```

At exact equality:

```text
I_relay = I_pickup  →  NOT PICKED UP
M = 1               →  no finite inverse operating time
```

This strict boundary is intentionally aligned with the language used in manufacturer functional descriptions that the element starts when current exceeds the setting.

### 6.1 Floating-point equality handling

A scale-aware numerical comparison shall be used:

```text
nearlyEqual(a,b) := |a-b| <= 1e-12 × max(1, |a|, |b|)
```

Pickup is true only if:

```text
I_relay > I_pickup AND not nearlyEqual(I_relay, I_pickup)
```

The same policy is used for the 50 threshold.

---

## 7. Supported inverse-time equation and constants

For a constant current with `M > 1`:

```text
                k
T(M) = S × [ ---------- + c ]
             M^α - 1
```

Where:

- `T(M)` = theoretical relay operating time in seconds;
- `M = I_relay / I_pickup`;
- `S` = time-scale setting (Section 8);
- `k`, `c`, `α` = curve constants.

### 7.1 Curve registry — V1

| Curve ID | Display name | k | c | α |
|---|---|---:|---:|---:|
| `IEC_SI` | IEC Standard Inverse | 0.14 | 0 | 0.02 |
| `IEC_VI` | IEC Very Inverse | 13.5 | 0 | 1 |
| `IEC_EI` | IEC Extremely Inverse | 80 | 0 | 2 |
| `IEEE_MI` | IEEE Moderately Inverse | 0.0515 | 0.1140 | 0.02 |
| `IEEE_VI` | IEEE Very Inverse | 19.61 | 0.491 | 2 |
| `IEEE_EI` | IEEE Extremely Inverse | 28.2 | 0.1217 | 2 |

No other inverse curve is implicitly supported in V1.

### 7.2 Robust numerical evaluation

Do not calculate the denominator only as `pow(M, alpha) - 1` near pickup.

Preferred stable form:

```text
denominator = expm1(α × ln(M))
```

Then:

```text
T = S × (k / denominator + c)
```

This reduces cancellation error for `M → 1+`.

### 7.3 Near-pickup behavior

For `M <= 1`:

- 51 is not picked up;
- inverse `operateTimeSec = null`;
- do not return `Infinity` as a normal UI value.

For `M > 1`, the theoretical time may become very large. The engine must return the finite theoretical result when representable. The graph may mark the operating point OFF-SCALE rather than destroying the useful characteristic view.

If arithmetic becomes non-finite/unrepresentable, the safe evaluator returns a numerical-range invalid result instead of throwing.

### 7.4 No hidden minimum-time clamp

V1 does not silently clamp an inverse curve to a vendor-specific minimum operate time. The displayed characteristic is the theoretical curve defined by the selected equation plus the explicit 50 element. A future minimum-time feature would require an explicit spec revision.

---

## 8. Time-scale setting: TMS / Time Dial

The engine stores one normalized dimensionless scalar:

```text
timeScale = S
```

UI terminology:

- IEC curve -> label **TMS**;
- IEEE curve -> label **Time Dial (TD)**;
- Calculation Details may show `timeScale` as the common mathematical parameter.

The engine equation is identical in form for both families: `S` multiplies the characteristic expression.

### 8.1 Supported V1 setting range

```text
0.05 <= S <= 15.00
```

This is a product-supported range, chosen to cover the range used by contemporary numerical relay implementations such as the ABB FC710. It is **not** presented as a universal IEC/IEEE mandatory setting range.

Canonical default:

```text
S = 0.10
```

---

## 9. Definite-time 51

If the 51 element is configured as Definite Time:

```text
if I_relay > I_pickup:
    T_51 = definiteDelaySec
else:
    T_51 = null
```

Magnitude above pickup does not change the definite delay.

### 9.1 Product-supported delay domain

Engine validity:

```text
definiteDelaySec > 0 and finite
```

The UI may constrain the normal study entry range without changing the engine equation. Canonical default:

```text
definiteDelaySec = 0.50 s
```

---

## 10. Instantaneous 50 element

The V1 50 element is a **no-intentional-delay high-set element**.

Parameters:

```text
50 enabled      bool
I_inst           [A sec]
```

Pickup/trip condition:

```text
50 operates if enabled AND I_relay > I_inst
```

At equality:

```text
I_relay = I_inst → 50 does not operate
```

Static theoretical operate time:

```text
T_50 = 0.000 s
```

This means **no intentional relay delay in the educational model**. It does not claim a physical device has zero processing/contact time. Breaker clearing remains separate.

If 50 is disabled:

```text
T_50 = null
```

---

## 11. 50 / 51 arbitration

Both elements are evaluated from the same measured relay current.

Priority:

1. if 50 is enabled and eligible -> active element = `50`;
2. otherwise if 51 is picked up -> active element = `51`;
3. otherwise -> `NONE`.

Static result shall still expose the calculated 51 reference time even when 50 wins, because it is educationally useful on the TCC.

Example:

```text
I_relay > I_inst
I_relay > I_pickup

51 theoretical time = 0.420 s
50 theoretical time = 0 s
active element       = 50
relay trip time       = 0 s
```

No hidden blocking or vendor-specific high-set logic is applied.

---

## 12. Static operating result

A valid static evaluation shall expose at minimum:

```text
I_primary
I_secondary_ideal
I_relay
I_pickup
M
pickup51
pickup50
curveId / timingMode
t51Sec | null
t50Sec | null
activeElement = NONE | 51 | 50
relayTripTimeSec | null
```

The static engine does not own wall-clock timers or breaker states.

---

## 13. Reset behavior — V1

The initial release uses **immediate reset**.

### 13.1 Inverse 51

If 51 has not yet tripped and current falls to/below pickup:

```text
I_relay <= I_pickup  → accumulated operate progress = 0
```

### 13.2 Definite-time 51

If current falls to/below pickup before the definite timer expires:

```text
timerElapsed = 0
```

### 13.3 After relay trip

A relay trip output remains asserted for the active run until Reset / study reinitialization. Fault removal does not retroactively cancel an already issued trip command.

### 13.4 Deliberate simplification

V1 does not expose:

- definite reset delay;
- inverse reset curve;
- dropout ratio/hysteresis setting.

The architecture must not make these impossible later.

---

## 14. Varying-current integration contract

Although first-release playback presets are primarily constant-current fault steps, the timeline architecture shall be ready for `I(t)`.

IEEE C37.112 describes inverse-time behavior using accumulated operating quantity for varying current. The simulator adopts the following normalized progress model for inverse-time 51:

```text
                 dt
Q(t) = integral -------
                T(I(t))
```

When:

```text
Q >= 1 → 51 trip output
```

V1 reset policy:

```text
if I(t) <= I_pickup:
    Q = 0
```

For definite time:

```text
Q_DT = cumulative time continuously above pickup / definiteDelay
```

and reset to zero as soon as current falls to/below pickup.

### 14.1 Implementation requirement

- integration uses **engineering simulation time**, not browser animation-frame time;
- playback speed may change wall-clock time but never the integrated engineering time;
- numerical integration for future varying profiles must be deterministic and convergence-tested;
- trip-time error caused by numerical integration must be <= 0.1% against a sufficiently refined reference for approved test profiles.

For constant-current V1 cases, use the analytic operating time rather than approximating it frame-by-frame.

---

## 15. Breaker-clearing semantics

Relay trip output and fault interruption are separate events.

For device `D`:

```text
relayTripTime(D) = time relay issues trip output
breakerOpenTime(D) = relayTripTime(D) + breakerClearingTime(D)
```

Canonical educational breaker-clearing default:

```text
breakerClearingTime = 0.10 s
```

Validation domain:

```text
breakerClearingTime >= 0 and finite
```

`0 s` is permitted as an idealized study case with no additional breaker-clearing interval. Negative or non-finite clearing time is invalid. This O04 clarification adds input hardening only; it does not change the relay-trip/breaker-open semantics above.

This is a study setting, not a universal breaker value.

### 15.1 Current persistence

Fault current persists after relay trip output until a breaker that isolates the active fault reaches `OPEN`.

Therefore backup relays continue timing during the primary breaker's clearing interval.

### 15.2 Multiple trip commands

If a backup relay reaches its trip output before the fault is isolated, its trip command is recorded and its breaker-opening event is scheduled even if another breaker later clears the fault first.

This enables the simulator to distinguish:

- selective primary clearing;
- backup operation before isolation;
- multiple-trip / loss-of-selectivity sequences.

### 15.3 Post-fault current

Post-isolation currents come from explicit study metadata. The simple radial learning presets use zero current in the isolated branch unless a preset explicitly supplies another post-fault profile.

No network current redistribution is invented by the timeline engine.

---

## 16. Fault / current study-data convention

The Study Engine is **not** a short-circuit solver.

A `FaultCase` supplies configured data:

```text
fault location ID
study label
current category = MIN | NOMINAL | MAX | CUSTOM
primary current seen by each relevant device
primary / backup chain
optional external clear time
optional post-fault current profile
```

For simple series radial presets, all upstream relays may receive the same through-fault primary current.

The data model shall nevertheless allow per-device currents so future studies can represent different measured currents without inventing a network solver.

### 16.1 Fault-location scrubber

If a topology supports a scrubber, the preset supplies an explicit profile or profile samples.

Interpolation:

- is presentation/study interpolation only;
- must be deterministic;
- must be identified as preset study data;
- must not be described as impedance-based fault calculation.

### 16.2 Authoritative validation cases

`RUN COORDINATION TEST` evaluates the preset's explicit `validationCases` as authoritative study points.

A continuous profile scan may additionally generate an envelope/worst-case indication, but it does not replace the configured validation-case registry.

---

## 17. Primary / backup relationship

Primary/backup roles come from topology/study metadata, never from names such as R1/R2/R3.

Example:

```text
F3:
  primary  = R3
  backup 1 = R2
  backup 2 = R1
```

For a coordination pair `(P,B)`, both devices are evaluated independently using their own:

- CT;
- pickup;
- curve;
- time scale;
- 50 setting;
- primary current from the study case.

---

## 18. CTI definition

For a primary relay `P` and backup relay `B`:

```text
Observed CTI = t_trip(B) - t_trip(P)
```

Times are **relay trip-output times**, not breaker-open times.

This convention makes the required target capable of explicitly budgeting the primary breaker-clearing allowance and other timing allowances.

### 18.1 CTI target budget

```text
Required CTI = Breaker Allowance
             + Relay / Timing Allowance
             + Study Safety Allowance
```

Canonical guided-study default:

```text
Breaker allowance       0.10 s
Relay/timing allowance  0.05 s
Study safety allowance  0.15 s
--------------------------------
Required CTI             0.30 s
```

These are **educational preset values, not universal requirements**. SEL coordination guidance notes that required CTI is application-specific and commonly chosen within a range that accounts for breaker interrupting time, relay tolerances, and setting errors.

### 18.2 Pass boundary

```text
PASS if Observed CTI >= Required CTI
```

Equality is PASS.

Use a scale-aware time comparison tolerance:

```text
EPS_time = 1e-9 × max(1, |Observed|, |Required|)
```

So values within floating-point noise of equality are treated as equal.

### 18.3 CTI not evaluable cases

- primary does not pick / has no trip time -> `PRIMARY_NOT_SENSITIVE`;
- required backup does not pick / has no trip time -> `BACKUP_NOT_AVAILABLE`;
- invalid relay/study data -> `INVALID`.

These states are not silently counted as PASS.

---

## 19. Coordination audit semantics

### 19.1 Sensitivity

For each intended primary relay at the configured **minimum-fault** case:

```text
PASS if 51 pickup is true
```

Exact equality with pickup is FAIL because the relay does not pick up.

Required backup devices shall also have fault coverage for cases where the study expects backup protection; otherwise report `BACKUP_NOT_AVAILABLE`.

### 19.2 Load security

At configured maximum load:

```text
PASS if I_relay_load < I_pickup
```

Equality is treated as **FAIL / zero security margin** for the coordination audit, even though the relay pickup logic itself uses strict `>`.

If 50 is enabled, maximum load must also remain below `I_inst`.

### 19.3 Selectivity

For a valid fault case:

```text
primary trip output must occur before every required upstream backup trip output
```

This is the basic ordering check.

### 19.4 Time grading

For each required primary-backup pair:

```text
Observed CTI >= Required CTI
```

This is stronger than simple selectivity.

### 19.5 Instantaneous reach

An upstream backup 50 element is considered an overreach violation for a downstream study fault when it is eligible to trip for that downstream fault, unless the specific study metadata explicitly permits that behavior.

Default radial guided-study policy:

```text
backup 50 pickup on downstream protected fault → FAIL
```

### 19.6 Speed

Speed is informational unless the study defines:

```text
maxPrimaryClearingTimeSec
```

If a maximum is configured:

```text
primary relay trip time + primary breaker clearing time <= configured maximum
```

---

## 20. 50 / 51 coordination edge cases

### Case A — primary 51, backup 51

Evaluate normal CTI.

### Case B — primary 50, backup 51

```text
t_primary = 0
Observed CTI = t_backup
```

PASS/FAIL still uses configured target.

### Case C — backup 50 operates for downstream fault

```text
t_backup = 0
```

This normally yields non-positive CTI and also triggers `INSTANTANEOUS_OVERREACH`.

### Case D — both primary and backup 50 operate

```text
Observed CTI = 0
```

With a positive CTI requirement this fails time grading. The timeline may subsequently show both trip outputs at the same engineering instant.

---

## 21. Coordination corridor and envelope mathematics

### 21.1 Corridor

For a primary-backup pair at a common primary-current study coordinate where both relay times are finite:

```text
minimumBackupTime(I) = primaryTripTime(I) + RequiredCTI
```

The backup curve is coordinated at that coordinate only when:

```text
backupTripTime(I) >= minimumBackupTime(I)
```

If device currents differ by study mapping, the corridor is generated from the study profile mapping rather than by pretending both relays see the same current.

### 21.2 Envelope

The Coordination Engine evaluates:

- all explicit validation cases;
- optional profile scan points supplied/derived from study metadata.

For each point it stores:

```text
primary time
backup time
observed CTI
required CTI
margin = observed - required
PASS / FAIL
50 reach status
```

### 21.3 Worst case

Worst case is the valid evaluated point with minimum:

```text
coordinationMargin = ObservedCTI - RequiredCTI
```

Ties are resolved deterministically by study-order / position order.

The UI must call this a **study-profile / configured-case worst point**, not a mathematically proven network-wide worst fault unless a future network solver exists.

---

## 22. Timeline state machine

Canonical engineering states:

```text
IDLE / NORMAL
   ↓ fault applied
FAULT ACTIVE
   ↓ element threshold exceeded
PICKUP / TIMING
   ↓ operate condition reached
TRIP OUTPUT
   ↓ breaker clearing interval
BREAKER OPEN
   ↓ topology says fault isolated
FAULT ISOLATED
   ↓ reset/reinitialize
NORMAL
```

### 22.1 Relay-specific state

Each relay may independently be:

```text
BELOW_PICKUP
51_TIMING
50_TRIPPED
51_TRIPPED
BREAKER_OPENING
BREAKER_OPEN
RESET
INVALID
```

### 22.2 Event ordering

Events at the same engineering timestamp use deterministic ordering:

1. current-profile change / fault application;
2. pickup calculation;
3. 50 operation;
4. 51 timer completion;
5. trip output event creation;
6. breaker-open event processing;
7. fault-isolation consequence / current-profile transition;
8. timer reset consequences.

### 22.3 Fault clears before trip

If an external fault-clear event occurs before relay trip:

- current changes to configured post-fault current;
- 51 timing resets immediately if below pickup;
- no trip is issued.

### 22.4 Backup timer stop point

Backup timing does **not** stop when the primary relay merely issues its trip output. Backup timing stops/resets only when the study current falls below pickup, typically after the fault is isolated at breaker open.

This distinction is required for educational CTI/breaker-clearing behavior.

---

## 23. Simulation speed

Supported initial playback controls:

```text
1× | 5× | 10×
```

Relationship:

```text
wallClockDelta = engineeringDelta / playbackSpeed
```

All user-visible engineering timestamps remain in real simulation seconds.

Changing playback speed:

- must not change calculated operating time;
- must not change CTI;
- must not change event ordering;
- must not alter breaker-clearing engineering time.

---

## 24. Input locking during a running experiment

Once a timed fault run starts, settings that would invalidate deterministic playback are locked:

- CT settings;
- 51 pickup;
- timing family / curve;
- TMS / Time Dial;
- definite delay;
- 50 enable/high-set;
- selected study case current.

User may still:

- change playback speed;
- inspect graph/tooltips;
- collapse/show UI sections;
- clear the fault when the study permits;
- Reset.

Changing relay settings during the run is deliberately deferred until a future varying-setting study is specified.

---

## 25. TCC equation / engine parity

The graph is a presentation of engine functions, not a second calculator.

Mandatory rule:

```text
TCC sampled point = output of the same approved 51 characteristic function
```

### 25.1 Inverse curve domain

- no inverse curve value is emitted at `M <= 1`;
- pickup boundary is rendered separately;
- no Infinity / NaN coordinates enter SVG/canvas.

### 25.2 50 representation

50 is represented as a high-set boundary / instantaneous region at the equivalent graph current.

### 25.3 Operating points

For each device, the operating point must use exactly the same measured current and operating time returned by the static engine.

### 25.4 Log axis

TCC time/current axes may be logarithmic. Log-space conversion is presentation-only and never changes engineering results.

---

## 26. Numerical validity and non-throwing requirement

The hardening lessons from Differential R07+ are mandatory.

### 26.1 Inputs

Reject safely:

- NaN;
- Infinity;
- negative current magnitudes;
- zero/negative CT ratings;
- CT error factor <= 0;
- zero/negative pickup;
- zero/negative time scale;
- invalid definite delay;
- negative/non-finite breaker clearing time;
- zero/negative 50 threshold when 50 enabled;
- invalid study current profile;
- invalid CTI budget components.

### 26.2 Derived arithmetic

Every calculation boundary checks finite results.

No numeric input may cause an uncaught exception in React/rendering.

### 26.3 Invalid output state

Recommended safe-evaluation result:

```text
VALID(result)
INVALID(reason, lastValidResult?)
```

While editing an invalid field, UI may retain last-valid engineering values, but status must be explicit:

```text
INPUT INVALID
OUTPUT HELD
```

Apply Fault / Run Coordination Test is disabled while invalid.

### 26.4 Very large finite values

Do not rely only on `Number.isFinite(input)`. Derived values must also be finite.

If the theoretical result is beyond representable numerical range, return a structured numerical-range error, not Infinity.

---

## 27. Canonical base device settings

Unless a scenario overrides them:

```text
CT primary rated       1000 A
CT secondary rated     1 A
CT ratio error          0 %

51 pickup               0.80 A sec
51 timing mode          INVERSE
51 curve                IEC Standard Inverse
51 TMS                   0.10
51 definite delay       0.50 s (stored but inactive)

50 enabled              false
50 pickup               3.00 A sec

breaker clearing        0.10 s
```

These are simulator defaults for education, not universal recommended protection settings.

---

## 28. Canonical Single Relay presets

All presets use the base CT `1000/1` unless stated otherwise.

### OVC-01 — Normal Load

```text
Primary current         600 A
51 pickup               0.80 A sec
Curve                   IEC SI
TMS                     0.10
50                      OFF
Expected                NO PICKUP
```

Derived:

```text
I_relay = 0.600 A sec
M = 0.75
```

### OVC-02 — Near Pickup

```text
Primary current         808 A
51 pickup               0.80 A sec
Curve                   IEC SI
TMS                     0.10
50                      OFF
Expected                51 pickup, very long operate time
```

Derived:

```text
I_relay = 0.808 A sec
M = 1.01
T51 ≈ 70.3424198 s
```

### OVC-03 — Moderate Overcurrent

```text
Primary current         1600 A
51 pickup               0.80 A sec
Curve                   IEC SI
TMS                     0.10
Expected                51 timed operation
```

Derived:

```text
I_relay = 1.600 A sec
M = 2
T51 ≈ 1.002902702 s
```

### OVC-04 — High Fault Current

```text
Primary current         4000 A
51 pickup               0.80 A sec
Curve                   IEC SI
TMS                     0.10
50                      OFF
Expected                faster 51 operation
```

Derived:

```text
I_relay = 4.000 A sec
M = 5
T51 ≈ 0.427972007 s
```

### OVC-05 — Instantaneous Fault

```text
Primary current         4000 A
51                      same as OVC-04
50                      ON
I_inst                  3.00 A sec
Expected                active element = 50, trip time = 0
```

51 reference time remains visible.

### OVC-06 — Definite Time

```text
Primary current         1600 A
51 pickup               0.80 A sec
Timing                  DEFINITE
Delay                   0.50 s
Expected                trip at 0.50 s
```

### OVC-07 — Fault Clears Before Trip

```text
Fault current           1600 A
51                      IEC SI, TMS 0.10, pickup 0.80 A
External clear time     0.40 s
Theoretical T51         ≈ 1.002902702 s
Expected                pickup/timing, then reset, NO TRIP
```

### OVC-08 — CT Measurement Error

```text
Primary current         780 A
CT                      1000/1
CT ratio error          +5 %
51 pickup               0.80 A sec
Curve                   IEC SI
TMS                     0.10
```

Derived:

```text
Ideal secondary         0.780 A
Measured relay current  0.819 A
M                       1.02375
T51                     ≈ 29.81531555 s
```

Educational comparison:

```text
without +5% error → 0.780 A < pickup → no pickup
with +5% error    → 0.819 A > pickup → pickup
```

---

## 29. Canonical radial coordination study

### 29.1 Topology

```text
SOURCE ─ R1 ───── R2 ───── R3 ───── LOAD
          │         │         │
         F1        F2        F3
```

Roles:

```text
F1: R1 primary
F2: R2 primary, R1 backup
F3: R3 primary, R2 backup 1, R1 backup 2
```

### 29.2 Base CT and load

```text
R1/R2/R3 CT           1000/1, 0% error
maximum load          600 A through current
```

### 29.3 Initial relay settings — intentional grading issue

All use `IEC Very Inverse`:

| Relay | Role | Pickup | TMS | 50 |
|---|---|---:|---:|---|
| R1 | Upstream | 1.20 A sec | 0.35 | OFF |
| R2 | Middle | 1.00 A sec | 0.18 | OFF |
| R3 | Downstream | 0.80 A sec | 0.10 | OFF |

Coordination target:

```text
Required CTI = 0.30 s
```

### 29.4 Study currents

```text
F1: MIN 6000 A, NOMINAL 8000 A, MAX 10000 A
F2: MIN 4000 A, NOMINAL 6000 A, MAX 8000 A
F3: MIN 2500 A, NOMINAL 4000 A, MAX 6000 A
```

These are configured educational study currents, not network-calculated values.

### 29.5 Intentional F3 worst point

At F3 MAX = `6000 A`:

```text
R3:
  Irelay = 6 A
  M = 7.5
  t ≈ 0.207692308 s

R2:
  Irelay = 6 A
  M = 6
  t = 0.486000000 s

Observed CTI R3→R2
  = 0.486000000 - 0.207692308
  ≈ 0.278307692 s

Required CTI = 0.300000000 s
Margin       ≈ -0.021692308 s
Result       = FAIL
```

R2→R1 remains coordinated at this point.

This preset intentionally teaches that curves may look broadly separated yet still miss the configured CTI at the high-current end.

### 29.6 Example corrected R2 timing

If the user changes only:

```text
R2 TMS 0.18 → 0.19
```

At F3 MAX:

```text
R2 t ≈ 0.513000000 s
Observed CTI ≈ 0.305307692 s
Result = PASS
```

This is a reference test vector, **not** a UI hint that automatically supplies the answer.

---

## 30. Instantaneous-coordination challenge vector

Starting from a coordinated 51 study, enable R2 50:

```text
R2 I_inst = 5.00 A sec
F3 MAX primary current = 6000 A
R2 CT = 1000/1
```

Derived:

```text
R2 Irelay = 6.00 A sec
6.00 > 5.00 → R2 50 eligible
```

For F3, R2 is backup, therefore default radial policy reports:

```text
INSTANTANEOUS_OVERREACH = FAIL
```

A corrected threshold must be above the relevant downstream-fault current seen by R2 or the 50 element must be disabled, subject to the user's study objective.

---

## 31. Reference inverse-curve test vectors

All rows use:

```text
S = 0.10
```

Expected theoretical seconds:

| Curve | M=2 | M=5 | M=10 |
|---|---:|---:|---:|
| IEC Standard Inverse | 1.002902702 | 0.427972007 | 0.297059862 |
| IEC Very Inverse | 1.350000000 | 0.337500000 | 0.150000000 |
| IEC Extremely Inverse | 2.666666667 | 0.333333333 | 0.080808081 |
| IEEE Moderately Inverse | 0.380324923 | 0.168832560 | 0.120675592 |
| IEEE Very Inverse | 0.702766667 | 0.130808333 | 0.068908081 |
| IEEE Extremely Inverse | 0.952170000 | 0.129670000 | 0.040654848 |

Recommended test tolerance for these deterministic vectors:

```text
absolute <= 1e-9 s OR relative <= 1e-9
```

---

## 32. Boundary test vectors

### 32.1 51 equality

```text
Irelay = 1.000000 A
Ipickup = 1.000000 A
Expected: pickup51 = false, t51 = null
```

### 32.2 51 above threshold

```text
Irelay = 1.010000 A
Ipickup = 1.000000 A
Expected: pickup51 = true
```

### 32.3 50 equality

```text
50 enabled = true
Irelay = 5.000000 A
Iinst = 5.000000 A
Expected: pickup50 = false
```

### 32.4 50 above threshold

```text
Irelay = 5.010000 A
Iinst = 5.000000 A
Expected: pickup50 = true, t50 = 0
```

### 32.5 CT error

```text
Iprimary = 4000 A
CT = 1000/1
error = +2%
Expected ideal = 4.000 A sec
Expected measured = 4.080 A sec
```

### 32.6 Definite-time magnitude independence

```text
pickup = 1 A
DT = 0.5 s
Irelay = 2 A → t = 0.5 s
Irelay = 8 A → t = 0.5 s
```

### 32.7 Reset before trip

```text
T51 = 1.0 s
fault above pickup from 0.0 to 0.4 s
current <= pickup after 0.4 s
Expected: no trip; progress reset to 0
```

---

## 33. Coordination / timeline parity vectors

### 33.1 Coordinated pair

```text
Primary trip output   0.20 s
Backup trip output    0.55 s
Required CTI          0.30 s
Observed CTI          0.35 s
Expected              PASS
```

### 33.2 Equality

```text
Primary               0.20 s
Backup                0.50 s
Required CTI          0.30 s
Expected              PASS
```

### 33.3 Miscoordination

```text
Primary               0.40 s
Backup                0.30 s
Observed CTI         -0.10 s
Expected              FAIL / backup earlier
```

### 33.4 Breaker-clearing sequence

```text
Primary relay trip    0.30 s
Primary breaker time  0.10 s
Fault isolated        0.40 s
Backup relay trip     0.55 s
Expected: backup timer stops/resets at 0.40 s, no backup trip output
```

### 33.5 Multiple trip before clearing

```text
Primary relay trip    0.30 s
Primary breaker open  0.45 s
Backup relay trip     0.40 s
Expected:
- primary trip output recorded
- backup trip output recorded
- coordination violation
- backup breaker opening scheduled
```

---

## 34. Guided-study hint contract

The engine / analysis layer may identify:

```text
violation location
violation pair
violation category
parameter family involved
recommended direction of change
```

It must **not** compute or reveal an automatic optimal setting as part of V1.

Three hint levels remain:

1. Location — where the problem is.
2. Parameter family — pickup/time/curve/50.
3. Direction — upstream slower, pickup higher/lower, etc.

Exact setting remains the user's learning task.

---

## 35. Parameter-impact semantics

The presentation layer may derive explanation metadata from the engine dependency graph.

Examples:

### TMS / Time Dial change

Affects:

- 51 operating time;
- coordination CTI;
- timeline trip time.

Does not directly affect:

- CT measured current;
- pickup threshold;
- 50 threshold.

### 51 pickup change

Affects:

- pickup boundary;
- current multiple;
- inverse operate time;
- load security;
- sensitivity;
- coordination.

### CT ratio/error change

Affects:

- relay current;
- 51 pickup status;
- current multiple;
- 51 operate time;
- 50 eligibility;
- coordination.

No separate UI formula is allowed.

---

## 36. Engine API behavioral contract

Exact TypeScript names are O02 implementation details, but the pure functions shall conceptually separate:

```text
evaluateMeasurement(primaryCurrent, ct)
evaluate51(relayCurrent, settings51)
evaluate50(relayCurrent, settings50)
evaluateOvercurrentDevice(primaryCurrent, deviceSettings)
evaluateCoordinationPair(primaryResult, backupResult, requirement)
evaluateStudyCase(topology, case, settings)
evaluateTimeline(runDefinition)
```

All functions:

- deterministic;
- side-effect free except timeline state reducer/event generator as explicitly designed;
- UI-independent;
- finite-safe;
- unit-testable.

---

## 37. Presentation behavior locked by engineering semantics

### Status vocabulary

Static / Explore:

```text
BELOW PICKUP
51 PICKUP
50 PICKUP / INSTANTANEOUS
```

Running:

```text
NORMAL
PICKUP
51 TIMING
50 TRIP
51 TRIP
BREAKER OPENING
FAULT ISOLATED
INPUT INVALID / HELD
```

Coordination:

```text
COORDINATED
COORDINATION INCOMPLETE
TIME-GRADING VIOLATION
INSTANTANEOUS OVERREACH
SENSITIVITY RISK
LOAD SECURITY FAIL
BACKUP NOT AVAILABLE
```

### Semantic colors

The Differential R10 grammar remains authoritative:

- cyan = interaction / selection;
- green = healthy / coordinated / cleared as intended;
- amber = pickup / timing / warning / invalid edit;
- red = trip / coordination failure / overreach;
- neutral gray = inactive / reference.

Relay identity curves must not rely only on semantic red/green.

---

## 38. O01 release acceptance checklist

O01 is ready for approval only if all are explicitly defined:

- [x] current domain and units;
- [x] CT ratio/error convention;
- [x] six inverse curve equations/constants;
- [x] definite-time behavior;
- [x] 51 equality boundary;
- [x] 50 equality boundary;
- [x] 50/51 arbitration;
- [x] TMS/Time Dial parameterization and supported range;
- [x] near-pickup numerical treatment;
- [x] immediate-reset V1 behavior;
- [x] varying-current integral contract;
- [x] breaker-clearing semantics;
- [x] CTI formula and pass equality;
- [x] CTI budget model;
- [x] sensitivity/load-security/selectivity semantics;
- [x] instantaneous overreach semantics;
- [x] configured fault-study convention;
- [x] numerical overflow / safe-invalid behavior;
- [x] canonical presets;
- [x] reference curve vectors;
- [x] coordination/timeline vectors;
- [x] limitations / non-goals;
- [x] equation-to-graph parity requirement.

---

## 39. Approval consequence

Once this O01 specification is approved:

1. freeze the engineering behavior as `overcurrent-o01-v1`;
2. proceed to **O02 — Domain Types & Data Model**;
3. then O03 Measurement + 50/51 Pure Engine;
4. production graph/timeline UI may only consume approved engine outputs;
5. any future change to formula, boundary, reset, CTI semantics, or current domain requires an explicit Engineering Specification revision.

Until approval, production engine coding remains blocked by project policy.

---

## 40. Final engineering statement

The initial Overcurrent module is intentionally a **standardized educational 50/51 study model**:

- theoretical standardized inverse curves;
- explicit definite time;
- explicit instantaneous high-set;
- transparent CT measurement;
- configured radial study currents;
- explicit primary/backup CTI;
- deterministic relay/breaker timeline;
- no hidden network solver;
- no hidden vendor behavior.

The primary objective is traceability: every number visible in TCC, SLD, Operating Sequence, and Analysis must be explainable from this specification and reproducible by unit tests.
