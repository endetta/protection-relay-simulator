---
mode: agent
agent: ui-ux-auditor
description: Run a UI/UX audit and auto-apply P0/P1 fixes
---

Run a full UI/UX audit using the ui-ux-auditor agent. After the audit,
for every [P0] and [P1] finding, apply the suggested fix as a patch
to the relevant file.

### Requirements
- Do NOT touch FROZEN Differential R10 files
- Do NOT change the stack (React/Vite/TS/Tailwind)
- Do NOT add new dependencies
- Every applied fix must be verifiable (tsc + vitest)
- After all patches, run `npx vitest run` to confirm no regressions
- **Then run the adversarial gate** (`.agents/skills/ui-adversarial-test/
  SKILL.md`, Gates 0–5) against your own patches. Re-trigger each original
  defect, hunt collateral damage, and emit its Verdict block. A fix is not
  "applied" until it survives this hostile pass.
- Produce a summary: file fixed, what changed, what was deferred
  (and why), + adversarial verdict
