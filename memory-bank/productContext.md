# Product context

## Why the product exists

Protection concepts are easier to understand when users can see the relationship between system conditions, measurement chains, relay settings, calculations, characteristics, and final protection decisions.

The platform therefore behaves as an interactive engineering workstation rather than a static educational website or a simple input-result calculator.

## Core user experience

The intended experience is:

System condition  
→ Relay input  
→ Relay parameter  
→ Relay calculation  
→ Characteristic  
→ Protection decision  
→ Trip / Restrain / Alarm

A parameter change should produce visible cause-and-effect feedback in real time.

## UX priorities

The interface prioritizes:
1. Engineering data
2. Simulation
3. Technical visualization
4. Contextual explanation
5. Decoration

## Learning goals

The UI should help the user understand:
- what is happening;
- why the relay responds;
- how a parameter changes the result;
- how the operating point moves;
- when the relay enters an operate/trip region;
- when the relay remains restrained.

## Interaction philosophy

- Do not require a generic `CALCULATE` action for ordinary parameter changes.
- Use technical animation only when it communicates system state or causality.
- Keep explanations contextual and concise through labels, tooltips, calculation panels, and dependency highlighting.
- Preserve precise typed engineering input even when sliders are also provided.

## Desktop experience

The primary experience is a dense but readable engineering application using a fixed or near-fixed viewport, with internal panel scrolling where necessary rather than a long browser page.
