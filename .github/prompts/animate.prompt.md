---
mode: agent
agent: protection-animation-expert
description: Design or revise a protection-relay animation
---

Use the protection-animation-expert agent to design or revise the
requested animation.

### Requirements
- Identify the engineering event BEFORE coding (pickup, trip, breaker
  open, fault, reset, etc.)
- Cite the spec reference (e.g., overcurrent-timeline-o07.md §3.2)
- Use the right tool from the taxonomy: CSS keyframe for loops, rAF
  for time-critical, transition for state changes
- NO animation libraries (framer-motion, gsap, lottie, etc.)
- Duration must be 70 ms – 1.4 s
- Always add `prefers-reduced-motion` opt-out
- Cancel rAF on unmount
- Delegate visual review to ui-ux-auditor
- Delegate accuracy check to engineering-validator
- Live DOM smoke in browser (if dev server is up)
- Produce APPROVED / NEEDS-FIX / BLOCKED verdict
