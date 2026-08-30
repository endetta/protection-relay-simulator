# Distance Relay Engineering Specification — D01

**Module:** Distance Relay Simulator — ANSI 21 Impedance-Based Transmission Line Protection Laboratory  
**Route:** `/simulator/distance`  
**Specification version:** D01 v1.0  
**Date:** 2026-08-28  
**Status:** **READY FOR APPROVAL**  
**Authoritative product plan:** `../PRD.md` § 1 (planned module: Distance Relay)  
**Reference UI language:** Differential Relay R10 (FINAL / FROZEN)  
**Reference engineering language:** Overcurrent Relay O01 v1.0 (FROZEN)

> **Gate status:** This document is the D01 engineering gate for the Distance Relay module. No production Distance engine code is authorized before this specification is approved and frozen. UI prototyping that uses placeholder Distance behavior must clearly identify the placeholder and must not be presented as validated relay behavior.

---

## 1. Purpose

This document locks the engineering behavior for the first Distance Relay release. It exists to prevent the impedance calculator, the R/X plane, the characteristic editor, the zone timing model, the reach / load-encroachment checks, and the helper engineering displays from evolving separate formulas or hidden assumptions.

The release is a **non-pilot, single-line, three-zone mho-style distance protection educational and study model**. It is not a vendor-specific relay emulator and it is not a full short-circuit network solver.

The engineering chain is:

```text
Configured system voltage / current / line impedance / fault location
        ↓
VT / CT measurement model (ratio + scalar error)
        ↓
Primary V / I → secondary V / I
        ↓
Apparent impedance Z = V / I (complex, scalar study form)
        ↓
Per-zone characteristic (mho circle / quad / polygon, configurable)
        ↓
Zone 1 / Zone 2 / Zone 3 reach and timing
        ↓
Load-encroachment and out-of-reach checks
        ↓
Zone arbitration (lowest numbered operated zone wins, with timer)
        ↓
Trip output (OPERATE / RESTRAIN)
        ↓
Presentation (R/X plane, phasor diagram, system one-line, analysis)
```

---

## 2. Normative and reference basis

### 2.1 Primary standards

1. **IEC 60255-121:2014** — functional requirements for distance protection, including characteristic definitions, zone reach, and timing.
2. **IEEE C37.91-2008** — guide for protective relay applications to power system buses.
3. **IEC 60255-187-1:2021** — functional requirements for directional and non-directional overcurrent / distance protection with virtual measurements (used only for the **study** definition of apparent impedance; no DSP model is implemented).

### 2.2 Primary manufacturer / application references used to make product conventions explicit

1. **GE / Alstom D30 / L90 Line Distance Protection manuals** — inform the conventional three-zone stepped distance scheme:
   - Zone 1: instantaneous, ~80–90% of line impedance (no intentional reach beyond remote bus);
   - Zone 2: timed, ~120–150% of line impedance, typical 0.25–0.40 s;
   - Zone 3 (and optional Zone 4): backup / out-of-step / reverse-looking.
2. **ABB REL670 / REF615 applications guide** — informs the apparent-impedance calculation under study assumptions and the load-encroachment conventional limit.
3. **SEL application guides on load encroachment and blind spot** — used to identify the **load-encroachment** check and the resistive **blind spot** between the mho circle and the load region.

### 2.3 Reference hierarchy

When product behavior must be deterministic, use this hierarchy:

1. this approved Engineering Specification;
2. the platform PRD (`../PRD.md`) and the Distance module plan once frozen;
3. the cited standard / manufacturer reference;
4. implementation detail that does not alter behavior.

A manufacturer-specific feature not explicitly adopted in this specification is **not** implied by citing a manufacturer manual.

---

## 3. Scope locked by D01

### 3.1 Included

- non-pilot, three-zone stepped distance protection;
- single transmission line, two-terminal (local ↔ remote bus) study model;
- VT (capacitive / inductive VTs treated identically at the study level) and CT ratio + scalar error measurement model;
- study fault locations between 0% (local bus) and 100% (remote bus) of the protected line length;
- mho characteristic per zone (study form: circle defined by reach `Z_reach` and characteristic angle `θ_char`; quad characteristic and polygon characteristic are **out of scope** for v1);
- Zone 1 / Zone 2 / Zone 3 settings: `Z_reach` (in secondary Ω), `θ_char` (in degrees), `time_delay` (in seconds), `enabled` flag;
- load-encroachment minimum-impedance check (study: `R_min_load` / `X_min_load` boundary approximated as an inclined straight line — see § 8);
- apparent-impedance scalar study form `Z_app = V_secondary / I_secondary` for single-line-to-ground / three-phase / phase-phase fault types via configurable `fault_type` study input (the simulator does not run a network solution — fault type only changes the **voltage factor** and the **zero-sequence compensation factor** that are user-entered, per § 5.5);
- primary / backup timing arbitration;
- simple R/X-plane operating point with optional per-zone circle overlay;
- study snapshot, fault-location scrubber, and reset (consistent with O05/O07 study patterns).

### 3.2 Explicitly excluded from this release

- directional comparison / permissive / blocking pilot schemes (85, 21P, 21B);
- series-compensated line compensation;
- loss-of-potential / fuse-failure logic;
- power swing blocking / out-of-step (78) detection;
- switch-onto-fault logic;
- VT / CT transient / CVT transient model;
- CCVT / CVT dynamic behavior;
- traveling-wave / phasor-based high-speed protection;
- single-pole tripping / single-phase auto-reclosing;
- adaptive reach;
- real network short-circuit solver (fault current is **study input**, not computed from network);
- full multi-line ring / meshed network;
- transformer differential backup zone (handled by Differential module);
- load encroachment **polygon** (only a single inclined line is used in v1; see § 8);
- quad and polygon characteristics;
- in-zone arc resistance compensation (`R_arc` is exposed as a **user-entered study parameter** that biases the apparent impedance, not modeled dynamically);
- frequency dependence of line impedance;
- polarized memory (no study frequency / inertia model);
- communication-assisted logic;
- vendor-specific operate-time tolerances;
- automatic setting optimization.

---

## 4. Engineering units and conventions

### 4.1 Quantity domain

| Quantity | Unit | Symbol | Source |
|---|---|---|---|
| System line-to-line voltage | kV (primary) | `V_LL_kV_primary` | user |
| Primary current (study) | A (primary) | `I_A_primary` | user / study preset |
| Line length | km | `L_km` | user |
| Line positive-sequence impedance | Ω/km (primary) | `z1_ohm_per_km_primary` | user |
| Line zero-sequence impedance | Ω/km (primary) | `z0_ohm_per_km_primary` | user (used for SLG compensation) |
| Arc resistance (study bias) | Ω (primary) | `R_arc_ohm_primary` | user |
| VT ratio | V_VT / V_secondary | `VT_ratio` | user |
| CT ratio | A_primary / A_secondary | `CT_ratio` | user |
| VT scalar error | % | `VT_ratio_error_pct` | user |
| CT scalar error | % | `CT_ratio_error_pct` | user |
| Voltage factor `K_v` | unitless | `K_v` | per fault type (see § 5.5) |
| Zero-sequence compensation factor `k_0` | unitless | `k_0` | per study (see § 5.5) |
| Per-zone reach | Ω (secondary) | `Z_reach_ohm_secondary` | user |
| Per-zone characteristic angle | deg | `theta_char_deg` | user |
| Per-zone time delay | s | `time_delay_sec` | user |
| Per-zone enabled flag | bool | `enabled` | user |
| Apparent impedance (output) | Ω (secondary) | `Z_app_ohm_secondary` | computed |
| Apparent resistance (output) | Ω (secondary) | `R_app_ohm_secondary` | computed |
| Apparent reactance (output) | Ω (secondary) | `X_app_ohm_secondary` | computed |

### 4.2 Sign and reference conventions

- **Positive sequence reference:** current flows from local bus toward remote bus; positive X is inductive (upward on the R/X plane).
- **Apparent impedance form:** Z = V / I, evaluated as a complex phasor quotient at the fundamental study frequency (50 / 60 Hz is exposed as a **study parameter** but does not change the impedance equations — only the `f_hz` UI label).
- **Study fault type** affects apparent voltage only via the **voltage factor** `K_v` (entered by the user or pulled from the study preset). The simulator does not compute `K_v` from network data.
- **Single-line-to-ground (SLG) compensation:** the apparent impedance is computed using a **user-entered** `k_0 = (z0 − z1) / (3 · z1)` study factor. The simulator does not derive `k_0` from line data.
- **Characteristic angle convention:** the mho circle is rotated so its diameter lies along the characteristic angle `θ_char` measured from the positive R axis. `θ_char = 75°`–`85°` is the conventional range for transmission lines.
- **Reach convention:** `Z_reach_ohm_secondary` is the **circle diameter**, consistent with conventional mho characteristic drawing. Zone 1 ≈ 0.80–0.90 × Z_line_secondary.
- **Operate boundary:** strict `Z_in_zone` (point is inside or on the circle boundary) → OPERATE; otherwise RESTRAIN. The boundary itself is OPERATE (consistent with conventional protective relay decision logic).

### 4.3 Time / playback conventions (aligned with O07)

- Engineering time is wall-clock-decoupled.
- Supported playback speeds: `×1`, `×5`, `×10` (consistent with O07).
- After trip, the breaker clearing interval is honored identically to O07 (`BreakerConfiguration.clearingTimeSec`).
- After a primary-zone trip, the relay does **not** retest the same fault during the same play session.

---

## 5. Per-zone characteristic

### 5.1 Study characteristic: mho circle only (v1)

A mho characteristic in the R/X plane is the circle defined by the **diameter** vector at characteristic angle `θ_char`, with origin at `(0, 0)` and **opposite end** at:

```
Z_diam = Z_reach · exp(j · θ_char_rad)
```

The center is at `Z_diam / 2` and the radius is `|Z_diam| / 2`. The circle passes through the origin and through the point at `Z_diam`.

A point `Z = R + jX` is **inside the characteristic** iff:

```
|Z − Z_center| ≤ |Z_diam| / 2 + ε
```

where `ε` is a fixed-tolerance `1e-9 Ω (secondary)` numeric guard to prevent boundary flicker.

### 5.2 Per-zone settings

```ts
interface DistanceZoneSettings {
  enabled: boolean;
  /** Circle diameter in secondary Ω. */
  reachOhmSecondary: number;
  /** Characteristic angle in degrees (0–90). */
  thetaCharDeg: number;
  /** Trip time delay in seconds. Zone 1 typically 0. */
  timeDelaySec: number;
}
```

### 5.3 Zone arbitration

- Zones are evaluated independently.
- The **operated** zone is the **lowest-numbered** zone whose characteristic contains the apparent impedance **and** whose timer has elapsed.
- A higher-numbered zone is suppressed once a lower-numbered zone has produced a trip output for the current fault.
- If no zone contains the apparent impedance, the relay remains RESTRAIN.

### 5.4 Time model

| Zone | Conventional timing |
|---|---|
| Zone 1 | 0.00 s (instantaneous) |
| Zone 2 | 0.25 – 0.40 s (study preset default: 0.30 s) |
| Zone 3 | 0.50 – 1.00 s (study preset default: 0.60 s) |

`Zone 1` is the only zone with conventional instantaneous trip. **Zones 2 and 3 are timed.** The timed behavior uses an O07-style deterministic timer that accumulates engineering time and trips when the per-zone delay elapses; the timer is reset if the apparent impedance leaves the zone characteristic before the timer expires.

### 5.5 Fault-type voltage and zero-sequence compensation

The **study** fault type is one of:

- `THREE_PHASE` — `K_v = 1.0`, `k_0` unused;
- `PHASE_PHASE` — `K_v = √3 / 2`, `k_0` unused;
- `SINGLE_LINE_GROUND` — `K_v = 1.0`, `k_0` = user-entered study compensation factor.

The simulator does not enforce default `k_0`; it must be entered. For `THREE_PHASE` and `PHASE_PHASE`, `k_0` is unused and must be set to `0` to make the contract explicit.

The compensated apparent impedance is:

```
V_secondary = (V_LL_kV_primary · 1000 / √3) · K_v / VT_ratio · (1 + VT_ratio_error_pct / 100)
I_secondary = I_A_primary · (1 + CT_ratio_error_pct / 100) / CT_ratio

Z_app_raw = V_secondary / I_secondary   (complex)

For SLG:    Z_app = (V_secondary / I_secondary) / (1 + k_0)
            (the standard approximation; product equation locked here)
For 3PH/PP: Z_app = V_secondary / I_secondary
```

`R_arc_ohm_primary` is added to the real part of `Z_app_raw` **before** zero-sequence compensation so that arc resistance always biases the apparent impedance in the same direction regardless of fault type. This is a **study approximation**; the simulator does not implement an arc model.

### 5.6 Load encroachment

The product implements a **single inclined straight-line** load-encroachment boundary in the R/X plane:

```
X_load_boundary = m_load · R_load_boundary
```

where `m_load` is the slope (`tan(θ_load)`) and the boundary is a single line passing through the origin. The relay declares the apparent impedance to be in the **load region** iff:

```
X_app ≥ m_load · R_app   AND   R_app ≥ R_min_load_ohm_secondary
```

When the apparent impedance is in the load region, **all zones are suppressed** for that play session. `R_min_load_ohm_secondary` and `m_load` are user-entered study parameters.

This is a **study approximation** of a load-encroachment characteristic; a polygon or multi-segment boundary is out of scope for v1 (see § 3.2).

### 5.7 Blind spot note

When `R_arc` is large and the fault is near the remote bus, the apparent impedance can leave the mho circle on the R-axis side even though the fault is on the protected line. This is the conventional **mho blind spot**. The simulator must display a **warning badge** (amber) when `R_arc_ohm_primary` is non-zero, indicating that the simplified model does not compensate for resistive reach; it must not auto-correct the apparent impedance.

---

## 6. CT / VT measurement model

The CT and VT measurement model mirrors the O01 measurement model for consistency:

```
I_secondary = I_A_primary · (1 + CT_ratio_error_pct / 100) / CT_ratio
V_secondary = (V_LL_kV_primary · 1000 / √3) · K_v · (1 + VT_ratio_error_pct / 100) / VT_ratio
```

- `CT_ratio = A_primary / A_secondary` (e.g. 600 / 5 = 120).
- `VT_ratio = V_VT_primary / V_secondary` (e.g. 110000 / √3 / 110 = 577).
- Errors are scalar percentages applied symmetrically (± sign allowed, study input).
- `K_v` is the fault-type voltage factor from § 5.5.
- Zero-sequence compensation `k_0` is applied to the apparent impedance, not to the secondary current.

### 6.1 Overflow / underflow guards

Same conventions as O04:

- `Number.isFinite` is required on every input and intermediate.
- `CT_ratio > 0` and `VT_ratio > 0` are required.
- `Z_reach_ohm_secondary > 0` and `time_delay_sec ≥ 0` are required.
- `0 ≤ θ_char_deg ≤ 90`.
- Bad drafts never enter engineering state.

---

## 7. Operating logic

### 7.1 Static operating result

For every study evaluation at engineering time `t`, the engine produces:

```ts
type DistanceStaticResult = {
  zAppOhmSecondary: { magnitude: number; angleDeg: number };
  rAppOhmSecondary: number;
  xAppOhmSecondary: number;
  faultType: DistanceFaultType;
  kvApplied: number;
  k0Applied: number;
  rArcApplied: number;
  zonesOperated: readonly DistanceZoneId[]; // zones whose characteristic contains the apparent impedance
  loadRegion: boolean;                       // apparent impedance is in the load region
  zInZone1: boolean;
  zInZone2: boolean;
  zInZone3: boolean;
  timeToZone1TripSec: number | null;         // 0 if instantaneous, null if no pickup
  timeToZone2TripSec: number | null;
  timeToZone3TripSec: number | null;
  tripZone: DistanceZoneId | null;
  tripReason: 'ZONE1_INSTANT' | 'ZONE1_TIMED' | 'ZONE2_TIMED' | 'ZONE3_TIMED' | null;
  displayStatus: 'OPERATE' | 'RESTRAIN' | 'INVALID';
  issues: readonly DomainIssue[];
};
```

### 7.2 Display status

- `OPERATE` — at least one zone has produced a trip output for the current fault and the apparent impedance is not in the load region.
- `RESTRAIN` — no zone is producing a trip output (apparent impedance is outside every enabled zone, or the load-encroachment check has suppressed all zones, or all timers are still pending).
- `INVALID` — one or more inputs are non-finite, out of range, or the evaluation threw. The previous valid result is held and active-trip semantics are suppressed (consistent with R07 hardened state).

### 7.3 Trip semantics

- **Zone 1 instantaneous trip:** when `Z_in_zone1 && Zone1.enabled && !loadRegion`, the relay trips at `t = 0.00 s` (engineering time).
- **Zone 2 timed trip:** when `Z_in_zone2 && Zone2.enabled && !loadRegion` and Zone 1 has not already tripped, the relay trips at `t = Zone2.timeDelaySec` after the apparent impedance entered Zone 2.
- **Zone 3 timed trip:** when `Z_in_zone3 && Zone3.enabled && !loadRegion` and Zones 1 and 2 have not already tripped, the relay trips at `t = Zone3.timeDelaySec` after the apparent impedance entered Zone 3.
- After trip, `BreakerConfiguration.clearingTimeSec` is applied (consistent with O07).
- **Out-of-step / power-swing logic is not implemented in v1** (out of scope per § 3.2). The simulator will not show a power-swing block.

---

## 8. Load encroachment (study)

The product implements a **single inclined straight line** through the origin with slope `m_load = tan(θ_load)`. The apparent impedance is in the **load region** iff:

```
R_app ≥ R_min_load_ohm_secondary   AND   X_app ≥ m_load · R_app
```

When the apparent impedance is in the load region, all three zones are suppressed for the current fault. The settings are:

```ts
interface DistanceLoadEncroachmentSettings {
  enabled: boolean;
  rMinLoadOhmSecondary: number;
  thetaLoadDeg: number; // slope angle in degrees, typically 20°–30°
}
```

A polygon-shaped load-encroachment characteristic is explicitly out of scope for v1 (see § 3.2).

---

## 9. Study fault-location model

The fault-location scrubber moves a single fault along the protected line from `0%` (local bus) to `100%` (remote bus). The **study** primary current and primary voltage are derived from the line impedance at the fault location:

```
Z_line_primary_ohms = z1_ohm_per_km_primary · L_km
Z_fault_primary_ohms = Z_line_primary_ohms · (fault_pct / 100)
```

The study primary current is **not** computed from a short-circuit network. The study input is:

- `I_A_primary` — the user-entered study fault current (or pulled from a study preset);
- `V_LL_kV_primary` — the user-entered system voltage (or pulled from a study preset);
- `fault_pct` — the scrubber value (0–100).

The simulator uses these inputs to compute the secondary V and I (§ 6) and then the apparent impedance (§ 5.5).

For each `fault_pct` step, the study engine re-evaluates `Z_app` and the per-zone pickup/timer state. This is **study interpolation**, not a short-circuit calculation.

---

## 10. Canonical presets (v1, study-only)

D01 specifies the following **study** presets. The presets are not engineering validations; they are **didactic scenarios** that exercise the canonical cases.

| Preset | Description | Key settings |
|---|---|---|
| `DIST-01` | Zone 1 internal fault, 3-phase, no arc, mid-line | V=110 kV, I=5 kA, L=100 km, z1=0.4 Ω/km, Z1=0.85·Z_line, θ=80°, Z2=1.30·Z_line @ 0.30 s, Z3=1.80·Z_line @ 0.60 s, fault_pct=50 |
| `DIST-02` | Zone 2 external fault, 3-phase, no arc, near remote bus | Same as DIST-01 with fault_pct=95 (still inside Zone 2) |
| `DIST-03` | Outside reach, 3-phase, near remote bus | Same as DIST-01 with fault_pct=100 (just outside Zone 2) |
| `DIST-04` | Single-line-to-ground fault, mid-line, with k_0 | Same as DIST-01 with fault_type=SLG, k_0=0.5, fault_pct=50 |
| `DIST-05` | Load encroachment scenario, no fault | Pre-fault I = 800 A, R_min_load = 5 Ω secondary, θ_load = 25°; apparent impedance falls inside the load region |
| `DIST-06` | Arc-resistance blind-spot warning | DIST-01 settings with R_arc = 20 Ω primary, fault_pct=90; expected: blind-spot warning badge shown, point likely outside Zone 1 |

These are study presets, not universal truths. Validation cases for v1 are limited to the characteristic equation and the basic zone-arbitration logic.

---

## 11. Validation cases (v1, equation-level)

The following are **equation-level** validation cases. They verify the impedance calculation and the mho containment test in isolation; they do not validate a physical short-circuit network.

### 11.1 Voltage / current conversion (positive case)

Given:
- V_LL_kV_primary = 110 kV
- VT_ratio = 577 (110 kV / √3 / 110 V)
- VT_ratio_error_pct = 0
- I_A_primary = 5000 A
- CT_ratio = 600 (600 A / 1 A)
- CT_ratio_error_pct = 0
- K_v = 1.0 (three-phase)

Then:
- V_secondary = 110000 · K_v / (√3 · 577) = 110 V
- I_secondary = 5000 / 600 = 8.3333… A
- Z_app_raw = 110 / 8.3333… = 13.2 Ω (real, angle 0° because the test sets V and I in phase)

### 11.2 Mho containment (positive case)

Given:
- Z_reach = 20 Ω, θ_char = 80°
- Z_center = 10 · exp(j · 80°)
- Z_diam_radius = 10 Ω
- Z = 6 + j4 Ω

Check:
- |Z − Z_center| ≈ |(6 − 1.736) + j(4 − 9.848)| ≈ |4.264 − j5.848| ≈ √(18.18 + 34.20) ≈ √52.38 ≈ 7.236 Ω
- 7.236 ≤ 10 + ε → **inside** (true, so the test would trip).

This is an exact vector-norm test; no approximation is permitted in the engine.

### 11.3 SLG compensation (positive case)

Given:
- V_secondary = 110 V
- I_secondary = 8.3333 A
- k_0 = 0.5
- R_arc = 0

Then:
- Z_app_raw = 110 / 8.3333 = 13.2 Ω (real)
- Z_app = 13.2 / (1 + 0.5) = 8.8 Ω (real)

### 11.4 Load encroachment (positive case)

Given:
- m_load = tan(25°) ≈ 0.4663
- R_min_load = 5 Ω
- R_app = 8 Ω, X_app = 4 Ω

Check:
- R_app ≥ R_min_load → 8 ≥ 5 → true
- X_app ≥ m_load · R_app → 4 ≥ 0.4663 · 8 ≈ 3.73 → true
- → in load region → all zones suppressed.

### 11.5 Out-of-range (negative case)

Given:
- Z_reach = 20 Ω, θ_char = 80°
- Z = 100 + j0 Ω (way outside)

Check:
- |Z − Z_center| ≈ |(100 − 1.736) + j(0 − 9.848)| ≈ √(9671 + 96.98) ≈ 98.84 Ω
- 98.84 > 10 + ε → **outside** (true, no trip).

### 11.6 Bad-input case

If `CT_ratio ≤ 0` or `VT_ratio ≤ 0` or `Z_reach ≤ 0`, the engine must return `displayStatus: 'INVALID'` and the last valid held result. No exception is thrown (consistent with O03 / R07).

---

## 12. Preset / fault restoration conventions

Same as O05 / O06 / O07:

- Production study data is immutable preset data; the reducer edits a copy, never the registry.
- The fault-location scrubber uses the O07 right-continuous STEP semantics at exact sample boundaries.
- The selected preset is the source of truth; explicit `Reset` restores the exact preset state.
- A simplified internal fault (when the user applies a fault from the preset) **temporarily switches** the active source to the per-preset study voltage / current model; `Clear Fault` restores the exact pre-fault state (consistent with R06/R08 Differential).

---

## 13. UI hierarchy and language (D01)

- The Distance module must reuse the Differential R10 / Overcurrent O15 visual and interaction language:
  - graphite / charcoal surfaces, steel-cyan structural accent, green = RESTRAIN, red = OPERATE, amber = warning;
  - 3-zone desktop layout (Parameters 24 / Live Simulation 49 / Analysis 27 from 1180 px);
  - 2 px square engineering scrollbars;
  - custom stepper, outline `?` tooltips, persistent collapse / expand.
- R/X plane is the primary visual; it supports:
  - per-zone circle overlay (Zone 1, Zone 2, Zone 3);
  - operating-point dot with the previous-point fade;
  - load-encroachment line overlay;
  - arc-resistance warning badge;
  - pointer-follow compact inspector card (R, X, |Z|, angle, in-zone flags).
- Apparent impedance units are always **`Ω (secondary)`**.
- The R/X axis label is `R (Ω sec)` and `X (Ω sec)`.
- The R/X plane is **the dominant visual** for Distance. The characteristic priority must follow the R09 Differential rules.

---

## 14. Verification gate

Before declaring REFERENCE MODULE READY for Distance:

1. TypeScript strict type-check passes for the Distance module.
2. Engine / system / preset / workflow runtime checks pass.
3. Vitest and Vite build pass.
4. Vitest unit tests for the mho containment, SLG compensation, and load-encroachment cases pass.
5. Manual browser smoke confirms the R/X plane, the per-zone overlay, the apparent-impedance calculation, the load-encroachment suppression, the arc-resistance warning, the playback animation, and the Reset path.

---

## 15. Still outside scope for Distance v1

Directional comparison / pilot schemes, power swing blocking, out-of-step, switch-onto-fault, series compensation, traveling-wave protection, single-pole tripping, full network short-circuit, ring/meshed coordination, quad / polygon characteristics, multi-segment load encroachment, dynamic arc resistance, frequency dependence, CVT transient, communication-assisted logic, and automatic setting optimization.

---

## 16. Glossary

- **Apparent impedance:** the complex quotient V / I seen by the relay, evaluated at the fundamental study frequency.
- **Characteristic angle:** the angle of the mho-circle diameter vector measured from the positive R axis.
- **Characteristic plane:** the R / X plane on which the apparent impedance is plotted and the per-zone circles are drawn.
- **Compensation factor (`k_0`):** user-entered study factor for SLG impedance compensation, equal to `(z0 − z1) / (3 · z1)` per the standard approximation.
- **Mho circle:** the impedance circle whose diameter lies along the characteristic angle and whose origin is at the R/X origin.
- **Reach (`Z_reach`):** the diameter of the mho circle, in secondary Ω.
- **Voltage factor (`K_v`):** user-entered study factor scaling the primary voltage to the equivalent phase / fault voltage.
- **Zone arbitration:** the rule that the lowest-numbered operated zone wins, with timed zones 2 and 3 deferred by their per-zone delay.
