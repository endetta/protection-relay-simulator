---
mode: agent
agent: ui-ux-auditor
description: Run a UI/UX audit on the current changes
---

Audit the UI changes in this workspace using the ui-ux-auditor agent.
Focus on the current diff and the files under `src/components/`,
`src/pages/`, and `src/layouts/`.

### Requirements
- Read `docs/frontend-design-guide.md` and `docs/ui-design-tokens.md`
- Run DEEP mode: all 31 dimensions, 7-pass audit loop
- Inspect at viewports: 320, 375, 390, 430, 414, 768, 1024, 1280, 1440 px
- Every CRITICAL/HIGH/MEDIUM finding must have 7-field evidence-based report
  (WHAT, WHERE, WHY, EVIDENCE, EXPECTED, ROOT CAUSE, FIX)
- Check micro-details: 1–4px drift between "identical" components
- Run live DOM smoke at all viewports (if dev server is up)
- If findings involve engine numbers, delegate to engineering-validator
- Do NOT touch FROZEN Differential R10 files
- Produce 5-tier severity report (CRITICAL/HIGH/MEDIUM/LOW/MICRO)
  with PASS / NEEDS-FIX / BLOCKED verdict
