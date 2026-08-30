# Technical context

## Verified repository state (2026-08-12)

A read-only Repository Context Audit confirmed the repository contains only documentation and agent configuration:
- `docs/` — PRD, frontend design guide, UI design tokens, and `engineering-specs/README.md` index (no relay specs).
- `.agents/skills/` — 6 skill definitions; `.clinerules/` — 9 rule files (one empty `testing.md`).
- `memory-bank/` — all 6 core files intact.
- No `package.json`, no source files (`src/`, `public/`, `components/`, `engines/`), no build config, no tests.

## Current technical status

The PRD defines architectural direction but does not lock the final frontend stack.

Do not treat an unapproved technology choice as established project fact.

## PRD-supported prototype options

The initial prototype may use:
- HTML
- CSS
- JavaScript

or:
- HTML
- Tailwind CSS
- JavaScript
- a chart library

## Longer-term architectural direction

For a growing modular platform, the PRD identifies React / Next.js as an appropriate architectural direction with separated:
- UI Layer
- Simulation Engine
- Chart Engine
- Relay Modules
- Shared Components

This is a direction, not an automatically approved implementation decision.

## Decision registry

Frontend framework: **Vite + React (chosen 2026-08-12)**  
Language (JS/TS): **TypeScript (chosen 2026-08-12)**  
Styling system: **Tailwind CSS (chosen 2026-08-12)**  
Chart library: **UNDECIDED (pending graph requirements)**  
State management: **Local React state (no global store for Milestone 1)**  
Testing framework: **Vitest (established by implemented engine/UI regression suites)**  
Build/deployment target: **Static SPA via Vite build (chosen 2026-08-12)**  

React/Next.js remains the longer-term platform direction noted in the PRD, but Vite + React + TS + Tailwind is the selected prototype path. The verified dependency set is limited to react, react-dom, react-router-dom, vite, typescript, Vitest, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer, and React type packages. O08/O09/O10 added no dependency or configuration change. O10 uses inline React SVG and the existing shared tooltip; no chart library was added.

Before adding a new dependency, inspect the repository and confirm it fits the existing stack and project constraints.

## Engineering constraints

- Calculation logic must be deterministic and independently testable.
- Value and unit should be separated internally.
- Invalid engineering values require explicit validation feedback.
- Final relay equations must come from relay-specific Engineering Specifications.
- UI updates should avoid unnecessary whole-application rerenders.

## Primary target resolutions

- 1440 × 900
- 1920 × 1080
- 2560 × 1440

Smartphone support may be simplified and is not the primary engineering simulation target.
