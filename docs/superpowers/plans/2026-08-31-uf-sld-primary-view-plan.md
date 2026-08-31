# Underfrequency SLD Primary View — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-31-uf-sld-primary-view-design.md` (approved)
**Baseline spec:** U01 v1.0 — this plan touches §14 (UI) only; engine untouched.
**Working location:** worktree `.claude/worktrees/uf-sld-primary-view`, branch `work/uf-sld-primary-view`
**Merge flow:** push branch → PR → merge → `bash scripts/parallel-session.sh --remove uf-sld-primary-view`
**Commit rule:** explicit pathspec always; one phase = one commit (or more if a phase grows).

---

## Phase 0 — Baseline (no code change)

Run in the worktree:

```bash
npx vitest run        # full suite green before touching anything
npm run build         # tsc strict + vite build green
```

Record any pre-existing failure — do not fix unrelated failures here; note them and continue only if green.

**Commit:** none (baseline only).

---

## Phase 1 — Reducer: `SET_SCRUB_TIME` (TDD)

**File:** `src/utils/underfrequencyState.test.ts` (extend; create if absent), `src/utils/underfrequencyState.ts`

1. Write tests first:
   - `SET_SCRUB_TIME { timeSec: 12.5 }` stores `12.5`, leaves `playbackState` unchanged.
   - `SET_SCRUB_TIME { timeSec: null }` clears to `null`.
   - `SET_SCRUB_TIME` with non-finite number → state unchanged (numeric-hygiene, same as other actions).
   - `RESET`, `APPLY_PRESET`, `CLEAR_RUN`, and any `flagModified` path (e.g. `SET_SYSTEM`) all reset `scrubTimeSec` to `null` (already coded — now load-bearing, must be tested).
2. Implement: add `{ readonly type: 'SET_SCRUB_TIME'; readonly timeSec: number | null }` to `UnderfrequencyAction`; add the reducer case (finite-guard, no playbackState change).

**Verify:** `npx vitest run src/utils/underfrequencyState.test.ts`

**Commit:** `feat(underfrequency): add SET_SCRUB_TIME action to store scrub time in reducer`

---

## Phase 2 — Presentation model: `underfrequencySld.ts` (TDD, pure)

**File:** `src/presentation/underfrequencySld.ts` (new), `src/presentation/underfrequencySld.test.ts` (new)

Pure model — no React, no DOM. Types (local to this module, no changes to `types/underfrequency.ts`):

```ts
interface UnderfrequencySldBlock {
  id: 'A' | 'B' | 'C' | 'D';
  fractionPct: number;          // 35 / 30 / 20 / 15
  baseMw: number;               // fraction × study.system.baseLoadMw
  shed: boolean;                // fully shed per D8
  critical: boolean;            // D only — never shed
}
interface UnderfrequencySldGenerator {
  generatorId, label, status ('ONLINE'|'TRIPPED'|'AT_GOVERNOR_LIMIT'),
  outputMw, governorResponseMw, headroomMw, saturated, rpm,
  mwRated, poles,
}
interface UnderfrequencySldModel {
  status: 'IDLE' | 'VALID';
  generators: readonly UnderfrequencySldGenerator[];
  bus: {
    frequencyHz, rocofHzPerSec, deficitMw,
    tone: 'success' | 'warning' | 'danger',
    collapse: boolean, unservedMw: number,
  };
  blocks: readonly UnderfrequencySldBlock[];
  shedMwTotal: number;
}
buildUnderfrequencySldModel(study, visibleSnapshot: UnderfrequencyTimelineSnapshot | null): UnderfrequencySldModel
```

Rules (all from spec §5, D8):
- **IDLE** (`visibleSnapshot === null`): pre-fault from study only — every generator ONLINE at `initialMw`, `f = fNominalHz`, ROCOF/deficit 0, all blocks energized, tone success.
- **VALID**: generator rows from `snapshot.generators`; RPM straight from snapshot.
- **Bus tone from snapshot state**: no `armedStageIds` and no `operatedStageIds` → success; any armed (none operated) → warning; any operated OR `steadyStateStatus COLLAPSE` → danger. Tone is NOT derived from hard-coded thresholds.
- **D8 allocation**: cumulative shed (sum of `shedMw` of operated stages — from the run's events up to the snapshot, or `snapshot.operatedStageIds` × per-stage shed MW computed as `shedFractionPct/100 × baseLoadMw`) fills blocks strictly A→B→C; D never sheds; overflow beyond A+B+C → `bus.unservedMw`.
- Collapse flag from `run.steadyStateStatus` (pass the run, or pass collapse as a param — decide in code, keep pure).

Tests (deterministic, no randomness):
- Partition math for the default study (455/390/260/195 MW).
- Shed 65 MW (S1) → only A shed; shed 195 MW cumulative → A+B shed; overflow > 1105 MW → unservedMw = remainder, D intact.
- D never shed for any input (property-style loop over a few crafted stages).
- Idle build equals pre-fault expectations.
- Tone mapping: idle → success; armed-only → warning; operated → danger; collapse → danger.
- Determinism: same inputs → deep-equal output twice.

**Verify:** `npx vitest run src/presentation/underfrequencySld.test.ts`

**Commit:** `feat(underfrequency): add pure SLD presentation model with D8 load-block allocation`

---

## Phase 3 — Playback lift: `useUnderfrequencyPlayback` + page owns `visibleSnapshot`

**Files:** `src/pages/underfrequencyPlayback.ts` (new hook), `src/pages/UnderfrequencySimulator.tsx`, `src/components/underfrequency/FrequencyTimelineChart.tsx`, chart test updates.

Hook (plain React, page-level):

```ts
useUnderfrequencyPlayback({ playbackState, simulationSpeed, totalTimeSec, dispatch })
// rAF loop: dispatch SET_SCRUB_TIME(min(total, scrub + wallDelta × speed))
// COMPLETE latch: dispatch SET_PLAYBACK_STATE COMPLETE at the end (same semantics as today)
```

Page changes:
- `visibleSnapshot = useMemo(() => run ? snapshotAtTime(run.snapshots, state.scrubTimeSec) : null, [run, state.scrubTimeSec])` — page computes it once and passes to **all** consumers (chart, SLD, GeneratorDiagram, SheddingChart).
- `onSnapshotChange` callback removed (chart no longer owns the clock or feeds siblings).
- GeneratorDiagram/SheddingChart switch to the `visibleSnapshot` prop (GeneratorDiagram currently takes `snapshot` — feed the same value).

Chart slim-down (`FrequencyTimelineChart.tsx`):
- Remove: internal `scrubTimeSec` state, rAF effect, COMPLETE-latch effect, playback bar (Run/Pause/Clear/speed/scrubber), Story mode (`buildStorySteps`, chips, `storyOpen`, `StoryStep`).
- New props: `scrubTimeSec: number | null` (for the crosshair), `visibleSnapshot: UnderfrequencyTimelineSnapshot | null` (for the readout). Remove `playbackState`, `simulationSpeed`, `dispatch`, `onSnapshotChange`.
- Keep: curve rendering, UFLS markers, tooltip, axis work from Bug 5, expand overlay.
- The `RUN {playbackState}` status chip moves to the global playback bar (Phase 5).

Tests:
- Chart tests: drop story/playback cases; assert crosshair appears for a given `scrubTimeSec`, readout from `visibleSnapshot`.
- Hook: assert `SET_SCRUB_TIME` dispatched on simulated frames (use fake rAF / vi.useFakeTimers pattern consistent with existing tests) and the COMPLETE latch.
- Page: `IDLE` + scrub null → last snapshot passed to children (snapshotAtTime semantics preserved).

**Verify:** `npx vitest run src/pages src/components/underfrequency src/utils`

**Commit:** `refactor(underfrequency): lift playback clock to page-level hook; chart becomes read-only`

---

## Phase 4 — SLD component: `UnderfrequencySld.tsx`

**Files:** `src/components/underfrequency/UnderfrequencySld.tsx` (new), `underfrequencySld.css` (new), `UnderfrequencySld.test.tsx` (new)

- Inline SVG (no library). Layout per spec §5: 4 generator columns on top, bus center, 4 feeder breakers + load blocks below.
- Renders ONLY from `buildUnderfrequencySldModel` output. No relay math, no shed allocation here — the component maps model → coordinates.
- `data-status` attributes drive CSS: `data-status="TRIPPED"` on generator groups; `data-status="SHED"` on blocks; breaker blade rotate via transition (~200 ms) triggered by state change (same visual idiom as Overcurrent `breakerGeometry`, separate code).
- Bus: big tabular-nums frequency readout + ROCOF + DEFISIT + tone class; COLLAPSE label when `bus.collapse`; `unservedMw` line when > 0.
- Generator: output bar fill (CSS transition, `--gen-output` style var like GeneratorDiagram), governor response bar, RPM, status chip (ONLINE / AT LIMIT / TRIPPED).
- aria: `aria-label='Diagram satu garis sistem underfrequency'`, role='status' on bus readout.
- Performance note: ~50 SVG nodes; model memoized per snapshot in the page — do not recompute inside the component.

Tests: idle renders pre-fault (all ONLINE, blocks energized); running renders snapshot values; TRIPPED generator gets `data-status`; shed block gets `data-status="SHED"` + breaker open; collapse shows COLLAPSE; aria labels present.

**Verify:** `npx vitest run src/components/underfrequency/UnderfrequencySld.test.tsx`

**Commit:** `feat(underfrequency): add animated SLD component (generators, bus, UFLS shed blocks)`

---

## Phase 5 — Page composition: tabs + global playback bar

**Files:** `src/pages/UnderfrequencySimulator.tsx`, `src/pages/UnderfrequencySimulator.test.tsx`, `src/pages/underfrequencySimulator.css`

- `const [viewMode, setViewMode] = useState<'sld' | 'curve' | 'split'>('sld')` — UI preference, NOT in reducer.
- Tab bar in the Live Simulation column header: `[SLD] [Curve] [Split]`, `aria-pressed`/`role="tablist"` consistent with existing step buttons.
- Global playback bar ABOVE tabs: Run/Pause/Resume · Clear · ×1/×5/×10 · scrubber (`min/max/step` from `run.finalTimeSec`) · `RUN {playbackState}` chip. All dispatch through the reducer (`SET_PLAYBACK_STATE`, `SET_SIMULATION_SPEED`, `SET_SCRUB_TIME`, `CLEAR_RUN`).
- Render switch: `sld` → SLD full; `curve` → chart full; `split` → SLD top + curve bottom (50/50 stack). GeneratorDiagram + SheddingChart remain beneath, shared across tabs (both views feed the same cards).
- IDLE behavior: SLD shows pre-fault from study (model IDLE state), chart shows curve-ready state — no "NO SNAPSHOT" walls.

Tests: default tab is SLD; switching to Curve renders the chart; Split renders both; playback bar dispatches correct actions; scrub input dispatches SET_SCRUB_TIME; IDLE renders pre-fault SLD.

**Verify:** `npx vitest run src/pages`

**Commit:** `feat(underfrequency): add SLD/Curve/Split view tabs with global playback bar (SLD default)`

---

## Phase 6 — Cleanup

- Delete now-dead CSS (`.underfrequency-ftc-story*`, playback styles that moved) from `frequencyTimelineChart.css`; add tab + playback-bar styles where they belong (`underfrequencySimulator.css` or a small new css file).
- Remove any unused exports (`buildStorySteps` gone entirely).
- `grep -rn "buildStorySteps\|underfrequency-ftc-story" src/` → zero hits.
- No unused imports (strict tsc will catch).

**Commit:** `chore(underfrequency): remove story-mode remnants and relocated playback styles`

---

## Phase 7 — Verification gate (mandatory before PASS)

1. `npx tsc --noEmit` → 0 errors.
2. `npx vitest run` → full suite green (parity + hardening pass untouched = engine regression guard).
3. `npm run build` → green.
4. Manual smoke (`npm run dev`): UFR-02 preset — Run → watch SLD: ROCOF dip, governor bars rise, S1..S4 breakers open in sequence with blocks dimming, bus recovers; Curve tab shows same run; Split shows both synchronized; scrub back and forth; Reset returns pre-fault SLD. Also UFR-06 (governor-only, no shed) and a collapse preset if available.
5. `.agents/skills/ui-adversarial-test/SKILL.md` run against this revision (CLAUDE.md hard gate). Unresolvable findings → verdict BLOCKED, never PASS.
6. Push, PR, merge; then `bash scripts/parallel-session.sh --remove uf-sld-primary-view`.

**Commit (if smoke fixes):** separate `fix(underfrequency): ...` commits, never lumped.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| 60 fps re-render of the whole page via reducer scrub updates | Model memoized per snapshot; SLD ~50 nodes; tabular-nums prevents layout jitter; GeneratorDiagram/SheddingChart already consume snapshot props at this rate today (chart fed them at rAF speed already) |
| rAF + vitest flakiness | Hook tested with faked rAF/timers; page tests assert dispatched actions, not frame timing |
| Two sessions share main tree | All work/commits inside the worktree (already created); explicit pathspecs only |
| Overcurrent SLD regression | Zero shared code — new files only; no edits to `overcurrentSld.ts` or `RadialProtectionDiagram.tsx` |
| Story-mode removal surprises users of existing tests | Chart tests updated in the same commit as the refactor (Phase 3), suite green before proceeding |

## Explicitly out of scope (unchanged from spec §9)

No new dependencies; no engine/preset/UFLS changes; no shared SLD abstraction; no interactive SLD editing; nothing from U01 §16.
