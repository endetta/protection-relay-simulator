# Overcurrent Relay O10H: TCC Hardening / PRD Closure

**Status:** IMPLEMENTED / PASSED  
**Date:** 2026-08-14  
**Parent:** accepted O10 source, SHA-256 `c61323d78ed844ef96ae0080c33c2453293f80faebc0d7ac5a1ec6096e5bcf92`

## 1. Purpose

O10H is a hardening gate between accepted O10 and O11. It closes presentation correctness and PRD-completeness issues found during the final pre-O11 audit. It does not change O03/O04 50/51 calculations, O05 study semantics, O06 coordination equations, O07 timeline behavior, O08 parameter state, or O09 SLD behavior.

## 2. Closed findings

### 2.1 Adjacent-tier CTI mapping

O10 previously evaluated every backup against the physical primary device. This was correct for Backup 1 but incorrect for Backup 2 and later tiers.

O10H follows the explicit protection chain:

`PRIMARY -> BACKUP 1 -> BACKUP 2 -> ...`

For each backup, the active CTI now comes from the configured O06 pair whose primary side is the immediately preceding device in that chain.

Canonical F3 therefore exposes:

- R2: pair `R3 -> R2`, CTI ~= 0.278307692 s, FAIL against 0.300 s;
- R1: pair `R2 -> R1`, CTI ~= 0.695250000 s, PASS against 0.300 s.

The presentation model stores `coordinationPairId`, `precedingDeviceId`, `ctiToPreviousSec`, required CTI, and pair status. No CTI formula is duplicated in the renderer.

### 2.2 Active coordination bracket

The Overcurrent PRD requires an active coordination bracket. O10H adds generic `COORDINATION_BRACKET` TCC layers and render-ready bracket records derived only from O06 pair results.

For N devices on a configured chain, up to N-1 active adjacent-tier brackets are produced when both trip times are finite and positive. The graph shows:

- connector from the two active operating points;
- vertical time separation;
- observed `Delta t`;
- required CTI;
- PASS/FAIL semantic tone.

The implementation uses device/pair IDs and contains no R1/R2/R3 branch.

### 2.3 Below-pickup versus off-scale

A below-pickup device has no finite operate time. O10 previously represented that null time as `LOW` off-scale, which could make the `Fit Point` control appear even though there was no operating time to fit.

O10H separates the states:

- below pickup: study marker, `selectedTripTimeSec = null`, `timeOffScale = null`;
- 50 instantaneous: exact `0 s`, `timeOffScale = LOW` because zero cannot appear on a positive log-time axis;
- finite 51 point outside characteristic bounds: genuine `LOW/HIGH` off-scale state.

`Fit Point` is now offered only when an operating result with a non-null trip time is outside the characteristic domain, or while already in Fit Point mode.

### 2.4 SVG pointer mapping

O10 mapped pointer x-position from the full CSS bounding rectangle. With `preserveAspectRatio="xMidYMid meet"`, letterboxing can make that mapping inaccurate at some viewport aspect ratios.

O10H first uses the browser's actual SVG `getScreenCTM().inverse()` transform. If unavailable, it falls back to a deterministic `xMidYMid meet` mapping in `overcurrentTccGeometry.ts`.

Permanent geometry tests cover horizontal and vertical letterboxing plus invalid dimensions.

### 2.5 TCC scrollbar and relay identity palette

The internal horizontal TCC scrollbar is reduced from a 7 px rounded thumb to a 2 px square thumb, matching the established compact simulator language without changing graph layout.

Relay series identity no longer uses semantic green/amber/red. A restrained technical blue/steel/lilac palette plus dash patterns identifies relays. Semantic colors remain reserved for PASS/FAIL/timing/trip meaning.

## 3. Production files changed

- `src/types/overcurrent.ts`
- `src/presentation/overcurrentTcc.ts`
- `src/presentation/overcurrentTccGeometry.ts` (new)
- `src/components/overcurrent/TimeCurrentCurve.tsx`
- `src/components/overcurrent/timeCurrentCurve.css`

Permanent tests updated/added:

- `src/presentation/overcurrentTcc.test.ts`
- `src/presentation/overcurrentTccGeometry.test.ts` (new)
- `src/components/overcurrent/TimeCurrentCurve.test.tsx`

## 4. Verification performed in this environment

Because the source archive intentionally contains no `node_modules`, a fresh Vite/Vitest install cannot be completed offline in this runtime. The uploaded parent archive hash exactly matches the previously accepted O10 archive that had TypeScript, Vite build, and O03-O10 Vitest evidence.

O10H-specific verification performed here:

- 66 TS/TSX files: TypeScript parser/transpile syntax diagnostics = 0;
- strict pure Overcurrent TypeScript compile = PASS;
- 2-relay active bracket contract = PASS;
- canonical 3-relay adjacent-tier CTI mapping = PASS;
- synthetic 4-relay active bracket contract = PASS;
- CTI equality boundary remains PASS = PASS;
- below-pickup is not time-off-scale = PASS;
- 50 exact 0 s remains LOW off-scale = PASS;
- all registered presets, both Characteristic/Fit modes: finite-coordinate and unique-layer scan = PASS;
- 101 configured COORD-02 scrubber positions: finite TCC/bracket scan = PASS;
- xMidYMid/meet wide and narrow pointer fallback mapping = PASS;
- strict diff confirms O03-O09 production engines/state/SLD remain unchanged.

## 5. Gate decision

O10H closes the pre-O11 audit findings. The accepted baseline after this gate is **O10H / O10 FINAL HARDENED**.

Next allowed gate: **O11 — Operating Sequence**.
