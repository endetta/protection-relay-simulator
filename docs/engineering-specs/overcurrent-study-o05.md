# Overcurrent O05 — Study Engine & Preset Registry

**Module:** Overcurrent Relay 50/51 Protection & Coordination Laboratory  
**Phase:** O05  
**Status:** IMPLEMENTED / VERIFIED  
**Date:** 2026-08-13  
**Parent:** O01 Engineering Specification (approved), O02 Domain Model, O03 Pure Engine, O04 Numerical Hardening

---

## 1. Purpose

O05 builds the immutable study-data layer around the hardened 50/51 engine. It defines what system is being studied, which current data is supplied to each relay, which relay is primary/backup, which fault/load cases are authoritative validation points, and which preset should initialize the simulator.

O05 deliberately **does not** calculate relay operating time, CTI, coordination pass/fail, timeline playback, TCC geometry, or React UI. Those remain O06 onward responsibilities.

The O05 rule is:

```text
Configured Study Data
        ↓
Study Engine / Registry
        ↓
Pure 50/51 Engine (O03/O04)
        ↓
Future Coordination / Timeline / Presentation
```

There is no hidden impedance or short-circuit solver.

---

## 2. Production files

```text
src/types/overcurrent.ts
src/studies/overcurrentStudy.ts
src/studies/overcurrentPresets.ts
src/studies/overcurrentStudy.test.ts
src/studies/overcurrentPresets.test.ts
```

O03/O04 engine files are consumed but not mathematically changed.

---

## 3. O05 responsibilities

The Study Engine owns:

- immutable preset registry;
- topology/device/reference validation;
- load cases;
- fault cases;
- MIN/NOMINAL/MAX study points;
- explicit per-device primary current maps;
- static and sampled current-profile resolution;
- primary/backup-chain metadata;
- coordination-pair/requirement references;
- fault-location interpolation from configured samples;
- fault-location protection-zone metadata;
- preset initialization into `OvercurrentSimulatorState`;
- guided-study objective/hint metadata.

It does **not** own:

- 50/51 operating equations;
- CT measurement equations;
- CTI calculation;
- coordination audit;
- worst-case scan;
- timer accumulation;
- breaker timeline state machine;
- TCC rendering;
- SLD rendering;
- UI state widgets.

---

## 4. O05 domain refinements

Integration of real preset data exposed two O02 omissions. These are semantic data-model refinements, not changes to O01 relay physics.

### 4.1 Explicit load cases

O02 modeled fault current but had no first-class maximum-load/reference-current record even though load security is a core PRD requirement.

O05 adds:

```text
LoadCaseId
LoadCurrentCategory
StudyCurrentDefinition
LoadCase
loadCases[]
loadSecurityCaseIds[]
defaultLoadCaseId
activeLoadCaseId
```

This prevents maximum load from being hidden in UI defaults or misrepresented as a fault.

### 4.2 Generic study-current definition

The current source contract is generalized to:

```text
StudyCurrentDefinition
├─ STATIC  → per-device primary-current map
└─ PROFILE → CurrentProfile reference
```

`FaultCurrentDefinition` remains a semantic alias so existing fault-domain terminology remains clear.

### 4.3 Fault-location protection segments

Current interpolation alone cannot tell the future coordination engine when a dragged fault crosses from one protection zone to another.

O05 therefore adds optional configured profile segments:

```text
FaultLocationProfileSegment
├─ startPosition
├─ endPosition
├─ locationId
└─ protectionChain
```

The current magnitude remains linearly interpolated from configured samples. Primary/backup role changes come from explicit configured segments, **not** from current magnitude, relay names, impedance, or inferred topology physics.

---

## 5. Validation contract

`validateOvercurrentStudyDefinition()` is the safe structural boundary.

A study is invalid when any of the following is true:

- duplicate topology device IDs;
- missing device referenced by topology;
- device record key does not match `device.id`;
- invalid topology kind/device count;
- duplicate location IDs;
- invalid normalized positions;
- missing per-device current value;
- negative/non-finite study current;
- current map references a device outside the topology;
- duplicate current/fault-location profile IDs;
- empty or non-monotonic current profile;
- invalid fault-location sample order/range;
- invalid or non-contiguous configured fault-location segments;
- missing fault location;
- invalid primary/backup chain;
- backup chain moving downstream instead of upstream;
- duplicate fault/load case IDs;
- missing referenced current/post-fault profile;
- negative/non-finite external clear time;
- duplicate/invalid coordination pair;
- coordination pair does not map to an adjacent tier of an explicit protection chain;
- duplicate requirement per pair;
- negative/non-finite required CTI;
- CTI budget does not reconcile to authoritative required CTI;
- invalid validation-case reference;
- invalid load-security-case reference;
- invalid default selection reference;
- invalid guided-hint reference.

Invalid study data returns `DomainEvaluation.INVALID`. It is not silently repaired.

---

## 6. Radial backup-chain rule

Topology device order is upstream → downstream.

Example:

```text
R1 → R2 → R3
```

For F3:

```text
ProtectionChain
primary = R3
backups = [R2, R1]
```

Coordination pairs represent **adjacent timing tiers**:

```text
backupOrder 1: R3 → R2
backupOrder 2: R2 → R1
```

This is important: the second pair at F3 is `R2 → R1`, even though R2 is backup-1 of the physical fault. O06 will calculate sequential grading margins from these explicit adjacent-tier pairs.

No pair is inferred from names such as `R1`, `R2`, or `R3`.

---

## 7. Static study-current rule

Every configured static current case must provide one primary-current value for **every topology device**.

Example F2 in a three-relay radial feeder:

```text
R1 = 6000 A   upstream, sees through-fault current
R2 = 6000 A   primary, sees fault current
R3 = 0 A      downstream of the fault, no through-fault current in this preset
```

There are no missing-key defaults.

---

## 8. Current-profile resolution

O05 supports deterministic `STEP` and `LINEAR` profile lookup.

### STEP

Between two samples, use the left/latest sample.

O07 integration refinement: at an exact configured sample timestamp, that new
sample applies. STEP lookup is therefore right-continuous at the boundary while
remaining constant between boundaries.

### LINEAR

For samples `(t0, I0)` and `(t1, I1)`:

```text
r = (t - t0) / (t1 - t0)
I(t) = I0 + r × (I1 - I0)
```

Per-device values are interpolated independently.

Boundary behavior:

- time before/at first sample → first sample;
- time after/at final sample → final sample;
- negative/non-finite engineering time → INVALID.

O07 will consume the same profile contract for deterministic timing integration.

---

## 9. Fault-location scrubber resolution

`resolveFaultLocationStudy()` accepts a configured profile and normalized position.

Outputs:

```text
normalizedPosition
primaryCurrentAByDevice
locationId              (when segments are configured)
protectionChain         (when segments are configured)
```

Rules:

- interpolation only inside configured sample range;
- no extrapolation beyond configured study data;
- primary currents use linear interpolation;
- protection role uses configured segment metadata;
- boundary selection is deterministic;
- UI must label this as configured study interpolation.

It must never be described as a network fault calculation.

---

## 10. Preset initialization

`initializeOvercurrentSimulatorState()` validates the definition first.

State is then initialized only from explicit study metadata:

```text
studyMode              ← preset.mode
guidanceMode           ← preset.guidance
studyPresetId          ← preset.id
topology               ← preset.topology
selectedDeviceId       ← explicit default or first topology device
activeLoadCaseId       ← explicit default or first load case
activeFaultCaseId      ← explicit default or null
simulationSpeed        ← 1×
playbackState          ← IDLE
devicesById            ← preset devices
coordinationRequirements ← preset requirements
initialSnapshot        ← immutable initial settings snapshot
comparisonSnapshot     ← null
validationState        ← IDLE
```

No hidden load/fault current is invented at initialization.

---

## 11. Production preset registry

O05 production registry contains 11 study definitions.

### Single Relay

| ID | Label | O01 intent |
|---|---|---|
| OVC-01 | Normal Load | no pickup |
| OVC-02 | Near Pickup | very long 51 timing |
| OVC-03 | Moderate Overcurrent | normal inverse timing |
| OVC-04 | High Fault Current | faster inverse timing |
| OVC-05 | Instantaneous Fault | 50 priority |
| OVC-06 | Definite Time | fixed delay |
| OVC-07 | Fault Clears Before Trip | timing then reset/no trip |
| OVC-08 | CT Measurement Error | +5% CT error crosses pickup |

All preserve the O01 `1000/1` base CT unless explicitly changed.

### Coordination

| ID | Label | Purpose |
|---|---|---|
| COORD-01 | Two Relay Time Grading | simple intentional primary/backup grading failure |
| COORD-02 | Three Relay Radial | canonical O01 R3 → R2 → R1 study |
| COORD-05 | Instantaneous Coordination | O01 §30 upstream-50 overreach challenge seed |

`COORD-03`, `COORD-04`, and `COORD-06` remain reserved for O13 Guided Challenges because their exact acceptance/hint workflow depends on the completed O06 coordination audit. They are not placeholder presets in O05.

---

## 12. COORD-01 — Two Relay Time Grading

Topology:

```text
SOURCE ─ R1 ───── R2 ───── LOAD
          │         │
         F1        F2
```

Initial settings:

| Relay | Pickup | Curve | TMS | 50 |
|---|---:|---|---:|---|
| R1 upstream | 1.00 A sec | IEC VI | 0.18 | OFF |
| R2 downstream | 0.80 A sec | IEC VI | 0.10 | OFF |

Load-security case:

```text
MAX LOAD = 600 A through R1/R2
```

Configured fault study currents:

```text
F1: MIN 6000, NOM 8000, MAX 10000 A
F2: MIN 2500, NOM 4000, MAX 6000 A
```

For F1, R2 is downstream of the fault and receives configured study current `0 A`.

For F2 MAX:

```text
R2 ≈ 0.207692308 s
R1 = 0.486000000 s
Observed CTI ≈ 0.278307692 s
Target CTI = 0.300000000 s
```

Therefore the initial guided state is intentionally miscoordinated.

This is an educational O05 preset value, not a universal recommended setting.

---

## 13. COORD-02 — Three Relay Radial

This preset directly implements O01 §29.

Topology:

```text
SOURCE ─ R1 ───── R2 ───── R3 ───── LOAD
          │         │         │
         F1        F2        F3
```

Initial settings:

| Relay | Pickup | IEC VI TMS |
|---|---:|---:|
| R1 | 1.20 A sec | 0.35 |
| R2 | 1.00 A sec | 0.18 |
| R3 | 0.80 A sec | 0.10 |

Configured currents:

```text
F1: MIN 6000 / NOM 8000 / MAX 10000 A
F2: MIN 4000 / NOM 6000 / MAX 8000 A
F3: MIN 2500 / NOM 4000 / MAX 6000 A
```

At each fault, downstream devices beyond the fault receive explicit `0 A` study current.

Canonical F3 MAX vector remains:

```text
R3 trip ≈ 0.207692308 s
R2 trip = 0.486000000 s
R3→R2 CTI ≈ 0.278307692 s
```

The O01 intentional grading defect is therefore preserved exactly.

---

## 14. COORD-05 — Instantaneous Coordination

This data preset implements O01 §30.

Starting point:

```text
R2 51 TMS = 0.19
R2 50 = ENABLED
R2 I>> = 5.00 A sec
F3 MAX = 6000 A primary
CT = 1000/1
```

Derived by O03 engine:

```text
R2 relay current = 6.00 A sec
6.00 > 5.00
selected element = 50
```

O06 will classify this as an upstream instantaneous-overreach violation for the downstream F3 fault.

---

## 15. Validation-case registry

Coordination presets explicitly identify authoritative cases for future `RUN COORDINATION TEST`.

Default coordination validation uses MIN and MAX cases:

```text
F1 MIN / MAX
F2 MIN / MAX
F3 MIN / MAX   (where topology contains F3)
```

NOMINAL cases remain available for interactive study but are not required to duplicate MIN/MAX validation coverage.

A future continuous scrubber/envelope scan is supplementary; it never replaces `validationCaseIds`.

---

## 16. Load-security registry

Load security is also explicit:

```text
loadCases[]
loadSecurityCaseIds[]
```

Canonical coordination presets use:

```text
Maximum Load = 600 A through all in-service series devices
```

O06 will evaluate this current against 51/50 pickup settings.

---

## 17. Guided metadata

O05 stores only structured educational metadata:

```text
objective
hint 1 = LOCATION
hint 2 = PARAMETER_FAMILY
hint 3 = DIRECTION
completion notes
```

Hints never contain the exact corrected setting value.

For example COORD-02 may say:

```text
Inspect R3 → R2 at F3 MAX.
The problem is time grading.
R2 should operate later relative to R3.
```

It must not say:

```text
Set R2 TMS = 0.19.
```

The O01 corrected value remains a test/reference vector, not an automatic solution.

---

## 18. Registry API

Production exports:

```text
OVERCURRENT_STUDY_PRESETS
OVERCURRENT_STUDY_PRESET_REGISTRY
getOvercurrentStudyPreset(id)
listOvercurrentStudyPresets()
validateOvercurrentPresetRegistry()
```

Study API includes:

```text
validateOvercurrentStudyDefinition()
resolveCurrentProfileAtTime()
resolveFaultCaseCurrents()
resolveLoadCaseCurrents()
resolveFaultLocationStudy()
getStudyDevice()
getFaultCase()
getLoadCase()
getCoordinationPairsForLocation()
getCoordinationRequirementForPair()
initializeOvercurrentSimulatorState()
```

---

## 19. O05 verification

Permanent source tests cover:

- registry validity;
- exact preset IDs;
- O01 OVC numeric parity;
- O01 COORD-02 F3 MAX parity;
- COORD-01 intentional initial CTI deficit;
- COORD-05 50 overreach seed;
- static fault/load resolution;
- STEP/LINEAR profile resolution;
- fault-location interpolation;
- protection-zone transition metadata;
- explicit initialization defaults;
- invalid CTI budget;
- missing current-map values;
- invalid radial backup direction.

Dependency-independent runtime regression additionally checks:

- every configured load/fault current safely evaluates every topology relay;
- dense scrubber interpolation;
- 100,000 deterministic LINEAR profile points;
- generic four-relay radial study validation;
- corruption matrix rejection.

Latest explicit runtime result:

```text
440,165 checks PASS
```

---

## 20. O05 acceptance

O05 is complete when:

- [x] all OVC-01..OVC-08 canonical data are registered;
- [x] two-relay radial coordination study exists;
- [x] canonical three-relay radial study exists;
- [x] O01 instantaneous challenge data exists;
- [x] load cases are explicit;
- [x] fault MIN/NOM/MAX data are explicit;
- [x] per-device current maps contain no hidden missing defaults;
- [x] primary/backup chains are explicit;
- [x] current-profile resolution is deterministic;
- [x] fault-location scrubber can return both current data and configured protection zone;
- [x] CTI requirements/budget references are structurally validated;
- [x] simulator initialization uses only explicit preset defaults;
- [x] generic four-relay topology remains representable;
- [x] O01 numeric vectors remain unchanged;
- [x] no Coordination Engine, Timeline Engine, TCC, SLD, or React UI is implemented in this phase.

---

## 21. Next gate — O06 Coordination Engine

O06 may now consume O05 studies to implement:

```text
case evaluation
operating order
adjacent-tier CTI
selectivity
time grading
minimum-fault sensitivity
maximum-load security
backup availability
50 instantaneous overreach
configured-case audit
coordination corridor data
profile/envelope scan
worst-case selection
structured violation results
```

O06 must use O03/O04 operating results and O05 study data. It must not duplicate relay equations or invent fault currents.

---

## O06 integration refinement — configured scrubber transitions

Dense O06 coordination-envelope scanning exposed that the first O05 LINEAR scrubber sample sets could interpolate across a protection-zone transition in a way that assigned substantially different through-fault currents to series devices over a visible interval. This was valid as arbitrary configured data but pedagogically misleading for a radial through-current study.

O06 therefore refined only the scrubber samples with closely spaced configured transition points. Immediately inside an F2/F3 radial zone, all in-series devices now receive the same configured through-fault current; devices downstream of a fault remain explicitly at 0 A upstream of their zone. Canonical explicit MIN/NOM/MAX fault cases, O01 formulas, CTI targets, and relay settings were not changed.

The profile remains study interpolation, **not** a network/impedance short-circuit solver.
