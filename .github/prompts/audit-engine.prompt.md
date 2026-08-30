---
mode: agent
agent: engineering-validator
description: Run an engineering math validation on the current engine
---

Validate the relay engine code in `src/engines/` against the matching
`docs/engineering-specs/<relay>.md`.

### Requirements
- Identify the relay in scope from `memory-bank/activeContext.md`
- Read the full engineering spec before touching code
- Run DEEP mode: all 10 validation matrix rows, 7-pass sweep
- Run parallel spec sweep (split by section: Inputs, Signs, Equations,
  Characteristic, Decision, Boundaries, Reference, Edge, Tolerance, Timeline)
- Every CRITICAL/HIGH/MEDIUM finding must have 7-field evidence-based report
  (WHAT, WHERE, WHY, EVIDENCE, EXPECTED, ROOT CAUSE, FIX)
- Check edge cases (overflow, zero, negative, boundary)
- Run `npx vitest run` and capture real output (not guessed)
- If numbers/units look wrong in UI, delegate to ui-ux-auditor
- Do NOT invent formulas — report the gap
- Do NOT touch FROZEN Differential R10 engine
- Produce 5-tier severity report (CRITICAL/HIGH/MEDIUM/LOW/MICRO)
  with VALIDATED / NEEDS-FIX / BLOCKED verdict
