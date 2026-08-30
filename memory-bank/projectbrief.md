# Project brief

## Project

**Name:** Protection System Relay Simulator Platform  
**Product type:** Web-based engineering simulator  
**Primary domain:** Electrical power system protection  
**Product identity:** Virtual Protection Engineering Laboratory

## Core goal

Build an interactive environment where users can select a protection relay, modify engineering parameters, and immediately observe how those parameters affect measurements, calculations, characteristic curves, system visualization, operating points, and protection decisions.

## Primary users

- Electrical engineering students
- Protection engineers
- Lecturers
- Technicians
- Training participants

## Core simulator scope

Initial relay modules:
- [~] Overcurrent Relay — **PRD AUTHORITATIVE / O01 APPROVED / O02–O10 IMPLEMENTED / NEXT O11**
- [x] Differential Relay — **FINAL / COMPLETED (R10)**
- [ ] Distance Relay — Planned
- [ ] Underfrequency Relay — Planned

Current platform focus: **Overcurrent Relay implementation — O10H TCC hardening passed; O11 Operating Sequence is next**, governed by `docs/PRD-overcurrent-relay.md` and the approved O01 engineering specification. Homepage R02 remains the current platform navigation shell; the Overcurrent route stays inactive until O15.

The platform must allow additional relay modules to be added without redesigning the whole application.

## MVP direction

The PRD recommends establishing:
- Application shell
- Homepage/navigation UX
- Shared UI components
- Differential Relay Simulator as the reference simulator

Differential Relay is the **completed reference module (R10)** from which reusable layout, interaction, chart, visualization, and animation patterns can be extracted. Its scope is frozen unless explicitly reopened.


## Overcurrent product direction

Overcurrent is planned as a **50/51 Protection & Coordination Laboratory**, not a static TCC calculator. Its locked learning sequence is **Explore → Coordinate → Validate**. Core scope includes Single Relay Study, 2/3-relay radial Coordination Lab, CT measurement, 50/51 timing, TCC, primary/backup CTI, coordination corridor/envelope, worst-case scanning, sensitivity/selectivity checks, time-domain trip/breaker sequence, guided miscoordination studies, all-cases validation, and initial-vs-current comparison. The exact engineering equations and timing boundaries must be approved in the dedicated Overcurrent Engineering Specification before engine implementation.

## Non-goals

The product is not:
- a long-form information website;
- a SaaS marketing landing page;
- a generic analytics dashboard;
- a gaming or cyberpunk interface;
- a decorative AI-style dashboard.

## Product success

A new user should be able to:
- find the intended simulator quickly;
- understand the main parameters without a long manual;
- change a parameter;
- immediately see its consequences;
- identify the relay state;
- understand why the relay operated or restrained;
- navigate back to the Protection Lab easily.
