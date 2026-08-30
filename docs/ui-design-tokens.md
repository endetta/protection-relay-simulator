# UI Design Tokens

These tokens define the baseline design language. Adapt them to the actual styling technology only after the repository stack is verified.

## Base colors

```css
:root {
  --app-bg: #0F1115;
  --surface-1: #161A20;
  --surface-2: #1B2027;
  --border-default: #2A3039;

  --text-primary: #E6E9ED;
  --text-secondary: #8E98A7;

  --radius-panel: 6px;
  --radius-control: 5px;
  --border-width: 1px;

  --header-height: 54px;

  --transition-fast: 150ms;
  --transition-panel: 220ms;
  --transition-graph: 320ms;
}
```

## Semantic colors

Define implementation-specific tokens for:
- measurement normal;
- selected measurement;
- healthy/active;
- warning/pickup;
- trip/fault/critical.

Do not name semantic tokens after decorative effects such as `neonGlow` or `magicGradient`.

## Spacing scale

Recommended base scale:
- 4 px
- 8 px
- 12 px
- 16 px
- 20 px
- 24 px
- 32 px

Typical usage:
- control gap: 6–8 px
- field spacing: 10–12 px
- section spacing: 16–20 px
- panel padding: 16–20 px

## Shape

- panel radius: 4–8 px
- controls: 4–6 px
- border: 1 px
- shadows: minimal

## Typography

UI:
- Inter preferred
- IBM Plex Sans or Roboto acceptable

Engineering values:
- IBM Plex Mono
- JetBrains Mono

Engineering values and equations should use tabular/monospace presentation when practical.
