# System patterns

**Verified status (2026-08-12):** Scaffold and Application Shell are now implemented. Simulator-specific calculation logic remains to be implemented.

## Application structure

Each simulator is an independent module with its own route.

Conceptual routes:
- `/`
- `/simulator/overcurrent`
- `/simulator/differential`
- `/simulator/distance`
- `/simulator/underfrequency`

Refresh on a simulator route must preserve that simulator route.

## Simulator layout pattern

Desktop simulator pages use three primary zones:

### Zone A — Parameters
Approx. 20–25%.
Contains editable SYSTEM, RELAY, INSTRUMENT, and scenario/fault parameters.

### Zone B — Live Simulation
Approx. 45–55%.
Primary visual focus. May contain one-line diagrams, characteristic curves, phasors, fault visualization, and dynamic operating points.

### Zone C — Analysis
Approx. 25–30%.
Contains relay state, derived quantities, thresholds, margins, equations, calculation explanation, and event information.

## Parameter hierarchy

Use:
- SYSTEM — physical/system conditions
- RELAY — relay settings
- INSTRUMENT — measurement chain such as CT/VT and measurement error

## State propagation pattern

Normal parameter update:

User input  
? validation  
? unit handling/conversion  
? relay calculation engine  
? characteristic evaluation  
? relay decision  
? simulation state  
? diagram / graph / result UI

The downstream state should update without a page reload.

## Separation of concerns

Conceptual architecture:

UI  
? Simulator Controller  
? Relay Calculation Engine  
? Simulation State  
? Graph / Diagram / Results

Do not bury engineering calculation logic inside visual components.

## Shared UI components

Expected reusable concepts include:
- AppShell
- SimulatorHeader
- ParameterPanel
- ParameterGroup
- EngineeringInput
- UnitSelector
- StatusIndicator
- ValueDisplay
- CalculationPanel
- ChartContainer
- OneLineDiagram
- ScenarioSelector
- SimulationControls
- Tooltip
- ResetButton
- HomeButton

### Implemented (extracted from Differential reference module)
Located in `src/components/shared/`:
- `NumberField` — labeled numeric input with unit suffix and range-validation feedback (uses `validateRange`).
- `Metric` — read-only engineering value display with unit (uses `formatEngineeringValue`).

Simulator-specific visualization is allowed and expected.

## Graph pattern

Engineering graphs require:
- named axes;
- engineering units;
- readable grid/ticks;
- characteristic representation;
- operating point when applicable;
- responsive update;
- tooltip/interactivity when useful.

## Responsive pattern

Desktop is primary.
Tablet may compact navigation/panels.
Mobile may use a simplified stacked experience; usability takes precedence over forcing desktop zero-scroll behavior.

## Overcurrent parameter-state pattern — O08

- The O05 `OvercurrentStudyDefinition` remains the editable study source of
  truth; reducer edits are immutable and never mutate registry presets.
- Device parameter forms map `topology.deviceIds`. Do not create separate
  R1/R2/R3 state types or form implementations.
- Coordination target forms map `coordinationRequirements`; when a CTI budget
  exists, `requiredCtiSec` is recalculated from its three components atomically.
- `NumberField` owns draft syntax/range validity. Invalid drafts do not enter
  engineering state and stay mounted through `ParameterGroup` collapse.
- Before a run, validate the full study plus every configured current vector
  through the approved device evaluator so derived overflow is contained.
- RUNNING/PAUSED locks engineering inputs. Device focus, playback speed, Clear,
  and Reset remain available. Playback speed is presentation-only.
- Keep the parameter component route-independent until O15; compose SLD, TCC,
  sequence, and Analysis only in their planned phases.

## Overcurrent radial-SLD pattern — O09

- Build the SLD through a pure presentation model; React/SVG must not resolve
  currents, protection roles, or breaker timing independently.
- Generate devices from `topology.deviceIds` and locations from
  `topology.locations`; relay names never determine primary/backup behavior.
- Discrete fault clicks select a configured `FaultCaseId`; preserve the active
  MIN/NOMINAL/MAX category when the target location provides it.
- Fault scrubber points use `resolveFaultLocationStudy()` and remain Explore-only
  unless a real configured FaultCase is selected for timeline playback.
- Breaker/isolation display accepts only a matching O07 `TimelineSnapshot` so a
  prior fault cannot leak stale open-breaker state into a new study case.
- SLD and TCC share O08 `selectedDeviceId` for cross-highlighting; do not create
  a second presentation-only relay selection source.

## Overcurrent TCC pattern — O10

- Build graph data in a pure presentation model. React/SVG may transform and
  clip coordinates but must not implement relay, CT, CTI, or profile equations.
- Sample 51 curves through O03/O04 engine functions. Keep plotted operating
  points equal to the accepted `OperatingResult` values.
- Use generic `TCCLayer` IDs keyed by configured device and pair IDs. Device
  labels and relay count must not control graph logic.
- Default Single Relay to current multiple and Coordination Lab to a common
  primary-current domain. State axis domain and units in visible text.
- Keep Characteristic scale stable. Mark extreme points off-scale and expand
  deterministic log bounds only in Fit Point mode.
- Represent a 50 result as an exact 0-second off-scale point plus a high-set
  boundary. Keep the engine's 51 reference time available in the inspector.
- Read active CTI and envelope data from O06. Do not recompute coordination
  margins in the render component.
- Use the shared compact curve inspector for pointer follow, keyboard focus,
  touch pin, outside dismiss, and viewport-edge clamping.
- Use O08 `selectedDeviceId` for SLD/TCC/parameter cross-highlighting.


## Overcurrent TCC hardening pattern — O10H

- For a protection chain, active CTI is adjacent-tier: PRIMARY→BACKUP1, BACKUP1→BACKUP2, etc.
- Render active coordination brackets from O06 pair results; never recompute CTI in React.
- A null trip time is a below-pickup study marker, not a time off-scale result.
- A 0 s 50 result remains lower off-scale because log time cannot represent zero.
- Map pointer coordinates through SVG CTM (or exact xMidYMid/meet fallback), not raw bounding-box width ratios.
