# Protection System Relay Simulator — Copilot Instructions

This project is a Vite + React + TypeScript + Tailwind + Vitest engineering
simulator for protection relays (Differential, Overcurrent, Distance, planned).

## Read first

Before any non-trivial task, read in this order:
1. `AGENTS.md` (project quick map)
2. `memory-bank/activeContext.md` (current focus and freeze status)
3. The relevant `docs/engineering-specs/*.md` for the relay in scope

## Source of truth precedence

1. Approved relay Engineering Specification under `docs/engineering-specs/`
2. `docs/PRD*.md` for product scope
3. `docs/frontend-design-guide.md` + `docs/ui-design-tokens.md` for UI
4. `memory-bank/activeContext.md` for current freeze state
5. Code (only if it agrees with the above)

Do not invent relay equations. Do not silently change the stack
(React/Vite/TS/Tailwind/Vitest). Do not claim a release is FROZEN
unless the user explicitly approves.

## Detailed workflows

Domain-specific specialist workflows live in `.github/agents/` and
`.github/instructions/`. Use the custom agents for audits:
- `ui-ux-auditor` — UI/UX quality audit (chains to `engineering-validator`)
- `engineering-validator` — relay math validation (chains to `ui-ux-auditor`)
- `architecture-auditor` — module boundary audit (chains to `ui-ux-auditor`)
- `fullstack-release-auditor` — pre-release gate (chains all three above)
- `performance-auditor` — bundle size / render performance
- `protection-animation-expert` — protection-relay animation specialist
- `protection-sound-expert` — protection-relay sound effect specialist
- `relay-module-builder` — new relay module scaffolding specialist

Reusable prompts:
- `/audit-ui` — UI/UX audit (T1 quick scan by default; add "deep" for 7-pass)
- `/audit-engine` — engine validation
- `/audit-architecture` — architecture audit
- `/pre-release` — pre-release technical gate
- `/fix-ui` — audit + auto-apply CRITICAL/HIGH patches
- `/test-ui` — adversarial UI/UX bug-hunt gate on the current revision
  (hostile verification of your own changes — `.agents/skills/
  ui-adversarial-test/SKILL.md`)
- `/deep-audit` — full super-gate (all agents)
- `/animate` — design or revise a protection animation
- `/fix-animation` — diagnose and fix an animation issue
- `/sound` — design or revise a protection sound effect
- `/fix-sound` — diagnose and fix a sound issue
- `/build-module` — scaffold a new relay module (relay-module-builder)
- `/ux-review` — deep psychology-driven UX review (ui-ux-auditor, 7-pass)

## UI/UX audit severity mapping

The ui-ux-auditor now uses a 5-tier severity system:

| Severity | Definition | Action |
|---|---|---|
| **CRITICAL** | Breaks usability, accessibility, interaction, or layout | Must fix before merge |
| **HIGH** | Significant visual/UX defect or major inconsistency | Should fix before merge |
| **MEDIUM** | Noticeable quality or consistency issue | Should fix; may defer |
| **LOW** | Minor polish issue | Can defer to next cycle |
| **MICRO** | Small visual imperfection (1–4px drift) | Polish backlog |

**DEEP UI/UX AUDIT MODE:** When the user says "audit UI", "cek UI",
"review tampilan", "periksa desain", "rapikan UI", "cek frontend",
"cek halaman ini", "perbaiki tampilan", "audit design", or
"review UI/UX" — automatically trigger DEEP mode (7-pass loop, all
31 dimensions, all viewports, evidence-based reporting). Do NOT
interpret a short prompt as permission for a shallow review.

**DEEP ENGINE VALIDATION MODE:** When the user says "audit engine",
"cek engine", "validasi", "validate", "periksa rumus", "cek kalkulasi",
"audit math", "cek spec", or "engineering review" — automatically
trigger DEEP mode (7-pass loop, all 10 validation matrix rows,
evidence-based reporting, edge case verification). Do NOT interpret
a short prompt as permission for a shallow check.

**DEEP ARCHITECTURE AUDIT MODE:** When the user says "audit
architecture", "cek architecture", "cek module", "cek dependency",
"cek import", "audit struktur", "cek struktur", "periksa boundary",
or "cek coupling" — automatically trigger DEEP mode (7-pass loop,
all modules, all routes, evidence-based reporting). Do NOT interpret
a short prompt as permission for a shallow check.

**5-tier severity (all auditors):**
| Severity | Definition | Action |
|---|---|---|
| **CRITICAL** | Breaks usability/accessibility/spec/architecture | Must fix before merge |
| **HIGH** | Significant defect or major inconsistency | Should fix before merge |
| **MEDIUM** | Noticeable quality or consistency issue | Should fix; may defer |
| **LOW** | Minor polish issue | Can defer to next cycle |
| **MICRO** | Small imperfection (1–4px drift, naming) | Polish backlog |

## Adversarial UI/UX verification gate (mandatory)

Every UI/UX-producing agent MUST run the adversarial test schema on its
**own revision** before declaring PASS / fixed / done / "looks good":

`.agents/skills/ui-adversarial-test/SKILL.md`

This is a **hostile verification harness**, not a self-review. It assumes
the change is guilty and tries to break it. Core rules:

- **No "looks fine" without evidence.** Every PASS claim needs a measured
  value, DOM/CSS assertion, screenshot observation, named test, or command
  output. No evidence → claim dropped, gate FAILS.
- **Reproduce before reporting; re-break before trusting a fix.** A symptom
  mask (`overflow:hidden` over a real width bug) is `NOT-FIXED`.
- **Gates:** 0 anti-laziness · 1 fix verification · 2 domain torture
  (numeric/state/timeline/SVG/empty) · 3 a11y+interaction attack ·
  4 regression sweep (`tsc` + `vitest` + frozen check + blast radius) ·
  5 visual forensics (1–4px drift) · 6 responsive (**opt-in**, project is
  desktop-first).
- **Two-strike rule:** a second defect in the same gate after a fix means
  the root cause was wrong — stop patching symptoms.
- **If you cannot test it, you cannot PASS it** → verdict is `BLOCKED`.
- Severity inflation AND deflation are both failures. Never fix a FROZEN
  module to make a gate go green.

Agents that run this gate: `ui-ux-auditor` (fix mode), `relay-module-builder`,
`protection-animation-expert`, `protection-sound-expert`,
`performance-auditor`, `fullstack-release-auditor` (pre-release probe).
Trigger it with `/test-ui` or "test the fix", "yakin sudah bener",
"cari bug", "coba rusak", "pastikan tidak ada error".

## Animation rules (special)

Any animation work is automatically loaded with
`.github/instructions/animation.instructions.md` and the
`.agents/skills/protection-animation/SKILL.md` domain knowledge.
Animation must map to engineering events (no decorative motion),
use CSS keyframes / rAF / transition (no animation libraries),
and respect `prefers-reduced-motion`.

## Sound rules (special)

Any sound work is automatically loaded with
`.github/instructions/sound.instructions.md` and the
`.agents/skills/protection-sound/SKILL.md` domain knowledge.
Sound must map to engineering events (no ambiance), use Web Audio API
oscillators (no sound libraries, no external audio files), default to
muted, and never exceed –3 dBFS.

## Efficiency rules (tier system)

All audit agents use a **3-tier system** with early-exit to avoid
unnecessary work:

| Tier | Scope | Time | Early-exit rule |
|---|---|---|---|
| **T1** | Quick scan | 2 min | If clean → DONE. If blocked → report + stop. |
| **T2** | Full audit | 5-15 min | If 0 issues → DONE. If issues found → proceed T3. |
| **T3** | Deep + browser | 5-10 min | Final verdict. |

**Always start at T1.** Only escalate to T2/T3 if:
- T1 finds issues that need deeper investigation
- User explicitly requests "full audit" or "deep audit"
- T1 result is inconclusive

**Skip tiers if:** trivial fix → fix immediately, skip full audit.

## Skill usage guidance

Large skills (`.agents/skills/*/SKILL.md`) now include a "Usage guidance"
section at the top. **Always read it first** to determine which parts
of the skill are relevant for the current tier:
- **T1:** Read only the quick-lookup table (event → visual/sound mapping)
- **T2:** Read quick-lookup + implementation patterns
- **T3:** Read entire skill

Do NOT read a full skill unless the tier requires it.

## Context budget limits (token awareness)

Agents must stay token-efficient. Observe these limits:
- **Read at most 3-5 docs/specs** per audit (activeContext, design-guide,
  engineering-spec, PRD, etc.). Don't re-read files you've cached.
- **Read at most 5 source files** to verify findings. Use grep to scan more.
- **Launch at most 4-5 Explore subagents** in parallel per audit.
- **One skill read** per audit (only at T3, only if needed). A second
  skill read is allowed for `ui-adversarial-test`, but only in fix mode
  and only the gates being executed.
- **One vitest run** per audit (don't re-run without code changes).
- **One browser smoke** per audit (T2 or T3, not both unless necessary).

**Checkpoint pattern:** If an audit exceeds 15 minutes or >5 file edits,
write a checkpoint summary **before** continuing. This protects the user
from context loss if the session is interrupted.

**Checkpoint format:**
```
### Checkpoint @ <step>
- Tier reached: T1 | T2 | T3
- Findings so far: <count>
- Files read: <count>
- Next: <what to do next>
```

## Guardrails

- Do not modify a FROZEN module (Differential R10) without explicit approval.
- Do not add new dependencies without justification.
- Do not claim tests pass without running them.
- Do not invent engineering formulas — report gaps instead.
