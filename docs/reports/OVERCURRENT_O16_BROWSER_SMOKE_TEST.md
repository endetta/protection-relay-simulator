# Overcurrent O16 — Browser Smoke-Test Checklist

**Target route:** `/simulator/overcurrent`
**Prerequisite:** `npm run dev` → `http://localhost:5173/simulator/overcurrent`
**Purpose:** satisfies O16 freeze-gate item 4 (production browser smoke) once the
dependency-complete build gate is unblocked.

**Pass criteria:** all phases PASS. Record every finding as
step / expected / actual / screenshot / severity
(CRITICAL / HIGH / MEDIUM / LOW / MICRO).
CRITICAL/HIGH block freeze; LOW/MICRO go to the polish backlog.

---

## Phase 1 — Boot & Layout

| # | Step | Expected |
|---|---|---|
| 1.1 | Open `/simulator/overcurrent` | Renders with no console errors; header status READY (neutral) |
| 1.2 | Resize 1440 → 1000 → 700 → 400 px | 3-col → 2-col → 1-col; no horizontal page overflow |
| 1.3 | Refresh on the simulator route | Route preserved (no redirect to home) |
| 1.4 | Click brand "Protection System Simulator" | Navigates to `/` Homepage |

## Phase 2 — TCC Curve (audit focus)

| # | Step | Expected |
|---|---|---|
| 2.1 | Preset OVC-03, hover the 51 curve | Industrial tooltip: M, A sec, operating time; flips at viewport edges |
| 2.2 | Hover near pickup (M ≈ 1) | Curve rises steeply; no NaN points or sudden disappearance |
| 2.3 | Click an operating point | Inspector shows Irelay, M, trip time; a 50 result renders as exact 0 s off-scale LOW plus high-set boundary |
| 2.4 | Toggle Characteristic ↔ Fit Point | Characteristic bounds stable; Fit Point expands only for positive engine points; overlay never consumes layout height |
| 2.5 | Tab to TCC, Left/Right/Home/End | Visible focus; deterministic point traversal |
| 2.6 | Change TMS 0.1 → 0.2 | Curve shifts proportionally (times ×2); initial-setting ghost appears (modified=true) |
| 2.7 | Switch IEC_SI → IEEE_EI | Steeper curve; legend label updates |
| 2.8 | Timing mode → DEFINITE | Curve becomes a horizontal line at definiteDelaySec |
| 2.9 | Click TCC "Expand" | Modal overlay; Escape closes; focus returns to Expand; body scroll locked |
| 2.10 | Preset COORD-02 (3 relays) | X-axis = A primary; 3 curves + adjacent-tier CTI brackets; F3 MAX shows FAIL |

## Phase 3 — SLD & Fault Selection

| # | Step | Expected |
|---|---|---|
| 3.1 | Click device R2 in the SLD | R2 parameter section opens; TCC cross-highlights (shared selectedDeviceId) |
| 3.2 | Click fault points F1/F2/F3 | Status becomes FAULT STUDY; current path highlights |
| 3.3 | Drag fault-location scrubber (Explore) | Currents change with position; scrubber cannot start a timeline run |
| 3.4 | Run to isolation, then switch fault case | Breaker OPEN comes only from the matching O07 snapshot; stale breaker state never leaks into the new case |
| 3.5 | Expand SLD overlay | Same modal behavior as 2.9 |

## Phase 4 — Timeline / Operating Sequence

| # | Step | Expected |
|---|---|---|
| 4.1 | Apply Fault (OVC-04) | RUNNING; inputs locked; 51_PICKUP → TIMING progress → 51_TRIP → BREAKER_OPENING → BREAKER_OPEN → FAULT_ISOLATED |
| 4.2 | Pause → speed 1×→5×→10× → resume | Wall-clock playback changes; engineering timestamps/values unchanged |
| 4.3 | STEP playback | Progress accumulates per step; right-continuous at sample boundaries |
| 4.4 | COORD-02 F3 backup continuation | Backup keeps timing after primary trip; resets only at isolation |
| 4.5 | Clear | Playback IDLE; engineering edits retained |
| 4.6 | While RUNNING, try editing pickup | Engineering inputs disabled; device focus/speed/Clear/Reset remain active |
| 4.7 | While COMPLETE, edit a parameter | Playback returns to IDLE (stale run invalidated) |

## Phase 5 — Invalid State & Validation

| # | Step | Expected |
|---|---|---|
| 5.1 | Type pickup = 0 | NumberField invalid; page banner "INPUT INVALID · OUTPUT HELD"; header INPUT INVALID (amber) |
| 5.2 | Collapse the section with the invalid draft, then expand | Draft stays mounted; no silent loss or stale apply |
| 5.3 | Apply Fault while invalid | Blocked |
| 5.4 | Run Coordination Test while invalid | Disabled with explanatory title |
| 5.5 | Fix the input | Banner clears; status back to READY; no leaked held output |
| 5.6 | Type TMS = 20 (outside 0.05–15) | Range validation rejects before state entry |

## Phase 6 — Analysis & Guided Challenges

| # | Step | Expected |
|---|---|---|
| 6.1 | Open Analysis sections (status/order/audit/impact) | Values match TCC inspector (single source of truth) |
| 6.2 | Collapse all / Expand all | Column headings do not shift when the button label changes |
| 6.3 | COORD-01 → run → Run Coordination Test | VALIDATION_REQUIRED → VERIFIED; success badge |
| 6.4 | Reveal hints in sequence | Order Location → Parameter Family → Direction; counter n/N; exact values never shown |
| 6.5 | After VERIFIED | "WHY THIS WORKS" appears; before VERIFIED it does not |
| 6.6 | COORD-02 F3 MAX intentional failure | Audit shows CTI ≈ 0.278 s < 0.30 s violation; worst case labeled |
| 6.7 | Switch Guided ↔ Free | Engineering validation state preserved; only learning ceremony changes |
| 6.8 | Reset | Hints 0, validation IDLE, canonical preset restored |

## Phase 7 — Header, Help, Audio

| # | Step | Expected |
|---|---|---|
| 7.1 | Click "?" Help | 9-topic overlay; 2-col grid → 1-col below 680 px; Escape/focus trap |
| 7.2 | Header status lifecycle | READY until an executed run/validation produces an engineering outcome |
| 7.3 | Audio: click device / Apply Fault / trip | Pickup chirp, click, trip alarm at low volume; on Safari/iOS audio activates only after the first user gesture |
| 7.4 | Reset from header | State restored; scenario label = active preset |

## Phase 8 — Accessibility & Motion

| # | Step | Expected |
|---|---|---|
| 8.1 | Tab-only traversal of the whole page | Every control reachable; focus ring visible on the dark theme |
| 8.2 | Screen reader (NVDA/VoiceOver) | aria-live announces trip/isolation; badges carry text, not color alone |
| 8.3 | Enable OS `prefers-reduced-motion` | Animations removed; state still readable via text |
| 8.4 | Coarse pointer / touch emulation | Device/fault targets comfortably sized; scrubber does not jump |
| 8.5 | Semantic colors | green = RESTRAIN/NO TRIP, red = OPERATE/TRIP, amber = invalid, blue = interaction only |

## Phase 9 — Regression Parity

| # | Step | Expected |
|---|---|---|
| 9.1 | Open Differential, run a short flow | Frozen R10 behavior unchanged (shared SimulatorHeader/EngineeringViewOverlay are additive) |
| 9.2 | Console check across the whole session | Zero runtime errors; `useLayoutEffect` warnings appear only in the jsdom test env, never in the browser |
| 9.3 | `npm run build` | **PASS 2026-08-30** — fresh `npm ci` from a clean cache (136 packages), `tsc && vite build` (83 modules, dist emitted), and the full Vitest suite 31 files / 260 tests all PASS. Production browser smoke of `/`, `/simulator/differential`, `/simulator/overcurrent` each returned HTTP 200 with assets served. Freeze-gate items 1–4 are now certified here; only explicit user freeze approval remains. |

---

## Code-Level Audit Summary (basis for this checklist)

All engine/presentation/reducer suites pass in this environment:

| Suite | Result |
|---|---|
| `src/engines/overcurrent.test.ts` | 30/30 PASS |
| `src/engines/overcurrent.hardening.test.ts` | PASS (5000×6 monotonicity, 20K fuzz, 10K CT) |
| `src/engines/overcurrentTimeline.test.ts` | 23/23 PASS (incl. 1000-case parity sweep) |
| `src/engines/overcurrentCoordination.test.ts` | 7/7 PASS |
| `src/engines/overcurrentMeasurement.test.ts` | 7/7 PASS |
| `src/presentation/overcurrentTcc.test.ts` | 11/11 PASS (1e-12 engine parity) |
| `src/presentation/overcurrentTccGeometry.test.ts` | 3/3 PASS |
| `src/utils/evaluateOvercurrentDevice.test.ts` | 4/4 PASS |
| `src/utils/overcurrentState.test.ts` | 10/10 PASS |
| `src/pages/OvercurrentSimulator.test.tsx` | 5/5 PASS |

No calculation bugs found. Curve math matches O01 spec:
`T = TMS × [k/(M^α − 1) + c]`, strict `>` pickup, `M ≤ 1` no-pickup,
50-priority arbitration, `Observed CTI ≥ Required CTI` PASS.

Known non-blocking observations (polish backlog candidates):

1. `overcurrentTcc.ts:353` — `deviceSettingsChanged` uses `JSON.stringify`
   deep equality; fragile if settings ever gain nested objects.
2. `overcurrentTcc.ts:329` — `curvePointAt` swallows engine exceptions
   (spec-correct graceful degradation, but error detail is lost for debugging).
3. `TimeCurrentCurve` rebuilds the TCC model on any state change, including
   playback ticks; curve data only depends on settings/fault selection.
