import type { DistanceOperatingResult } from '../../types/distance';
import { Metric } from '../shared/Metric';
import { ParameterGroup } from '../shared/ParameterGroup';

/**
 * Distance Relay Analysis panel (D06).
 *
 * Reads a pre-computed `DistanceOperatingResult`; never recomputes
 * relay math. Follows the Differential R10 / Overcurrent O12
 * hierarchy: zone evaluation, trip state, impedance detail, and a
 * compact zone-timing summary.
 */

export interface DistanceAnalysisPanelProps {
  readonly result: DistanceOperatingResult;
  readonly faultPct: number;
  readonly lineLengthKm: number;
}

export function DistanceAnalysisPanel({ result, faultPct, lineLengthKm }: DistanceAnalysisPanelProps) {
  const statusTone = result.displayStatus === 'OPERATE' ? 'operate' as const : result.displayStatus === 'INVALID' ? 'warning' as const : 'restrain' as const;
  const z1 = result.zones.find((z) => z.zoneId === 'Z1');
  const z2 = result.zones.find((z) => z.zoneId === 'Z2');
  const z3 = result.zones.find((z) => z.zoneId === 'Z3');

  return (
    <div className='flex flex-col gap-2'>
      <ParameterGroup title='Relay Status' defaultOpen={true}>
        <div className='flex flex-col gap-1.5'>
          <Metric label='Display Status' value={result.displayStatus} tone={statusTone} />
          <Metric label='Trip Zone' value={result.tripZone ?? '—'} />
          <Metric
            label='Trip Reason'
            value={
              result.tripReason === 'ZONE1_INSTANT' ? 'Z1 INST'
              : result.tripReason === 'ZONE2_TIMED' ? 'Z2 TIMED'
              : result.tripReason === 'ZONE3_TIMED' ? 'Z3 TIMED'
              : '—'
            }
            tone={result.tripZone ? 'operate' : 'normal'}
          />
          <Metric label='Load Region' value={result.loadRegion ? 'SUPPRESSED' : 'CLEAR'} tone={result.loadRegion ? 'warning' : 'normal'} />
        </div>
      </ParameterGroup>

      <ParameterGroup title='Apparent Impedance' defaultOpen={true}>
        <div className='flex flex-col gap-1.5'>
          <Metric label='|Z|' value={Number.isFinite(result.impedance.magnitudeOhmSecondary) ? `${result.impedance.magnitudeOhmSecondary.toFixed(2)} Ω sec` : '—'} />
          <Metric label='R' value={Number.isFinite(result.impedance.rOhmSecondary) ? `${result.impedance.rOhmSecondary.toFixed(2)} Ω sec` : '—'} />
          <Metric label='X' value={Number.isFinite(result.impedance.xOhmSecondary) ? `${result.impedance.xOhmSecondary.toFixed(2)} Ω sec` : '—'} />
          <Metric label='Angle' value={Number.isFinite(result.impedance.angleDeg) ? `${result.impedance.angleDeg.toFixed(1)}°` : '—'} />
          <Metric label='Fault Location' value={`${faultPct.toFixed(0)}% of ${lineLengthKm.toFixed(0)} km`} />
        </div>
      </ParameterGroup>

      <ParameterGroup title='Zone Evaluation' defaultOpen={true}>
        <div className='flex flex-col gap-1.5'>
          {z1 && <Metric label='Z1 (instant)' value={z1.inZone ? `IN ZONE · ${z1.timeToTripSec === 0 ? 'INST' : (z1.timeToTripSec?.toFixed(1) ?? '…') + 's'}` : 'NOT IN ZONE'} tone={z1.inZone ? 'operate' : 'normal'} />}
          {z2 && <Metric label='Z2 (timed)' value={z2.inZone ? `IN ZONE · ${z2.timeToTripSec === 0 ? 'INST' : (z2.timeToTripSec?.toFixed(1) ?? '…') + ' s'}` : 'NOT IN ZONE'} tone={z2.inZone ? 'operate' : 'normal'} />}
          {z3 && <Metric label='Z3 (backup)' value={z3.inZone ? `IN ZONE · ${z3.timeToTripSec === 0 ? 'INST' : (z3.timeToTripSec?.toFixed(1) ?? '…') + ' s'}` : 'NOT IN ZONE'} tone={z3.inZone ? 'operate' : 'normal'} />}
        </div>
      </ParameterGroup>

      {result.loadRegion && (
        <div className='rounded border border-[color:var(--sim-amber-border)] bg-[color:var(--sim-amber-bg)] px-3 py-2 text-[11px] text-[color:var(--sim-amber)]'>
          Apparent impedance is inside the load-encroachment region. All zones suppressed.
        </div>
      )}
    </div>
  );
}
