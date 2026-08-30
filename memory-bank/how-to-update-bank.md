---
name: how-to-update-bank
description: When and how to refresh each memory-bank file so status lines never drift from the repo
metadata:
  type: reference
---

This bank mixes two kinds of content: **live status** (module status, freeze state, focus) and **durable reasoning** (architecture, patterns, decisions, phase history). Confusing the two is why it drifted. Keep them separate.

**Live-status files — update these whenever the repo state changes.** Re-derive, don't assume:
- `verified-repo-state.md` — the dependency-checked ground truth. Before editing a status line, run `npm test` (full Vitest) and `npm run build` (tsc strict + Vite) and read the real numbers from the output. Never guess a test/file/module count.
- `activeContext.md` — "Current focus" + the module-status table + freeze state.
- `MEMORY.md` — the top module-status table mirrors `activeContext.md`; only change it when that table changes.

**Durable-reasoning files — update only when the content is wrong, not when status changes:**
- `systemPatterns.md`, `techContext.md`, `productContext.md`, `projectbrief.md`, `checkpoints.md`, `progress.md` phase records.

`checkpoints.md` and the per-phase records in `progress.md` are historical logs: they describe the state **at the time of writing**. Do not rewrite history on a later status change — a checkpoint that said "planned / not started" on its date is a faithful record; append a new entry instead. Only correct a historical line if it makes a *present-tense claim* that is now false.

**How to apply:** every time you update `activeContext.md`'s status table, (1) re-run `npm test` + `npm run build` and put the verified numbers in `verified-repo-state.md`, then (2) reflect them in `MEMORY.md`'s table. Link from [[overcurrent-build-gate-closed]] and [[verified-repo-state]].
