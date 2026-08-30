---
mode: agent
agent: ui-ux-auditor
description: Run the adversarial UI/UX bug-hunt gate on the current changes
---

Run the **adversarial UI/UX test schema** on the current revision using the
`ui-ux-auditor` agent. This is a hostile verification pass, not a review:
your job is to PROVE the change is broken, and to keep trying until either
a defect is reproduced or every attack is exhausted with recorded evidence.

Skill: `.agents/skills/ui-adversarial-test/SKILL.md`

### Scope
- Target: the working diff (`git diff --name-only`) under `src/components/`,
  `src/pages/`, `src/layouts/`, `src/index.css`, `tailwind.config.js`.
- If the diff is empty, target the most recently edited UI files and say so.

### Requirements
- Run **Gate 0** first: state the exact files changed, the falsifiable
  defect claim being verified, and the smallest reproduction.
- Run **Gate 1**: re-trigger the original defect condition. Classify as
  `VERIFIED-FIXED` / `PARTIALLY-FIXED` / `NOT-FIXED` /
  `FIXED-BUT-BROKEN-ELSEWHERE`. A symptom mask (`overflow:hidden`,
  hardcoded width, `z-index` band-aid) counts as `NOT-FIXED`.
- Run **Gate 2** (domain torture): 0 / negative / extreme / `NaN` /
  `Infinity` / non-numeric / pasted junk in every numeric control;
  out-of-range must show an explicit invalid state, never silent clamping;
  rapid spinner hold; forced state jumps RESTRAIN→PICKUP→TRIP→
  BREAKER-OPEN→ISOLATED→BACKUP→RESET; out-of-order jumps; Clear mid-trip;
  scrub backwards past trip; speed change mid-animation; empty / one /
  hundreds of cases; off-scale Fit Point; pointer-map accuracy at every
  zoom level.
- Run **Gate 3** (a11y + interaction attack): keyboard-only sweep, focus
  ring always visible, hover-only sins, <100 ms live update with no
  "calculate" button, `prefers-reduced-motion`, measured WCAG AA contrast,
  200% browser zoom.
- Run **Gate 4** (regression sweep): grep the blast radius of every changed
  class/token/component name; sibling-parity check against unchanged
  siblings; cross-panel state sync (Parameters ↔ SLD ↔ TCC ↔ Operating
  Sequence ↔ Analysis); `npx tsc --noEmit`; `npx vitest run`;
  `git diff --name-only` frozen-module check.
- Run **Gate 5** (visual forensics): squint test, grayscale test, baseline
  grid, edge alignment, 1–4px drift between "identical" components.
- **Gate 6** (responsive): `SKIPPED (desktop-first default)` unless the user
  explicitly asked for mobile/responsive or the change touches breakpoints.
- Every defect must use the full evidence format (WHAT / WHERE / WHY /
  EVIDENCE / EXPECTED / ROOT CAUSE / FIX). Vague findings are rejected.
- Apply the two-strike escalation rule: a second defect in the same gate
  after a fix means the root cause was wrong — stop patching symptoms.
- Do NOT touch FROZEN Differential R10 files. Do NOT change the stack.
  Do NOT add dependencies.
- If a required gate cannot run (no dev server, blocked env), report
  `BLOCKED` — never `PASS`.

### Output
Emit the schema's **Verdict block** verbatim: gate results, defect table,
severity breakdown, and a final `PASS` / `NEEDS-FIX` / `BLOCKED`.

### Auto-fix mode
If the user says "fix", "rapikan", "perbaiki", or "yakin sudah bener" —
after the verdict, patch every CRITICAL and HIGH defect, then **re-run the
whole gate from Gate 0** on the patched code. Report both rounds. Do not
declare done until a full gate run returns PASS with evidence.
