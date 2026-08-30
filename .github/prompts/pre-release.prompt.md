---
mode: agent
agent: fullstack-release-auditor
description: Run the pre-release gate (typecheck, tests, build, DOM smoke)
---

Run the full pre-release gate for the in-scope module.

### Requirements
- Read `memory-bank/progress.md` for module status
- Run typecheck + vitest in parallel (independent)
- Run build only after typecheck + tests pass
- Run DOM smoke in browser at desktop (1280x800) + 414px
- Verify critical components render AND live update works
- If any stage fails → report BLOCKED, never PASS
- If a check cannot run → report BLOCKED with reason
- Respect FROZEN Differential R10
- Produce PASS/FAIL per stage with raw command output
