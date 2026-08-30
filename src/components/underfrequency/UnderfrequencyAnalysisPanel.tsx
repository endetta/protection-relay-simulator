import { useMemo } from 'react';
import {
  buildUnderfrequencyAnalysisModel,
  type UnderfrequencyTone,
} from '../../presentation/underfrequencyAnalysis';
import type {
  UnderfrequencySimulatorState,
  UnderfrequencyStaticResult,
  UnderfrequencyTimelineRun,
} from '../../types/underfrequency';
import { formatEngineeringNumber } from '../../utils/engineering';
import { ParameterGroup, type ParameterGroupIntl } from '../shared/ParameterGroup';
import { SectionSummary, SummaryMetric } from '../shared/SectionSummary';
import './underfrequencyAnalysisPanel.css';

/** Indonesian collapse/expand titles for shared ParameterGroup in the analysis panel. */
const ANALYSIS_GROUP_INTL: ParameterGroupIntl = {
  hideTitle: (title) => `Ciutkan ${title}`,
  showTitle: (title) => `Bentangkan ${title}`,
};

export interface UnderfrequencyAnalysisPanelProps {
  readonly state: UnderfrequencySimulatorState;
  readonly staticResult: UnderfrequencyStaticResult | null;
  readonly run: UnderfrequencyTimelineRun | null;
  readonly inputDraftValid?: boolean;
  readonly className?: string;
  /** Controlled section open/close state — lifted to the page for collapse-all wiring. */
  readonly sections: Record<string, boolean>;
  /** Toggle a single section open/closed. */
  readonly setSections: (next: Record<string, boolean>) => void;
}

const TONE_TO_BADGE: Record<UnderfrequencyTone, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  normal: 'neutral',
};

/** Readable per-event labels for the raw engine event tokens (U01 § 8). */
const EVENT_LABELS: Record<string, string> = {
  DISTURBANCE_APPLIED: 'Disturbance applied',
  GOVERNOR_SATURATION: 'Governor saturated',
  GOVERNOR_UNSATURATION: 'Governor released',
  UFLS_ARMED: 'UFLS armed',
  UFLS_TIMER_RESET: 'UFLS timer reset',
  UFLS_TRIP: 'UFLS trip',
  STEADY_STATE_REACHED: 'Steady state reached',
  COLLAPSE: 'Collapse',
};

function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, ' ').toLowerCase();
}

function checkTone(status: 'PASS' | 'FAIL' | 'NOT_EVALUABLE'): 'success' | 'danger' | 'neutral' {
  if (status === 'PASS') return 'success';
  if (status === 'FAIL') return 'danger';
  return 'neutral';
}

export function UnderfrequencyAnalysisPanel({
  state,
  staticResult,
  run,
  inputDraftValid = true,
  className = '',
  sections,
  setSections,
}: UnderfrequencyAnalysisPanelProps) {
  const model = useMemo(
    () => buildUnderfrequencyAnalysisModel(state, staticResult, run),
    [state, staticResult, run],
  );

  const setOpen = (key: string, open: boolean) => setSections({ ...sections, [key]: open });
  const integratedInputInvalid = !inputDraftValid || model.status === 'INVALID';
  const showInvalidBanner = integratedInputInvalid && inputDraftValid;
  const displayedHeadline = !inputDraftValid
    ? { label: 'INPUT INVALID / OUTPUT HELD', detail: 'Perbaiki draf parameter yang tidak valid sebelum melanjutkan.', tone: 'warning' as const }
    : model.headline;

  return (
    <aside className={`underfrequency-analysis-panel simulator-theme ${className}`.trim()} aria-label='Analisis dan pembelajaran Underfrequency' role='region'>
      {showInvalidBanner && (
        <div className='underfrequency-analysis-invalid' role='status' aria-live='assertive' aria-atomic='true'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>{model.issues[0]?.detail ?? 'Perbaiki input engineering yang tidak valid sebelum melanjutkan.'}</span>
        </div>
      )}

      <ParameterGroup
        title='Status Relay / System'
        open={sections.status}
        onOpenChange={(open) => setOpen('status', open)}
        badge={displayedHeadline.label}
        badgeTone={TONE_TO_BADGE[displayedHeadline.tone]}
        intl={ANALYSIS_GROUP_INTL}
        summary={(
          <SectionSummary columns={1}>
            <SummaryMetric label='Status' value={<span className='font-eng'>{displayedHeadline.label}</span>} tone={TONE_TO_BADGE[displayedHeadline.tone]} sublabel={displayedHeadline.detail} />
          </SectionSummary>
        )}
      >
        <div className='underfrequency-analysis-empty'>{displayedHeadline.detail}</div>
      </ParameterGroup>

      {model.summaryTiles.length > 0 && (
        <ParameterGroup
          title='Ringkasan'
          open={sections.summary}
          onOpenChange={(open) => setOpen('summary', open)}
          badge={`${model.summaryTiles.length} TILES`}
          badgeTone='info'
          intl={ANALYSIS_GROUP_INTL}
          summary={(
            <SectionSummary columns={1}><SummaryMetric label='Headline' value={model.headline.label} tone={TONE_TO_BADGE[model.headline.tone]} /></SectionSummary>
          )}
        >
          <div className='underfrequency-analysis-tiles'>
            {model.summaryTiles.map((tile) => (
              <div key={tile.id} data-tone={TONE_TO_BADGE[tile.tone]}>
                <span>{tile.label}</span>
                <b className='font-eng'>{tile.value}</b>
              </div>
            ))}
          </div>
        </ParameterGroup>
      )}

      {model.studyLabel && (
        <ParameterGroup
          title='Studi'
          open={sections.study}
          onOpenChange={(open) => setOpen('study', open)}
          badge={model.displayStatus}
          badgeTone={model.displayStatus === 'OPERATE' ? 'danger' : model.displayStatus === 'RESTRAIN' ? 'success' : 'warning'}
          intl={ANALYSIS_GROUP_INTL}
          summary={(
            <SectionSummary columns={1}>
              <SummaryMetric label='Preset' value={model.studyLabel} />
            </SectionSummary>
          )}
        >
          <p className='underfrequency-analysis-description'>{model.studyDescription}</p>
          {model.plnVerificationRequired && (
            <p className='underfrequency-analysis-pln'>
              <b>PLN STANDARD — NOT VERIFIED</b>
              <span>{model.sourceNote ?? 'Praktik umum; menunggu verifikasi grid-code resmi.'}</span>
            </p>
          )}
        </ParameterGroup>
      )}

      <ParameterGroup
        title='Pemeriksaan'
        open={sections.checks}
        onOpenChange={(open) => setOpen('checks', open)}
        defaultOpen={false}
        badge={model.checks.some((c) => c.status === 'FAIL') ? 'FAIL' : model.checks.length ? 'PASS' : '—'}
        badgeTone={model.checks.some((c) => c.status === 'FAIL') ? 'danger' : model.checks.length ? 'success' : 'neutral'}
        intl={ANALYSIS_GROUP_INTL}
        summary={(
          <SectionSummary columns={1}><SummaryMetric label='Pemeriksaan' value={model.checks.length} /></SectionSummary>
        )}
      >
        <div className='underfrequency-analysis-checks'>
          {model.checks.map((check) => (
            <div key={check.id} data-tone={checkTone(check.status)}>
              <span>{check.label}</span>
              <b>{check.status}</b>
              <small>{check.detail}</small>
            </div>
          ))}
        </div>
      </ParameterGroup>

      {model.phases.length > 0 && (
        <ParameterGroup
          title='Tahapan Operasi'
          open={sections.phases}
          onOpenChange={(open) => setOpen('phases', open)}
          defaultOpen={false}
          badge={`${model.phases.length} PHASES`}
          badgeTone='info'
          intl={ANALYSIS_GROUP_INTL}
          summary={(
            <SectionSummary columns={1}><SummaryMetric label='Tahapan' value={model.phases.length} /></SectionSummary>
          )}
        >
          <ol className='underfrequency-analysis-phases'>
            {model.phases.map((phase) => (
              <li key={phase.id} data-tone={TONE_TO_BADGE[phase.tone]}>
                <time className='font-eng'>{formatEngineeringNumber(phase.timeSec)} s</time>
                <b>{phase.label}</b>
                <span>{phase.narrative}</span>
              </li>
            ))}
          </ol>
        </ParameterGroup>
      )}

      {model.calculationDetails.length > 0 && (
        <ParameterGroup
          title='Detail Perhitungan'
          open={sections.calculation}
          onOpenChange={(open) => setOpen('calculation', open)}
          defaultOpen={false}
          intl={ANALYSIS_GROUP_INTL}
          summary={(
            <SectionSummary columns={1}><SummaryMetric label='Detail' value={model.calculationDetails.length} /></SectionSummary>
          )}
        >
          <div className='underfrequency-analysis-calculation'>
            {model.calculationDetails.map((detail) => <code key={detail}>{detail}</code>)}
          </div>
        </ParameterGroup>
      )}

      {model.events.length > 0 && (
        <ParameterGroup
          title='Peristiwa'
          open={sections.events}
          onOpenChange={(open) => setOpen('events', open)}
          defaultOpen={false}
          badge={String(model.events.length)}
          intl={ANALYSIS_GROUP_INTL}
          summary={(
            <SectionSummary columns={1}><SummaryMetric label='Peristiwa tercatat' value={model.events.length} /></SectionSummary>
          )}
        >
          <div className='underfrequency-analysis-events'>
            {model.events.map((event) => (
              <div key={event.id}>
                <span className='font-eng'>{formatEngineeringNumber(event.timeSec)} s</span>
                <b>{eventLabel(event.type)}</b>
                <small>{event.stageId ?? event.generatorId ?? ''}{event.shedMw != null ? ` · ${formatEngineeringNumber(event.shedMw)} MW` : ''}</small>
              </div>
            ))}
          </div>
        </ParameterGroup>
      )}
    </aside>
  );
}
