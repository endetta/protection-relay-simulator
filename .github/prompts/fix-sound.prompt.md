---
mode: agent
agent: protection-sound-expert
description: Diagnose and fix an existing sound issue
---

Use the protection-sound-expert agent to diagnose and fix the sound
issue. The agent will:
1. Identify the engineering event the sound represents
2. Inspect existing Web Audio API code (AudioContext, oscillators, gain)
3. Check the troubleshooting decision tree in the skill:
   - Is AudioContext created? → check autoplay policy
   - Is sound muted? → check SoundContext.muted + localStorage
   - Is gain correct? → –12 dBFS default
   - Is the right event firing? → check trigger predicate
   - Is the waveform right? → sine/square/triangle/noise per event
4. Apply the right waveform from the taxonomy
5. Honor default-muted + gain calibration
6. Delegate UX review to ui-ux-auditor
7. Delegate accuracy check to engineering-validator
8. Produce APPROVED / NEEDS-FIX / BLOCKED verdict
