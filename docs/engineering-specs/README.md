# Relay Engineering Specifications

Each production-grade relay simulator requires its own Engineering Specification.

The frontend and simulation engine must not invent mathematical behavior that is not defined by an approved specification.

Expected specifications include:
- Differential Relay Engineering Specification — `differential-relay.md` (**APPROVED / FINAL — R10 reference module**)
- Overcurrent Relay Engineering Specification — `overcurrent-relay.md` (**O01 v1.0 APPROVED / FROZEN**); domain model `overcurrent-domain-model-o02.md` (**O02 implemented + later integration refinements**); pure engine `overcurrent-engine-o03.md` + hardening (**O03/O04 complete**); Study Engine `overcurrent-study-o05.md` (**O05 implemented**); Coordination Engine `overcurrent-coordination-o06.md` (**O06 implemented**); Timeline Engine `overcurrent-timeline-o07.md` (**O07 implemented**); Parameter UI `overcurrent-parameter-ui-o08.md` (**O08 implemented**); radial SLD `overcurrent-sld-o09.md` (**O09 implemented**); TCC `overcurrent-tcc-o10.md` + `overcurrent-tcc-o10h.md` (**O10/O10H implemented**); Operating Sequence `overcurrent-operating-sequence-o11.md` (**O11 implemented**); Analysis / Learning `overcurrent-analysis-o12.md` (**O12 implemented**); Coordination Guided Challenges `overcurrent-guided-challenges-o13.md` (**O13 implemented**); Responsive / Accessibility / UX `overcurrent-responsive-accessibility-o14.md` (**O14 implemented**); Page / Route / Homepage Integration `overcurrent-page-route-integration-o15.md` (**O15 implemented**); Final Engineering + UX Audit `overcurrent-final-audit-o16.md` (**O16 audit PASS / conditional release candidate; all gate items PASS 2026-08-30 (fresh `npm ci`, Vitest, Vite build, browser smoke) — READY FOR FREEZE; user freeze approval pending, not FINAL**)
- Distance Relay Engineering Specification — `distance-relay.md` (**D01 v1.0 READY FOR APPROVAL**; module is implemented and merged into `main` at `/simulator/distance`, but the spec is not yet approved/frozen)
- Underfrequency Relay Engineering Specification — `underfrequency-relay.md` (**U01 v1.0 READY FOR APPROVAL**; module is complete and merged into `main` at `/simulator/underfrequency`, but the spec is not yet approved/frozen)

Each relay specification should define, as applicable:
- equations;
- assumptions;
- engineering conventions;
- units;
- characteristic definitions;
- calculation sequence;
- operating logic;
- decision boundaries;
- references;
- validation ranges;
- test/reference cases.

Until the relevant specification exists, UI prototyping may represent the workflow and state model, but any placeholder or provisional engineering logic must be clearly identified and must not be presented as validated relay behavior.
