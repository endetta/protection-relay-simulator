import { useMemo, type CSSProperties } from 'react';
import { buildUnderfrequencyGeneratorDiagramModel } from '../../presentation/underfrequencyGeneratorDiagram';
import type {
  UnderfrequencyStudyDefinition,
  UnderfrequencyTimelineSnapshot,
} from '../../types/underfrequency';
import { formatEngineeringNumber } from '../../utils/engineering';
import './generatorDiagram.css';

export interface GeneratorDiagramProps {
  readonly snapshot: UnderfrequencyTimelineSnapshot | null;
  readonly study: UnderfrequencyStudyDefinition;
  readonly className?: string;
}

function statusTone(status: UnderfrequencyTimelineSnapshot['generators'][number]['status']): 'success' | 'danger' | 'warning' {
  if (status === 'TRIPPED') return 'danger';
  if (status === 'AT_GOVERNOR_LIMIT') return 'warning';
  return 'success';
}

function statusLabel(status: UnderfrequencyTimelineSnapshot['generators'][number]['status']): string {
  if (status === 'TRIPPED') return 'TRIPPED';
  if (status === 'AT_GOVERNOR_LIMIT') return 'AT LIMIT';
  return 'ONLINE';
}

export function GeneratorDiagram({ snapshot, study, className = '' }: GeneratorDiagramProps) {
  const model = useMemo(() => {
    if (!snapshot) return null;
    return buildUnderfrequencyGeneratorDiagramModel(
      snapshot.generators,
      study.generators,
      snapshot.frequencyHz,
      study.system.fNominalHz,
    );
  }, [snapshot, study.generators, study.system.fNominalHz]);

  return (
    <section className={`underfrequency-gen-diagram simulator-theme ${className}`.trim()} aria-label='Generator response diagram'>
      <header className='underfrequency-gen-diagram-header'>
        <div className='underfrequency-gen-diagram-heading'>
          <span>Per-unit response</span>
          <h3>Generator Diagram</h3>
        </div>
        <div className='underfrequency-gen-diagram-summary' role='status' aria-live='polite' aria-atomic='true'>
          <span>Aggregate {model ? formatEngineeringNumber(model.aggregateOutputMw) : '—'} MW</span>
          <span>{model ? model.onlineCount : 0} online · {model ? model.trippedCount : 0} tripped</span>
        </div>
      </header>

      {!model || model.status === 'INVALID' ? (
        <div className='underfrequency-gen-diagram-message' data-tone='danger' role='status'>
          <b>NO SNAPSHOT</b>
          <span>Run the underfrequency study to see per-generator governor response.</span>
        </div>
      ) : (
        <div className='underfrequency-gen-diagram-rows'>
          {model.rows.map((row) => {
            const tone = statusTone(row.status);
            const style = {
              '--gen-output': `${Math.round(row.outputFill * 100)}%`,
              '--gen-response': `${Math.round(row.responseFill * 100)}%`,
            } as CSSProperties;
            return (
              <div
                key={row.generatorId}
                className='underfrequency-gen-diagram-row'
                data-status={row.status}
                data-tone={tone}
                style={style}
              >
                <div className='underfrequency-gen-row-identity'>
                  <b>{row.label}</b>
                  <span className='underfrequency-gen-row-tag' data-tone={tone}>{statusLabel(row.status)}</span>
                </div>

                <div className='underfrequency-gen-row-metric'>
                  <span>Output</span>
                  <b className='font-eng'>{formatEngineeringNumber(row.outputMw)} MW</b>
                </div>
                <div className='underfrequency-gen-row-bar' aria-hidden='true'>
                  <span className='underfrequency-gen-row-fill' />
                  <span className='underfrequency-gen-row-response' />
                </div>

                <div className='underfrequency-gen-row-metric'>
                  <span>Governor</span>
                  <b className='font-eng'>{row.saturated ? `${formatEngineeringNumber(row.governorResponseMw)} MW · SAT` : formatEngineeringNumber(row.governorResponseMw)} MW</b>
                </div>

                <div className='underfrequency-gen-row-stat'>
                  <span>RPM</span>
                  <b className='font-eng'>{formatEngineeringNumber(row.rpm)}</b>
                  <small>{row.poles} pole</small>
                </div>
                <div className='underfrequency-gen-row-stat'>
                  <span>Droop</span>
                  <b className='font-eng'>{formatEngineeringNumber(row.droopPu * 100)}%</b>
                  <small>H {formatEngineeringNumber(row.inertiaSec)} s</small>
                </div>
                <div className='underfrequency-gen-row-stat'>
                  <span>Headroom</span>
                  <b className='font-eng'>{formatEngineeringNumber(row.headroomMw)} MW</b>
                  <small>rated {formatEngineeringNumber(row.mwRated)}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
