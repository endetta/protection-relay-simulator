# Underfrequency Relay Engineering Specification — U01

**Module:** Underfrequency Relay Simulator — ANSI 81U Underfrequency / UFLS System Laboratory
**Route:** `/simulator/underfrequency`
**Specification version:** U01 v1.0
**Date:** 2026-08-30
**Status:** **READY FOR APPROVAL**
**Authoritative product plan:** this Underfrequency module plan (see `../PRD.md` § 1 — planned module: Underfrequency Relay) and the approved plan `lakukan-planning-untuk-memulai-soft-diffie.md`
**Reference UI language:** Differential Relay R10 (FINAL / FROZEN)
**Reference engineering language:** Overcurrent Relay O01 v1.0 (FROZEN), Distance Relay D01 v1.0

> **Gate status:** This document is the U01 engineering gate for the Underfrequency Relay module. No production Underfrequency engine code is authorized before this specification is approved and frozen. UI prototyping that uses placeholder Underfrequency behavior must clearly identify the placeholder and must not be presented as validated relay behavior.

---

## 1. Purpose

This document locks the engineering behavior for the first Underfrequency Relay release. It exists to prevent the system-frequency ODE, the governor/droop response, the UFLS stage ladder, and the helper engineering displays from evolving separate formulas or hidden assumptions.

The release is a **non-pilot, single-area, generator-coherent underfrequency / underfrequency load-shedding (UFLS) educational and study model**. It is **not** a vendor-specific relay emulator, **not** a multi-machine transient stability simulator, and **not** a full power-flow / network solver.

The engineering chain is:

```text
Configured system load / generation / inertia / droop / UFLS stages
        ↓
Pre-disturbance operating point (per-generator output & reserve)
        ↓
Disturbance event (generator loss / load step / generator block) → deficit MW
        ↓
Initial ROCOF df/dt|₀ = -(f_nom/(2·H_sys))·(D₀/S_base)
        ↓
Governor/droop response per generator (unsaturated → saturated) → system stiffness β
        ↓
Closed-loop steady-state Δf_ss = -f_nom·D/β_pu   (with saturation → piecewise-linear solve)
        ↓
UFLS stage arming / timer / trip (strict f < threshold, latched) → shed MW → new segment
        ↓
Arrest & recovery to a new (or pre-disturbance) steady state, or COLLAPSE
        ↓
Presentation (f(t) chart, generator RPM/load diagram, shedding chart, analysis)
```

---

## 2. Normative and reference basis

### 2.1 Primary standards

1. **IEEE C37.117-2007** — Guide for the Application of Underfrequency Load Shedding and Restoration Schemes. This is the primary reference for UFLS stage design, arming thresholds, shedding amounts, and coordinated restoration.
2. **IEC 60255-181:2019** — Functional requirements for under- and over-frequency protection. This is the reference for the 81U protection function, measurement, and the definite-time (or user-selectable) timing characteristic that an individual UFLS stage uses.
3. **IEEE C37.106-2021** — Guide for Abnormal Frequency Protection for Power Generating Plants. Informative for generator frequency tolerance / protection (the generator will be shown as ONLINE / TRIPPED / AT_GOVERNOR_LIMIT, but generator frequency protection itself is **not** individually timed in this release).
4. **IEEE C37.91-2021** — Guide for Protective Relay Applications to Power System Buses. Informative basis for the system-level protection / emergency control view.
5. **Swing equation (standard)** — the rotor dynamics `2H·(df/dt) = (P_m − P_e)/S_base` in per-unit form, used to define ROCOF and the inertial response.

### 2.2 Global practice reference for UFLS typical thresholds

Because this simulator is explicitly intended to reflect **PLN Indonesia** operating practice (frequency ±0.2 Hz around 50 Hz nominal; underfrequency load shedding as a last-resort emergency control), the module seeks to use PLN-like thresholds. However, no authoritative PLN grid-code / Peraturan Dirjen document is available in this development environment at the time of writing. Therefore:

- The default UFLS stage table in Section 10 uses **"typical global practice"** numbers (49.50 / 49.00 / 48.50 / 48.00 Hz; shed 5 / 10 / 15 / 20% of pre-disturbance load; intentional delays 0.2–0.5 s). These are presented as **typical practice, not verified PLN values**.
- Every preset and the study default carries `notes: { plnVerificationRequired: true, sourceNote: 'typical practice — verify exact official PLN thresholds/shed amounts.' }`.
- The UI renders an **amber** verification note when `plnVerificationRequired` is true, so the numbers are never presented as verified PLN law.
- If the user later supplies an official PLN grid code / Peraturan Dirjen PLN values, those numbers replace the table and `plnVerificationRequired` is set to `false`.

### 2.3 Reference hierarchy

When product behavior must be deterministic, use this hierarchy:

1. this approved Engineering Specification;
2. the Underfrequency module plan (once frozen);
3. the cited standard / reference;
4. implementation detail that does not alter behavior.

A manufacturer-specific or utility-specific feature not explicitly adopted in this specification is **not** implied by citing a reference.

---

## 3. Scope locked by U01

### 3.1 Included

- single-area, generator-coherent system frequency model (one scalar `f(t)` for the whole online set);
- per-generator inertial constant `H`, rating `MVA`, droop `R`, `maxMW` / governor headroom, initial output, poles → synchronous RPM;
- disturbance events: **GENERATOR_LOSS** (drop a unit), **LOAD_STEP** (add/remove load MW), **GENERATOR_BLOCK** (reduce a unit's governor capability / force it to governor limit);
- inertial response + governor/droop response (unsaturated then saturated), system stiffness `β`;
- closed-form exact segment integration of the frequency ODE (see § 8), giving bit-exact steady state for parity tests;
- automatic, staged UFLS (Section 10): strict-inequality pickup, reset-definite-time delay, latched trip, sequential shed of pre-disturbance base load;
- steady-state solver `solveSteadyStateDeficit` that handles saturation and returns **COLLAPSE** / `DEFICIT_EXCEEDS_AVAILABLE_GENERATION` when the system cannot arrest;
- study snapshot, playback, time-scrubber, preset registry, and reset (consistent with O05/O07/D03 study patterns);
- static closed-form evaluator `evaluateUnderfrequencySystem` for parity with the timeline engine.

### 3.2 Explicitly excluded from this release

- multi-machine transient stability (N rotor angles / swing per-generator with electrical coupling);
- transmission-network power flow, line impedance, or voltage collapse modeling;
- generator frequency protection as an independently-timed element (a unit at frequency tolerance is shown as a state, not tripped at a per-unit time);
- under-voltage load shedding (U/VLS);
- rate-of-change-of-frequency (ROCOF / ANSI 81R) **trip** logic as an independent element (ROCOF is computed and displayed, but not used as a trip decision in this release);
- islanding detection / unintentional islanding schemes;
- automatic restoration / load restoration sequence following UFLS (restoration is shown as a narrative note only);
- synchronous condenser / SVC / battery / HVDC response modeling;
- turbine / boiler dynamics and governor transfer-function lag (governor is modeled as static droop with a headroom clamp; no first-order lag is applied in v1 — see § 8.4);
- unit commitment / economic dispatch;
- frequency-dependence of load (`D` load-frequency sensitivity) — v1 uses a constant net deficit; the natural damping term is folded into the prescribed `D` MW deficit;
- full network topology or per-bus frequency (single-area coherence assumed).

---

## 4. Engineering units and conventions

### 4.1 Quantity domain

| Quantity | Unit | Symbol | Source |
|---|---|---|---|
| Nominal frequency | Hz | `f_nom` | user (default 50) |
| Instantaneous system frequency | Hz | `f(t)` | computed |
| Frequency deviation | Hz | `Δf = f − f_nom` | computed |
| System base MVA | MVA | `S_base = Σ MVA_i` | computed (online set) |
| Generator rating | MVA | `MVA_i` | user |
| Generator rated MW | MW | `MW_rated_i` | user |
| Generator initial output | MW | `P0_i` | user |
| Inertia constant | s | `H_i` | user |
| Droop (per-unit) | pu | `R_i` | user (0.04–0.08 pu typical) |
| Generator max governor output | MW | `MW_max_i` | user |
| Governor headroom | MW | `HDR_i = MW_max_i − P0_i` | computed |
| Load (pre-disturbance) | MW | `P_load` | user |
| Net deficit | MW | `D` | computed |
| System stiffness | MW/Hz | `β_MW/Hz = β_pu · f_nom` | computed |
| UFLS stage threshold | Hz | `f_thr` | user |
| UFLS stage delay | s | `T_delay` | user |
| UFLS shed fraction | % | `shed_pct` | user |
| ROCOF | Hz/s | `df/dt` | computed |
| Synchronous speed | rpm | `N = 120·f/poles` | computed (presentation) |

### 4.2 Sign and reference conventions

- **Frequency deviation:** `Δf = f − f_nom`. Underfrequency gives `Δf < 0`.
- **Deficit:** a **positive** deficit `D > 0` means generation is insufficient (load > generation); this drives frequency down. Generator loss contributes `+MW_lost`; a positive load step contributes `+MW_added`; a generator block contributes `+` blocked MW.
- **Governor response:** each unit produces `resp_i(Δf) ≥ 0` MW of additional output when frequency is low, clamped to its headroom. It is **never negative on underfrequency** for an online unit (it neither decelerates nor absorbs; governor already at minimum is treated as normal operation in v1).
- **Strict underfrequency pickup:** arming requires `f < f_thr && !nearlyEqual(f, f_thr)`. At exact equality, the element is **not** armed (consistent with the `nearlyEqual` invariant used by O02).
- **Shedding amount:** `shedMW_s = (shed_pct_s / 100) · P_load_preDisturbance`, computed once at study start from the **pre-disturbance** load; UFLS does not re-derive base load from the post-fault value.
- **RPM:** `N = 120·f/poles`, computed in the presentation model from the instantaneous frequency; it is a coordinate transform, not a relay equation.

### 4.3 Time / playback conventions (aligned with O07)

- Engineering time is wall-clock-decoupled.
- Supported playback speeds: `×1`, `×5`, `×10` (consistent with O07).
- UFLS delays are intentional relay/load-shedding delays; they accumulate engineering time and trip when the per-stage delay elapses **while frequency remains below the threshold**.
- After an UFLS stage trips and sheds, its stage is **latched** (does not re-arm in the same run even if frequency recovers then falls again).
- If a stage's timer is running and frequency recovers above the threshold **before** the delay elapses, the timer resets to zero (does not trip).

---

## 5. System model (online set)

### 5.1 Generators

```ts
interface UnderfrequencyGeneratorData {
  readonly id: GeneratorId;          // 'G1' | 'G2' | 'G3' | 'G4' | ...
  readonly label: string;            // 'G1 — Thermal 600 MW'
  readonly mwRated: number;          // rated MW (nameplate)
  readonly mva: number;              // MVA rating (used for inertia weighting & base MVA)
  readonly inertiaSec: number;       // H (s)
  readonly droopPu: number;          // R (pu) — e.g. 0.05 = 5%
  readonly poles: number;            // synchronous poles — used for RPM display
  readonly governorMaxMw: number;    // max achievable governor output (MVA-limited)
  readonly initialMw: number;        // pre-disturbance output P0_i
}
```

The **online set** is every generator with `status === 'ONLINE'`. A generator that trips (or is blocked out) leaves the online set and no longer contributes inertia, stiffness, or headroom.

### 5.2 Aggregates

```text
S_base = Σ_online MVA_i                       [MVA]
H_sys  = Σ_online (H_i · MVA_i) / S_base      [s]   (inertia-weighted mean)
```

### 5.3 Load and pre-disturbance reserve

- `baseLoadMw` = pre-disturbance total load `P_load`.
- Pre-disturbance generation `P_gen0 = Σ_online P0_i`. Balanced when `P_gen0 = P_load` (v1 default).
- Total reserve = `Σ_online (governorMaxMw_i − P0_i)` — the aggregate headroom available for governor response.

---

## 6. Disturbance events

### 6.1 Event types

```ts
type UnderfrequencyDisturbanceStepKind = 'GENERATOR_LOSS' | 'LOAD_STEP' | 'GENERATOR_BLOCK';
interface UnderfrequencyDisturbanceStep {
  readonly id: UnderfrequencyEventId;
  readonly kind: UnderfrequencyDisturbanceStepKind;
  readonly timeSec: number;        // engineering time the step applies
  readonly generatorId?: GeneratorId;
  readonly mw?: number;            // loss or block magnitude (positive MW), or load step signed
}
```

- **GENERATOR_LOSS:** the named generator leaves the online set at `timeSec`; contributes `+mw` to the deficit (default `mw = initialMw` of that generator). Its inertia, stiffness, and headroom are removed after the event.
- **LOAD_STEP:** a signed MW added to the load; `mw > 0` adds load (raises deficit), `mw < 0` removes load (relieves deficit). No generator is written off.
- **GENERATOR_BLOCK:** the named generator stays online but its `governorMaxMw` is reduced (its available headroom is clamped to the new value, and its present output is clamped to it). Used to force a unit toward / at its governor limit with zero effective droop.

### 6.2 Net deficit

At any instant, the net deficit is:

```text
D = P_load_current − P_gen0_remaining − governor_support
```

Where `governor_support` is the aggregate governor response computed in § 7. The **initial** (post-disturbance, pre-governor) deficit used for the ROCOF is:

```text
D₀ = P_load_current − Σ_online P0_i   (post-disturbance online set, governor response = 0)
```

---

## 7. Governor / droop response (per generator)

### 7.1 Unsaturated droop

For an online, non-blocked generator at frequency deviation `Δf`, the droop response (MW) is:

```text
resp_i(Δf) = -Δf/f_nom · (MVA_i / R_i)     [MW]
```

Because `Δf < 0` for underfrequency, `resp_i` is positive (unit raises output).

### 7.2 Headroom clamp (saturation)

Each unit can only raise output to its headroom:

```text
headroom_i = governorMaxMw_i − P0_i
resp_i(Δf) = clamp1(-Δf/f_nom · MVA_i/R_i, 0, headroom_i)
```

The **saturation deviation** for unit `i` is the frequency deviation at which it just reaches headroom:

```text
Δf_i,sat = -f_nom · headroom_i · R_i / MVA_i
```

For `Δf < Δf_i,sat` (i.e. frequency lower than the saturating deviation) the unit is fully at its limit; for `Δf > Δf_i,sat` it is on its droop slope. At `Δf` between `Δf_i,sat` and 0 the unit responds linearly.

### 7.3 System stiffness

The aggregate droop stiffness is the sum over **unsaturated** units (units whose response has not saturated, i.e. `Δf > Δf_i,sat`):

```text
β_pu = Σ_unsaturated (MVA_i / R_i)          [pu]
β_MW/Hz = β_pu / f_nom                      [MW/Hz]
```

### 7.4 Steady-state without saturation

With all units unsaturated and a net constant deficit `D` (MW):

```text
Δf_ss = -f_nom · D / β_pu                    [Hz]
f_ss  = f_nom + Δf_ss
```

### 7.5 Steady-state with saturation (piecewise-linear)

As frequency falls, the units with the smallest saturation deviation `Δf_i,sat` saturate first and leave `β_pu`. This makes the closed-loop `Δf_ss` a **monotone piecewise-linear** function of `D`. `solveSteadyStateDeficit(D)` inverts this function:

- Walk units in increasing `|Δf_i,sat|` order (the ones that saturate first);
- maintain the running `β_pu` of still-unsaturated units and the running aggregate saturated-maximum MW;
- solve `Δf_ss` against the piecewise segments until a consistent fixed point is found;
- if **all** units saturate before the deficit is covered (i.e. `β_pu → 0`), return the **COLLAPSE / `DEFICIT_EXCEEDS_AVAILABLE_GENERATION`** result rather than a numeric steady state.

The solver is monotone, deterministic, and does not throw on the collapse boundary (it returns a status, not an exception).

---

## 8. Frequency ODE and time-domain integration

### 8.1 Swing equation (coherent form)

For a single-area coherent system the frequency dynamics reduce to the aggregated swing equation:

```text
2H_sys · df/dt = (P_gen − P_load) / S_base
⇒  df/dt = -(f_nom / (2H_sys)) · (D / S_base)
```

where `D` is the instantaneous net deficit `P_load − P_gen`. (The per-unit frequency error used here is `Δf/f_nom`; the standard per-unit `ω` ≈ `f/f_nom`.)

The **initial ROCOF** immediately after a disturbance, before governor response acts, is:

```text
df/dt|₀ = -(f_nom / (2H_sys)) · (D₀ / S_base)     [Hz/s]
```

### 8.2 Closed-form segment integration

On any time segment where the coefficient set is constant — i.e. the deficit `D`, the online set, and the stiffness `β` are all constant — the ODE is linear first-order and has an exact closed-form solution. Writing `Δf(t)` and the segment steady-state `Δf_ss`:

```text
Δf(t + Δt) = Δf_ss + (Δf(t) − Δf_ss) · e^(−K·Δt)
```

where the relaxation rate `K` is derived from the physical constants for the segment. Because the solution is analytic, the integration is **exact** (no step-size bias), and the timeline's *final* frequency is **bit-identical** to `evaluateUnderfrequencySystem(...).steadyStateHz` for the same final state.

### 8.3 Event-driven segment boundaries

A new segment begins (and the closed-form integrates a fresh interval) when any of the following occurs:

- a disturbance event time is reached (generator loss / load step / block);
- an UFLS stage trips (shed MW, latent change in `D`);
- a governor saturation crossing (a unit's `Δf` crosses `Δf_i,sat`);
- a stage is dis-armed / timer reset because frequency recovered above threshold.

The engine emits **dense snapshot grid samples** (default `~0.02 s`) plus **exact event-time samples**, so the curve is smooth and events are placed precisely.

### 8.4 Governor lag note

v1 models the governor as **static droop with a headroom clamp** — there is no first-order turbine/governor lag applied. This means the frequency response settles with a single exponential per segment. A governor lag term is a deliberate **future** refinement, not part of this release. (Consequence: the model is slightly stiffer in the sub-second window than a real machine with a finite-governor time constant, but it is deterministic, textbook-clean, and bit-exact — which the parity test requires.)

---

## 9. UFLS stage logic

### 9.1 Stage settings

```ts
interface UflsStageSettings {
  readonly id: UflsStageId;            // 'S1' | 'S2' | 'S3' | 'S4' | ...
  readonly label: string;              // 'Stage 1 — 49.50 Hz'
  readonly enabled: boolean;
  readonly thresholdHz: number;        // arming threshold
  readonly timeDelaySec: number;       // intentional delay (reset-definite-time)
  readonly shedFractionPct: number;    // % of pre-disturbance load
}
```

### 9.2 Pickup (arming) — strict inequality

```text
armed = f < thresholdHz && !nearlyEqual(f, thresholdHz)
```

At exact equality (`nearlyEqual(f, thresholdHz)`) the stage is **not** armed. This is the same `nearlyEqual` invariant as O02 (`M <= 1` is no-pickup).

### 9.3 Timer (reset-definite-time)

- When a stage arms, its timer accumulates engineering time.
- If frequency rises back to `f >= thresholdHz` (or `nearlyEqual`) before the delay elapses, the timer **resets to 0** and the stage re-arms only if it later falls below again.
- When the timer reaches `timeDelaySec`, the stage **trips**.

### 9.4 Trip and latch

- On trip, the stage sheds `shedMW_s = (shedFractionPct/100) · baseLoadMw` (the pre-disturbance load).
- The stage is **latched**: it never re-arms or re-sheds in the same run, even if frequency subsequently recovers and then falls again. (A stage that already shed is considered "operated"; a higher stage may still shed later.)
- After a trip, `D` decreases by `shedMW_s` and a **new segment** begins.

### 9.5 Stage ordering validation

- Stages must be ordered by **descending threshold** (S1 highest threshold, shed first; S_N lowest).
- If the user edits a stage so the thresholds are no longer strictly ordered (after applying `nearlyEqual` for the boundary), `validateUnderfrequencyStudy` reports `INVALID_UFLS_ORDER` and the study is INVALID (the engine does not silently reorder or clamp them).

---

## 10. Canonical presets (v1, study-only)

### 10.1 Default generator set (4 units, PLP-flavored but generic)

| Id | Type | MW_rated | MVA | H (s) | R (pu) | Poles | governorMax MW | Initial MW |
|---|---|---|---|---|---|---|---|---|
| G1 | Thermal (coal) | 600 | 700 | 5.0 | 5% | 2 | 640 | 500 |
| G2 | Hydro | 400 | 450 | 4.0 | 4% | 4 | 430 | 350 |
| G3 | Gas | 300 | 330 | 4.5 | 5% | 2 | 320 | 250 |
| G4 | CCGT | 250 | 280 | 3.0 | 6% | 2 | 265 | 200 |

- `baseLoadMw = 1300`; `Σ initialMW = 1300` (balanced).
- Total governor headroom (reserve) = `(640−500) + (430−350) + (320−250) + (265−200)` = **355 MW**.
- `fNominalHz = 50`, `voltageKv = 150`.

### 10.2 Default UFLS stages (typical global practice — `plnVerificationRequired`)

| Stage | Threshold Hz | Delay s | Shed % | Shed MW at 1300 MW |
|---|---|---|---|---|
| S1 | 49.50 | 0.20 | 5% | 65 |
| S2 | 49.00 | 0.30 | 10% | 130 |
| S3 | 48.50 | 0.40 | 15% | 195 |
| S4 | 48.00 | 0.50 | 20% | 260 |

### 10.3 Preset registry

| Preset | Description | Key scenario |
|---|---|---|
| `UFR-01` | Normal operation | Balanced; no disturbance; f = 50.00 Hz; all units ONLINE; no governor response. |
| `UFR-02` | Lose large unit | G1 loss (500 MW) → deficit 500 MW; expect ROCOF ≈ −(50/(2·H_sys))·(500/S_base); governor + UFLS arrest to a new steady state. |
| `UFR-03` | Lose two units | G1 + G2 loss (850 MW) → large deficit; deeper ROCOF; multiple UFLS stages operate; possible marginal collapse. |
| `UFR-04` | High inertia | All 4 units with H boosted (thermal heavy); slow ROCOF; single UFLS stage may arrest. |
| `UFR-05` | Low inertia | All H reduced; fast ROCOF; deep frequency excursion; multiple stages shed. |
| `UFR-06` | Small deficit | 100 MW load step (or small unit loss); governor alone arrests without UFLS; `finalFrequencyHz` = droop equation without UFLS. |

All presets set `notes.plnVerificationRequired = true`.

`DEFAULT_UNDERFREQUENCY_PRESET_ID = 'UFR-01'`.

These are **study presets**, not universal truths. Validation cases for v1 are limited to the swing equation, the droop/stiffness model, the UFLS stage logic, and the steady-state solver (Section 12).

---

## 11. Static operator result contract

### 11.1 Static result

```ts
interface UnderfrequencyStaticResult {
  readonly sBaseMva: number;
  readonly hSysSec: number;
  readonly betaPu: number;               // stiffness of the FINAL online/unsaturated set
  readonly betaMwPerHz: number;
  readonly initialRocofHzPerSec: number; // df/dt|₀ for the initial post-disturbance deficit
  readonly initialDeficitMw: number;     // D₀ (post-disturbance, pre-governor)
  readonly steadyStateHz: number;        // closed-form f_ss for the FINAL state (or null on collapse)
  readonly steadyStateStatus: 'SETTLED' | 'COLLAPSE';
  readonly governorResponseMw: Readonly<Record<GeneratorId, number>>;
  readonly generatorStatus: Readonly<Record<GeneratorId, UnderfrequencyGeneratorStatus>>;
  readonly uflsOperatedStageIds: readonly UflsStageId[];
  readonly totalShedMw: number;
  readonly displayStatus: 'OPERATE' | 'RESTRAIN' | 'INVALID';
  readonly issues: readonly DomainIssue[];
}
```

### 11.2 Display status

- `OPERATE` — at least one UFLS stage operated/shed, OR the frequency is below a stage threshold such that UFLS is operating (i.e. emergency control active). Used to drive the header operating tone.
- `RESTRAIN` — frequency is within normal band, no UFLS stage armed (or only the protective function invoked, no shedding), no collapse.
- `INVALID` — one or more inputs are non-finite, out of range, or the evaluation threw. The previous valid result is held and active-trip semantics are suppressed (consistent with R07 hardened state).

### 11.3 Boundary semantics

- **`COLLAPSE`** (steady-state status) — `β_pu → 0` (all online headroom exhausted) and the deficit cannot be recovered. The timeline ends at the collapse point; `steadyStateHz` is `null`.
- **`DEFICIT_EXCEEDS_AVAILABLE_GENERATION`** — the engine's explicit status when the requested deficit is beyond what the online set + remaining UFLS can arrest. It is a **status**, not an exception.

---

## 12. Validation cases (v1, equation-level)

### 12.1 Inertia-weighted H (positive case)

Given an online set of `{MVA: 700, H: 5.0}`, `{MVA: 450, H: 4.0}`, `{MVA: 330, H: 4.5}`, `{MVA: 280, H: 3.0}` (S_base = 1760):

```text
H_sys = (5.0·700 + 4.0·450 + 4.5·330 + 3.0·280) / 1760
      = (3500 + 1800 + 1485 + 840) / 1760
      = 7625 / 1760
      ≈ 4.3324 s
```

### 12.2 Initial ROCOF (positive case)

For the UFR-02 G1-loss (500 MW) case with `S_base = 1760`:

```text
D₀ = 500 MW
H_sys ≈ 4.3324 s
f_nom = 50 Hz
df/dt|₀ = -(50 / (2·4.3324)) · (500/1760) ≈ -1.640 Hz/s
```

(Exact value computed at engine time; the test asserts within `1e-6` of the hand-calculated closed form.)

### 12.3 Unsaturated steady state (positive case)

Small deficit, no saturation, no UFLS (`D = 100 MW`). The droop response per unit is `-Δf/f_nom · MVA_i/R_i` (MW), and steady state requires `Σ resp_i(Δf_ss) = D`:

```text
β_pu = Σ MVA_i/R_i = 700/0.05 + 450/0.04 + 330/0.05 + 280/0.06
      = 14000 + 11250 + 6600 + 4666.67
      = 36516.67   [pu]

-Δf_ss/f_nom · β_pu = D     ⇒   Δf_ss = -f_nom · D / β_pu
Δf_ss = -50 · 100 / 36516.67 ≈ -0.1369 Hz
f_ss  ≈ 49.863 Hz
```

### 12.4 Saturation → collapse (negative boundary case)

Push the deficit beyond the total available governor headroom + remaining UFLS. The engine must return `steadyStateStatus: 'COLLAPSE'` / `DEFICIT_EXCEEDS_AVAILABLE_GENERATION`, **not** throw. Frequency never leaves finite range; the final snapshot is the collapse point.

### 12.5 UFLS strict boundary (negative case)

For `thresholdHz = 49.50`:

- `f = 49.500` (exact) → `nearlyEqual(f, threshold)` → **not armed**.
- `f = 49.50 - 1e-9` (just below) → `f < threshold && !nearlyEqual` → **armed**.
- `f = 49.51` → `f < threshold` is false → **not armed**.

### 12.6 Stage ordering (negative case)

If `S2.thresholdHz >= S1.thresholdHz` (after tolerance), `validateUnderfrequencyStudy` reports `INVALID_UFLS_ORDER`.

### 12.7 Non-finite guard (negative case)

`f_nom <= 0`, `H <= 0`, `R <= 0`, `MVA <= 0`, `poles <= 0` → `INVALID` with the corresponding issue code. No exception is thrown.

---

## 13. Parity and hardening guarantees

### 13.1 Static ↔ timeline parity

For `UFR-02`, `UFR-06`, and single-stage variants:

```text
|timelineRun.finalFrequencyHz − evaluateUnderfrequencySystem(study).steadyStateHz| < 1e-6
```

Because the segment integration is exact closed-form (§ 8.2), this is bit-exact, not merely approximate.

### 13.2 Determinism

`computeUnderfrequencyTimeline(study)` called twice → `JSON.stringify` identical. Playback speed does not affect engineering time. Float timestamps handled by `canonicalTime`/`sameTime` helpers so simultaneous events are not split.

### 13.3 Hardening (seeded LCG)

A deterministic seeded LCG (seed `0x81_50_2026`) sweeps boundary cases and asserts the engine never throws and always returns finite frequencies or an explicit non-finite-status.

---

## 14. UI hierarchy and language (U01)

- The Underfrequency module **reuses** the Differential R10 / Overcurrent O15 / Distance D01 visual and interaction language, but is **deliberately re-balanced and scaled up** to address the readability / scan-ability concerns raised against the earlier modules:
  - light-mode-first (`` `simulator-theme simulator-theme-light` ``), following Differential R10 light mode;
  - 3-column desktop layout (Parameters ~24% / Live Simulation hero ~52% / Analysis ~24%), with parameter and analysis groups **collapsed by default** so the first thing seen is data & physics, not a form;
  - typography scaled up: parameter-group titles 15–16px semibold, field labels 13px, engineering numbers 14px tabular-nums, big-number summary tiles 22–28px;
  - a single **blue accent** for data/series + three semantic colors: **green** = normal/secure/restrain, **amber** = warning/UFLS-armed/verification-needed, **red** = operate/shed/collapse;
  - `f(t)` curve uses **one accent** color (no gradient), with urgency carried by UFLS markers (amber → red) and header tone, never by the curve hue;
  - **big-number summary tiles** across the top of the Live column: `f NOW / ROCOF / DEFISIT / MIN f`, each with a semantic tone;
  - an optional **Story mode** (a button, not the primary view): step chips + phase narrative driven by the analysis model, scrubbing `timeSec` synchronously with the curve and UFLS markers;
  - generator blocks show per-generator pre/post MW, headroom, status chips (`ONLINE`, `AT LIMIT`, `TRIPPED`), and RPM derived from `f`;
  - light-mode contrast meets WCAG AA (4.5:1) on all meaningful fg/bg pairs.
- The dominant visual is the **frequency-vs-time curve**; the generator diagram and the shedding chart are secondary cards beneath it.

---

## 15. Verification gate

Before declaring REFERENCE MODULE READY for Underfrequency:

1. TypeScript strict type-check passes for the Underfrequency module (`npx tsc --noEmit` → 0 errors).
2. Engine / timeline / preset / workflow runtime checks pass (`npx vitest run src/engines/underfrequency*`, `src/studies/underfrequencyPresets.test.ts`, `src/utils/evaluateUnderfrequencyParameters.test.ts`).
3. Parity test passes: `|timelineRun.finalFrequencyHz − evaluateUnderfrequencySystem(...).steadyStateHz| < 1e-6`.
4. Hardening (seeded LCG) passes; the engine never throws.
5. Vitest and Vite build pass (`npx vitest run`, `npm run build`).
6. Manual browser smoke confirms the f(t) curve, the generator RPM/load diagram, the shedding chart, the UFLS markers, the Story mode, the playback animation, and the Reset path.
7. The `.agents/skills/ui-adversarial-test/SKILL.md` gate is run against the module before any PASS verdict; unresolvable → `BLOCKED`.

---

## 16. Still outside scope for Underfrequency v1

Multi-machine transient stability, network power flow, generator per-unit frequency trip as an independent element, ROCOF trip element, U/VLS, islanding detection, automatic load restoration, dynamic governor/turbine lag, unit commitment, frequency-dependent load model, and full network topology.

---

## 17. Glossary

- **Coherent system:** the assumption that all online synchronous machines swing together at a single `f(t)`; valid for the study's single-area model, invalid for inter-area oscillations.
- **Droop (R):** per-unit slope of the generator's governor frequency-power characteristic; `5%` droop means a 5% frequency deviation produces 100% (i.e. 1 pu) output change.
- **Governor headroom:** `MW_max − P0`, the MW a unit can still raise before hitting its limit.
- **Inertia constant (H):** stored kinetic energy at rated speed, normalized to rated MVA, in seconds.
- **ROCOF:** rate of change of frequency `df/dt`, in Hz/s.
- **UFLS:** underfrequency load shedding — a staged, emergency control that sheds discrete blocks of load when frequency falls below threshold.
- **Shedding amount:** pre-disturbance load × shed fraction; computed once, not re-derived from post-fault load.
- **Collapse:** the condition where `β_pu → 0` (all headroom exhausted) and deficit exceeds available generation; the model returns this as a status rather than a numeric steady state.
- **System stiffness (β):** the MW/Hz of the governor droop aggregate; `β_pu/f_nom` in MW/Hz.
