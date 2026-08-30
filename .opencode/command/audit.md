---
description: Run comprehensive protection audit (spec compliance, type safety, UX psychology, animation/sound, build gate, frozen guard)
agent: protection-auditor
---

Run a comprehensive protection audit for $ARGUMENTS.

**Scope:** Full 6-dimension audit covering:
1. Engineering spec compliance
2. Type safety & architecture
3. UI/UX psychology (using senior-ui-ux-reviewer skill)
4. Animation & sound compliance
5. Build & test gate
6. FROZEN module guard (Differential R10)

**Target module:** $1 (overcurrent, differential, distance, or detect from git diff)
**Options:** $2 onwards (--scope=ui|engineering|gate, --depth=T1|T2|T3, --severity=P0|P1|P2)

Generate both JSON report (`docs/reports/`) and markdown summary with clear PASS/FAIL verdict.
