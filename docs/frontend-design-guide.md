# Frontend Design Guide

## Protection System Relay Simulator Platform

This document is the detailed UI/UX reference for frontend work. The project must feel like a modern protection engineering workstation running in a browser.

## 1. Design identity

Target character:
- precise;
- technical;
- structured;
- industrial;
- professional;
- modern;
- calm;
- dense but readable.

Do not style the product as:
- a SaaS landing page;
- a marketing dashboard;
- a futuristic AI UI;
- cyberpunk;
- gaming;
- crypto;
- a consumer mobile application.

Priority:
Engineering Data > Simulation > Visualization > Explanation > Decoration.

## 2. Desktop application shell

Primary target is a 100vw × 100vh engineering workspace where practical.

Homepage:
- compact application header;
- module navigation/sidebar;
- main technical workspace;
- no marketing-section page structure.

Simulator:
- compact header, approx. 48–60 px;
- Zone A Parameters: approx. 20–25%;
- Zone B Live Simulation: approx. 45–55%;
- Zone C Analysis: approx. 25–30%.

Prefer internal panel scrolling, collapsible groups, tabs, or drawers over a long browser page.

## 3. Navigation

- Keep primary navigation scannable and compact.
- Provide a consistent `← PROTECTION LAB` / `← HOME` action in the upper-left of simulator pages.
- Do not depend only on browser Back.
- Simulator modules use independent routes.
- Module states may include AVAILABLE, BETA, COMING SOON.

## 4. Parameter organization

Group inputs by context:

### SYSTEM
Physical/system conditions, e.g. current, voltage, frequency, line impedance, fault position.

### RELAY
Protection settings, e.g. pickup, slope, time delay, zone reach, characteristic.

### INSTRUMENT
Measurement chain, e.g. CT ratio, VT ratio, CT error, saturation, mismatch.

Use advanced groups/drawers when parameter count is large.

## 5. Engineering inputs

Every engineering control should expose:
- label;
- precise editable value;
- unit;
- valid range when relevant;
- accessible information help when useful;
- explicit invalid state.

Sliders may supplement but must not replace precise numeric typing when precision matters.

Never silently correct invalid values.

## 6. Engineering value formatting

Always show units.

Preferred examples:
- `2.35 A`
- `80 %`
- `0.40 Ω`
- `48.50 Hz`
- `250 ms`

Use a monospace font for engineering values and equations.

Keep numeric value and unit separate in the internal data model.

## 7. Typography

Preferred UI fonts:
- Inter
- IBM Plex Sans
- Roboto

Preferred engineering/numeric fonts:
- IBM Plex Mono
- JetBrains Mono

Suggested desktop scale:
- 11–12 px metadata/supporting labels
- 12–13 px parameter labels
- 13–14 px navigation/body
- 14–16 px important UI text
- 18–22 px panel/module title
- 24–32 px homepage primary title

Avoid oversized marketing typography.

## 8. Color and surfaces

Use a neutral industrial dark palette.

Base:
- app background `#0F1115`
- surface `#161A20`
- panel `#1B2027`
- border `#2A3039`
- primary text `#E6E9ED`
- secondary text `#8E98A7`

Use accent colors semantically:
- blue: normal measurement
- cyan: selected measurement
- green: healthy/active
- amber: warning/pickup/attention
- red: trip/fault/critical

Accent must convey meaning, not decorative glow.

## 9. Shape language

Recommended:
- panel radius 4–8 px;
- button/input radius 4–6 px;
- 1 px structural borders;
- minimal shadow.

Avoid:
- giant rounded cards;
- pill-shaped panels;
- floating surfaces with large shadows.

Use border, spacing, typography, and surface hierarchy instead of decorative shadow.

## 10. Status

Status must use more than color.

Examples:
- `● NORMAL`
- `● PICKUP`
- `▲ WARNING`
- `■ TRIP`
- `● RESTRAIN`

Relay state should be immediately visible in the Analysis zone.

## 11. Simulation feedback

Normal edit flow:

User changes parameter  
→ calculation updates  
→ diagram updates  
→ graph updates  
→ operating point moves  
→ relay state reevaluates  
→ UI status updates

Do not require a generic CALCULATE button for ordinary parameter changes.

When useful, briefly emphasize the affected visual element to teach cause and effect.

## 12. Technical diagrams

One-line diagrams should be:
- geometric;
- clear;
- technically meaningful;
- minimally decorative;
- interactive where useful.

Clicking equipment such as CT1 or transformer may focus/open the related parameter group.

## 13. Engineering charts

A chart is an engineering component, not decoration.

Require as applicable:
- X/Y axis labels;
- engineering units;
- grid/ticks;
- characteristic;
- regions;
- dynamic operating point;
- tooltip;
- responsive sizing;
- live updates without refresh.

Differential reference:
- Y: Differential Current / Idiff
- X: Bias or Restraint Current / Ibias

Operating-point movement may interpolate smoothly.

## 14. Animation

Use animation only to communicate technical state.

Valid examples:
- subtle current-flow pulse;
- breaker open/close transition;
- simple fault marker;
- operating-point movement;
- characteristic transition.

Suggested timing:
- micro interaction: 120–180 ms;
- panel transition: 180–250 ms;
- graph transition: 250–400 ms;
- route/module transition: 200–350 ms.

Avoid long cinematic animation, parallax, random looping effects, and scroll-driven marketing effects.

## 15. Analysis panel

The Analysis zone should answer:

**What is happening, and why?**

Prioritize:
1. relay state;
2. primary calculated quantities;
3. threshold;
4. margin;
5. operating condition;
6. expandable calculation explanation.

Do not present an unapproved formula as final engineering truth.

## 16. Educational layer

Use short contextual learning aids:
- info tooltip;
- popover;
- calculation breakdown;
- cause/effect highlighting;
- concise parameter explanation.

Do not turn the main simulator workspace into a textbook page.

## 17. Fault interaction

Where applicable, fault controls may include:
- type;
- location;
- resistance;
- apply/reset action.

Fault application should visibly propagate through:
fault → system quantities → measurement → relay calculation → operating point → decision → breaker state.

## 18. Scenarios

Scenario presets should change actual simulator state.

Examples for Differential:
- Normal Load
- Internal Fault
- External Fault
- CT Mismatch
- CT Saturation
- Heavy Through Fault

## 19. Reset

Every simulator must provide RESET and restore:
- system parameters;
- relay settings;
- scenario;
- graph;
- diagram;
- operating point;
- simulation state.

## 20. Responsive behavior

Desktop is primary.

Tablet:
- compact navigation;
- maintain usable main visualization;
- analysis may become a drawer or collapsible panel.

Mobile:
- simplified stacked mode is acceptable;
- usability outranks desktop-style zero-scroll;
- do not simply shrink the desktop UI.

## 21. Accessibility

Minimum:
- keyboard navigation;
- visible focus;
- labeled controls;
- sufficient contrast;
- status not dependent on color alone;
- accessible tooltips/dialogs/dropdowns;
- readable font sizes;
- explicit validation messages.

## 22. Anti-patterns

Do not introduce by default:
- giant gradients;
- purple-blue gradients;
- neon glow;
- glowing cards;
- excessive glassmorphism;
- floating blobs;
- blurred gradient backgrounds;
- particles/orbit animation;
- huge rounded cards;
- generic card-grid dashboards;
- oversized marketing typography;
- gradient CTAs;
- fake AI visualizations;
- gaming HUD;
- crypto-dashboard visuals;
- excessive shadows;
- scroll-driven marketing sections.

## 23. New-element decision gate

Before adding a UI element, ask:
- What engineering information does it expose?
- What action does it support?
- Which state or parameter does it represent?
- Does it help the user understand the relay?
- Is the same information already available elsewhere?

If no strong answer exists, do not add it.

## 24. Frontend acceptance gate

Before considering UI work complete, verify:
- engineering application identity is preserved;
- desktop workspace is usable;
- back navigation exists;
- engineering values show units;
- invalid inputs are explicit;
- parameter changes visibly affect dependent state;
- chart axes/units are correct;
- operating point is visible where applicable;
- relay state is clear;
- status is not color-only;
- keyboard focus is visible;
- animation communicates state rather than decoration;
- no prohibited AI/marketing visual pattern was introduced.

Final rule:

**When aesthetics conflict with engineering clarity, engineering clarity wins.**
