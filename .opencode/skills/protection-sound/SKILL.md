---
name: protection-sound
description: Domain knowledge for protection-relay simulator audio
feedback. Covers engineering-event-to-sound mapping, Web Audio API
oscillator patterns, gain calibration, muting, accessibility, and
forbidden patterns. Use as a reference when designing or debugging
any audio feedback in this simulator.
---

# Protection Relay Sound — Domain Knowledge

## Usage guidance (READ THIS FIRST)

**When to read this skill:**
- protection-sound-expert agent is active
- Designing a new sound effect
- Debugging existing audio feedback
- Setting up audio infrastructure (SoundContext)

**How to read efficiently:**
- **Quick lookup (event → sound):** Read only "Engineering event →
  sound mapping" table
- **New sound design:** Read "Engineering event mapping" + "Web Audio
  API patterns" + "Mute/volume"
- **Debug:** Read "Forbidden patterns" + "Accessibility" sections

**Do NOT read this skill for:**
- Visual UI work
- Animation decisions (use protection-animation skill)

## Core principle

Sound in this project is **functional feedback**, not ambiance. Every
tone must answer: "Which engineering event does this signal?"
If it doesn't signal one, remove it.

Engineering UI is not a game. Audio cues are subtle, short, industrial.

## Engineering event → sound mapping

| Engineering event | Sound | Duration | Waveform | Notes |
|---|---|---|---|---|
| **Pickup** (51/50) | Short rising tone (C4→E4) | 120 ms | Sine | Gentle, attention-only |
| **Trip** (51/50) | Two-tone descending alert | 200 ms | Square | C4→G3, distinct from pickup |
| **Breaker OPEN** | Mechanical click | 50 ms | White noise | Sub-100ms, sharp |
| **Breaker CLOSE** | Soft thud | 80 ms | Low sine (60–80 Hz) | Quick decay |
| **Fault active** | Low rumble + warning | 300 ms | Low sine 80 Hz | Fade in/out |
| **Fault cleared** | Short descending chime | 150 ms | Sine | A4→E4, relief feel |
| **Backup continuation** | Double-beep | 160 ms | Two square pulses | 80 ms gap |
| **Alarm / violation** | Repeating beep (1 Hz) | 400 ms each | Square | Only on TCC bracket FAIL |
| **Reset** | Single soft blip | 60 ms | Sine | Confirming |
| **Parameter change** | Subtle click | 30 ms | Noise burst | Optional, low gain |
| **Route enter** | None | — | — | Silent, no decoration |
| **All-case PASS** | Ascending chime | 250 ms | Sine arpeggio | C4→E4→G4, celebration |
| **All-case FAIL** | None | — | — | Visual only, no shame noise |

## Gain calibration (strict)

| Level | Use | dBFS |
|---|---|---|
| **Default peak** | All engineering cues | –12 dBFS (~0.25 linear) |
| **Loud alert** | Trip, alarm | –8 dBFS (~0.40 linear) |
| **Subtle click** | Breaker, parameter | –18 dBFS (~0.13 linear) |
| **Never louder than** | — | –3 dBFS (speech-level) |

If the user complains "too loud", reduce gain by 6 dB, never disable.

## Frequency reference

```
C3 = 130.81 Hz
E3 = 164.81 Hz
G3 = 196.00 Hz
A3 = 220.00 Hz
C4 = 261.63 Hz
D4 = 293.66 Hz
E4 = 329.63 Hz
F4 = 349.23 Hz
G4 = 392.00 Hz
A4 = 440.00 Hz
C5 = 523.25 Hz
```

For the Overcurrent simulator, the standard cue palette is:
- Pickup: C4 → E4 sweep
- Trip: E4 → C4 → G3 sequence
- Reset: C4 single blip
- Pass: C4 → E4 → G4 arpeggio

## Web Audio API building blocks

### Master singleton (one AudioContext per app)

```typescript
let _ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (_ctx === null) {
    _ctx = new (window.AudioContext
      || (window as any).webkitAudioContext)();
  }
  return _ctx;
}
```

The AudioContext must be created on first user gesture (browser
autoplay policy), not on page load. Resume on first interaction.

### Tone primitive (sine, square, triangle)

```typescript
export function playTone(opts: {
  freq: number;
  endFreq?: number;
  duration: number;
  wave?: OscillatorType;
  gainDb?: number;
}) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.wave ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, ctx.currentTime);
  if (opts.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      opts.endFreq,
      ctx.currentTime + opts.duration / 1000
    );
  }
  const peak = Math.pow(10, (opts.gainDb ?? -12) / 20);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(
    peak, ctx.currentTime + 0.005
  );
  gain.gain.exponentialRampToValueAtTime(
    0.001, ctx.currentTime + opts.duration / 1000
  );
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + opts.duration / 1000 + 0.01);
}
```

### Noise burst (breaker click)

```typescript
export function playNoise(duration: number, gainDb = -18) {
  const ctx = getAudioContext();
  const bufferSize = ctx.sampleRate * (duration / 1000);
  const buffer = ctx.createBuffer(
    1, bufferSize, ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) *
      (1 - i / bufferSize);  // decay
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(
    Math.pow(10, gainDb / 20), ctx.currentTime
  );
  src.connect(gain).connect(ctx.destination);
  src.start();
}
```

## Mute / volume infrastructure

Sound must be opt-in. The minimum pattern:

```typescript
// src/state/soundContext.tsx
interface SoundState {
  muted: boolean;
  volume: number; // 0..1
  toggle: () => void;
  setVolume: (v: number) => void;
}

const SoundContext = createContext<SoundState | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(() =>
    localStorage.getItem('sim-sound-muted') === 'true'
  );
  const [volume, setVolumeState] = useState(() =>
    Number(localStorage.getItem('sim-sound-volume') ?? 0.5)
  );

  const setVolume = (v: number) => {
    setVolumeState(v);
    localStorage.setItem('sim-sound-volume', String(v));
  };

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('sim-sound-muted', String(next));
  };

  // All playTone calls must read muted + volume before playing.
  return (
    <SoundContext.Provider value={{ muted, volume, toggle, setVolume }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound outside SoundProvider');
  return ctx;
}
```

## Accessibility

1. **Default muted.** User must opt in via a UI control. This is
   non-negotiable for an engineering tool.
2. **`prefers-reduced-motion: reduce` does not control audio** —
   it controls visual motion. Use `prefers-reduced-motion` only as
   a hint to also lower audio defaults.
3. **No flashing visual + audio** combination. Sound is a complement
   to a stable visual state, never a substitute.
4. **No surprise sound on route load.** Sounds must be triggered by
   an explicit engineering event.
5. **No looping sound** — every sound has a definite end.

## Forbidden patterns

- ❌ External `.mp3` / `.wav` files (asset loading, CORS, no determinism)
- ❌ Sound libraries (howler.js, tone.js, pixi-sound)
- ❌ `Math.random()` for non-noise synthesis (use it ONLY for noise)
- ❌ `setInterval` for repeating sound (gate with explicit state)
- ❌ Looping sound without definite end
- ❌ Sound > 1 s duration
- ❌ Default unmuted
- ❌ Sound that duplicates visual state without value
- ❌ Editing FROZEN Differential R10 audio without reopen

## Common bugs and fixes

| Bug | Cause | Fix |
|---|---|---|
| No sound on page load | AudioContext blocked by autoplay policy | Create on first user gesture, resume on click |
| Sound is too loud | Default gain too high | Set peak to –12 dBFS, never above –3 dBFS |
| Click is harsh | Full-amplitude white noise | Apply linear decay envelope |
| Trip tone sounds like pickup | Same waveform + same freq | Use different wave (square vs sine) + descending |
| Memory leak on unmount | Oscillator not stopped | Schedule `osc.stop(time + duration + 0.01)` |
| Sound fires on initial load | Trigger tied to mount | Gate with explicit event predicate |
| User can't mute | No UI control | Add mute toggle in simulator header |
| Reverb/echo on every sound | No gain envelope | Apply attack-decay envelope per oscillator |
| Tinnitus-inducing tones | Pure tone at 4 kHz | Stay below 1 kHz for alerts, use noise for clicks |

## Troubleshooting decision tree

When sound misbehaves, walk this tree in order:

### Step 1: Is the AudioContext created?
- Open DevTools → Console → check for "AudioContext was not allowed to start"
- If yes → user hasn't clicked anywhere yet. Add `resume()` on first
  user gesture (mousedown, keydown, pointerdown).
- If no AudioContext at all → call `getAudioContext()` first.

### Step 2: Is sound muted when it shouldn't be?
- Check `SoundContext.muted` in localStorage
- Check `SoundContext.volume` (> 0?)
- If the toggle UI is broken → the mute toggle, not the play fn
- If the play fn bypasses the context → it must read mute + volume

### Step 3: Is the gain too low / too high?
- Use the gain calibration table: default –12 dBFS
- If user complains too loud → reduce by 6 dB, never disable
- If user can't hear → check system volume, then app gain

### Step 4: Is the right event firing the right sound?
- Re-read the event-to-sound mapping table
- Verify the trigger predicate matches the spec
- If wrong → fix the trigger, not the waveform

### Step 5: Is the waveform right?
- Sine for chimes, square for alerts, triangle for pickup, noise for click
- If using sine for breaker click → it sounds like a tone, not a click
- If using square for chime → it sounds harsh

### Step 6: Is the duration wrong?
- Re-read the duration column in the mapping table
- If too long (>1 s) → reduce duration
- If too short (<30 ms) → click is lost; use 50 ms minimum

### Step 7: Memory leak on unmount?
- Confirm every `osc.start()` has a matching `osc.stop(time + duration + 0.01)`
- If leak → add the stop call. Confirm by running React DevTools profiler.
