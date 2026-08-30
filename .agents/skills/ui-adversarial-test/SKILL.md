---
name: ui-adversarial-test
description: Adversarial UI/UX verification harness. A cruel, critical,
bug-hungry schema used by ANY UI/UX agent to test the RESULT of its own
revisions before declaring them done. Proactively tries to BREAK the UI,
prove fixes actually fixed, and hunt regressions, edge cases, and lies
("looks fine"). Use after every UI/UX edit, before any PASS verdict, and
in /fix-ui, /audit-ui, /deep-audit, /ux-review, and /build-module flows.
---

# UI/UX Adversarial Test Schema — "Break It Before They Do"

## Usage guidance (READ THIS FIRST)

**When to read this skill:**
- AFTER any UI/UX change is made (this is a *verification* harness, not a
  discovery audit — it tests the *result of a revision*).
- Before writing the word "PASS", "fixed", "done", "looks good", or
  "resolved" anywhere in a UI/UX report.
- When a user says: "test", "verify", "validate the fix", "are you sure",
  "yakin sudah bener", "coba rusak", "cari bug", "pastikan tidak ada error",
  "uji", "cek hasil revisi".
- In `/fix-ui`, `/audit-ui`, `/deep-audit`, `/ux-review`, `/build-module`
  as the mandatory final gate.

**How to read efficiently:**
- **Quick gate (T1/T2):** Read "The Iron Rules" + "Gate 0 — Anti-Laziness"
  + "Gate 4 — Regression Sweep" + the verdict block.
- **Full gate (T3/DEEP):** Read the entire skill and run ALL gates.
- **Torture inputs only:** Read "Gate 2 — Domain Torture Matrix".

**Do NOT use this skill for:**
- Finding *new* design issues in untouched UI (use `ui-ux-auditor` +
  `senior-ui-ux-reviewer` instead).
- Engine/math validation (delegate to `engineering-validator`).

## Core principle — adversarial, not cooperative

A normal audit asks *"is this good?"*. This schema asks
**"how do I prove this is broken?"** and does not stop until it either
finds a defect or exhausts every attack with recorded evidence.

You are NOT the author of the code. You are the hostile QA engineer, the
angry protection engineer at 2 AM during a commissioning test, the new
intern who clicks everything twice, the user on a 1366px laptop with a
trackpad, the person who tabs through the form, the person who resizes
the window while a curve is animating. **Assume every revision is guilty
until proven innocent by evidence.**

The output of this skill is a **verdict with proof**, never an opinion.

## The Iron Rules (violating any one voids the verdict)

1. **No self-certification.** The agent that made the change may not
   declare it correct without running the gates below and pasting evidence.
2. **No "looks fine".** Every PASS claim must carry EVIDENCE: a measured
   value, a DOM/CSS assertion, a screenshot observation, a test name, or a
   command output. "It appears correct" is an automatic FAIL.
3. **Reproduce before you report.** A suspected bug must be reproduced
   (manually in browser, or by a written failing test) before it is logged.
4. **A fix is not done until it is broken-again-tested.** Re-introduce the
   original failure condition; confirm it no longer fails.
5. **Every fix must be diffed for collateral damage.** Run the Regression
   Sweep (Gate 4) on everything the changed code can touch.
6. **Severity inflation AND deflation are both failures.** A real CRITICAL
   downgraded to LOW to reach a PASS is misconduct. So is a cosmetic nit
   inflated to block release.
7. **If you cannot test it, you cannot PASS it.** Blocked environment →
   verdict is `BLOCKED`, never `PASS`.
8. **Honor the frozen boundary.** Do not "fix" a FROZEN module (Differential
   R10) to make a test pass; report the conflict instead.

## Gate 0 — Anti-Laziness / Anti-Rubber-Stamp (mandatory, always)

Before any other gate, answer in writing:

- [ ] What EXACTLY did I change? (files + line ranges, not "the UI")
- [ ] What was the original defect, stated as a falsifiable claim?
      (e.g. "at 1440px the SLD panel overflowed horizontally")
- [ ] What is my **smallest reproduction** of that original defect?
- [ ] What could my change have broken that I did NOT intend?
- [ ] Am I about to declare PASS without opening a browser / running a test?
      → If yes, STOP. That is the failure mode this gate exists to catch.

**Reflexive-bias checklist** (mark each honestly):
- [ ] Sunk-cost bias: "I spent time on this, so it must be right." → reject.
- [ ] Happy-path bias: did I only test the default/ideal state?
- [ ] Author-blindness: did I re-read the code as-written instead of
      as-intended?
- [ ] Fresh-eyes test: would an engineer who did NOT write this find it
      obvious, or would they trip?

## Gate 1 — Fix Verification (did the fix actually fix it?)

For EACH finding the revision claims to resolve:

1. Restate the original 7-field evidence (WHAT/WHERE/WHY/EVIDENCE/
   EXPECTED/ROOT CAUSE/FIX) from the audit that produced it.
2. Re-run the exact reproduction from Gate 0.
3. Record one of:
   - `VERIFIED-FIXED` — repro no longer triggers, with new evidence.
   - `PARTIALLY-FIXED` — symptom reduced but still reachable; give the
     remaining repro steps. Treat as an OPEN defect.
   - `NOT-FIXED` — repro still triggers. CRITICAL if it was CRITICAL.
   - `FIXED-BUT-BROKEN-ELSEWHERE` — original gone, new defect introduced.
     Log the new defect at its own severity.
4. **Root-cause confirmation:** confirm the fix addresses ROOT CAUSE, not
   just the symptom. A symptom patch (e.g. `overflow:hidden` to hide a
   real width bug) is a `NOT-FIXED` with a note "cosmetic masking".

## Gate 2 — Domain Torture Matrix (protection-relay specific)

Attack the simulator with the inputs a real engineer or a malicious user
would produce. For each control/panel in scope, try to break it.

### 2.1 Numeric / parameter torture
- [ ] `0`, negative, and extreme-max values in every numeric field.
- [ ] Values out of valid range → must show **explicit invalid state**,
      never silently clamp or auto-correct (design-guide §5).
- [ ] Non-numeric input: letters, spaces, `-`, `.`, `..`, `1e999`, `NaN`,
      `Infinity`, emoji, pasted `"12; drop table"`.
- [ ] Decimal separators: `2.5` vs `2,5`; trailing/leading dots; `007`.
- [ ] Empty field then blur; empty field then submit; paste-then-tab.
- [ ] Rapid typing / spinner hold (`usePressRepeat`) → no stuck state,
      no runaway increment, no dropped final value.
- [ ] Unit boundary: does changing CT ratio / kV / MVA keep derived
      currents consistent on screen, or show a stale number?
- [ ] Very long numbers (e.g. `1234567.89 A`) → no clipping, no overflow,
      tabular alignment intact.

### 2.2 State-machine torture (relay states)
- [ ] Force every state: RESTRAIN → PICKUP → TRIP → BREAKER-OPEN →
      ISOLATED → BACKUP → RESET. Confirm each has a distinct, correct,
      semantic color (red=TRIP, amber=PICKUP, green=RESTRAIN — never mixed).
- [ ] Jump states out of order (Clear mid-trip, scrub backwards past trip).
- [ ] Toggle lock/Clear repeatedly and fast → no visual desync between
      SLD, TCC, Operating Sequence, and Analysis.
- [ ] Does a color ever encode the WRONG engineering meaning during a
      transition frame (e.g. green flashing during a fault)?

### 2.3 Timeline / scrubber torture
- [ ] Scrub to exact sample boundaries; same-timestamp events; 0 ms and
      max-duration faults.
- [ ] Change playback speed mid-scrub and mid-animation → no jump, no
      wall-clock leaking into engineering time.
- [ ] Play → pause → scrub → play → Clear → Play. Any stuck animation?
      Any rAF leak (must cancel on unmount)?
- [ ] Fault cleared externally while playing.

### 2.4 SVG chart torture (TCC / SLD / characteristic)
- [ ] Fit Point / zoom / pan to extremes → operating point off-scale
      behavior correct, no NaN coordinates, no path collapse.
- [ ] Pointer-map accuracy: does the tooltip/hover point match the actual
      SVG coordinate at every zoom level?
- [ ] Zero-length / single-point curves; fully flat curves; curves with one
      breakpoint; multi-slope with breakpoint 3.
- [ ] Resize the container while a curve-draw animation is running.
- [ ] Legend color vs actual series color — exact match, no drift.

### 2.5 Empty / loading / error states
- [ ] No study selected; no device selected; zero cases; one case;
      hundreds of cases.
- [ ] A panel whose data source returns empty → does it show a designed
      empty state or a broken/blank rectangle?
- [ ] Simulate a thrown engine error → does the UI degrade gracefully or
      white-screen?

## Gate 3 — Interaction & Accessibility Attack

- [ ] **Keyboard-only sweep:** reach every control, tab order logical,
      focus ring always visible (2px, `--focus-ring`), no focus trap leaks,
      modal focus returns to trigger on close.
- [ ] **Hover-only sins:** every hover interaction must also work on focus
      and on tap. Find any tooltip/action reachable only by mouse.
- [ ] **Live-update rule:** change a parameter → visualization updates in
      <100 ms with NO "calculate" button. Verify there is no manual
      recompute trigger.
- [ ] **`prefers-reduced-motion`:** enable it → all transitions/keyframes
      collapse to ~0.01 ms, no flashing, no lost information.
- [ ] **Contrast:** every meaningful fg/bg pair ≥ WCAG AA (4.5:1 text,
      3:1 large/UI) on the dark surface. Measure, don't eyeball.
- [ ] **ARIA honesty:** accessible names present on icon-only buttons;
      no redundant ARIA where native HTML suffices; state changes announced.
- [ ] **Zoom:** browser zoom 200% → no clipped controls, no overlap.

## Gate 4 — Regression Sweep (collateral damage hunt)

The change is now correct in isolation — but what did it break?

1. **Dependency blast radius:** list every component/hook/token that
   imports or renders the changed file. Grep for the changed class names,
   token names, and component names across `src/`.
2. **Shared-token drift:** if a Tailwind token / CSS var / spacing value
   changed, confirm every OTHER consumer still looks right.
3. **Sibling-component parity:** if one card/button/input/panel was
   restyled, compare against its unchanged siblings — did it now diverge
   (1–4px padding, radius, shadow, font-weight drift)?
4. **Cross-panel state sync:** Parameters ↔ SLD ↔ TCC ↔ Operating Sequence
   ↔ Analysis must agree on the same reducer state. Change one, confirm all
   reflect it with no stale render.
5. **Build & test gate:** run `npx tsc --noEmit` and `npx vitest run`.
   Any new error/failure = CRITICAL regression. Paste the tail of output.
6. **Frozen-module check:** confirm no FROZEN file was modified
   (`git diff --name-only` against the Differential R10 set).

## Gate 5 — Visual Forensics (the 1–4px hunt)

For DEEP mode, or when the change is visual:

- [ ] Squint test: does the primary viz still dominate, or did the fix
      introduce a competing focal point?
- [ ] Grayscale test: primary viz still the brightest/darkest mass?
- [ ] Baseline-grid test: adjacent text baselines aligned to 4px.
- [ ] Edge-alignment test: left/right edges and vertical centers of
      "identical" components line up to the pixel.
- [ ] Overflow/clip test: nothing cut at panel edges, no scrollbar where
      there shouldn't be one, no element escaping its container.
- [ ] Consistency test: corner radius, shadow depth, border width, icon
      stroke — identical across the changed surface.

## Gate 6 — Responsive (OPT-IN — desktop-first default)

> **Project default is desktop-only** (see user memory `ui-viewport-preference.md`).
> Run this gate ONLY when the user explicitly asks for mobile/responsive,
> or when the change touches layout breakpoints. Otherwise mark `SKIPPED
> (desktop-first default)` and do NOT count it against the verdict.

When active, inspect at 320 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 px:
- [ ] No horizontal scroll, no clipping, no overlap at any width.
- [ ] Three-zone rhythm degrades sensibly, not chaotically.
- [ ] Touch targets ≥ 44px on narrow widths.
- [ ] SVG charts scale via viewBox, not hardcoded pixel dims.

## Verdict block (REQUIRED output format)

End every adversarial test with EXACTLY this structure. No PASS without it.

```
## Adversarial UI/UX Test — <module/route> — <date>
Target revision: <files + what changed>
Original defect claim: <falsifiable statement>

### Gate results
- Gate 0 Anti-laziness: PASS | FAIL
- Gate 1 Fix verification: VERIFIED-FIXED | PARTIAL | NOT-FIXED | FIXED-BUT-BROKEN
- Gate 2 Domain torture: <n> defects found
- Gate 3 A11y/interaction: <n> defects found
- Gate 4 Regression sweep: tsc=<pass/fail> vitest=<pass/fail> frozen=<clean/violation>
- Gate 5 Visual forensics: <n> defects found
- Gate 6 Responsive: RUN | SKIPPED (desktop-first default)

### Defects found (each with 7-field evidence)
| # | Severity | Gate | WHAT | WHERE | EVIDENCE | EXPECTED | ROOT CAUSE | FIX |
|---|---|---|---|---|---|---|---|---|

### Severity breakdown
CRITICAL: <n> | HIGH: <n> | MEDIUM: <n> | LOW: <n> | MICRO: <n>

### VERDICT
PASS | NEEDS-FIX | BLOCKED
- PASS: 0 CRITICAL, 0 HIGH, fix VERIFIED-FIXED, tsc+vitest green, no frozen violation.
- NEEDS-FIX: any CRITICAL/HIGH open, or fix not verified.
- BLOCKED: could not run a required gate (env/tooling). NEVER report PASS here.
```

## Anti-patterns of this schema (what a lazy agent does — reject these)

- ❌ Re-reading the diff and nodding. (Reading ≠ testing.)
- ❌ "The change is small, no need to test." Small changes cause the worst
  regressions.
- ❌ Testing only the happy path / default study.
- ❌ Declaring PASS because tsc passed (types ≠ UX).
- ❌ Hiding a width bug with `overflow:hidden` and calling it fixed.
- ❌ Reporting "improve spacing" instead of a measured 7-field defect.
- ❌ Marking Gate 6 failures as CRITICAL when the project is desktop-first
  (respect the opt-in rule), OR skipping a real desktop defect by claiming
  "responsive only".
- ❌ Fixing a FROZEN module to make a test go green.

## Severity mapping (aligned with ui-ux-auditor)

| Severity | Adversarial trigger | Action |
|---|---|---|
| **CRITICAL** | Crash/white-screen, wrong engineering state shown, a11y blocker, tsc/vitest failure, frozen violation, fix NOT-FIXED on a critical defect | Blocks merge & release |
| **HIGH** | Reachable defect in torture matrix, semantic color misuse, regression in sibling panel, fix only PARTIAL | Fix before merge |
| **MEDIUM** | Noticeable inconsistency, missing interaction state, contrast just under AA | Fix or justify deferral |
| **LOW** | Minor polish, non-blocking copy/wrap issue | Next cycle |
| **MICRO** | 1–4px drift, naming, sub-perceptual nit | Polish backlog |

## How each UI/UX agent uses this schema

This is the **shared final gate** for every UI/UX-producing agent. After
an agent makes or revises UI, it MUST run this schema on its own output
before reporting completion.

| Agent | When this gate fires | Required gates |
|---|---|---|
| `ui-ux-auditor` (fix mode) | After applying any CRITICAL/HIGH patch | 0,1,3,4,5 (+2 if data/param touched) |
| `relay-module-builder` | After scaffolding a new relay page/panel | 0,1,2,3,4,5 |
| `protection-animation-expert` | After any animation change | 0,1,2.3,2.4,3,4,5 |
| `protection-sound-expert` | After any sound change (UI-coupled) | 0,1,3,4 |
| `performance-auditor` | After a render/bundle change | 0,1,4,5 |
| `fullstack-release-auditor` | As the pre-release UI gate | ALL gates (0–6, 6 opt-in) |

**Chain rule:** when one agent hands off to another (e.g. `ui-ux-auditor`
→ `engineering-validator`), the receiving agent re-runs Gate 4 (regression)
on the handoff, so no defect slips between specialists.

## Two-strike escalation

- **1st defect found in a gate** → fix, then re-run that gate AND Gate 4.
- **2nd defect found in the same gate after a fix** → the fix is suspect.
  Re-open the ROOT CAUSE, do not patch the symptom again. Escalate to a
  full DEEP pass before any PASS.
- **3rd** → stop, write a checkpoint, report `NEEDS-FIX` with the open
  defect list. Do not grind silently.

## Minimum evidence bar (what "proof" means)

A claim is only accepted if backed by at least one of:
- a measured value (px, contrast ratio, ms, count);
- a DOM/CSS assertion (computed style, selector match);
- a screenshot observation with viewport noted;
- a named passing/failing test (`vitest` test id);
- a command + its output tail (`tsc`, `vitest`, `git diff --name-only`).

No evidence → the claim is dropped and the gate is marked `FAIL`.

## Context budget for this gate

- Reuse the audit's cached specs; do not re-read design docs.
- One `tsc` + one `vitest` run per verification cycle (re-run only after
  new edits).
- One browser smoke per cycle unless a fix changes layout, then re-smoke.
- Torture matrix (Gate 2) is grep + targeted reads, not full-file reads.