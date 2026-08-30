# Differential Relay Engineering Specification

**Status:** APPROVED — cumulative Differential revision, 2026-08-13.

## Scope

Reference simulator for a **simplified two-terminal percentage-restraint differential element** with an optional load-driven transformer current model.

This simulator is an educational/protection-engineering study model. It is **not a vendor-specific relay emulation** and is not yet a complete transformer-differential (87T) implementation.

Primary-source terminology and characteristic concepts were checked against ABB differential-protection application guidance and the SEL-787 transformer differential data sheet. The implementation remains a generic piecewise characteristic rather than reproducing any one vendor algorithm.

## Current/reference convention

- Terminal quantities are **signed scalar RMS currents**, not complex phasors.
- Positive current direction is defined as **entering the protected zone** from each terminal.
- The measurement chain converts primary current to CT-secondary current using the explicit CT ratio plus a simplified ratio-error term.
- Differential calculations use **CT-secondary amperes (A)**.
- The relay decision is `OPERATE` or `RESTRAIN`; breaker opening is not inferred.

## System operating inputs

Two user modes are supported.

### Load Driven

The user defines:

- transformer rated apparent power `Sn` in MVA;
- terminal-1 rated line-to-line voltage `V1` in kV;
- terminal-2 rated line-to-line voltage `V2` in kV;
- pre-fault active load `P` in MW;
- displacement power-factor magnitude `pf`.

The model calculates:

`Sload = P / pf`

`Loading % = 100 × Sload / Sn`

For a three-phase terminal:

`I = S / (sqrt(3) × VLL)`

with consistent MVA/kV-to-A scaling.

Normal load uses the derived load current. Simplified fault scenarios use a configurable multiple of each terminal rated current. That fault multiple is a **study control**, not a network short-circuit calculation.

### Direct Current

The user directly enters signed terminal primary currents `I1p` and `I2p`. Editing either current switches the physical operating input to Direct Current and marks the scenario Custom/Modified.

## CT measurement chain

For each CT:

`Isec_ideal = Iprimary × (CT_secondary_rated / CT_primary_rated)`

`Imeasured = Isec_ideal × (1 + errorPct/100)`

Engine validation requires:

- finite primary current;
- CT primary rating > 0 A;
- CT secondary rating > 0 A;
- ratio error finite and greater than -100%.

The UI study range for ratio error is -10% to +10%.

## Differential quantities

Using measured CT-secondary currents `I1` and `I2`:

`Idiff = |I1 + I2|`

`Ibias = (|I1| + |I2|) / 2`

## Piecewise restrained characteristic

The characteristic is continuous and starts with a horizontal minimum-operate level.

Settings:

- `Iset`: minimum operate current / horizontal level;
- `BP1`: first bias-current turning point, end of the horizontal section;
- `Slope1`: percentage slope from BP1 to BP2;
- `BP2`: second turning point;
- `Slope2`: percentage slope above BP2 in Dual-Slope mode;
- optional `BP3` and `Slope3` in Multi-Slope mode.

### Region 0 — horizontal minimum operate current

For `Ibias <= BP1`:

`Iop = Iset`

### Region 1 — Slope 1

For `BP1 < Ibias <= BP2`:

`Iop = Iset + (Slope1/100) × (Ibias - BP1)`

### Region 2 — Slope 2

Let:

`T(BP2) = Iset + (Slope1/100) × (BP2 - BP1)`

For Dual-Slope mode, or Multi-Slope while `BP2 < Ibias <= BP3`:

`Iop = T(BP2) + (Slope2/100) × (Ibias - BP2)`

### Region 3 — optional Slope 3

Multi-Slope only.

Let:

`T(BP3) = T(BP2) + (Slope2/100) × (BP3 - BP2)`

For `Ibias > BP3`:

`Iop = T(BP3) + (Slope3/100) × (Ibias - BP3)`

The engine requires `BP2 > BP1`, and in Multi-Slope mode `BP3 > BP2`.

## Decision boundary

- `OPERATE` when `Idiff > Iop`
- `RESTRAIN` when `Idiff <= Iop`
- equality intentionally remains RESTRAIN.

## Reference settings

Current simulator defaults:

- `Iset = 0.20 A secondary`
- `BP1 = 0.50 A secondary`
- `Slope1 = 25%`
- `BP2 = 2.00 A secondary`
- `Slope2 = 50%`
- mode = `Dual-Slope`
- dormant Multi-Slope defaults: `BP3 = 5.00 A`, `Slope3 = 80%`.

These are **study defaults**, not universal coordination recommendations.

## Reference load model

Default study transformer:

- 25 MVA
- 150 kV / 20 kV
- 13.5 MW pre-fault active load
- power factor 0.90
- resulting apparent load 15 MVA / 60% loading.

Default CTs:

- CT1 = 100/1 A
- CT2 = 750/1 A

The CT ratios are explicit user settings and approximately normalize the reference transformer terminal currents. There is no hidden vector-group/tap compensation.

## Characteristic graph behavior

The default graph view is **characteristic-priority**, not operating-point-priority. Axis scaling is based primarily on characteristic turning points so `Iset`, turning points, and slopes remain readable when an operating point becomes very large.

If the operating point lies outside the default characteristic view:

- the real operating point is represented by an off-scale edge marker with actual coordinates;
- `Fit Point` temporarily expands the axes around the point;
- `Characteristic` returns to the characteristic-priority view.

This prevents large external/CT-mismatch scenarios from compressing characteristic labels into the left edge.

## UI input validation

Invalid drafts are not committed to engineering state. The calculation continues using the last valid engineering value and the UI shows `INPUT INVALID` until the draft is corrected.

Relational turning-point constraints are also enforced by the UI and engine.

## Current limitations

Not modelled in this revision:

- complex phasor angle;
- transformer vector-group compensation;
- zero-sequence compensation;
- automatic relay tap/current-base compensation beyond explicit CT ratios;
- CT saturation;
- magnetizing inrush or harmonic blocking/restraint;
- network short-circuit impedance solution;
- breaker operating time or post-trip current solution.

These require separate engineering specifications and should not be inferred into the engine.

## Verification requirements

1. Differential engine tests for horizontal Iset, all slope regions, strict boundary, and invalid settings.
2. Continuity checks immediately below/at/above each active turning point.
3. Load-driven system tests for MVA/MW/PF/kV current calculations and sign convention.
4. Production preset integration through system condition -> CT measurement -> differential decision.
5. Workflow tests for load parameter edits, Direct Current mode, Custom scenario, Apply/Clear Fault, characteristic mode, and Reset.
6. UI smoke tests for viewport-aware tooltips and characteristic/off-scale graph behavior.
