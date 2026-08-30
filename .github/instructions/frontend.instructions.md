---
applyTo: "src/components/**,src/pages/**,src/layouts/**,src/index.css,tailwind.config.js"
description: Frontend UI work for the Protection Relay Simulator
---

# Frontend instructions (active for UI files)

## Before editing
1. Read `docs/frontend-design-guide.md` and `docs/ui-design-tokens.md`.
2. Read `memory-bank/activeContext.md` for the current UI language lock.
3. Inspect the existing component before adding new structure.

## Stack is locked
React 18 + TypeScript + Tailwind + inline React SVG for charts.
Do not add: chart libraries, UI kits, animation libraries, CSS-in-JS,
state libraries. Extend the existing pattern instead.

## Use the specialist agent
For full UI/UX audits invoke the `ui-ux-auditor` agent.
For new pages use the `relay-module-builder` agent.

## Three-zone desktop layout
Zone A Parameters (~20-25%) / Zone B Live Simulation (~45-55%) /
Zone C Analysis (~25-30%). Preserve this rhythm.

## Accessibility
- Keyboard reachable, visible focus, ARIA where needed
- Honor `prefers-reduced-motion`
- Contrast must pass WCAG AA against the dark engineering surface

## UX Psychology (senior designer mindset)
Before committing a UI change, mentally trace where the eye lands first.
The **primary engineering visualization** MUST be in the first 1–2
fixations (0–800 ms). If it isn't, the user is lost.
- One focal point only. No competing bright elements.
- ≤7 interactive elements visible at once (Miller's 7±2).
- Cause-effect visible in <100 ms (no "calculate" button).
- Colors match semantic meaning (red=TRIP, green=RESTRAIN, amber=CAUTION).
- In grayscale, the primary viz must still be the brightest element.

For the full framework see
`.agents/skills/senior-ui-ux-reviewer/SKILL.md`.

## Anti-patterns (do NOT do these)
- ❌ `import { Chart } from 'recharts'` or any chart library
- ❌ `import { motion } from 'framer-motion'` or any animation lib
- ❌ `import styled from '@emotion/styled'` or any CSS-in-JS
- ❌ `import { create } from 'zustand'` or any state library
- ❌ Inline styles for theming (use Tailwind tokens from
  `docs/ui-design-tokens.md`)
- ❌ A 5th color outside the semantic palette (green/red/amber/accent)
- ❌ Floating call-to-action buttons (this is not a marketing site)
- ❌ `'use client'` (this is Vite, not Next.js)
- ❌ Adding a global state for what local `useState` can do
- ❌ Decorative gradients or shadows on engineering UI
- ❌ Multiple competing focal points
- ❌ More than 7 visible interactive elements at once
- ❌ A "calculate" button for parameter changes (must be live)

## Mandatory verification gate (after ANY UI change)

No UI/UX change is "done" until it survives the adversarial test schema:
`.agents/skills/ui-adversarial-test/SKILL.md`.

This is a **hostile verification harness**, not a self-review. After
editing, you must try to BREAK your own change before claiming it works:

- **Gate 0** — state the falsifiable defect claim + smallest repro.
- **Gate 1** — re-run the original repro; a fix that only hides the
  symptom (e.g. `overflow:hidden` over a real width bug) is NOT-FIXED.
- **Gate 2** — domain torture: 0/negative/extreme/`NaN`/non-numeric input,
  out-of-range must show explicit invalid state (never silent clamp),
  rapid spinner hold, forced state jumps (RESTRAIN→TRIP→CLEAR→RESET),
  scrubber abuse, mid-animation resize, empty/one/hundreds-of-cases.
- **Gate 3** — keyboard-only sweep, hover-only sins, <100 ms live update,
  `prefers-reduced-motion`, measured WCAG AA contrast.
- **Gate 4** — regression sweep: grep the blast radius, sibling-parity
  check, cross-panel state sync, `npx tsc --noEmit`, `npx vitest run`,
  frozen-file check.
- **Gate 5** — visual forensics: squint, grayscale, baseline grid,
  edge alignment, 1–4px drift.
- **Gate 6** — responsive: **opt-in only** (project is desktop-first).

Rules that override everything else:
1. **"Looks fine" is not evidence.** Every PASS claim needs a measured
   value, DOM/CSS assertion, screenshot observation, named test, or
   command output. No evidence → the claim is dropped, gate FAILS.
2. **If you cannot test it, you cannot PASS it** → verdict is `BLOCKED`.
3. **Severity inflation and deflation are both failures.**
4. **Two-strike rule:** a second defect in the same gate after a fix means
   the root cause was wrong — stop patching symptoms, re-open root cause.
5. **Never fix a FROZEN module to make a gate go green.** Report the
   conflict instead.

Every UI/UX agent (`ui-ux-auditor`, `relay-module-builder`,
`protection-animation-expert`, `protection-sound-expert`,
`performance-auditor`, `fullstack-release-auditor`) runs this gate on its
own output and must emit its Verdict block.
