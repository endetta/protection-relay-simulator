---
mode: agent
agent: architecture-auditor
description: Run a module-boundary architecture audit
---

Audit the module boundaries, state flow, shared components, and
dependency direction in this workspace.

### Requirements
- Read `memory-bank/systemPatterns.md` and `docs/PRD.md`
- Run DEEP mode: all 7 passes (module structure, dependency direction,
  cross-module imports, state leakage, shared components, live DOM, regression)
- Map each route → page → components → engine → types
- Detect: parallel architecture, state leakage, cross-module imports,
  shared components, global state, three-zone layout preservation
- Run parallel module scan (one Explore subagent per module)
- Every CRITICAL/HIGH/MEDIUM smell must have 7-field evidence-based report
  (WHAT, WHERE, WHY, EVIDENCE, EXPECTED, ROOT CAUSE, FIX)
- Check all routes with live DOM + console errors
- Read-only — do NOT modify files
- Do NOT propose a new framework or state library
- Do NOT touch FROZEN Differential R10 structure
- Produce 5-tier severity report (CRITICAL/HIGH/MEDIUM/LOW/MICRO)
  with CLEAN / DRIFT / BLOCKED verdict
