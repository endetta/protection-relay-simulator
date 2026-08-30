# Memory index

## Module status (verified against `main` on 2026-08-30)

| Module | Status | Spec |
|---|---|---|
| Differential Relay | **FINAL / FROZEN (R10)** — do not modify without approval | differential-relay.md — APPROVED |
| Overcurrent Relay | O16 audit PASS · all release-gate items PASS 2026-08-30 · **READY FOR FREEZE, not yet FINAL** (freeze approval pending) | overcurrent-relay.md O01 APPROVED/FROZEN; O02–O16 implemented; overcurrent-final-audit-o16.md |
| Distance Relay | **IMPLEMENTED / MERGED into `main`** (route + homepage wired) — spec **not yet approved**, partial test coverage | distance-relay.md D01 READY FOR APPROVAL |
| Underfrequency Relay | **COMPLETE** (page/route wired) — spec **not yet approved** | underfrequency-relay.md U01 READY FOR APPROVAL |
| Homepage / Protection Lab | IMPLEMENTED R02 / NOT FROZEN | — |

## Files

- [How to update this bank](how-to-update-bank.md) — when & how to refresh each file (avoids drift)
- [Verified repo state](verified-repo-state.md) — dependency-checked source of truth, re-derivable via `npm test` / `npm run build`
- [Overcurrent release-frozen readiness](overcurrent-build-gate-closed.md) — all O16 gate items PASS 2026-08-30; Ready for freeze, not FINAL
- [Progress](progress.md) — phase-by-phase Overcurrent O01–O16 history + full project status
- [Active context](activeContext.md) — current focus, freeze state, module status table
- [Product context](productContext.md) — why it exists, UX priorities, interaction philosophy
- [Project brief](projectbrief.md) — project name, users, scope, MVP direction
- [System patterns](systemPatterns.md) — architecture rules, layer separations, per-module patterns
- [Tech context](techContext.md) — stack, decision registry, engineering constraints
- [Checkpoints](checkpoints.md) — per-phase checkpoint versions, rollback paths, verification results

> **Freshness rule:** `verified-repo-state.md` and the module-status table in `activeContext.md` are the only entries meant to track *live* status. The rest are durable reasoning. If in doubt about current status, re-run `npm test` and `npm run build` before editing a status line.
