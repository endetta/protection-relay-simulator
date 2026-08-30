---
applyTo: "src/utils/sound*,src/hooks/useSound*,src/state/soundContext*,src/components/**/[Ss]ound*,src/components/**/*[Tt]oggle*udio*,src/components/**/[Mm]ute*,src/components/**/*Volume*"
description: Sound effect code for protection relay simulator events
---

# Sound instructions (active for sound files)

## Read first
- `.agents/skills/protection-sound/SKILL.md` — domain knowledge
- `docs/engineering-specs/overcurrent-timeline-o07.md` — timeline events
- `memory-bank/activeContext.md` — UI language lock

## Stack is locked
- **Web Audio API** (AudioContext + Oscillator + Gain)
- NO external sound files (no `.mp3`, no `.wav`)
- NO sound libraries (no howler.js, no tone.js, no pixi-sound)
- Optional `<audio>` tag ONLY for sub-50 kB pre-recorded samples
  (with explicit user approval)

## Rules
1. Every sound must map to an engineering event (pickup, trip, breaker
   open, fault, reset, etc.).
2. All durations must be in 30 ms – 800 ms.
3. Default gain peak: –12 dBFS (~0.25 linear). Never above –3 dBFS.
4. Default state: MUTED. User must opt in via UI control.
5. Use the right waveform from the skill palette (sine/square/
   triangle/noise) per event.
6. Stop all oscillators on unmount.
7. Do NOT touch FROZEN Differential R10 sounds without reopen.

## Anti-patterns (do NOT do these)
- ❌ `import { Howl } from 'howler'` (no sound libraries)
- ❌ `import * as Tone from 'tone'` (no sound libraries)
- ❌ `import { sound } from 'pixi-sound'` (no sound libraries)
- ❌ `<audio src="/sounds/trip.mp3" />` without explicit approval
- ❌ `new Audio('/sounds/...')` (no asset loading)
- ❌ `Math.random()` for non-noise synthesis
- ❌ `setInterval` for repeating sound (gate with state)
- ❌ Sound > 1 s duration
- ❌ Default unmuted state
- ❌ Looping sound without definite end
- ❌ Tinnitus-inducing tone (> 1 kHz for alerts)
- ❌ `osc.start()` without matching `osc.stop()` (memory leak)
- ❌ Editing a FROZEN module's audio without reopen
- ❌ Sound that duplicates visual state without value
