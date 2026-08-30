---
name: senior-ui-ux-reviewer
description: Psychology-driven UI/UX review framework for senior
designers. Covers visual perception, eye-tracking, cognitive load,
Gestalt principles, color psychology, subconscious trust, and
engineering-UX-specific heuristics. Use as a reference when auditing
any UI for deep usability and subconscious user response.
---

# Senior UI/UX Reviewer — Psychology-Driven Framework

## Usage guidance (READ THIS FIRST)

**When to read this skill:**
- User explicitly requests "/ux-review" or "deep UX audit"
- You need psychology-driven heuristics beyond surface checks
- ui-ux-auditor T3 (deep tier) is active

**How to read efficiently:**
- **T1 (quick):** Read only "Layer 1 — Surface" + "Quick audit checklist"
- **T2 (full):** Read "Layer 1" + first 3 items of "Layer 2" (7-9)
- **T3 (deep):** Read entire skill

**Do NOT read this skill for:**
- Simple component edits
- Typography-only questions
- Color token lookups (use `ui-design-tokens.md` instead)

## Core principle

Great UI/UX is not just "looks good" — it's **how the human brain
processes the interface in the first 500 ms**. A senior designer
thinks in terms of:

- Where does the eye land first?
- What does the brain assume before reading?
- What cognitive load is imposed?
- What subconscious feeling does the user get?

This skill gives you the mental models to audit at that level.

## Layer 1 — Surface (rules-based)

These are the checklists. They catch 80% of issues.

### 1. Product identity
Does it feel like:
- Engineering software ✓
- Protection laboratory instrumentation ✓
- A professional technical workstation ✓

Flag if it drifts toward:
- SaaS landing page ✗
- Generic dashboard ✗
- AI aesthetic ✗
- Gaming/cyberpunk ✗
- Decorative marketing UI ✗

### 2. Information hierarchy
Can the user find in <3 seconds:
- Relay identity (e.g., "51/50 Overcurrent")
- Current relay state (e.g., "OPERATE / TRIP")
- Primary engineering visualization (TCC curve, SLD, characteristic)
- Editable parameters

### 3. Engineering-data prominence
- Numbers are large, units are clear, not buried in prose
- Critical values (trip current, time dial) are the largest text
- Non-critical values (labels, metadata) are smaller but readable

### 4. Responsive
- Desktop: three-zone layout preserved
- Mobile 414 px: no overflow, no clipping, no horizontal scroll
- Touch targets ≥ 44 px

### 5. Accessibility
- Keyboard reachable, visible focus ring
- ARIA labels where needed
- `prefers-reduced-motion` honored
- WCAG AA contrast on dark surface

### 6. Consistency
- Follows `docs/ui-design-tokens.md` exactly
- No one-off colors, fonts, or spacing
- Component patterns reused, not reinvented

## Layer 2 — Perception (psychology-based)

These are the mental models. They catch the 20% that surface checks miss.

### 7. Visual scanability (eye-tracking)

**The F-pattern and Z-pattern:**
- Western readers scan in an F (top-left → right → down → left → right)
  or Z (top-left → top-right → bottom-left → bottom-right).
- The **primary engineering visualization** MUST be in the first
  1–2 fixations (0–800 ms).
- If the eye lands on a label or control first, the viz is buried.

**Audit technique:**
1. Take a screenshot of the page.
2. Mentally trace: where does the eye land at 0 ms, 300 ms, 800 ms?
3. The primary viz should be in fixation 1 or 2.
4. If not → flag as [P0].

**Common failure:**
- Too many competing focal points (multiple bright colors, multiple
  large elements) → the eye doesn't know where to go.
- Fix: make the primary viz the single brightest / largest element.

### 8. Gestalt closure (grouping)

**The 6 Gestalt principles:**

| Principle | What it means | Audit check |
|---|---|---|
| **Proximity** | Things close together are related | Are related controls grouped? |
| **Similarity** | Things that look alike are related | Do same-colored items mean the same? |
| **Closure** | Brain fills in missing parts | Are groups perceived as units? |
| **Continuity** | Eye follows lines | Does the eye flow naturally? |
| **Figure-ground** | Object vs background | Does the viz "pop"? |
| **Common fate** | Moving together = related | Do related items animate together? |

**Audit technique:**
- Squint at the screenshot. What shapes emerge?
- If you see scattered fragments → proximity/similarity failure.
- If the primary viz blends with background → figure-ground failure.

### 9. Figure-ground separation

**The primary visualization must "pop".**
- It must have higher contrast against the background than any other
  element.
- It must be the largest single visual mass.
- It must not compete with chrome (borders, labels, controls).

**Audit technique:**
- Desaturate the screenshot to grayscale.
- The primary viz should still be the brightest/darkest element.
- If chrome is brighter → flag as [P1].

### 10. Cognitive load (Hick's law, Miller's 7±2)

**Hick's Law:** Decision time = log₂(n) × processing time per option.
- Every toggle, dropdown, or checkbox adds cognitive load.
- If the user must make >3 decisions simultaneously → overload.

**Miller's 7±2:** Working memory holds 7±2 items.
- If the user must hold >7 pieces of information → overload.

**Audit technique:**
- Count the number of interactive elements visible at once.
- Count the number of distinct values the user must track.
- If >7 → flag as [P1].

**Common failure:**
- Parameter panel with 12+ fields all visible → split into tabs or
  collapsible groups.

### 11. Color psychology (engineering context)

| Color | Psychological effect | Engineering meaning |
|---|---|---|
| **Red** | Urgency, stop, danger | TRIP, fault, breaker OPEN |
| **Green** | Safety, go, calm | RESTRAIN, no-trip, current flow |
| **Amber** | Caution, attention | PICKUP, backup, warning |
| **Blue (accent)** | Trust, focus, calm | Interaction, focus, time |
| **Gray (muted)** | Neutral, inactive | Disabled, background |

**Audit technique:**
- Red must NEVER be used for non-critical states.
- Green must NEVER signal danger.
- Blue must NEVER encode engineering state (only interaction).
- If a color is used outside its semantic role → flag as [P1].

### 12. Subconscious trust (first 1 second)

**What the brain decides in 1 second:**
- Is this professional? (typography, alignment, spacing)
- Is this reliable? (consistency, no jitter, no broken layout)
- Is this for me? (clarity of purpose, no marketing fluff)

**Audit technique:**
- Show the screenshot to someone for 1 second, then ask:
  "What is this for?"
- If they can't answer "protection relay simulator" → identity failure.
- If they say "looks like a dashboard" → identity failure.

**Trust signals:**
- Consistent baseline grid (all text baselines aligned)
- Consistent corner radius (4 px everywhere)
- Consistent shadow depth (one shadow style)
- Consistent spacing rhythm (8 px / 12 px / 16 px multiples)
- No decorative elements (no gradients, no shadows for decoration)

## Engineering-UX-specific heuristics

### 13. Data-ink ratio (Tufte)
- Every pixel must serve engineering data.
- Remove: decorative borders, unnecessary gradients, ornamental icons.
- If a pixel doesn't encode data or aid interaction → remove it.

### 14. Progressive disclosure
- Show the primary viz + state immediately.
- Hide secondary controls behind a toggle or tab.
- Never show all parameters at once if >7 are visible.

### 15. Direct manipulation
- When the user changes a parameter, the viz must update
  **immediately** (no "calculate" button).
- The cause-effect must be visible in <100 ms.

### 16. Error prevention (Norman)
- Make wrong actions hard.
- Make right actions easy.
- If a parameter is invalid, show it **before** the user tries to
  apply it (inline validation).

## Audit scoring rubric

| Score | Meaning |
|---|---|
| 2/2 | Excellent — exceeds the principle |
| 1/2 | Needs improvement — minor issue |
| 0/2 | Poor — significant issue, flag as P1 or P0 |

## Common senior-designer observations

### "The viz is fighting the chrome"
Symptom: The primary visualization doesn't stand out.
Fix: Increase contrast between viz and background. Reduce chrome
opacity. Make viz the brightest element.

### "Too many cooks in the kitchen"
Symptom: Multiple competing focal points.
Fix: Pick ONE primary focal point. Dim everything else.

### "The brain has to work too hard"
Symptom: User must remember too many things simultaneously.
Fix: Progressive disclosure. Show less, reveal more on demand.

### "It feels like a dashboard, not a tool"
Symptom: Decorative elements, marketing language, SaaS aesthetics.
Fix: Remove decoration. Use technical language. Align to grid.

### "I don't know where to look"
Symptom: No clear visual hierarchy.
Fix: Size + color + position. The most important thing is the largest,
brightest, and in the top-left.

## Quick audit checklist (print this)

- [ ] Primary viz in first 1-2 fixations
- [ ] No competing focal points
- [ ] Figure-ground: viz pops in grayscale
- [ ] ≤7 interactive elements visible
- [ ] ≤7 values to track simultaneously
- [ ] Colors match semantic meaning
- [ ] No decorative elements
- [ ] Consistent baseline grid
- [ ] Consistent corner radius
- [ ] Consistent shadow depth
- [ ] Consistent spacing rhythm
- [ ] Cause-effect visible in <100 ms
- [ ] Inline validation before apply
- [ ] No "calculate" button for parameter changes
- [ ] First 1-second test: "What is this for?" → correct answer
