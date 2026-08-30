# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser engineering simulator for power-system protection relays: Differential (87, frozen), Overcurrent (50/51), Distance (in-progress), Underfrequency (planned). Stack is fixed: **Vite + React 18 + TypeScript (strict) + Tailwind CSS + Vitest**. No global state library and no chart library — all charts are inline SVG. Do not add either.

The `AGENTS.md` quick-map, the `.github/copilot-instructions.md` audit workflows, and `memory-bank/activeContext.md` freeze state are authoritative and should be read before non-trivial work. This file captures the module architecture that spans files.

## Commands

```bash
npm install / npm ci        # install deps (npm ci is the clean-cache path; must compile native rolldown bindings)
npm run dev                 # Vite dev server
npm run build               # runs `tsc && vite build` — type-check then production build (dist/)
npm run preview             # serve the built dist/
npm test                    # full Vitest suite (vitest run)
npx vitest run <file>       # single test file (e.g. src/engines/overcurrentTimeline.test.ts)
```

`tsconfig.json` is strict (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`), so `npm run build` also serves as the type-check gate. Tests are colocated next to source (`*.test.ts` / `*.test.tsx`). There is no separate lint step.

## Module architecture (the big picture)

Each relay is built as five isolated layers; **equations move in one direction only** (types → engines → presentation → components → page). This discipline is the reason the codebase can verify relay math independently of the UI.

1. **`src/types/<relay>.ts`** — the domain contract (e.g. `overcurrent.ts` is the O02 authoritative contract). Settings, operating results, study topology, violations, timelines.
2. **`src/engines/<relay>*.ts`** — pure, deterministic calculation. No React, no DOM, no SVG. Tested in isolation with hundreds of thousands of randomized checks (see `overcurrent.hardening.test.ts`). The inverse equation is `T = TMS × [k/(M^α − 1) + c]`; the curve constants live in `OVERCURRENT_INVERSE_CURVES`.
3. **`src/studies/<relay>*.ts`** — preset/study registry and the validation that resolves study current data.
4. **`src/presentation/<relay>*.ts`** — pure presentation models (TCC, SLD, operating sequence, analysis). They transform engine output into coordinates/layers; they must **not** re-implement relay or coordination equations. Coordinates may be clipped/transformed, math may not.
5. **`src/components/<relay>/*`** — React/SVG UI. Read state, render presentation models, dispatch actions. Components may clip or transform SVG coordinates but must never contain relay or coordination equations.

The `src/utils/` layer sits between engines and the page: `overcurrentState.ts` is the immutable reducer, and `evaluateOvercurrentParameters.ts` validates settings and runs the full engine to produce the active evaluation. **Invalid drafts never enter engineering state** — they block Apply Fault and hold `INPUT INVALID / OUTPUT HELD`.

### How the Overcurrent page is composed

`src/pages/OvercurrentSimulator.tsx` wires **one `useReducer` state** (`overcurrentParameterReducer`) plus **one `TimelineSnapshot`** and shares both across all panels (Parameters, RadialProtectionDiagram, TimeCurrentCurve, OperatingSequence, OvercurrentAnalysisPanel, GuidedChallengeCard). No panel owns its own copy of engineering state. The `SimulatorHeader` tone is derived from the analysis tone (danger → operate, warning → invalid, success → restrain).

Key semantic invariants that must hold in every change:
- **Decision inequalities matter.** `M <= 1` (or `nearlyEqual(M, 1)`) is no-pickup; pickup requires strict `>`; `Observed CTI >= Required CTI` passes. The `nearlyEqual` helper (`src/engines/overcurrent.ts`) is the standard tolerance — reuse it, don't re-derive comparisons.
- **50-priority arbitration**: an enabled 50 high-set operates ahead of 51 timing.
- **Frozen modules cannot be touched.** Differential R10 is FINAL/FROZEN — do not modify its source or tests without explicit user approval.

## Process guardrails

- **Localized, not global.** Prefer extending existing shared/pattern files (`src/components/shared/`) over inventing parallel architecture.
- **New dependencies are rejected** unless justified and audited against the existing stack.
- For Overcurrent work, read `memory-bank/progress.md` + `activeContext.md` first to see the O01–O16 implementation baseline before changing anything.
- After ANY UI/UX change, the producing agent MUST run `.agents/skills/ui-adversarial-test/SKILL.md` against its own revision before declaring PASS (`/test-ui`). It is a hostile bug-hunt harness, not a self-review; unresolvable → verdict `BLOCKED`, never `PASS`.

## Git workflow (mandatory)

This repository uses Git + GitHub as the source of truth. There is always a saved, revertible copy on `origin/main`.

- **Commit as you work.** After completing any unit of work, `git add` the relevant files and `git commit` with a **clean, conventional message** (short imperative subject + concise body; end with `Co-Authored-By: Claude Code <noreply@anthropic.com>`). Commit in logical steps, not one giant final commit.
- **Push each commit to GitHub.** After committing, run `git push` so the state is always saved remotely and recoverable. Do not leave work only on the local machine.
- **Never lose work or status.** Keeping commits + pushes current means we can always revert to a known-good point. If a change turns out wrong, revert via git rather than manually un-doing it.
- **One logical change per commit.** Co-locate related edits; separate cleanups (e.g. gitignore, config) from feature work.
- **No secrets.** Never commit keys, tokens, or credentials.

Local settings that must stay out of the repo (already gitignored): `.claude/settings.local.json` is machine-local and auto-modified per session — never stage it.
