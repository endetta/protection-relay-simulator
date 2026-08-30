/**
 * Underfrequency generator diagram presentation model (UFR).
 *
 * Pure model that transforms a timeline snapshot's per-generator data into a
 * per-generator bar/status layout model. It derives synchronous RPM from
 * `rpm = 120·f/poles` as a coordinate transform (U01 § 4.2) — this is a
 * display derivation, not redesigning a governor/droop equation, which the
 * engine already computed into `governorResponseMw` / `outputMw`.
 */

import type {
  UnderfrequencyGeneratorSnapshot,
} from '../types/underfrequency';

// ─────────────────────────────── Model types ────────────────────────────────

export interface UnderfrequencyGeneratorRowModel {
  readonly generatorId: string;
  readonly label: string;
  readonly status: UnderfrequencyGeneratorSnapshot['status'];
  readonly outputMw: number;
  readonly governorResponseMw: number;
  readonly headroomMw: number;
  readonly saturated: boolean;
  readonly rpm: number;
  readonly poles: number;
  readonly initialMw: number;
  readonly mwRated: number;
  readonly mva: number;
  readonly droopPu: number;
  readonly inertiaSec: number;
  /** Bar fill fraction relative to the max visible MW across the set (0..1). */
  readonly outputFill: number;
  /** Bar fill fraction for the governor response slice (0..1). */
  readonly responseFill: number;
}

export interface UnderfrequencyGeneratorDiagramModel {
  readonly status: 'VALID' | 'INVALID';
  readonly rows: readonly UnderfrequencyGeneratorRowModel[];
  readonly maxOutputMw: number;
  readonly aggregateOutputMw: number;
  readonly totalHeadroomMw: number;
  readonly currentFrequencyHz: number;
  readonly nominalFrequencyHz: number;
  readonly onlineCount: number;
  readonly trippedCount: number;
}

// ─────────────────────────────── Builder ────────────────────────────────────

/**
 * Build the generator diagram from a single timeline snapshot. Fall back to
 * the static result's generator values when a snapshot is unavailable.
 */
export function buildUnderfrequencyGeneratorDiagramModel(
  snapshot: readonly UnderfrequencyGeneratorSnapshot[],
  generatorsMeta: readonly { id: string; label: string; poles: number; mwRated: number; mva: number; droopPu: number; inertiaSec: number; initialMw: number }[],
  currentFrequencyHz: number,
  nominalFrequencyHz: number,
): UnderfrequencyGeneratorDiagramModel {
  const rows: UnderfrequencyGeneratorRowModel[] = snapshot.map((snap) => {
    const meta = generatorsMeta.find((g) => g.id === snap.generatorId);
    return {
      generatorId: snap.generatorId,
      label: meta?.label ?? snap.generatorId,
      status: snap.status,
      outputMw: snap.outputMw,
      governorResponseMw: snap.governorResponseMw,
      headroomMw: snap.headroomMw,
      saturated: snap.saturated,
      rpm: snap.rpm,
      poles: meta?.poles ?? 2,
      initialMw: meta?.initialMw ?? 0,
      mwRated: meta?.mwRated ?? 0,
      mva: meta?.mva ?? 0,
      droopPu: meta?.droopPu ?? 0,
      inertiaSec: meta?.inertiaSec ?? 0,
      outputFill: 0,
      responseFill: 0,
    };
  });
  const maxOutputMw = Math.max(1, ...rows.map((r) => r.outputMw));
  const withFill = rows.map((row) => ({
    ...row,
    outputFill: Math.max(0, Math.min(1, row.outputMw / maxOutputMw)),
    responseFill: Math.max(0, Math.min(1, row.governorResponseMw / maxOutputMw)),
  }));
  return {
    status: withFill.length > 0 ? 'VALID' : 'INVALID',
    rows: withFill,
    maxOutputMw,
    aggregateOutputMw: withFill.reduce((sum, r) => sum + r.outputMw, 0),
    totalHeadroomMw: withFill.reduce((sum, r) => sum + r.headroomMw, 0),
    currentFrequencyHz,
    nominalFrequencyHz,
    onlineCount: withFill.filter((r) => r.status !== 'TRIPPED').length,
    trippedCount: withFill.filter((r) => r.status === 'TRIPPED').length,
  };
}
