# Overcurrent Relay Domain Types & Data Model — O02

**Module:** Overcurrent Relay Simulator — ANSI 50/51 Protection & Coordination Laboratory  
**Route:** `/simulator/overcurrent`  
**Phase:** O02 — Domain Types & Data Model  
**Version:** O02 v1.0  
**Date:** 2026-08-13  
**Status:** **IMPLEMENTED / O03-COMPATIBLE**  
**Authoritative product plan:** `../PRD-overcurrent-relay.md`  
**Authoritative engineering behavior:** `overcurrent-relay.md` (O01 v1.0 APPROVED)  
**Reference UI language:** Differential Relay R10 (FINAL / FROZEN)

---

## 1. Purpose

O02 converts the approved Overcurrent PRD and O01 Engineering Specification into a stable TypeScript domain vocabulary before any production 50/51 equations are implemented.

The purpose is architectural: future phases must not hard-code the simulator around one relay, one fault, or exactly three devices. Single Relay Study and Coordination Lab must both use the same domain model, and later study/presentation features must be able to grow without rewriting the core contracts.

O02 contains **no relay mathematics**. It defines the data that future engines will accept and return.

> **O03 compatibility note:** O03 added `DISABLED` to `Overcurrent51StaticStatus` because O02 already exposed `Overcurrent51Settings.enabled`. This closes a result-vocabulary gap without changing any O01 calculation rule.

Production type source:

```text
src/types/overcurrent.ts
```

---

## 2. O02 architecture rule

The domain vocabulary follows the locked stack:

```text
ProtectionDevice / Settings / CT
        ↓
StudyTopology / StudyLocation / FaultCase / CurrentProfile
        ↓
OperatingResult
        ↓
CoordinationPair / CoordinationRequirement / CoordinationAudit
        ↓
TimelineSnapshot / TimelineEvent
        ↓
TCCLayer / StudySnapshot / UI State
```

No React component is imported by this model.

No domain type imports from Differential Relay.

Shared visual components may be reused later, but engineering data contracts remain independent.

---

## 3. Design principles

### 3.1 Generic devices, not R1/R2/R3 types

Forbidden architecture:

```text
R1Settings
R2Settings
R3Settings
```

Approved architecture:

```text
ProtectionDevice
ProtectionDeviceId
Record<ProtectionDeviceId, ProtectionDevice>
```

R1, R2, R3 are preset IDs/labels only. A future four-relay radial study does not require a new TypeScript interface.

### 3.2 Engineering units are explicit in field names

Examples:

```text
primaryRatedA
secondaryRatedA
pickupASecondary
clearingTimeSec
requiredCtiSec
```

This prevents a primary-current value from being silently mistaken for CT-secondary current.

### 3.3 Settings and derived results are separate

`OvercurrentDeviceSettings` stores user/study inputs.

`OperatingResult` stores future engine output.

The simulator must not store derived trip time as a user setting.

### 3.4 Study data is explicit

Fault cases supply configured current data or a configured current profile. There is no data type that implies an impedance/network short-circuit solver.

### 3.5 Presentation references domain results

TCC layers reference devices, fault cases, coordination pairs, or explicit operating coordinates. The graph never becomes a second relay engine.

### 3.6 Invalid data is structured

Future engines return `DomainEvaluation<T>` rather than throwing into React render paths.

---

## 4. Identifier model

O02 uses semantic string aliases:

```text
ProtectionDeviceId
StudyLocationId
FaultCaseId
CurrentProfileId
FaultLocationProfileId
CoordinationPairId
CoordinationRequirementId
StudyPresetId
StudySnapshotId
TimelineEventId
TCCLayerId
```

These remain ordinary strings at runtime. They exist to make API intent visible without introducing serialization complexity.

A future persistence layer may introduce stronger/branded IDs if needed, but this is not required for the current local simulator.

---

## 5. Protection-device model

Current V1 device union contains:

```text
OvercurrentProtectionDevice
kind = OVERCURRENT_50_51
```

The exported public alias is:

```text
ProtectionDevice
```

This is intentionally a union alias rather than embedding overcurrent-specific fields into every future protection device.

An overcurrent device owns:

```text
CTConfiguration
Overcurrent51Settings
Overcurrent50Settings
BreakerConfiguration
```

The separation is intentional:

- CT belongs to measurement;
- 51 belongs to timed overcurrent behavior;
- 50 belongs to instantaneous high-set behavior;
- breaker clearing is a separate physical/study interval after relay trip output.

---

## 6. CT configuration

```text
CTConfiguration
├─ primaryRatedA
├─ secondaryRatedA
└─ ratioErrorPct
```

O02 does not calculate the measured current. O03 will implement the O01 measurement convention.

The ratio-error field is signed and expressed as percent.

No CT saturation, remanence, phase error, or waveform distortion property exists in V1 because those are explicit non-goals.

---

## 7. 51 settings

```text
Overcurrent51Settings
├─ enabled
├─ pickupASecondary
├─ timingMode
├─ inverseCurveId
├─ timeScale
└─ definiteDelaySec
```

`inverseCurveId` is restricted to the six O01-approved curves:

```text
IEC_SI
IEC_VI
IEC_EI
IEEE_MI
IEEE_VI
IEEE_EI
```

Both inverse and definite settings remain stored so switching timing modes does not destroy the user's previous value. The inactive setting is ignored by the relevant engine path.

---

## 8. 50 settings

```text
Overcurrent50Settings
├─ enabled
└─ pickupASecondary
```

O02 intentionally contains no vendor-specific instantaneous delay or dropout setting.

O01 V1 defines 50 as zero intentional relay delay when the strict pickup threshold is exceeded.

---

## 9. Breaker configuration

```text
BreakerConfiguration
└─ clearingTimeSec
```

This exists independently from relay settings because the timeline must distinguish:

```text
relay trip output
        ↓
breaker clearing interval
        ↓
breaker open
        ↓
fault isolation/current removal
```

The type model therefore prevents the implementation from collapsing trip time and breaker-clear time into one number.

---

## 10. Study topology

Current topology kinds are intentionally limited to:

```text
SINGLE_RELAY_FEEDER
RADIAL_FEEDER
```

A topology stores:

```text
deviceIds[]  // upstream → downstream
locations[]
```

The order is suitable for the V1 radial SLD and study engine.

No ring/meshed-network graph is implied by O02.

This is deliberate scope control rather than an architectural failure: future network topology support would require a separate engineering specification because non-directional 50/51 is not sufficient for arbitrary meshed coordination.

---

## 11. Study locations

`StudyLocation` represents a configured point such as F1/F2/F3.

An optional `normalizedPosition` supports the planned fault-location scrubber.

It is explicitly presentation/study metadata. A normalized position does **not** mean line impedance or electrical distance.

---

## 12. Fault case model

A `FaultCase` contains:

```text
id
label
locationId
category
current
protectionChain
externalClearTimeSec?
postFaultProfileId?
```

Current category is:

```text
MIN
NOMINAL
MAX
CUSTOM
```

The current definition is discriminated:

```text
STATIC
  primaryCurrentAByDevice

or

PROFILE
  profileId
```

This is a major architectural requirement. Static V1 studies remain simple, while the same study engine can later execute varying-current profiles without replacing the `FaultCase` concept.

---

## 13. Per-device study current

Fault current is represented as:

```text
DevicePrimaryCurrentMap
```

rather than one global `faultCurrentA`.

For today's simple series radial studies the values may be identical for all upstream devices. The data model nevertheless allows different currents per device.

This supports richer configured studies later without pretending a network solver exists.

---

## 14. Current profiles

A `CurrentProfile` is a deterministic ordered set of:

```text
CurrentProfileSample
├─ timeSec
└─ primaryCurrentAByDevice
```

Interpolation can be:

```text
STEP
LINEAR
```

O07 will own timeline integration and validate monotonic time ordering.

O02 only establishes the contract.

This makes the architecture ready for:

- fault clearing before trip;
- temporary overload;
- motor-start study;
- varying fault magnitude;
- future profile-based educational scenarios.

No such advanced profile is automatically assumed in V1.

---

## 15. Fault-location profiles

`FaultLocationProfile` supports the planned continuous scrubber experience using explicit preset samples:

```text
normalizedPosition
primaryCurrentAByDevice
```

Interpolation is currently locked to `LINEAR` for this presentation/study feature.

The UI and help content must describe this as configured study interpolation, never impedance-based fault calculation.

---

## 16. Protection chain

A `ProtectionChain` explicitly identifies:

```text
primaryDeviceId
backupDeviceIds[]
```

Backup IDs are ordered nearest-to-farthest.

Examples:

```text
F1: R1 primary
F2: R2 primary → R1 backup
F3: R3 primary → R2 backup → R1 backup
```

The chain is explicit study data rather than inferred from labels such as `R1` or `R3`.

---

## 17. Coordination pair

A `CoordinationPair` represents one primary-backup relationship at one study location:

```text
locationId
primaryDeviceId
backupDeviceId
backupOrder
```

A three-relay F3 case can therefore expose two pairs:

```text
R3 → R2
R2 → R1
```

and, if the study later requires it, another explicit pair may be defined without changing the type system.

---

## 18. Coordination requirement and CTI budget

`CoordinationRequirement` stores:

```text
pairId
requiredCtiSec
budget?
```

The explicit `requiredCtiSec` remains authoritative.

An optional `CTIBudget` explains where the study target came from:

```text
breakerAllowanceSec
relayTimingAllowanceSec
studySafetyMarginSec
```

This maintains the PRD principle that the simulator should teach why a margin exists rather than presenting one unexplained magic value.

---

## 19. Static measurement and relay results

Future O03 engine output contracts are already defined:

```text
MeasurementResult
Overcurrent51OperatingResult
Overcurrent50OperatingResult
OperatingResult
```

`OperatingResult` preserves both 50 and 51 results even when 50 wins final arbitration.

This supports Analysis text such as:

```text
50 high-set superseded 51 timed operation.
```

without recalculating the 51 curve in the UI.

---

## 20. Coordination result model

`CoordinationPairResult` exposes:

```text
primaryTripTimeSec
backupTripTimeSec
observedCtiSec
requiredCtiSec
surplusSec
status
```

Status is:

```text
PASS
FAIL
NOT_EVALUABLE
```

This is intentionally not reduced to one boolean so the UI can distinguish a coordination failure from a case where a backup does not pick up or the study cannot produce a valid comparison.

---

## 21. Coordination violations and audit

Violation types are locked to current core scope:

```text
TIME_GRADING
INSTANTANEOUS_OVERREACH
SENSITIVITY_RISK
LOAD_SECURITY_FAIL
BACKUP_NOT_AVAILABLE
```

The full study audit reports independent dimensions:

```text
SENSITIVITY
SELECTIVITY
TIME_GRADING
INSTANTANEOUS_REACH
LOAD_SECURITY
BACKUP_AVAILABILITY
```

This supports the PRD requirement that the result should say which protection objective failed rather than show a consumer-style numerical score.

---

## 22. Worst-case contract

`CoordinationAuditResult` may include one `worstCase` record containing:

```text
faultCaseId
pairId
observedCtiSec
requiredCtiSec
surplusSec
```

O06 will define deterministic selection if multiple cases tie.

The type deliberately describes the worst point among evaluated configured/profile cases, not a mathematically proven network-wide worst fault.

---

## 23. Timeline state vocabulary

Relay timeline states are:

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

Playback state is separately represented as:

```text
IDLE
RUNNING
PAUSED
COMPLETE
INVALID
```

This separation is important: one relay may be `51_TIMING` while the overall study playback is `RUNNING`.

---

## 24. Timeline event model

`TimelineEvent` is a discriminated union, not a free-form event string.

Current V1 event types:

```text
FAULT_APPLIED
CURRENT_PROFILE_CHANGED
51_PICKUP
50_TRIP
51_TRIP
BREAKER_OPENING
BREAKER_OPEN
FAULT_ISOLATED
51_RESET
```

Each event stores **engineering time**, not browser wall-clock time.

This enforces the O01 playback-speed requirement: 10× changes how quickly the animation is shown, not the timestamps in the protection study.

---

## 25. Timeline snapshot

A `TimelineSnapshot` stores:

```text
engineeringTimeSec
playbackState
faultCaseId
relay state per device
event history
```

Each relay snapshot includes:

```text
operateProgress51
tripOutputTimeSec
breakerOpenTimeSec
```

`operateProgress51` is a normalized accumulated operating quantity from 0 to 1. This is the data-model support required for O01's future-ready varying-current integration contract.

---

## 26. TCC layer architecture

O02 defines the graph as a layer system rather than a component hard-coded for R1/R2/R3.

Initial layer kinds:

```text
RELAY_CURVE
INSTANTANEOUS_BOUNDARY
FAULT_CURRENT_LINE
OPERATING_POINT
PICKUP_BOUNDARY
LOAD_REGION
MINIMUM_FAULT_REFERENCE
MAXIMUM_FAULT_REFERENCE
COORDINATION_CORRIDOR
COORDINATION_VIOLATION_ENVELOPE
INITIAL_SETTING_GHOST
STUDY_MARKER
EQUIPMENT_LIMIT
```

The architecture already leaves a natural path for future fuse, recloser, motor-start, cable-withstand, or equipment-damage layers after separate specifications approve them.

The graph renderer must never calculate relay protection logic independently.

---

## 27. TCC domain and view state

TCC current domain is explicit:

```text
PRIMARY_A
SECONDARY_A
CURRENT_MULTIPLE
```

Scale mode is:

```text
CHARACTERISTIC
FIT_POINT
```

This preserves lessons from Differential R10: graph scale behavior is presentation state, not relay state.

---

## 28. Operating-point layer

An operating point stores enough derived information for the planned compact inspector:

```text
primaryCurrentA
secondaryCurrentA
currentMultiple
operateTimeSec
role = PRIMARY | BACKUP
```

The UI should therefore not recompute current multiple or trip time just to build the tooltip.

---

## 29. Study snapshots

`StudySnapshot` stores a named copy of:

```text
devicesById
coordinationRequirements
selectedFaultCaseId
```

The same contract supports:

- INITIAL settings;
- CURRENT settings via active state;
- optional REFERENCE/CANDIDATE snapshot.

Ghost curves and before/after summaries must derive from snapshots, not from a second local graph state.

---

## 30. Guided-learning metadata

O02 includes optional study learning metadata:

```text
StudyObjective
GuidedHint
StudyLearningMetadata
```

Guided hints are classified exactly as planned:

```text
LOCATION
PARAMETER_FAMILY
DIRECTION
```

No type exists for an automatic exact-setting answer. That omission is deliberate.

A guided preset can therefore tell a user where and how to think without embedding an optimizer into the product.

---

## 31. Study definition

`OvercurrentStudyDefinition` is the root immutable preset/study contract.

It owns:

```text
mode
guidance
topology
devicesById
faultCases
currentProfiles
faultLocationProfiles
coordinationPairs
coordinationRequirements
validationCaseIds
learning metadata
```

O05 will create the production registry using this type.

The current O02 phase does not yet create those production presets because O05 owns preset-data implementation and validation.

---

## 32. Simulator state

`OvercurrentSimulatorState` stores mutable user/workflow state separately from the immutable preset definition.

Current contract includes:

```text
studyMode
guidanceMode
studyPresetId
topology
selectedDeviceId
activeFaultCaseId
simulationSpeed
playbackState
devicesById
coordinationRequirements
initialSnapshot
comparisonSnapshot
validationState
uiSectionState
```

Derived operating/coordination results are intentionally absent from the persistent state contract. They will be derived by engines/evaluators except where timeline history explicitly requires a snapshot.

---

## 33. State/source-of-truth rule

Future UI must follow:

```text
Preset Study Definition
        ↓ initialize
Simulator State
        ↓
Pure Engines
        ↓
Derived Results
        ↓
Presentation Model
```

Forbidden architecture:

```text
React input state
  + graph local settings
  + coordination local settings
  + hidden engine defaults
```

There must be one setting source of truth.

---

## 34. Invalid-state architecture

`DomainEvaluation<T>` is a discriminated union:

```text
VALID(value)
INVALID(issues[])
```

`DomainIssue` uses a machine-readable code and optional path/detail.

Future safe evaluation must use this mechanism for:

- invalid setting range;
- non-finite input;
- numerical overflow;
- missing study reference;
- invalid topology/profile/pair;
- invalid timeline transition.

This is the Overcurrent equivalent of the hardening lesson learned from Differential R07.

---

## 35. What O02 intentionally does not implement

O02 does not contain:

- CT equations;
- inverse-time constants/evaluation code;
- pickup comparisons;
- 50/51 arbitration code;
- preset registry;
- topology validation;
- CTI calculations;
- worst-case scan;
- timeline reducer;
- React state reducer;
- SLD rendering;
- TCC rendering.

Those are owned by O03 onward.

---

## 36. O02 acceptance checks

O02 is complete when:

- [x] `src/types/overcurrent.ts` compiles under TypeScript strict mode;
- [x] no React/UI dependency exists in the domain type file;
- [x] no Differential engine/type dependency exists;
- [x] exact six inverse curve IDs are represented;
- [x] primary and secondary current units are explicit in field names;
- [x] static and profile current sources are both representable;
- [x] per-device fault currents are representable;
- [x] primary and ordered backups are generic IDs;
- [x] 1/2/3+ device studies do not require separate setting interfaces;
- [x] CTI budget and explicit required CTI are both representable;
- [x] coordination violations and audit dimensions are structured;
- [x] accumulated 51 operating progress is representable;
- [x] relay trip output and breaker open are separate timeline events;
- [x] generic TCC layers cover all V1 planned layers;
- [x] initial/comparison snapshots are representable;
- [x] guided objective/hints are representable without exact-setting optimization;
- [x] invalid evaluation is non-throwing by contract;
- [x] production preset/calculation code remains deferred to the owning phases.

---

## 37. O03 handoff

The next phase is **O03 — Measurement + 50/51 Pure Engine**.

O03 must consume O02 types and implement only pure, UI-independent behavior:

```text
evaluateMeasurement
calculate51
calculate50
evaluateOvercurrentDevice
safe/static evaluation boundary
```

O03 must use the exact O01 engineering equations and boundaries.

O03 may not yet implement:

- study topology traversal;
- preset registry;
- coordination scanning;
- timeline playback;
- React UI.

Those remain O05–O08 responsibilities.

---

## 38. O02 final statement

The Overcurrent module now has a domain model capable of representing the entire locked V1 concept without hard-coding the initial three-relay demonstration.

The architecture can represent:

```text
one relay
multiple radial relays
static fault cases
varying current profiles
fault-location study samples
primary/backup relationships
CTI requirements
coordination audits
time-domain events
TCC layers
before/after study snapshots
guided learning metadata
```

while keeping relay mathematics, study logic, coordination logic, timeline logic, and UI presentation as separate future phases.

This satisfies the architectural purpose of O02 and authorizes progression to O03.

---

## O05 integration refinement — 2026-08-13

Implementing the production Study Engine exposed two data-contract omissions that are now corrected without changing O01 relay physics:

1. `LoadCase` / `loadSecurityCaseIds` / `activeLoadCaseId` explicitly represent normal/maximum-load study data rather than hiding load current in UI defaults or fault records.
2. `FaultLocationProfileSegment` explicitly maps configured scrubber intervals to a `locationId` and `ProtectionChain`, allowing primary/backup roles to change during a fault-location study without inferring a network model.

`StudyCurrentDefinition` is now the generic STATIC/PROFILE current-source contract; `FaultCurrentDefinition` remains a semantic alias.

These refinements are implemented and validated in `src/studies/overcurrentStudy.ts` and documented in `overcurrent-study-o05.md`.
