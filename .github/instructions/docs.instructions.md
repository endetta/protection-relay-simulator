---
applyTo: "docs/**,*.md,README.md"
description: Documentation, PRDs, READMEs, changelogs
---

# Documentation instructions

## Authoritative documents (do not lightly rewrite)
- `docs/PRD.md`, `docs/PRD-overcurrent-relay.md`
- `docs/frontend-design-guide.md`, `docs/ui-design-tokens.md`
- `docs/engineering-specs/<relay>.md`
- `memory-bank/activeContext.md`, `memory-bank/progress.md`

## Engineering specs need a version bump
Any change to formulas, units, or decision logic in
`docs/engineering-specs/*.md` must bump the spec version and explain
the change in the changelog section.

## Memory Bank discipline
After a milestone, update `memory-bank/activeContext.md` and
`memory-bank/progress.md`. Do not dump long content into Memory Bank;
put detail under `docs/`.

## Anti-patterns (do NOT do these)
- ❌ Editing a FROZEN spec without version bump
- ❌ Putting long code blocks in `memory-bank/` (use `docs/`)
- ❌ Stating FROZEN status without user approval
- ❌ Inventing formulas or units (cite the spec section)
- ❌ Removing historical decisions from changelog
- ❌ Adding marketing language to a PRD ("revolutionary", "blazing fast")
- ❌ Changing a color outside the semantic palette
- ❌ Mixing PRD and engineering-spec content in one file
- ❌ Skipping a test reference in a spec change
- ❌ Leaving `TODO: <thing>` in a published spec
