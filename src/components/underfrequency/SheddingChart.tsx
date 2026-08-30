import { useMemo, type CSSProperties } from 'react';
import { buildUnderfrequencySheddingChartModel } from '../../presentation/underfrequencySheddingChart';
import type {
  UnderfrequencyStudyDefinition,
  UnderfrequencyTimelineRun,
} from '../../types/underfrequency';
import { formatEngineeringNumber } from '../../utils/engineering';
import './sheddingChart.css';

export interface SheddingChartProps {
  readonly uflsStages: UnderfrequencyStudyDefinition['uflsStages'];
  readonly baseLoadMw: number;
  readonly run: UnderfrequencyTimelineRun | null;
  readonly className?: string;
}

export function SheddingChart({ uflsStages, baseLoadMw, run, className = '' }: SheddingChartProps) {
  const model = useMemo(
    () => buildUnderfrequencySheddingChartModel(uflsStages, baseLoadMw, run),
    [uflsStages, baseLoadMw, run],
  );

  return (
    <section className={`underfrequency-shedding simulator-theme ${className}`.trim()} aria-label='UFLS shedding chart'>
      <header className='underfrequency-shedding-header'>
        <div className='underfrequency-shedding-heading'>
          <span>UFLS ladder</span>
          <h3>Load Shedding</h3>
        </div>
        <div className='underfrequency-shedding-summary' role='status' aria-live='polite' aria-atomic='true'>
          <span>{model.operatedCount} operated</span>
          <span>{formatEngineeringNumber(model.totalShedMw)} MW shed</span>
        </div>
      </header>

      {model.status === 'INVALID' ? (
        <div className='underfrequency-shedding-message' data-tone='danger' role='status'>
          <b>NO STAGES</b>
          <span>Konfigurasikan setidaknya satu UFLS stage yang enabled.</span>
        </div>
      ) : (
        <div className='underfrequency-shedding-ladder'>
          {model.bars.map((bar) => {
            const style = {
              '--shed-fill': `${Math.round(bar.shedFill * 100)}%`,
            } as CSSProperties;
            return (
              <div
                key={bar.stageId}
                className='underfrequency-shedding-stage'
                data-enabled={bar.enabled}
                data-operated={bar.operated}
                data-armed={bar.armed}
                style={style}
              >
                <div className='underfrequency-shedding-stage-label'>
                  <b>{bar.label}</b>
                  <span>
                    {bar.enabled ? `${bar.thresholdHz.toFixed(2)} Hz · ${formatEngineeringNumber(bar.shedMw)} MW` : 'DISABLED'}
                  </span>
                </div>
                <div className='underfrequency-shedding-stage-bar' aria-hidden='true'>
                  <span className='underfrequency-shedding-stage-fill' />
                </div>
                <div className='underfrequency-shedding-stage-rail'>
                  <span>{bar.enabled ? `${bar.shedFractionPct.toFixed(0)}% · ${bar.timeDelaySec.toFixed(2)} s` : '—'}</span>
                  <b>{bar.operated ? 'OPERATED' : bar.armed ? 'ARMED' : bar.enabled ? 'READY' : 'OFF'}</b>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
