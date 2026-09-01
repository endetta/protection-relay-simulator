# Protection System Simulator — Codebase Audit Report
**Date:** 2026-08-31  
**Auditor:** Claude Code (read-only)  
**Baseline:** `main` @ `4cafe2c` (post-merge of PR #2)

---

## 1. Untracked / Stray Files

| Path | Status | Recommendation |
|---|---|---|
| `docs/superpowers/` | **Untracked** (new) | **Keep, but move into `docs/` hierarchy** or commit. Contains the approved UF SLD primary-view design spec (`specs/2026-08-31-uf-sld-primary-view-design.md`). This is a real project artifact, not temporary. The directory name "superpowers" is non-standard; consider renaming to `docs/designs/` or `docs/specs/` for consistency with `docs/engineering-specs/` and `docs/reports/`. |
| `OVERCURRENT_O16_README.md` | **Tracked** (committed) | **Move to `docs/reports/`** or delete. It is a handoff/audit note that duplicates information already present in `docs/reports/Overcurrent_O16_*.json/md` (8 files). It is not referenced by any source or documentation link. |
| `TCC_PAN_ZOOM_FINAL.md` | **Tracked** (committed) | **Move to `docs/reports/`** or delete. A single-feature implementation summary for the Overcurrent TCC pan/zoom fix. The actual implementation is already in source; this is historical notes. |
| `.teach/` | **Gitignored** ✓ | **Keep as-is**. Already in `.gitignore` (line 16). Personal teaching workspace, correctly excluded. |
| `dist/` | **Gitignored** ✓ | **Keep as-is**. Already in `.gitignore` (line 2). Build output, correctly excluded. |
| `src/presentation/__bug3_probe.test.ts` | **Not present on disk** | **N/A**. This file was referenced in the user's task list but does **not exist** in the working tree, not tracked, not untracked, not in git history. It may have been a temporary probe file that was already cleaned up. |
| `.claude/worktrees/` | **Gitignored** ✓ | Already in `.gitignore` (line 13). However, **Vitest discovers test files inside worktrees** because there is no `exclude` in `vite.config.ts`. See Test Health section. |

### Root-level tracked files inventory
The following non-source files are tracked at repo root and appear legitimate:
- `AGENTS.md`, `CLAUDE.md`, `index.html`, `package.json`, `package-lock.json`, `postcss.config.js`, `tailwind.config.js`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `.gitattributes`, `.gitignore`
- **Questionable:** `OVERCURRENT_O16_README.md`, `TCC_PAN_ZOOM_FINAL.md` (handoff docs that should live in `docs/reports/`)

---

## 2. Dead Code / Orphaned Files in `src/`

### 2.1 Orphaned files (not imported from `main.tsx`)
**Result: ZERO.**

All 80 non-test `.ts/.tsx` files and 15 `.css` files in `src/` are reachable from `main.tsx` via the import graph:
- `main.tsx` → `App.tsx` → all 5 pages (`SimulatorHome`, `DifferentialSimulator`, `OvercurrentSimulator`, `DistanceSimulator`, `UnderfrequencySimulator`)
- Pages → components → presentation → engines → utils → types
- CSS files are imported directly by their owning components

### 2.2 Unused CSS files
**Result: ZERO.**

All 15 `.css` files are imported by at least one `.tsx` component:
- `src/index.css` → `main.tsx`
- `src/components/overcurrent/*.css` → respective `.tsx` files
- `src/components/underfrequency/*.css` → respective `.tsx` files
- `src/components/shared/engineeringViewOverlay.css` → `EngineeringViewOverlay.tsx`
- `src/pages/overcurrentSimulator.css` → `OvercurrentSimulator.tsx`
- `src/pages/underfrequencySimulator.css` → `UnderfrequencySimulator.tsx`

### 2.3 Dead exports / unused helpers

| Symbol | File | Status | Used by |
|---|---|---|---|
| `evaluateUnderfrequencyUfr` | `src/engines/underfrequency.ts:220` | **Dead in production** | Only used in `underfrequency.test.ts` and `underfrequency.hardening.test.ts` (test-only consumption). The production code path uses `evaluateUnderfrequencySystem` instead. |
| `UnderfrequencyPhaseZone` interface | `src/presentation/underfrequencyTimelineChart.ts:52-56` | **Dead** | Zero usages anywhere in the codebase. Contains a typo (`'ARrest'` instead of `'ARREST'`). |
| `armedEvents` array | `src/presentation/underfrequencyTimelineChart.ts:66,155,234` | **Dead** | Computed on every chart build but never consumed by any component. The array includes `UFLS_TIMER_RESET` events mislabeled as "armed". |
| `AT_GOVERNOR_LIMIT` as pre-disturbance status | `src/types/underfrequency.ts` | **Semantically dead / invalid** | `UnderfrequencyGeneratorData.status` allows `'AT_GOVERNOR_LIMIT'`, but U01 §5.1 defines this as a runtime-only state. No preset uses it as a pre-disturbance value. |

### 2.4 Missing / incomplete modules

| Module | Missing files |
|---|---|
| **Distance** | No presentation model layer (`distanceSld.ts`, `distanceTcc.ts` analogs). Only `distanceMeasurement.test.ts` exists — no page test, no timeline test, no presentation tests. Spec D01 is "READY FOR APPROVAL" but source is already in `main`. |

---

## 3. Test & Build Health

### 3.1 `npm run build` (tsc + Vite)
**Status: PASS** ✅
- TypeScript strict (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) — zero errors
- Vite production build: 106 modules transformed
- Output: `dist/index.html`, `dist/assets/index-CA0prn4M.js` (563.52 kB), `dist/assets/index-HKRzivQY.css` (165.36 kB)
- One non-blocking warning: single chunk >500 kB (expected for a monolithic SPA without code-splitting)

### 3.2 `npx vitest run`
**Status: CONDITIONAL PASS** ⚠️

When run with default discovery (`npx vitest run`):
- **5 failures** across 5 test files — all the same test: `src/engines/underfrequencyTimeline.test.ts` and its 4 copies in `.claude/worktrees/*`
- Failure: `matches clampGovernorMw at every online-generator snapshot for random studies` — **times out at 5s**
- This is a 200-trial randomized fuzz test that legitimately takes >5s on this hardware
- **Root cause:** `vite.config.ts` has no `test.exclude` for `.claude/worktrees/`, so Vitest discovers and runs duplicate test files from parallel-session worktrees

When run scoped to `src/` with extended timeout (`npx vitest run src/ --test-timeout=30000`):
- **225 test files passed**
- **1,887 tests passed**
- **0 failures**

**Recommendation:**
1. Add `test: { exclude: ['.claude/**', 'node_modules/**'] }` to `vite.config.ts` to prevent worktree test duplication
2. Consider raising the default test timeout for the fuzz test, or splitting it into smaller batches

### 3.3 Test file count drift
- Memory-bank (`verified-repo-state.md`) claims: 43 files / 366 tests
- **Actual current count:** 45 test files / 1,887 tests in `src/`
- The 366 number was from an earlier baseline (pre-Underfrequency expansion). The 1,887 count is correct and includes all Underfrequency, Distance, Overcurrent, and Differential tests.

---

## 4. Active Working Tree Diffs & Bug State

### 4.1 Git status
- Working tree: **clean** (no unstaged changes)
- Only untracked: `docs/superpowers/` (the UF SLD design spec)
- The previously staged changes to `underfrequencyPresentation.test.ts` and `underfrequencyTimelineChart.ts` were **committed by a parallel session** while this audit was running (PR #2 merge at `4cafe2c`)

### 4.2 Recently committed changes (HEAD history)
- `b17d995` — feat(underfrequency): relabel collapse/expand buttons to Collapse/Expand
- `9722b97` — fix(underfrequency): size y-axis to the curve, not to UFLS stages (Bug 5)
- `044d4e2` — feat(underfrequency): add interactive hover tooltip on frequency curve (Bug 4)

### 4.3 Known bugs from memory-bank (`ufr-audit-findings-2026-08-31.md`)

| # | Severity | Location | Description | Test coverage? |
|---|---|---|---|---|
| 1 | **CRITICAL** | `underfrequencyTimeline.ts:418,435,448,597` | `state.timers` never accumulates elapsed time — always 0. `tauTrip = stage.timeDelaySec` measured from segment start, not arming instant. **Delay=0 stages never trip** (rejected by `best.tau > EPS` gate). | **MISSING** |
| 2 | **CRITICAL** | `underfrequencyTimeline.ts` `applyStep` (~610) | `GENERATOR_BLOCK` implemented identically to `GENERATOR_LOSS` (removes from online set). U01 §6.1 says it must clamp governor headroom while staying online. `step.mw` never read. | **MISSING** (no preset uses BLOCK) |
| 3 | **HIGH** | `underfrequencyTimelineChart.ts:285-295` | Tooltip "Armed" pill contradicts event list at trip/reset instants — `armed` set is not cleared for TRIP/TIMER_RESET/STAGE_RESET events. | Partial (tooltip tests exist) |
| 4 | **HIGH** | `underfrequencyTimeline.ts:496-521` | Spurious COLLAPSE on exactly-balanced-at-limits knife edge (`dResidualMw === 0`): `runawayRocofHzPerSec = 0`, loop burns `maxIterations` → safety net latches COLLAPSE on a physically balanced system. | **MISSING** |
| 5 | **HIGH** | `underfrequencyAnalysis.ts:142-147` | Static→run fallback shows phantom "OPERATED" when run settles without trips but static closed-form latches stages. | **MISSING** |
| 6 | **HIGH** | `underfrequency.ts:301-313` | UFLS stage ordering check is adjacent-pair only with early `break` — non-adjacent inversions (S1>S3>S2) can pass. | **MISSING** |
| 7 | **MEDIUM** | `FrequencyTimelineChart.tsx:130` vs `underfrequencyAnalysis.ts:295` | Story vs analysis phase disagreement: strict `>` vs `>=` for Recovery boundary. | **MISSING** |
| 8 | **MEDIUM** | `underfrequencyTimelineChart.ts:99` + `FrequencyTimelineChart.tsx:463-472` | Bug 5 downstream: on UFR-01 (flat 50 Hz), `paddedBounds` degenerate branch → y-domain [49.50, 50.50]; S1 threshold 49.50 lands on clip-rect bottom edge → dashed stage line half-clipped. | **MISSING** |
| 9 | **MEDIUM/LOW** | `underfrequencyTimelineChart.ts:52-56,66,155,234` | Dead `UnderfrequencyPhaseZone` interface (typo `'ARrest'`), dead `armedEvents` array, dead `evaluateUnderfrequencyUfr` export, `AT_GOVERNOR_LIMIT` allowed as pre-disturbance status. | N/A (dead code) |

### 4.4 Pending feature work
- **UF SLD Primary View** — Spec approved, plan committed on branch `work/uf-sld-primary-view`. Implementation deferred until explicit user go-ahead. Worktree: `.claude/worktrees/uf-sld-primary-view`.
- **UFR audit fixes** — 2 critical + 4 high bugs identified, fixes pending. Worktree: `.claude/worktrees/ufr-audit-fixes`.

---

## 5. Summary of Recommendations

### Immediate (no code change needed)
1. **Move** `OVERCURRENT_O16_README.md` and `TCC_PAN_ZOOM_FINAL.md` into `docs/reports/` (or delete if fully superseded)
2. **Rename** `docs/superpowers/` → `docs/designs/` or `docs/specs/` for consistency, then commit
3. **Update** `memory-bank/verified-repo-state.md` test count from 366 → 1,887

### Short-term (code/config change)
4. **Add Vitest exclusion** in `vite.config.ts`:
   ```ts
   test: {
     exclude: ['node_modules/**', '.claude/**', 'dist/**'],
   }
   ```
5. **Fix** the 5s timeout on the 200-trial fuzz test (`underfrequencyTimeline.test.ts`) — either raise timeout or reduce trial count
6. **Remove dead code:** `UnderfrequencyPhaseZone` interface, `armedEvents` array, `evaluateUnderfrequencyUfr` export (or deprecate)

### Medium-term (engineering work)
7. **Fix CRITICAL bug #1** (UFLS timer accumulation + Delay=0) with regression tests
8. **Fix CRITICAL bug #2** (GENERATOR_BLOCK semantics) with regression tests
9. **Fix HIGH bugs #3-6** per the audit findings
10. **Complete Distance module tests** — add page test, timeline test, presentation model tests

---

*End of audit. No files were modified or deleted during this audit.*
