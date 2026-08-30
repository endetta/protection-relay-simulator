---
mode: agent
agent: protection-animation-expert
description: Diagnose and fix an existing animation issue
---

Use the protection-animation-expert agent to diagnose and fix the
animation issue. The agent will:
1. Identify the engineering event the animation represents
2. Inspect existing CSS keyframes / rAF loops / transitions
3. Check the troubleshooting decision tree in the skill:
   - Is the animation defined? → check keyframe/class
   - Is the trigger firing? → log the callback
   - Is the timing correct? → compare to spec
   - Is it accessibility-safe? → reduced-motion + text state
4. Apply the right tool from the taxonomy (CSS keyframe vs rAF vs transition)
5. Honor prefers-reduced-motion
6. Delegate visual review to ui-ux-auditor
7. Delegate accuracy check to engineering-validator
8. Produce APPROVED / NEEDS-FIX / BLOCKED verdict
