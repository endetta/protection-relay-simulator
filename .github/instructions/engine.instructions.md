---
applyTo: "src/engines/**,src/utils/**,src/hooks/**"
description: Simulation engine, calculation, and helper code
---

# Engine instructions (active for engine / utils / hooks)

## Read first
The relevant `docs/engineering-specs/<relay>.md` is the only source of
truth for equations, units, sign conventions, and decision inequalities.
Do not invent or paraphrase formulas.

## Properties of engine code
- Pure functions, deterministic, no I/O, no time, no Math.random
- Value + unit separated internally; convert at the UI boundary
- Defensive: explicit INVALID state, finite/overflow guards
- Covered by Vitest unit tests; do not delete a test to make code pass

## Use the specialist agent
For full validation invoke `engineering-validator` agent.
For new relay modules use `relay-module-builder` agent.

## Frozen reference
Differential R10 is FROZEN. Touching its engine requires explicit
reopen approval.

## Anti-patterns (do NOT do these)
- ❌ `import { useState } from 'react'` inside engine (no React in engine)
- ❌ `Math.random()` (must be deterministic)
- ❌ `Date.now()` (no wall-clock, no time I/O)
- ❌ `localStorage` / `sessionStorage` (no I/O in engine)
- ❌ `fetch()` / `XMLHttpRequest` (no I/O in engine)
- ❌ `console.log` left in production code
- ❌ Untyped `any` (use proper types from `src/types/`)
- ❌ Throwing on invalid input silently (return INVALID, let UI show it)
- ❌ Lowering test threshold to make code pass
- ❌ Adding a TODO without a spec reference
