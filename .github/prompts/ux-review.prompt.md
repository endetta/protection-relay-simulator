---
mode: agent
agent: ui-ux-auditor
description: Deep psychology-driven UX review of the current UI
---

Run a **deep** UI/UX review using the ui-ux-auditor agent. This goes
beyond surface checks into psychology-driven perception analysis.

### Requirements
- Read `.agents/skills/senior-ui-ux-reviewer/SKILL.md` first
- Score all 12 dimensions (6 surface + 6 perception)
- Trace the eye path: where does the eye land at 0ms / 300ms / 800ms?
- Check Gestalt grouping: do related items read as units?
- Check figure-ground: does the primary viz pop in grayscale?
- Check cognitive load: ≤7 interactive elements, ≤7 values to track
- Check color psychology: does the palette evoke the right response?
- Check subconscious trust: typography rhythm, alignment grid, breathing room
- Run live DOM smoke at desktop + 414px (if dev server is up)
- Every finding must cite which dimension it affects
- Produce [P0/P1/P2] report with PASS / NEEDS-FIX / BLOCKED verdict
