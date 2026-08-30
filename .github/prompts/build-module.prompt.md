---
mode: agent
agent: relay-module-builder
description: Scaffold a new protection relay simulator module
---

Use the relay-module-builder agent to scaffold a new relay module.
The agent will:
1. Read the approved engineering spec for the relay
2. Inspect existing reference modules (Differential R10, Overcurrent O16)
3. Scaffold types → engine → tests → page → components → route
4. Run tests + typecheck
5. Delegate engine validation to engineering-validator
6. Delegate UI review to ui-ux-auditor
7. Produce a MODULE-READY / NEEDS-FIX / SCAFFOLD-ONLY verdict
