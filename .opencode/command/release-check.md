---
description: Pre-release gate check (test, build, browser smoke, frozen guard) — comprehensive release validation
agent: protection-auditor
---

Run pre-release gate check for $ARGUMENTS.

**Target:** $1 (module name, e.g., overcurrent O17)
**Version:** $2 (optional version tag)

**Gate checks:**
1. ✅ Test suite pass (all tests)
2. ✅ Build success (no TypeScript errors)
3. ✅ Browser smoke test recommendations
4. ✅ FROZEN module guard (detect Differential R10 modifications)
5. ✅ Dependency completeness check

**Output:**
- Gate status: PASS / FAIL / BLOCKED_BY_ENVIRONMENT
- JSON report: `docs/reports/{Module}_{Version}_Release_Gate.json`
- Markdown summary with blockers

**Policy:** Do not declare FINAL/FROZEN until all gates pass on exact release source.
