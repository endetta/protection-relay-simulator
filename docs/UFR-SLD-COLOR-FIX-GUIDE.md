# UFR SLD Color Fix — Planning Guide

**Date:** 2026-09-01
**Branch:** `work/ufr-sld-color-fix`
**Reporter:** User (Sheva) — fatal visual bug in UFR SLD
**Severity:** Critical — renders in light-theme fallback on dark-mode workspace

---

## 1. Problem Statement

The Underfrequency (UFR) Single-Line Diagram (SLD) panel renders with
**light-theme hex fallbacks** on the project's default dark workspace,
creating a jarring visual contrast against every other panel.

The root cause: `src/components/underfrequency/underfrequencySld.css`
uses **three non-existent CSS custom properties** plus hardcoded light-theme
hex values, while every sibling CSS file in the project correctly uses
valid `var(--sim-*)` tokens.

---

## 2. Audit Findings

### 2.1 Non-existent tokens in `underfrequencySld.css`

| Line | Property | Token Used | Fallback (Browser Default) | Problem |
|------|----------|-----------|---------------------------|---------|
| 6 | `background` | `--sim-surface` | `#fff` | Non-existent token → fallback is pure white |
| 19 | `fill` | `--sim-surface-subtle` | `#f8fafc` | Non-existent token → fallback is light gray |
| 25 | `fill` | `--sim-muted` | `#f1f5f9` | Non-existent token → fallback is light gray |

**Confirmed:** These three tokens are NOT defined in `src/index.css`
(neither dark nor light sections). They appear only in this one file.

### 2.2 Hardcoded light-theme hex throughout

All `fill`, `stroke`, and `color` values in the SVG SLD are hardcoded
Tailwind slate/blue hex — not tokenized:

| Element | Current Hex | Role | Should Be Token |
|---------|------------|------|-----------------|
| Generator symbol fill | `#e0f2fe` | Accent background | `var(--sim-accent-bg)` |
| Generator symbol stroke | `#0284c7` | Accent | `var(--sim-accent)` |
| Generator symbol text | `#0c4a6e` | Text on accent | `var(--sim-text)` |
| Generator frame | `#f8fafc` | Panel surface | `var(--sim-panel-raised)` |
| Gen frame border | `#e5e7eb` | Border | `var(--sim-border)` |
| Busbar success | `#0f766e` | Green (success) | `var(--sim-green)` |
| Busbar warning | `#b45309` | Amber (warning) | `var(--sim-amber)` |
| Busbar danger | `#991b1b` | Red (danger) | `var(--sim-red)` |
| Busbar text | `#0f172a` | Primary text | `var(--sim-text)` |
| Tie line | `#cbd5e1` | Border-strong | `var(--sim-border-strong)` |
| Generator MW text | `#334155` | Text | `var(--sim-text)` |
| Generator RPM text | `#64748b` | Text-muted | `var(--sim-text-muted)` |
| Status chip online | `#16a34a` | Green | `var(--sim-green)` |
| Status chip limit | `#d97706` | Amber | `var(--sim-amber)` |
| Status chip tripped | `#dc2626` | Red | `var(--sim-red)` |
| Load block fill | `#f8fafc` | Panel raised | `var(--sim-panel-raised)` |
| Load block stroke | `#94a3b8` | Border-strong | `var(--sim-border-strong)` |
| Load block label | `#334155` | Text | `var(--sim-text)` |
| Load block MW | `#64748b` | Text-muted | `var(--sim-text-muted)` |
| SHED chip | `#dc2626` | Red | `var(--sim-red)` |
| Breaker terminal | `#475569` | Text-dim | `var(--sim-text-dim)` |
| Breaker blade | `#0f172a` | Text | `var(--sim-text)` |
| Feeder line | `#64748b` | Text-muted | `var(--sim-text-muted)` |
| COLLAPSE text | `#dc2626` | Red | `var(--sim-red)` |
| Bus bar default | `#1e293b` | Border-strong | `var(--sim-border-strong)` |

### 2.3 Sibling files — all clean

| File | Status | Token Approach |
|------|--------|---------------|
| `generatorDiagram.css` | ✅ Clean | All `var(--sim-*)`, no fallbacks |
| `sheddingChart.css` | ✅ Clean | All `var(--sim-*)`, no fallbacks |
| `frequencyTimelineChart.css` | ✅ Clean | All `var(--sim-*)`, no fallbacks |
| `underfrequencyAnalysisPanel.css` | ✅ Clean | All `var(--sim-*)`, no fallbacks |
| `underfrequencySld.css` | ❌ **BROKEN** | Non-existent tokens + hardcoded hex |

### 2.4 Text legibility floor

Several UFR SLD text elements use font sizes below the project's
legibility floor (`--sim-text-label: 12px`, `--sim-text-value: 14px`):

| Element | Current Size | Floor | Action |
|---------|-------------|-------|--------|
| Generator ID text | 9px | 12px | Bump to 12px |
| Generator MW | 8.5px | 14px | Bump to 12px |
| Generator RPM | 7.5px | 12px | Bump to 10px (SVG space constraint) |
| Status chip | 7px | 12px | Bump to 10px (SVG space constraint) |
| Load block MW | 7.5px | 12px | Bump to 10px |
| SHED chip | 7px | 12px | Bump to 10px |
| Bus sub-text | 9px | 12px | Bump to 11px |
| COLLAPSE | 10px | 12px | Bump to 12px |
| UNSERVED | 8px | 12px | Bump to 10px |
| Load block critical star | 10px | 12px | Keep 10px (decorative, not primary) |

### 2.5 Semantic color contract

The SLD already has both color AND text/icon indicators:
- Status chips: "ONLINE" / "AT LIMIT" / "TRIPPED" + color ✅
- Load blocks: "SHED" label + red tint ✅
- COLLAPSE: text label + red font ✅
- Busbar: frequency readout + color tone ✅

**Verdict:** Status is NOT color-only. WCAG requirement met.

---

## 3. Design Decisions

### D1 — Theme mode: dark-first only

**Decision:** UFR SLD will use dark-first tokens exclusively. No light-mode
fallbacks. No `.simulator-theme-light` override (that's for Differential only).

**Rationale:** UFR module is designed as dark-first. The project's `:root`
sets `color-scheme: dark`. Only Differential uses `.simulator-theme-light`.
Light-mode fallbacks in dark context cause the exact bug being fixed.

**Impact:** In dark mode (the only mode UFR supports), the SLD will render
correctly. If light mode is ever added to UFR, it will need explicit
`.simulator-theme-light` overrides — same pattern as Differential.

### D2 — Token selection: follow sibling convention

**Decision:** Use the same token pattern as `generatorDiagram.css` and
`sheddingChart.css`: `var(--sim-*)` without fallbacks.

**Rationale:** Sibling files already prove this pattern works. No fallback
means the browser uses the token value directly — if the token is missing,
the element is transparent/unstyled, which is easier to debug than a
light-mode color on a dark workspace.

### D3 — SVG text legibility: conditional bump

**Decision:** Bump text sizes where the SVG viewBox allows, but keep
7-8px text for genuinely space-constrained elements (generator RPM,
status chips, unserved MW). Document the exception.

**Rationale:** The SVG is 560×320 fixed viewBox. Generator bays are
104×96px. Bumping ALL text to 12px would overflow the generator frame.
The 7-8px text in the SLD serves as secondary/tertiary labels (RPM,
chip text) — engineering users can read these at desktop zoom. The
primary labels (generator ID, MW, block ID, block MW) should be
at or near 12px.

**Exception list (below floor, kept small):**
- Generator RPM (7.5px → keep as-is, tertiary info)
- Status chip (7px → keep as-is, color + text provides meaning)
- SHED chip (7px → keep as-is, color + text provides meaning)
- Critical star ★ (10px → decorative, keep)
- UNSERVED text (8px → bump to 10px)

### D4 — Regresion prevention: CSS token-existence test

**Decision:** Add a test in `src/components/underfrequency/` that verifies
every `var(--sim-*)` token used in UFR SLD CSS actually exists in
`src/index.css`.

**Rationale:** This catches the exact bug pattern: someone writes
`var(--sim-surface)` which doesn't exist, and the fallback hides the
problem until someone looks at it in the right theme.

---

## 4. Implementation Steps

### Step 1: Rebuild `underfrequencySld.css` (D1, D2)

**File:** `src/components/underfrequency/underfrequencySld.css`

Replace every non-existent token and hardcoded hex with valid `--sim-*`
tokens. Full mapping:

```css
/* Container */
.underfrequency-sld {
  border: 1px solid var(--sim-border);          /* was var(--sim-border, #e5e7eb) */
  border-radius: 12px;
  background: var(--sim-panel);                  /* was var(--sim-surface, #fff) */
  padding: 12px 10px 8px;
}

/* Generator frame */
.underfrequency-sld-gen-frame {
  fill: var(--sim-panel-raised);                 /* was var(--sim-surface-subtle, #f8fafc) */
  stroke: var(--sim-border);                     /* was var(--sim-border, #e5e7eb) */
  stroke-width: 1.2;
}

.underfrequency-sld-gen[data-status="tripped"] .underfrequency-sld-gen-frame {
  fill: var(--sim-panel);                        /* was var(--sim-muted, #f1f5f9) */
  opacity: 0.6;
}

.underfrequency-sld-gen[data-status="limit"] .underfrequency-sld-gen-frame {
  fill: var(--sim-amber-bg);                     /* was #fffbeb */
  stroke: var(--sim-amber);                      /* was #f59e0b */
}

/* Generator symbol */
.underfrequency-sld-gen-symbol {
  fill: var(--sim-accent-bg);                    /* was #e0f2fe */
  stroke: var(--sim-accent);                     /* was #0284c7 */
  stroke-width: 1.3;
}

.underfrequency-sld-gen[data-status="tripped"] .underfrequency-sld-gen-symbol {
  fill: var(--sim-panel-raised);                 /* was #e2e8f0 */
  stroke: var(--sim-border-strong);              /* was #64748b */
}

.underfrequency-sld-gen-symbol-g {
  font-size: 12px;                               /* was 9px (D3: bumped) */
  font-weight: 800;
  fill: var(--sim-text);                         /* was #0c4a6e */
  letter-spacing: 0.02em;
}

.underfrequency-sld-gen[data-status="tripped"] .underfrequency-sld-gen-symbol-g {
  fill: var(--sim-text-muted);                   /* was #475569 */
}

/* Progress bars */
.underfrequency-sld-gen-track {
  fill: var(--sim-border);                       /* was #e5e7eb */
}

.underfrequency-sld-gen-fill {
  transform-origin: left center;
  transform: scaleX(var(--fill, 0));
  fill: var(--sim-accent);                       /* was #2563eb */
  transition: transform 180ms ease-out;
}

.underfrequency-sld-gen-resp {
  transform-origin: left center;
  transform: scaleX(var(--fill, 0));
  fill: var(--sim-accent-soft);                  /* was #0ea5e9 */
  transition: transform 180ms ease-out;
}

.underfrequency-sld-gen[data-status="limit"] .underfrequency-sld-gen-resp {
  fill: var(--sim-amber);                        /* was #f59e0b */
}

.underfrequency-sld-gen-mw {
  font-size: 12px;                               /* was 8.5px (D3: bumped) */
  font-weight: 700;
  fill: var(--sim-text);                         /* was #334155 */
}

.underfrequency-sld-gen-rpm {
  font-size: 7.5px;                              /* D3: keep — space-constrained */
  fill: var(--sim-text-muted);                   /* was #64748b */
}

/* Status chips */
.underfrequency-sld-gen-chip {
  font-size: 7px;                                /* D3: keep — color + text */
  font-weight: 800;
  letter-spacing: 0.06em;
}

.underfrequency-sld-gen-chip[data-status="online"] { fill: var(--sim-green); }
.underfrequency-sld-gen-chip[data-status="limit"] { fill: var(--sim-amber); }
.underfrequency-sld-gen-chip[data-status="tripped"] { fill: var(--sim-red); }

/* Tie lines */
.underfrequency-sld-tie {
  stroke: var(--sim-border-strong);              /* was #cbd5e1 */
  stroke-width: 1.2;
}

.underfrequency-sld-gen[data-status="tripped"] .underfrequency-sld-tie {
  stroke: var(--sim-border);                     /* was #94a3b8 */
  stroke-dasharray: 3 3;
}

/* Bus bar */
.underfrequency-sld-bus-bar {
  fill: var(--sim-border-strong);                /* was #1e293b */
}

.underfrequency-sld-bus[data-tone="success"] .underfrequency-sld-bus-bar { fill: var(--sim-green); }
.underfrequency-sld-bus[data-tone="warning"] .underfrequency-sld-bus-bar { fill: var(--sim-amber); }
.underfrequency-sld-bus[data-tone="danger"] .underfrequency-sld-bus-bar { fill: var(--sim-red); }

.underfrequency-sld-bus-freq {
  font-size: 18px;
  font-weight: 800;
  fill: var(--sim-text);                         /* was #0f172a */
}

.underfrequency-sld-bus[data-tone="danger"] .underfrequency-sld-bus-freq { fill: var(--sim-red-text); }
.underfrequency-sld-bus[data-tone="warning"] .underfrequency-sld-bus-freq { fill: var(--sim-amber-text); }

.underfrequency-sld-bus-sub {
  font-size: 10px;                               /* was 9px (D3: bumped) */
  fill: var(--sim-text-muted);                   /* was #475569 */
}

.underfrequency-sld-bus-collapse {
  font-size: 12px;                               /* was 10px (D3: bumped) */
  font-weight: 900;
  fill: var(--sim-red);                          /* was #dc2626 */
  letter-spacing: 0.14em;
}

/* Feeders + breaker */
.underfrequency-sld-feeder {
  stroke: var(--sim-text-muted);                 /* was #64748b */
  stroke-width: 1.2;
}

.underfrequency-sld-breaker-terminal { fill: var(--sim-text-dim); }

.underfrequency-sld-breaker-blade {
  stroke: var(--sim-text);                       /* was #0f172a */
  stroke-width: 2;
  stroke-linecap: round;
  transform-origin: left center;
  transition: transform 180ms ease-out, stroke 180ms ease-out;
}

.underfrequency-sld-breaker[data-open="true"] .underfrequency-sld-breaker-blade {
  transform: rotate(-42deg);
  stroke: var(--sim-red);                        /* was #dc2626 */
}

/* Load blocks */
.underfrequency-sld-block-frame {
  fill: var(--sim-panel-raised);                 /* was #f8fafc */
  stroke: var(--sim-border-strong);              /* was #94a3b8 */
  stroke-width: 1.2;
}

.underfrequency-sld-block[data-status="SHED"] .underfrequency-sld-block-frame {
  fill: var(--sim-red-bg);                       /* was #fef2f2 */
  stroke: var(--sim-red);                        /* was #fca5a5 */
  opacity: 0.72;
}

.underfrequency-sld-block[data-critical] .underfrequency-sld-block-frame {
  stroke: var(--sim-border-strong);              /* was #64748b */
}

.underfrequency-sld-block-id {
  font-size: 13px;
  font-weight: 800;
  fill: var(--sim-text);                         /* was #334155 */
}

.underfrequency-sld-block-critical {
  font-size: 10px;
  fill: var(--sim-accent);                       /* was #0ea5e9 */
}

.underfrequency-sld-block[data-status="SHED"] .underfrequency-sld-block-id {
  fill: var(--sim-red-text);                     /* was #7f1d1d */
}

.underfrequency-sld-block-mw {
  font-size: 7.5px;                              /* D3: keep — space-constrained */
  fill: var(--sim-text-muted);                   /* was #64748b */
}

.underfrequency-sld-block-shedchip {
  font-size: 7px;                                /* D3: keep — color + text */
  font-weight: 800;
  fill: var(--sim-red);                          /* was #dc2626 */
  letter-spacing: 0.06em;
}

.underfrequency-sld-unserved {
  font-size: 10px;                               /* was 8px (D3: bumped) */
  font-weight: 700;
  fill: var(--sim-red);                          /* was #b91c1c */
}
```

**Key changes:**
1. Removed all non-existent tokens (`--sim-surface`, `--sim-surface-subtle`, `--sim-muted`)
2. Replaced hardcoded hex with semantic tokens
3. Bumped text sizes where SVG space allows (D3)
4. Removed all light-mode fallbacks (D1)

### Step 2: Update `UnderfrequencySld.tsx` viewBox if needed

After bumping font sizes, the SVG may need a viewBox adjustment if text
overflows. Check the generator bay layout:

- `GEN_W = 104`, `GEN_H = 96`
- Generator ID text was 9px, now 12px — may need more vertical space
- Generator MW text was 8.5px, now 12px — may need more vertical space

If overflow occurs, increase `GEN_H` from 96 to ~110 and adjust `BUS_Y`,
`FEEDER_Y` accordingly. This is a layout-only change, no math.

### Step 3: Write CSS token-existence test (D4)

**File:** `src/components/underfrequency/underfrequencySld.css.test.ts` (new)

This test reads the CSS file, extracts all `var(--sim-*)` references,
and verifies each exists in `src/index.css`. Prevents future regressions.

### Step 4: Run full test suite + build

```bash
npm test              # expect 43+ files, 366+ tests
npm run build         # tsc strict + vite build
```

### Step 5: Adversarial UI gate

```bash
# .agents/skills/ui-adversarial-test/SKILL.md
/test-ui
```

Must run against own revision before declaring PASS.

### Step 6: Commit + push + PR

```bash
git add src/components/underfrequency/underfrequencySld.css
git add src/components/underfrequency/underfrequencySld.css.test.ts
git commit -m "style(ufr-sld): align SLD with --sim-* dark token system, remove light fallbacks

- Replace non-existent tokens (--sim-surface, --sim-surface-subtle, --sim-muted)
  with valid --sim-* tokens from src/index.css
- Remove all hardcoded hex literals, use semantic token references
- Bump text sizes where SVG space allows (generator ID: 9→12px, MW: 8.5→12px)
- Keep 7-8px for space-constrained secondary labels (RPM, chips)
- Add CSS token-existence test to prevent regression
- Fixes fatal light-theme-on-dark contrast regression from post-99e6cc2 revert

Co-Authored-By: Claude Code <noreply@anthropic.com>"

git push -u origin work/ufr-sld-color-fix
gh pr create --base main
```

---

## 5. Verification Checklist

| # | Check | Gate |
|---|-------|------|
| 1 | Non-existent tokens removed | grep `--sim-surface` returns 0 matches in UFR |
| 2 | All fill/stroke/color use `var(--sim-*)` | Manual inspection |
| 3 | Dark mode renders correctly | `npm run dev` → `/simulator/underfrequency` |
| 4 | Generator bays don't overflow after font bump | Visual check at 560px SVG width |
| 5 | Status chips still readable (color + text) | Visual check |
| 6 | Busbar tones: green (success), amber (warning), red (danger) | Visual check |
| 7 | SHED blocks: red tint + "SHED" label | Visual check |
| 8 | COLLAPSE state: red text + red busbar | Visual check |
| 9 | `npm test` passes | Automated |
| 10 | `npm run build` passes (tsc strict) | Automated |
| 11 | `/test-ui` adversarial gate | Gate |
| 12 | No other UFR CSS files affected | grep confirms isolation |

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Font size bump causes SVG overflow | Low | Medium | Check generator bay layout; increase GEN_H if needed |
| Token value doesn't match visual intent | Low | Medium | Compare dark-mode rendered output vs PR #9 reference |
| Light-mode regression | None | N/A | UFR doesn't use light mode; no fallbacks to break |
| Other CSS files affected | None | N/A | Audit confirms isolation to SLD only |
