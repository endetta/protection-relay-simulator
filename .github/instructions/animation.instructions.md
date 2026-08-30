---
applyTo: "src/components/**/*[Cc]haracteristicCurve*,src/components/**/*[Oo]peratingSequence*,src/components/**/*[Rr]adialProtection*,src/components/**/*[Tt]imeCurrentCurve*,src/index.css,src/components/overcurrent/*.css,src/components/**/*Diagram*.tsx,src/components/**/*Curve*.tsx"
description: Animation code for protection relay simulator visualizations
---

# Animation instructions (active for animation files)

## Read first
- `.agents/skills/protection-animation/SKILL.md` — domain knowledge
- `docs/engineering-specs/overcurrent-timeline-o07.md` — timeline events
- `memory-bank/activeContext.md` — UI language lock

## Stack is locked
- CSS `@keyframes` for repeating motion (flow, pulse, flash, curve draw)
- `requestAnimationFrame` + React `useRef` for time-critical playback
- CSS `transition` for state changes (border, background, transform)
- NO animation libraries (framer-motion, react-spring, gsap, lottie, anime.js)

## Rules
1. Every animation must map to an engineering event (pickup, trip,
   breaker open, fault, reset, etc.).
2. All durations must be in the 70 ms – 1.4 s range.
3. Always add `prefers-reduced-motion` opt-out.
4. Cancel rAF on unmount.
5. Use only semantic colors: green = restraint/no-trip, red = trip/fault,
   amber = pickup/backup, accent = focus only.
6. Do NOT touch FROZEN Differential R10 animations without reopen.

## Anti-patterns (do NOT do these)
- ❌ `import { motion } from 'framer-motion'` (no animation libs)
- ❌ `import { useSpring } from 'react-spring'` (no spring libs)
- ❌ `import { gsap } from 'gsap'` (no GSAP)
- ❌ `Math.random()` for visual (use fixed values for spec moments)
- ❌ `Date.now()` for rAF timing (use `performance.now()` or rAF delta)
- ❌ `setTimeout` for continuous playback (use rAF)
- ❌ `setInterval` for animation (use rAF or CSS keyframes)
- ❌ Animation that conveys info without text fallback
- ❌ Animation faster than 3 Hz (WCAG 2.3.1)
- ❌ `will-change` without bounds (GPU memory leak)
- ❌ Editing a FROZEN module's animation without reopen
- ❌ A 5th color outside the semantic palette for state
