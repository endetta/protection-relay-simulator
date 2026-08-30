/**
 * Underfrequency UFLS shedding chart presentation model (UFR).
 *
 * Pure model that turns the UFLS stage ladder + the timeline's operated set
 * into a stacked/sectioned bar model. It reads stage thresholds and shed MW
 * from settings, plus which stages latched over the run; it never decides
 * pickup or sheds load (that is the engine's job). Each bar is ordered by
 * descending threshold (Stage 1 first), highlighting operated vs. armed-only
 * vs. bypassed stages and showing the latched shed MW.
 */

import type {
  UflsStageSettings,
  UnderfrequencyTimelineRun,
} from '../types/underfrequency';

// ─────────────────────────────── Model types ────────────────────────────────

export interface UnderfrequencySheddingBarModel {
  readonly stageId: string;
  readonly label: string;
  readonly thresholdHz: number;
  readonly enabled: boolean;
  readonly operated: boolean;
  readonly armed: boolean;
  readonly shedFractionPct: number;
  readonly shedMw: number;
  readonly timeDelaySec: number;
  /** Shed fraction restored as a bar fill (0..1) for the "shed" slice. */
  readonly shedFill: number;
}

export interface UnderfrequencySheddingChartModel {
  readonly status: 'VALID' | 'INVALID';
  readonly bars: readonly UnderfrequencySheddingBarModel[];
  readonly totalShedMw: number;
  readonly totalBaseLoadMw: number;
  readonly operatedCount: number;
  readonly enabledCount: number;
}

// ─────────────────────────────── Builder ────────────────────────────────────

/**
 * Build the shedding bar chart. The operated set is taken from the run's
 * latched stage IDs (final snapshot) so it reflects the whole run; armed-only
 * reflects the last snapshot's armed set.
 */
export function buildUnderfrequencySheddingChartModel(
  uflsStages: readonly UflsStageSettings[],
  baseLoadMw: number,
  run: UnderfrequencyTimelineRun | null,
): UnderfrequencySheddingChartModel {
  // Stages ordered by descending threshold so the ladder reads top-down first.
  const ordered = [...uflsStages].sort((a, b) => b.thresholdHz - a.thresholdHz);

  const operatedIds = new Set<string>();
  const armedIds = new Set<string>();
  if (run && run.status === 'VALID') {
    const last = run.snapshots[run.snapshots.length - 1];
    if (last) {
      last.operatedStageIds.forEach((id) => operatedIds.add(id));
      last.armedStageIds.forEach((id) => armedIds.add(id));
    }
  }

  const totalShedBase = ordered.reduce((sum, s) => sum + (s.shedFractionPct / 100) * baseLoadMw, 0);
  const maxShed = Math.max(1, totalShedBase);

  const bars: UnderfrequencySheddingBarModel[] = ordered.map((stage) => {
    const shedMw = (stage.shedFractionPct / 100) * baseLoadMw;
    const operated = stage.enabled && operatedIds.has(stage.id);
    return {
      stageId: stage.id,
      label: stage.label,
      thresholdHz: stage.thresholdHz,
      enabled: stage.enabled,
      operated,
      armed: stage.enabled && armedIds.has(stage.id),
      shedFractionPct: stage.shedFractionPct,
      shedMw,
      timeDelaySec: stage.timeDelaySec,
      shedFill: stage.enabled ? Math.max(0, Math.min(1, shedMw / maxShed)) : 0,
    };
  });

  const totalShedMw = bars.reduce((sum, bar) => (bar.operated ? sum + bar.shedMw : sum), 0);

  return {
    status: bars.length > 0 ? 'VALID' : 'INVALID',
    bars,
    totalShedMw,
    totalBaseLoadMw: baseLoadMw,
    operatedCount: bars.filter((b) => b.operated).length,
    enabledCount: bars.filter((b) => b.enabled).length,
  };
}
