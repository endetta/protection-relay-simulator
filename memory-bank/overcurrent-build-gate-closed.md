---
name: overcurrent-build-gate-closed
description: The Overcurrent O16 release gate is fully closed as of 2026-08-30; module is READY FOR FREEZE, not yet FINAL
metadata:
  type: project
---

All five Overcurrent O16 release-gate items now PASS on this release source (verified 2026-08-29 and 2026-08-30):
`tsc --noEmit`, `npm ci` from a clean cache (136 packages in ~5s), `npm test` (31 files / 260 tests), `npm run build` (83 modules, dist emitted), and a production browser smoke (`/`, `/simulator/differential`, `/simulator/overcurrent` each HTTP 200, assets served, SPA fallback returns the root title).

**Why:** The historical `yallist-3.1.1`/`ENOTCACHED` environment blocker is gone from the dependency tree (0 matches in package-lock.json). A clean `npm ci` succeeded and closed the last gate items.

**How to apply:** The module is READY FOR FREEZE. Do NOT mark it FINAL/FROZEN until the user explicitly approves freeze — that is the sole remaining item. See [[overcurrent-o16-freeze-rule]]. Note the commit-ordering caveat: the first `npm ci` run threw `EPERM` because the project's own `vite preview` process held `node_modules/@rolldown/binding-win32-x64-msvc/rolldown-binding.win32-x64-msvc.node`; killing that PID (and only that one, not the unrelated `9router` node processes) released the lock. Also note that in Git Bash `taskkill //PID N //F` needs doubled slashes (a single `/PID` is rewritten to a Git path and errors).
