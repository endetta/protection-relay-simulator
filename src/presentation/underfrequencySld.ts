/**
 * Underfrequency SLD presentation model (pure, UI-independent).
 *
 * Transforms (study, visible snapshot, run) into the coordinates/state the
 * animated single-line diagram renders: per-generator rows, the bus readout,
 * and the four load blocks with the D8 shed-allocation policy applied.
 *
 * This module never re-implements relay or coordination equations — engine
 * output is consumed as-is; the load-block partition is a documented,
 * presentation-only visual policy (see docs/superpowers/specs/
 * 2026-08-31-uf-sld-primary-view-design.md § 5.1, decision D8).
 */

import type {
  UnderfrequencyGeneratorStatus,
  UnderfrequencyStudyDefinition,
  UnderfrequencyTimelineRun,
  UnderfrequencyTimelineSnapshot,
} from '../types/underfrequency';

// ─────────────── Load-block partition (D8, presentation-only) ──────────────

/** Fixed A/B/C/D load-block fractions of the pre-disturbance base load. */
export const LOAD_BLOCK_FRACTIONS = { A: 0.35, B: 0.3, C: 0.2, D: 0.15 } as const;

export type UnderfrequencySldBlockId = keyof typeof LOAD_BLOCK_FRACTIONS;

export interface UnderfrequencySldBlock {
  readonly id: UnderfrequencySldBlockId;
  /** Percent of base load this block represents (35/30/20/15). */
  readonly fractionPct: number;
  /** MW the block carries pre-fault (fraction × baseLoadMw). */
  readonly baseMw: number;
  /** True when the block has been fully shed (D8: blocks fill A→B→C; D never). */
  readonly shed: boolean;
  /** True only for block D — the protected/critical block. */
  readonly critical: boolean;
}

export interface UnderfrequencySldGenerator {
  readonly generatorId: string;
  readonly label: string;
  readonly status: UnderfrequencyGeneratorStatus;
  readonly outputMw: number;
  readonly governorResponseMw: number;
  readonly headroomMw: number;
  readonly saturated: boolean;
  readonly rpm: number;
  readonly mwRated: number;
  readonly poles: number;
}

export type UnderfrequencySldTone = 'success' | 'warning' | 'danger';

export interface UnderfrequencySldBus {
  readonly frequencyHz: number;
  readonly rocofHzPerSec: number;
  readonly deficitMw: number;
  readonly tone: UnderfrequencySldTone;
  readonly collapse: boolean;
  /** MW shed beyond the sheddable capacity (A+B+C) — never carved from D. */
  readonly unservedMw: number;
}

export interface UnderfrequencySldModel {
  /** IDLE: pre-fault view built from the study alone (no snapshot yet). */
  readonly status: 'IDLE' | 'VALID';
  readonly generators: readonly UnderfrequencySldGenerator[];
  readonly bus: UnderfrequencySldBus;
  readonly blocks: readonly UnderfrequencySldBlock[];
  /** Total MW shed by operated UFLS stages (engine figure, presentation-mapped). */
  readonly shedMwTotal: number;
}

// ───────────────────────────── Builder ─────────────────────────────────────

/**
 * Build the SLD model. With `snapshot === null` the model is IDLE and shows
 * the pre-fault configuration straight from the study (all generators at
 * initialMw, f = fNominalHz, no shed).
 */
export function buildUnderfrequencySldModel(
  study: UnderfrequencyStudyDefinition,
  snapshot: UnderfrequencyTimelineSnapshot | null,
  run: UnderfrequencyTimelineRun | null,
): UnderfrequencySldModel {
  const baseLoadMw = study.system.baseLoadMw;

  const generators: readonly UnderfrequencySldGenerator[] = snapshot
    ? study.generators.map((g) => {
        const snap = snapshot.generators.find((s) => s.generatorId === g.id);
        return {
          generatorId: g.id,
          label: g.label,
          status: snap?.status ?? 'ONLINE',
          outputMw: snap?.outputMw ?? g.initialMw,
          governorResponseMw: snap?.governorResponseMw ?? 0,
          headroomMw: snap?.headroomMw ?? Math.max(0, g.governorMaxMw - g.initialMw),
          saturated: snap?.saturated ?? false,
          rpm: snap?.rpm ?? (120 * study.system.fNominalHz) / g.poles,
        };
      })
    : study.generators.map((g) => ({
        generatorId: g.id,
        label: g.label,
        status: 'ONLINE' as const,
        outputMw: g.initialMw,
        governorResponseMw: 0,
        headroomMw: Math.max(0, g.governorMaxMw - g.initialMw),
        saturated: false,
        rpm: (120 * study.system.fNominalHz) / g.poles,
      }));

  const collapse = run?.steadyStateStatus === 'COLLAPSE';

  // Bus tone is derived from snapshot state, never from hard-coded thresholds.
  const anyOperated = snapshot ? snapshot.operatedStageIds.length > 0 : false;
  const anyArmed = snapshot ? snapshot.armedStageIds.length > 0 : false;
  const tone: UnderfrequencySldTone = anyOperated || collapse
    ? 'danger'
    : anyArmed
      ? 'warning'
      : 'success';

  const { blocks, shedMwTotal, unservedMw } = buildLoadBlocks(study, snapshot?.operatedStageIds ?? []);
  const bus: UnderfrequencySldBus = {
    frequencyHz: snapshot?.frequencyHz ?? study.system.fNominalHz,
    rocofHzPerSec: snapshot?.rocofHzPerSec ?? 0,
    deficitMw: snapshot?.deficitMw ?? 0,
    tone,
    collapse,
    unservedMw,
  };

  return {
    status: snapshot ? 'VALID' : 'IDLE',
    generators,
    bus,
    blocks,
    shedMwTotal,
  };
}

// ────────────────── D8 shed allocation (presentation-only) ─────────────────

function buildLoadBlocks(
  study: UnderfrequencyStudyDefinition,
  operatedStageIds: readonly string[],
): {
  readonly blocks: readonly UnderfrequencySldBlock[];
  readonly shedMwTotal: number;
  readonly unservedMw: number;
} {
  const baseLoadMw = study.system.baseLoadMw;

  const ids = Object.keys(LOAD_BLOCK_FRACTIONS) as UnderfrequencySldBlockId[];
  const blocks: UnderfrequencySldBlock[] = ids.map((id) => ({
    id,
    fractionPct: LOAD_BLOCK_FRACTIONS[id] * 100,
    baseMw: LOAD_BLOCK_FRACTIONS[id] * baseLoadMw,
    shed: false,
    critical: id === 'D',
  }));

  // Total engine shed MW for the operated stages (per U01 § 9.4: fraction of
  // the PRE-disturbance base load, computed once per stage).
  const shedMwTotal = operatedStageIds.reduce((sum, stageId) => {
    const stage = study.uflsStages.find((s) => s.id === stageId);
    return stage ? sum + (stage.shedFractionPct / 100) * baseLoadMw : sum;
  }, 0);

  // Fill A→B→C in order; block D is critical and never sheds.
  let remaining = shedMwTotal;
  for (const block of blocks) {
    if (block.critical) continue;
    if (remaining >= block.baseMw) {
      block.shed = true;
      remaining -= block.baseMw;
    } else {
      break;
    }
  }

  // Any shed requested beyond the A+B+C capacity overflows to unservedMw.
  const sheddableCapacity =
    blocks.filter((b) => !b.critical).reduce((sum, b) => sum + b.baseMw, 0);
  const unservedMw = Math.max(0, shedMwTotal - sheddableCapacity);

  return { blocks, shedMwTotal, unservedMw };
}
