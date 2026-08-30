# AGENTS.md — Project quick map for AI agents

## Project
Protection System Relay Simulator Platform — engineering simulator
for protection relays. Stack: Vite + React 18 + TypeScript + Tailwind +
Vitest, no global state library, no chart library (inline SVG).

## Module status
- Differential Relay: FINAL / FROZEN (R10) — do not modify without user approval
- Overcurrent Relay: O16 audit pass / CONDITIONAL RELEASE — **READY FOR FREEZE (2026-08-30)**; fresh `npm ci`, Vitest, Vite build, and production browser smoke all PASS on this release source; NOT FINAL until the user explicitly approves freeze
- Distance Relay: parallel branch D05 (not merged into this source)
- Homepage: R02 (not frozen)

## Read first (order matters)
1. `AGENTS.md`
2. `memory-bank/activeContext.md` — current focus + freeze status
3. Relevant `docs/engineering-specs/<relay>.md`

## Source of truth precedence
1. Approved relay spec under `docs/engineering-specs/`
2. Product: `docs/PRD*.md`
3. UI: `docs/frontend-design-guide.md`, `docs/ui-design-tokens.md`
4. `memory-bank/activeContext.md` for current freeze state
5. Code (only if it agrees with the above)

## Key directories
- `src/engines/` — pure calculation logic (test in isolation)
- `src/presentation/` — pure presentation models (SLD/TCC/sequence/analysis)
- `src/components/` — UI components (`shared/`, `overcurrent/`, `distance/`)
- `src/pages/` — route entry per relay
- `src/studies/` — preset registry / study definitions
- `src/types/` — domain types (`overcurrent.ts` is the O02 authoritative contract)
- `src/utils/` — pure helpers (state reducers, evaluators)
- `src/layouts/` — AppShell, SimulatorHeader
- `src/hooks/` — React hooks
- `docs/engineering-specs/` — approved relay equations
- `memory-bank/` — durable project state
- `.github/` — custom agents, prompts, instruction rules

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — tsc + vite build
- `npm test` / `npx vitest run` — full Vitest suite
- `npx vitest run <file>` — single test file
- `npm run preview` — preview build

## Architecture rules
- Math lives in `src/engines/*.ts`, never inside React/SVG components
- Presentation models (`src/presentation/*`) transform engine output; components may clip/transform coordinates but must not implement relay or coordination equations
- Charting is inline SVG; O08/O09/O10 added no dependency
- Do not add chart/state libraries
- Presentation is pure and independently unit-tested

## Rules agents must obey
- Do not modify a FROZEN module (Differential R10) without explicit user approval
- Do not claim a module is FROZEN/FINAL unless the user explicitly approves
- Match exact units, sign conventions, and decision inequalities from the engineering spec; do not invent relay equations
- Decision inequalities matter: `M <= 1` is no-pickup, `Observed CTI >= Required CTI` passes
- Do not propose new dependencies, chart libraries, or state libraries
- Prefer extending existing shared/pattern files over inventing parallel architecture
- For Overcurrent: read `memory-bank/activeContext.md` for O01–O16 implementation baseline before changes

## Skills (`.agents/skills/`)
- `senior-ui-ux-reviewer` — psychology-driven UX heuristics (audit discovery)
- `protection-animation` — engineering-event → animation mapping
- `protection-sound` — engineering-event → sound mapping
- `ui-adversarial-test` — **hostile UI/UX verification gate** (see below)

## Adversarial UI/UX verification gate (mandatory)
After ANY UI/UX change, the producing agent MUST run
`.agents/skills/ui-adversarial-test/SKILL.md` against its OWN revision
before declaring PASS / fixed / done. It is a bug-hunting harness, not a
self-review: assume the change is broken and try to prove it. No "looks
fine" without evidence; if you cannot test it, the verdict is `BLOCKED`,
never `PASS`. Trigger with `/test-ui`. Responsive checks (Gate 6) are
opt-in — the project is desktop-first.
