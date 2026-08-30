---
name: protection-animation
description: Domain knowledge for protection-relay simulator animation.
Covers engineering-event-to-visual mapping, CSS animation patterns
currently used, timeline mapping, color semantics, accessibility,
and forbidden patterns. Use as a reference when designing or debugging
any animation in this simulator.
---

# Protection Relay Animation — Domain Knowledge

## Usage guidance (READ THIS FIRST)

**When to read this skill:**
- protection-animation-expert agent is active
- Designing a new animation
- Debugging an existing animation

**How to read efficiently:**
- **Quick lookup (event → visual):** Read only "Engineering event →
  visual mapping" table
- **New animation design:** Read "Engineering event mapping" +
  "Existing CSS keyframes" + "Tool selection"
- **Debug:** Read "Forbidden patterns" + "Accessibility" sections

**Do NOT read this skill for:**
- Static UI work
- Color or typography decisions (use other skills)

## Core principle

Animation in this project is **engineering causality**, not decoration.
Every motion must answer: "Which engineering event does this
represent?" If it doesn't represent one, remove it.

## Engineering event → visual mapping

| Engineering event | Visual representation | Duration | Tool |
|---|---|---|---|
| **Current flow** on SLD | Green dashed stroke moves along path | 1.05 s loop | CSS `@keyframes` stroke-dashoffset |
| **Pickup** (51) | Relay card border turns amber | 150 ms | CSS `transition` border-color |
| **Trip** (51 / 50) | Flash red on relay card + analysis | 1.4 s flash | CSS `@keyframes` opacity + box-shadow |
| **Breaker OPENING** | Blade stroke amber, device card red border | 150–300 ms | CSS `transition` stroke + border |
| **Breaker OPEN** | Blade stroke red, device card steady red | 150 ms | CSS `transition` |
| **Fault active** | Bolt fill red, dashed drop line red, active-fault ring pulses | 1.2 s | CSS `@keyframes` + `transition` |
| **Fault cleared** | Bolt dim, current path stops, breaker OPEN | 300 ms | CSS `transition` + `animation: none` |
| **Backup continuation** | Backup device card highlights amber | 150 ms | CSS `transition` |
| **TCC curve draw** | Curve path stroke-dasharray reveal on enter | 720 ms | CSS `@keyframes` cubic-bezier(0.32, 0.72, 0.24, 1) |
| **Operating point motion** | SVG circle/cx moves along curve | 320 ms | CSS `transition` on cx/cy cubic-bezier(0.4, 0, 0.2, 1) |
| **Crosshair pulse** | Circles scale pulse | 1.4 s loop | CSS `@keyframes` transform: scale() |
| **Corridor / CTI bracket** | Dashed amber stroke on TCC | — | No animation, static |
| **Operating sequence playback** | Progress bar advances, row states change per timeline | Step-by-step | `requestAnimationFrame` scrubber |
| **Route enter** | Panel slides up + fades in | 280 ms one-shot | CSS `@keyframes` cubic-bezier(.22,.8,.24,1) |
| **Control state change** | Border / background shifts | 120–220 ms | CSS `transition` ease |

## Existing CSS keyframes (do not duplicate)

Defined in `src/index.css`:
```
flowdash               — stroke-dashoffset loop for current flow
protection-home-enter  — homepage panel entrance
simulator-route-enter  — simulator route entrance
```

Defined in `src/components/overcurrent/radialProtectionDiagram.css`:
```
overcurrent-sld-flow   — SLD current-path dash movement
```

Defined in `src/components/overcurrent/timeCurrentCurve.css`:
```
tcc-crosshair-pulse    — crosshair circle scale pulse
tcc-curve-draw         — curve stroke-dasharray reveal
tcc-point-pulse        — operating-point symbol pulse
tcc-target-expand      — invisible target ring expand
tcc-trip-flash         — trip indicator flash
tcc-legend-glow        — legend accent glow
```

## Operating sequence timing (O07 spec)

The operating sequence scrubber is the most timing-sensitive animation.
It reads timeline events from `src/engines/overcurrentTimeline.ts` and
plays them using `requestAnimationFrame`:

1. **STEP lookup** is right-continuous at sample boundaries.
2. Progress bar width updates at 70 ms `transition`.
3. Each row (relay, breaker) has its own event: pickup → trip →
   breaker opening → fault isolated / backup continuation.
4. Speed factor (0.5×, 1×, 2×) is applied to engineering time, NOT to
   wall-clock time. The rAF loop advances `simTime += dt * speed`.
5. Reset restores all rows to pre-fault state.

## Color semantics (strict)

| Color | Use | Never |
|---|---|---|
| `var(--sim-green)` | RESTRAIN / NO TRIP / current flow / primary role | Decorative |
| `var(--sim-red)` | OPERATE / TRIP / fault / breaker OPEN | Hover states |
| `var(--sim-amber)` | PICKUP / WARNING / backup role / instantaneous | Accent |
| `var(--sim-accent)` | Focus, interactive selection, time indicator | State encoding |
| `var(--sim-text-muted)` | Inactive, off-scale | |

## Duration rules

- **Infinite loops** (flow, pulse): 700 ms – 1.8 s. Too fast = strobe;
  too slow = static.
- **State transitions** (border, background): 120 – 300 ms. Instant feels
  glitchy; >300 ms feels laggy.
- **Curve draw**: 600 – 900 ms. Must complete within one human breath.
- **Route enter**: 200 – 350 ms. Sub-200 ms is invisible; >400 ms is
  sluggish.
- **Operating sequence scrubber progress bar**: 70 ms linear transition.
  Must track the rAF tick exactly.

## Accessibility requirements

1. `@media (prefers-reduced-motion: reduce)` must kill all infinite
   animations and set transition duration to `0.01ms`.
   Pattern:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .overcurrent-sld *, .overcurrent-tcc *, .overcurrent-sequence * {
       animation-duration: .01ms !important;
       transition-duration: .01ms !important;
     }
   }
   ```
2. No animation must be the ONLY way to convey information. The state
   must also be readable as text (e.g., "TRIP" label alongside the flash).
3. No flashing faster than 3 Hz (WCAG 2.3.1). The trip flash at 1.4 s
   period (0.7 Hz) is safe.

## Forbidden patterns

- ❌ `framer-motion`, `react-spring`, `gsap`, `lottie`, `anime.js`
- ❌ `Math.random()` or `Date.now()` for visual animation
- ❌ `setTimeout` for continuous playback (use rAF)
- ❌ Uncontrolled infinite loops without reduced-motion opt-out
- ❌ Animation that requires a specific frame rate to look correct
- ❌ `will-change` without bounds (can leak GPU memory)
- ❌ Editing the FROZEN Differential R10 animations without reopen

## Common bugs and fixes

| Bug | Cause | Fix |
|---|---|---|
| Jittery point motion | `transition` on `cx` too fast (<70 ms) | Set 320 ms cubic-bezier(0.4, 0, 0.2, 1) |
| Memory leak on unmount | rAF not cancelled | `useEffect` cleanup calls `cancelAnimationFrame(ref.current)` |
| Strobe on flow animation | Stroke-dashoffset loop too fast | Set 1.05 s linear infinite |
| Flash too aggressive | Period < 400 ms | Use 1.2 – 1.6 s period |
| Animation ignores reduced-motion | Missing media query | Add the `prefers-reduced-motion` block |
| Breaker blade rotates wrong | SVG rotate center wrong | Set `transform-origin` to pivot point |

## Troubleshooting decision tree

When an animation misbehaves, walk this tree in order:

### Step 1: Is the animation even defined?
- Search for the keyframe name or `transition` rule
- Verify the CSS class is applied to the element
- Verify the element is in the DOM at the time of the animation
- If absent → add the keyframe/transition first

### Step 2: Is the trigger firing?
- For rAF: log inside the rAF callback to confirm it runs
- For CSS transition: confirm the state class actually changes
- For CSS keyframe: confirm `animation-name` and `animation-duration` are set
- If absent → fix the trigger logic, not the animation

### Step 3: Is the timing correct?
- Compare animation duration to spec (70 ms – 1.4 s)
- Compare rAF tick to spec timestamp
- If wrong → adjust duration, NOT the keyframe shape

### Step 4: Is it accessibility-safe?
- Check `prefers-reduced-motion: reduce` is honored
- Check the state is also conveyed as text (not just by motion)
- Check no flash >3 Hz

### Step 5: Is it the wrong animation for the event?
- Re-read the event-to-visual mapping table
- If using decorative motion for an engineering event → replace
- If using engineering motion for decoration → remove
