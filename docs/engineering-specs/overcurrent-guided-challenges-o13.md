# Overcurrent Relay — O13 Coordination Guided Challenges Engineering Specification

**Status:** IMPLEMENTED / PASSED  
**Gate:** O13  
**Date:** 2026-08-14  
**Parent:** O12 Analysis / Learning Layer PASS  
**Next gate:** O14 Responsive / Accessibility / UX Refinement

## 1. Objective

O13 closes the PRD Guided Study workflow for Overcurrent Coordination Lab without adding another protection calculation engine. The learning sequence is:

`Intentional coordination problem -> Investigate -> Adjust accepted engineering settings -> Reveal progressive hints when needed -> Run Coordination Test -> Incomplete or Verified -> Why This Works`

The challenge layer is deliberately outcome-based. It never requires an exact hidden setting value and it never auto-optimizes settings. A user may complete a challenge with any valid engineering configuration that satisfies the complete configured study and required audit dimensions.

## 2. Architectural boundary

The accepted calculation ownership remains unchanged:

- O03/O04: CT measurement and 50/51 device operation;
- O05: explicit study/preset data;
- O06: coordination pairs, CTI, sensitivity, selectivity, time grading, load security, backup availability, 50 reach, violations, and run-all audit;
- O07/O11: engineering-time fault sequence and playback projection;
- O09: radial SLD presentation;
- O10H: TCC presentation and adjacent-tier CTI brackets;
- O12: Analysis / Learning engineering explanation;
- O13: challenge objective, progressive-hint lifecycle, explicit completion semantics, and verified explanation.

O13 does **not** recalculate CT ratio, pickup, current multiple, inverse time, definite time, 50 operation, CTI, or coordination status. `buildOvercurrentGuidedChallengeModel()` consumes accepted state and O06 audit results.

## 3. Challenge completion contract

A Guided Coordination challenge is VERIFIED only when all of the following are true:

1. the active study is `COORDINATION_LAB`;
2. guidance mode is `GUIDED`;
3. the preset has a configured Study Objective;
4. the user has explicitly executed `RUN_COORDINATION_TEST` after the latest engineering mutation;
5. validation state is `COMPLETE`;
6. O06 audit status is `COORDINATED`;
7. `passedCaseCount === totalCaseCount` and the configured case count is nonzero;
8. every objective-required audit dimension is `PASS`.

`NOT_EVALUABLE` can never produce VERIFIED.

A setting state that would pass the study but has not yet been run through `RUN_COORDINATION_TEST` is `VALIDATION_REQUIRED`, not VERIFIED. This prevents the challenge UI from silently treating a single visible operating point or stale audit as proof of full coordination.

## 4. Guided challenge statuses

O13 derives, rather than redundantly stores, the following statuses:

- `NOT_APPLICABLE` — Free Study or no challenge objective;
- `READY` — canonical Guided initial state, no completed validation yet;
- `VALIDATION_REQUIRED` — engineering settings changed since the last complete validation;
- `INCOMPLETE` — complete run-all validation exists but at least one configured case/objective still fails;
- `VERIFIED` — all configured validation cases and required dimensions pass;
- `INVALID` — engineering input invalid; output held.

Derived status avoids a second source of truth for challenge completion.

## 5. Challenge progress state

O13 adds only lightweight learning progress:

```ts
interface GuidedChallengeProgress {
  readonly revealedHintCount: number;
}
```

This state does not contain relay settings, results, scores, or completion flags.

`REVEAL_GUIDED_HINT` increments the revealed count only in Guided Coordination Lab, clamps at the configured hint count, and remains an inspection/learning action during timed playback.

`RESET` reconstructs the selected canonical preset and therefore restores:

- canonical engineering settings;
- validation state `IDLE`;
- zero revealed hints;
- no verified completion;
- existing O08/O11 reset behavior.

## 6. Guided versus Free Study semantics

Changing `GUIDED <-> FREE` is learning metadata only. It must not:

- set `modified = true`;
- mutate CT/50/51/breaker/CTI settings;
- invalidate a valid engineering coordination audit;
- affect O06 results.

Changing guidance mode resets only temporary hint progression.

Free Study continues to expose the engineering simulator and `Run Coordination Test`; it simply suppresses challenge objective, hint progression, verification ceremony, and `Why This Works`.

## 7. Selection versus engineering mutation

O13 closes an O12 workflow ambiguity: changing the Explore fault-location scrubber position is selection/presentation state, not a mutation of the configured validation registry. Therefore it preserves an existing complete run-all validation result.

Engineering mutations continue to invalidate prior validation to `IDLE`, including CT, 51 pickup/curve/time, definite delay, 50, breaker clearing, CTI requirement/budget, and configured study current edits.

Relay selection and other inspection actions also preserve validation.

## 8. Progressive hints

Guided challenge hints are locked to exactly three levels:

1. `LOCATION`
2. `PARAMETER_FAMILY`
3. `DIRECTION`

The challenge UI reveals them sequentially. Runtime hint metadata may identify relay/fault/pair context, but must not provide the exact numerical answer.

Examples of permitted guidance:

- inspect the R3 -> R2 margin at F3;
- the issue is associated with time grading;
- the upstream backup must operate later relative to the downstream primary.

Examples intentionally prohibited:

- set R2 TMS to 0.19;
- set pickup to 0.80 A sec;
- set I>> to 7 A sec.

Known solved settings exist only in regression fixtures to prove challenge solvability.

## 9. Guided challenge registry

O13 completes the planned coordination challenge progression from COORD-01 through COORD-06.

### 9.1 COORD-01 — Two Relay Time Grading

Learning focus: basic primary/backup grading.

Initial deterministic result:

- `3 / 4` configured cases pass;
- status `COORDINATION_INCOMPLETE`;
- intentional violation: `TIME_GRADING`.

Test-only solved reference: adjust the R1 51 time scale to a known passing value. The value is not included in runtime hints.

### 9.2 COORD-02 — Three Relay Radial

Learning focus: adjacent-tier three-relay grading.

Canonical O01/O06 result is preserved:

- `5 / 6` configured cases pass;
- F3 MAX R3 -> R2 observed CTI is approximately `0.278307692 s` against required `0.300 s`;
- status `COORDINATION_INCOMPLETE`;
- intentional violation: `TIME_GRADING`.

The accepted regression solution remains test-only and is not surfaced as a hint.

### 9.3 COORD-03 — Pickup + Time

Learning focus: coordinate the pickup window and time grading together.

Initial O13 data deliberately raises downstream R3 51 pickup while retaining the original R2 grading problem.

Initial deterministic result:

- `4 / 6` configured cases pass;
- `SENSITIVITY_RISK`;
- `SELECTIVITY_FAIL`;
- `TIME_GRADING`;
- load security, instantaneous reach, and backup availability remain PASS.

The challenge therefore teaches that pickup must remain above configured maximum load yet below the configured minimum fault, while upstream backup timing must still coordinate.

### 9.4 COORD-04 — Curve Selection

Learning focus: inverse characteristic shape across the configured fault-current range.

Initial state intentionally changes R2 to an inverse curve shape that loses downstream F3 high-current grading while preserving the other engineering dimensions.

Initial deterministic result:

- `5 / 6` configured cases pass;
- the only violation type is `TIME_GRADING`;
- sensitivity, selectivity outside the failed grading context, 50 reach, load security, and backup availability remain otherwise valid under O06 semantics.

Completion is not tied to a particular curve name. Any complete passing engineering outcome is accepted.

### 9.5 COORD-05 — Instantaneous Coordination

Learning focus: prevent upstream 50 overreach while retaining 51 coordination.

The accepted O01/O06 challenge is preserved with upstream R2 50 enabled at the original intentional overreach setting.

Initial deterministic result:

- `5 / 6` configured cases pass;
- `SELECTIVITY_FAIL`;
- `TIME_GRADING`;
- `INSTANTANEOUS_OVERREACH`;
- audit dimension `INSTANTANEOUS_REACH = FAIL`.

The hint identifies the 50 high-set family but never gives a target current.

### 9.6 COORD-06 — Full Coordination Study

Learning focus: capstone combining pickup, 51 grading, and instantaneous reach.

Initial state combines the COORD-03 downstream sensitivity issue, the original grading problem, and the COORD-05 upstream 50 overreach.

Initial deterministic result:

- `4 / 6` configured cases pass;
- `SENSITIVITY_RISK`;
- `SELECTIVITY_FAIL`;
- `TIME_GRADING`;
- `INSTANTANEOUS_OVERREACH`.

The capstone completes only when the entire configured validation registry and all required dimensions pass.

## 10. Objective dimensions

O13 extends `StudyRequirementKey` to include `BACKUP_AVAILABILITY` so challenge objectives can explicitly cover the complete O06 audit surface.

Supported objective dimensions are:

- sensitivity;
- selectivity;
- time grading;
- instantaneous reach;
- load security;
- backup availability.

The Guided Challenge model maps each requirement directly to the corresponding O06 dimension result. Before explicit validation, requirement rows are `PENDING`; they do not infer a PASS from currently visible calculations.

## 11. Why This Works

`WHY THIS WORKS` is available only after VERIFIED. It is derived from the required dimensions that actually passed, for example:

- configured minimum-fault primaries remain above enabled 51 pickup;
- maximum load remains below enabled pickup thresholds;
- downstream primaries operate before adjacent upstream backups;
- every required CTI meets or exceeds the configured target;
- no required upstream backup 50 overreaches a downstream fault;
- required backups remain available at minimum fault.

Optional challenge-specific completion notes come from learning metadata. The section remains concise and does not become an article or an optimization prescription.

## 12. UI integration

O13 adds `GuidedChallengeCard` at the top of the existing Analysis column when Guided Coordination mode is active.

The card contains:

- `GUIDED STUDY · COORD-XX` identity;
- Study Objective;
- derived challenge status;
- required audit-dimension rows;
- explicit run-all case progress;
- `Run Coordination Test` action;
- progressive hints and reveal action;
- `Why This Works` after verification.

The prior O12 standalone local hint counter is removed. Hint progression is reducer-owned and deterministic across component remounts.

Free Study retains the normal O12 toolbar Run Coordination Test action and hides the Guided card.

No new page, graph, route, modal workflow, score, badge system, or layout column is added.

## 13. Engineering and UX safety properties

O13 preserves these invariants:

- no duplicate 50/51/CTI formula;
- no optimizer or hidden recommended setting engine;
- exact test solutions are not runtime challenge data;
- one operating point never proves full coordination;
- stale validation never remains VERIFIED after engineering edits;
- inspection interactions do not unnecessarily destroy valid audit state;
- invalid inputs cannot produce a false completion;
- challenge logic is generic enough to build a synthetic four-relay Guided model;
- new presets remain compatible with existing SLD, TCC, and Operating Sequence presentation layers.

## 14. Verification performed

### 14.1 Pure compile and syntax

- strict pure Overcurrent TypeScript compile: PASS;
- current source syntax-transpile: **78 TS/TSX files / 0 diagnostics**;
- full-source stub comparison: O12 baseline and O13 have the exact same 33 environment/stub messages and O13 adds **0 new** messages.

### 14.2 Parent regression

The O12 runtime harness was rerun against the O13 build:

- **1,063 checks PASS**.

The count is slightly larger than the earlier O12 report because preset-loop assertions now traverse the completed COORD-03/04/06 registry. This is not a change to O12 engineering semantics.

Protected production files remain byte-identical to O12, including:

- O03/O04 protection engines;
- O06 Coordination Engine;
- O07/O11 Timeline Engine;
- O05 study resolver;
- O09 SLD presentation/component;
- O10H TCC presentation/component;
- O11 Operating Sequence presentation/component;
- O12 Analysis engineering presentation model;
- Differential R10;
- App shell and Homepage.

### 14.3 O13 runtime contract suite

O13 independent runtime harness: **2,118 checks PASS**.

Coverage includes:

- COORD-01 through COORD-06 registry validity;
- deterministic intentional initial failure for every challenge;
- one test-only fully coordinated solution for every challenge;
- exactly three ordered hint levels;
- numeric-answer leakage guard;
- explicit-validation completion contract;
- Why This Works visibility only after verification;
- Reset/hint lifecycle;
- Guided/Free semantics;
- fault scrubber preservation of complete run-all validation;
- engineering-edit stale-result invalidation;
- invalid-input containment;
- synthetic four-relay Guided model;
- 1,000 deterministic randomized setting iterations with no NaN/Infinity serialization and valid Analysis output;
- all six coordination presets build valid existing SLD, TCC, and Operating Sequence models.

### 14.4 Dependency-complete repository run

A fresh repository `npm ci -> Vitest -> Vite build` was **not claimed** at the time of writing. The source package then had an empty/incomplete `node_modules`, and `npm ci --offline` was blocked because the local npm cache did not contain `yallist-3.1.1`.

This was an environment limitation rather than a source test failure. Permanent O13 Vitest tests are included, and the dependency-complete Vitest suite (31 files / 260 tests), the Vite production build, a fresh `npm ci` from a clean cache, and a production browser smoke all now PASS in the current environment (2026-08-29 / 2026-08-30), alongside a clean `tsc --noEmit`. The module is READY FOR FREEZE pending only explicit user approval.

## 15. Scope exclusions

O13 does not implement:

- automatic setting optimization;
- exact-answer hints;
- scores, stars, grades, badges, or confetti;
- persistent challenge progress;
- O14 responsive/accessibility final refinement;
- O15 Overcurrent route/Homepage activation;
- O16 release audit/freeze;
- directional 67;
- ground/sequence overcurrent;
- CT saturation;
- full short-circuit network solving;
- ring/meshed coordination;
- vendor-specific relay emulation.

## 16. Acceptance verdict

O13 acceptance criteria are satisfied within the available runtime evidence:

- challenge progression COORD-01..06 complete;
- intentional failure and solvability proven;
- outcome-based explicit completion implemented;
- three-level non-answer hints implemented;
- verified explanation implemented;
- Guided/Free and Reset semantics deterministic;
- parent protection behavior preserved;
- no later-gate route/responsive/release work introduced.

**O13 verdict: PASS.**

Next gate: **O14 Responsive / Accessibility / UX Refinement**. O14 is not started by O13.
