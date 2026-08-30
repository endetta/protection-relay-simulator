---
mode: agent
agent: fullstack-release-auditor
description: Run the full super-gate (technical + UI + engine + arch)
---

Run the full pre-release super-gate using the fullstack-release-auditor
agent. This includes:
1. Technical gate (typecheck + tests + build + DOM smoke) — in parallel
2. UI/UX sign-off (ui-ux-auditor) — after technical gate passes
3. Engine spec compliance (engineering-validator) — parallel with UI
4. Module boundary sign-off (architecture-auditor) — parallel with UI
5. **Adversarial UI gate** (`ui-adversarial-test`, ALL gates 0–6, Gate 6
   opt-in) — hostile probe that attempts to break the UI after 1–4 pass

### Requirements
- Chain all 4 specialist agents in parallel after technical gate passes
- Run the adversarial schema last, as the hostile pre-release probe
- Aggregate all verdicts into a single consolidated report
- If ANY stage fails → overall verdict is BLOCKED
- A `NEEDS-FIX` / `BLOCKED` adversarial verdict caps the release verdict
  at `NEEDS-FIX` — no RELEASE-READY without a PASS adversarial verdict
- If any check cannot run → BLOCKED with reason
- Respect FROZEN Differential R10
- Produce a single PASS/FAIL/BLOCKED verdict with evidence per stage
