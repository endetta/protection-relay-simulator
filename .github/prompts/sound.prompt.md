---
mode: agent
agent: protection-sound-expert
description: Design or revise a protection-relay sound effect
---

Use the protection-sound-expert agent to design or revise the requested
sound effect.

### Requirements
- Identify the engineering event BEFORE coding (pickup, trip, breaker
  open, fault, reset, alarm, etc.)
- Cite the spec reference (e.g., overcurrent-timeline-o07.md §3.2)
- Use Web Audio API oscillators ONLY — no sound libraries, no mp3 files
- Default state: MUTED. User must opt in via UI toggle
- Gain peak: –12 dBFS. Never above –3 dBFS
- Duration: 30 ms – 800 ms. Nothing >1 s
- Use the right waveform from the taxonomy
- If audio infrastructure doesn't exist, scaffold the SoundContext first
- Cancel oscillators on unmount
- Delegate UX review to ui-ux-auditor
- Delegate accuracy check to engineering-validator
- Live DOM smoke in browser (if dev server is up)
- Produce APPROVED / NEEDS-FIX / BLOCKED verdict
