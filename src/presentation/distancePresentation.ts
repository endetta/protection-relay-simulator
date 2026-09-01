/**
 * Distance Relay presentation models (D04-D05).
 *
 * Pure-presentation transforms of engine output into render-ready
 * coordinates for the SLD and RX plane. No relay/coordinate math
 * here — only clipping and layout.
 */

import type {
  DistanceDeviceSettings,
  DistanceDisplayStatus,
  DistanceOperatingResult,
  DistanceQuadrilateralSettings,
  DistanceSchemeType,
  DistanceTopologyId,
  DistanceZoneId,
  DistanceZoneSettings,
} from '../types/distance';

// ──────────────────────── SLD layout (D04) ────────────────────────────────

export interface SldBusLayout {
  readonly id: string;
  readonly label: string;
  /** Normalised X coordinate in [0, 1]. */
  readonly xNorm: number;
}

export interface SldRelayLayout {
  readonly id: string;
  readonly busId: string;
  /** Direction the relay faces. */
  readonly facing: 'forward' | 'reverse';
  readonly label: string;
  /** Normalised X coordinate in [0, 1]. */
  readonly xNorm: number;
}

export interface SldLineLayout {
  readonly id: string;
  readonly fromBusId: string;
  readonly toBusId: string;
  /** Normalised Y coordinate (single-row layouts only). */
  readonly yNorm: number;
  readonly lengthKm: number;
}

export interface SldTappedLoadLayout {
  readonly busId: string;
  readonly label: string;
  readonly xNorm: number;
  readonly yNorm: number;
}

export interface SldSchemeLink {
  readonly fromRelayId: string;
  readonly toRelayId: string;
  readonly scheme: DistanceSchemeType;
}

export interface SldLayout {
  readonly topology: DistanceTopologyId;
  readonly buses: readonly SldBusLayout[];
  readonly relays: readonly SldRelayLayout[];
  readonly lines: readonly SldLineLayout[];
  readonly tappedLoads: readonly SldTappedLoadLayout[];
  readonly schemeLink: SldSchemeLink | null;
}

/**
 * Build the SLD layout for the active topology. Pure function of
 * (topology, scheme); engine output is not consumed here.
 */
export function buildSldLayout(topology: DistanceTopologyId, scheme: DistanceSchemeType): SldLayout {
  switch (topology) {
    case 'SINGLE_ENDED':
      return {
        topology,
        buses: [
          { id: 'bus-local', label: 'Local Bus', xNorm: 0.15 },
          { id: 'bus-remote', label: 'Remote Bus', xNorm: 0.85 },
        ],
        relays: [{ id: 'relay-local', busId: 'bus-local', facing: 'forward', label: '21', xNorm: 0.15 }],
        lines: [{ id: 'line-1', fromBusId: 'bus-local', toBusId: 'bus-remote', yNorm: 0.5, lengthKm: 100 }],
        tappedLoads: [],
        schemeLink: null,
      };
    case 'DOUBLE_ENDED':
      return {
        topology,
        buses: [
          { id: 'bus-a', label: 'Source A', xNorm: 0.1 },
          { id: 'bus-b', label: 'Source B', xNorm: 0.9 },
        ],
        relays: [
          { id: 'relay-a', busId: 'bus-a', facing: 'forward', label: '21A', xNorm: 0.1 },
          { id: 'relay-b', busId: 'bus-b', facing: 'reverse', label: '21B', xNorm: 0.9 },
        ],
        lines: [{ id: 'line-1', fromBusId: 'bus-a', toBusId: 'bus-b', yNorm: 0.5, lengthKm: 100 }],
        tappedLoads: [],
        schemeLink: scheme !== 'NONE' ? { fromRelayId: 'relay-a', toRelayId: 'relay-b', scheme } : null,
      };
    case 'TAPPED':
      return {
        topology,
        buses: [
          { id: 'bus-local', label: 'Local Bus', xNorm: 0.1 },
          { id: 'bus-remote', label: 'Remote Bus', xNorm: 0.9 },
        ],
        relays: [{ id: 'relay-local', busId: 'bus-local', facing: 'forward', label: '21', xNorm: 0.1 }],
        lines: [{ id: 'line-1', fromBusId: 'bus-local', toBusId: 'bus-remote', yNorm: 0.5, lengthKm: 100 }],
        tappedLoads: [{ busId: 'tapped-1', label: 'Tapped Load', xNorm: 0.5, yNorm: 0.5 }],
        schemeLink: null,
      };
  }
}

// ──────────────────────── RX plane layout (D05) ───────────────────────────

export interface RxZonePath {
  readonly zoneId: DistanceZoneId;
  readonly enabled: boolean;
  /** SVG path string (M… A… format for mho, M… L… Z for quad). */
  readonly pathD: string;
  readonly strokePattern: 'solid' | 'dashed' | 'dotted';
  readonly strokeColor: string;
  readonly opacity: number;
}

export interface RxLoadRegion {
  readonly enabled: boolean;
  /** Path string for the load slope line (left to right edge). */
  readonly slopePath: string;
  /** Path string for the vertical R_min cutoff. */
  readonly rMinPath: string;
}

export interface RxOperatingPoint {
  readonly r: number;
  readonly x: number;
  readonly inDomain: boolean;
  readonly fillColor: string;
}

export interface RxPreFaultPoint {
  readonly r: number;
  readonly x: number;
  readonly fillColor: string;
}

export interface RxTrajectory {
  readonly pathD: string;
  readonly strokeColor: string;
}

export interface RxPlaneLayout {
  readonly domainHalfOhm: number;
  readonly zones: readonly RxZonePath[];
  readonly loadLine: RxLoadRegion | null;
  readonly faultPoint: RxOperatingPoint;
  readonly preFaultPoint: RxPreFaultPoint | null;
  readonly trajectory: RxTrajectory | null;
}

/** Generate the SVG arc path for a mho circle (diameter from origin). */
export function buildMhoPath(zone: DistanceZoneSettings, domainHalfOhm: number): string {
  if (!zone.enabled || zone.reachOhmSecondary <= 0 || !Number.isFinite(zone.reachOhmSecondary)) {
    return '';
  }
  const reach = zone.reachOhmSecondary;
  const theta = (zone.thetaCharDeg * Math.PI) / 180;
  const r = reach / 2;
  const x0 = 0;
  const y0 = 0;
  const x1 = reach * Math.cos(theta);
  const y1 = reach * Math.sin(theta);
  const clamp = (v: number) => Math.max(-domainHalfOhm, Math.min(domainHalfOhm, v));
  return `M ${clamp(x0)} ${-clamp(y0)} A ${r} ${r} 0 0 1 ${clamp(x1)} ${-clamp(y1)}`;
}

/** Generate the SVG polygon path for a quadrilateral zone. */
export function buildQuadrilateralPath(
  quad: DistanceQuadrilateralSettings,
  zone: DistanceZoneSettings,
  domainHalfOhm: number,
): string {
  if (!zone.enabled) return '';
  // The engine decides containment with `zReach = zone.reachOhmSecondary`
  // (per zone), so the drawn polygon MUST use the same per-zone reach —
  // using the single shared `quad.zReachOhmSecondary` would make every
  // zone's drawing identical and out of sync with the trip decision.
  const zReach = zone.reachOhmSecondary;
  if (!Number.isFinite(zReach) || zReach <= 0) return '';
  const alphaRad = (quad.alphaDeg * Math.PI) / 180;
  const betaRad = (quad.betaDeg * Math.PI) / 180;
  const clamp = (v: number) => Math.max(-domainHalfOhm, Math.min(domainHalfOhm, v));
  const points: Array<[number, number]> = [
    [0, 0],
    [zReach, 0],
    [zReach, zReach * Math.tan(betaRad)],
    [0, zReach * Math.tan(alphaRad)],
  ];
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${clamp(x)} ${-clamp(y)}`).join(' ') + ' Z';
}

/**
 * Build the load-encroachment boundary paths. The load region per the
 * engine is `R ≥ R_min AND X ≥ tan(θ_load)·R`, so the boundary is two
 * strokes: the inclined slope line (full width) and the vertical R_min
 * cutoff below it. Returned as two path strings; either may be empty.
 */
export function buildLoadLinePaths(
  rMinLoad: number,
  thetaLoadDeg: number,
  domainHalfOhm: number,
): { slopePath: string; rMinPath: string } {
  if (!Number.isFinite(thetaLoadDeg) || thetaLoadDeg < 0 || thetaLoadDeg > 90) {
    return { slopePath: '', rMinPath: '' };
  }
  const slope = Math.tan((thetaLoadDeg * Math.PI) / 180);
  const clamp = (v: number) => Math.max(-domainHalfOhm, Math.min(domainHalfOhm, v));
  const slopePath = `M ${-domainHalfOhm} ${clamp(slope * domainHalfOhm)} L ${domainHalfOhm} ${clamp(-slope * domainHalfOhm)}`;
  const rMinPath =
    Number.isFinite(rMinLoad) && rMinLoad > 0
      ? `M ${clamp(rMinLoad)} ${-domainHalfOhm} L ${clamp(rMinLoad)} ${clamp(-slope * rMinLoad)}`
      : '';
  return { slopePath, rMinPath };
}

/** Build the full RX-plane layout from engine output + settings. */
export function buildRxPlaneLayout(
  result: DistanceOperatingResult,
  settings: DistanceDeviceSettings,
  domainHalfOhm: number,
): RxPlaneLayout {
  const useQuad = settings.characteristicType === 'QUADRILATERAL';
  const zones: RxZonePath[] = [
    {
      zoneId: 'Z1',
      enabled: settings.zone1.enabled,
      pathD: useQuad
        ? buildQuadrilateralPath(settings.quadrilateral, settings.zone1, domainHalfOhm)
        : buildMhoPath(settings.zone1, domainHalfOhm),
      strokePattern: 'solid',
      strokeColor: 'var(--sim-green)',
      opacity: 0.85,
    },
    {
      zoneId: 'Z2',
      enabled: settings.zone2.enabled,
      pathD: useQuad
        ? buildQuadrilateralPath(settings.quadrilateral, settings.zone2, domainHalfOhm)
        : buildMhoPath(settings.zone2, domainHalfOhm),
      strokePattern: 'dashed',
      strokeColor: 'var(--sim-accent)',
      opacity: 0.7,
    },
    {
      zoneId: 'Z3',
      enabled: settings.zone3.enabled,
      pathD: useQuad
        ? buildQuadrilateralPath(settings.quadrilateral, settings.zone3, domainHalfOhm)
        : buildMhoPath(settings.zone3, domainHalfOhm),
      strokePattern: 'dotted',
      strokeColor: 'var(--sim-text-muted)',
      opacity: 0.6,
    },
  ];

  const loadLine: RxLoadRegion | null = settings.loadEncroachment.enabled
    ? {
        enabled: true,
        ...buildLoadLinePaths(
          settings.loadEncroachment.rMinLoadOhmSecondary,
          settings.loadEncroachment.thetaLoadDeg,
          domainHalfOhm,
        ),
      }
    : null;

  const inDomain =
    Number.isFinite(result.impedance.rOhmSecondary) &&
    Number.isFinite(result.impedance.xOhmSecondary) &&
    Math.abs(result.impedance.rOhmSecondary) <= domainHalfOhm &&
    Math.abs(result.impedance.xOhmSecondary) <= domainHalfOhm;

  const faultPoint: RxOperatingPoint = {
    r: Number.isFinite(result.impedance.rOhmSecondary) ? result.impedance.rOhmSecondary : 0,
    x: Number.isFinite(result.impedance.xOhmSecondary) ? result.impedance.xOhmSecondary : 0,
    inDomain,
    fillColor: result.displayStatus === 'OPERATE'
      ? 'var(--sim-red)'
      : result.displayStatus === 'INVALID'
        ? 'var(--sim-amber)'
        : result.loadRegion
          ? 'var(--sim-amber)'
          : 'var(--sim-green)',
  };

  return {
    domainHalfOhm,
    zones,
    loadLine,
    faultPoint,
    preFaultPoint: null,
    trajectory: null,
  };
}

// ──────────────────────── Display helpers ─────────────────────────────────

export function displayStatusLabel(status: DistanceDisplayStatus): string {
  switch (status) {
    case 'OPERATE':
      return 'TRIP';
    case 'RESTRAIN':
      return 'NO TRIP';
    case 'INVALID':
      return 'INPUT INVALID';
  }
}

export function schemeLabel(scheme: DistanceSchemeType): string {
  switch (scheme) {
    case 'NONE':
      return 'Direct (no scheme)';
    case 'PUTT':
      return 'PUTT — Permissive Underreach Transfer Trip';
    case 'POTT':
      return 'POTT — Permissive Overreach Transfer Trip';
    case 'DCB':
      return 'DCB — Directional Comparison Blocking';
    case 'DTT':
      return 'DTT — Direct Transfer Trip';
  }
}

export function topologyLabel(topology: DistanceTopologyId): string {
  switch (topology) {
    case 'SINGLE_ENDED':
      return 'Single-Ended';
    case 'DOUBLE_ENDED':
      return 'Double-Ended (forward-reverse)';
    case 'TAPPED':
      return 'Tapped Load';
  }
}
