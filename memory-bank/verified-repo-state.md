---
name: verified-repo-state
description: Dependency-checked ground truth of the repo on 2026-08-30 — re-derivable via npm test / npm run build
metadata:
  type: reference
---

Verified from `main` on **2026-08-30** (re-derivable — run `npm test` and `npm run build` to confirm).

- `npm test` — **43 files / 366 tests PASS** (5.51 s). Includes Overcurrent, Differential, Distance, Underfrequency.
- `npm run build` — `tsc` strict clean + Vite prod build: **105 modules transformed**, `dist/` emitted (index.js 554.78 kB / index.css 160.39 kB). One non-blocking chunk-size warning (>500 kB) for the single app chunk.
- Overcurrent O16 release gate (earlier snapshot): fresh `npm ci` from clean cache (136 packages), Vitest 31 files / 260 tests, Vite build 83 modules, production browser smoke `/`, `/simulator/differential`, `/simulator/overcurrent` — HTTP 200. All PASS 2026-08-30.

**Routing (source of truth `src/App.tsx`):** all four routes are wired — `/`, `/simulator/differential`, `/simulator/overcurrent`, `/simulator/distance`, `/simulator/underfrequency`. `SimulatorHome` lists all four relay options.

**Module status (no freeze inferred without explicit approval):**

| Module | Status |
|---|---|
| Differential | FINAL / FROZEN (R10) |
| Overcurrent | O16 audit PASS · READY FOR FREEZE 2026-08-30 · not FINAL (freeze approval pending) |
| Distance | Implemented & routed; spec D01 READY FOR APPROVAL; only `distanceMeasurement.test.ts` exists (no page/timeline test) |
| Underfrequency | Complete & routed; spec U01 READY FOR APPROVAL; full test coverage incl. `UnderfrequencySimulator.test.tsx` |

**How to apply:** treat this table as the authoritative baseline. When a freeze is approved, or a Distance/Underfrequency spec is approved, update both this file and `activeContext.md`'s status table, then mirror in `MEMORY.md`. Link from [[how-to-update-bank]] and [[overcurrent-build-gate-closed]].
