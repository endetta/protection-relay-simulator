import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { buildOvercurrentAnalysisModel } from '../../presentation/overcurrentAnalysis';
import { buildOvercurrentGuidedChallengeModel } from '../../presentation/overcurrentGuidedChallenge';
import type { TimelineSnapshot } from '../../types/overcurrent';
import { formatEngineeringNumber } from '../../utils/engineering';
import type { OvercurrentParameterAction, OvercurrentParameterState } from '../../utils/overcurrentState';
import { GuidedChallengeCard } from './GuidedChallengeCard';
import { ParameterGroup } from '../shared/ParameterGroup';
import { SectionSummary, SummaryMetric } from '../shared/SectionSummary';
import './overcurrentAnalysisPanel.css';

export interface OvercurrentAnalysisPanelProps {
  readonly state: OvercurrentParameterState;
  readonly dispatch: Dispatch<OvercurrentParameterAction>;
  readonly timelineSnapshot?: TimelineSnapshot | null;
  /** O15 page integration: invalid local numeric drafts hold the last valid engineering output. */
  readonly inputDraftValid?: boolean;
  readonly onDeviceFocus?: (deviceId: string) => void;
  readonly className?: string;
  /** Controlled section open/close state — lifted to the page for collapse-all wiring. */
  readonly sections: Record<string, boolean>;
  /** Toggle a single section open/closed. */
  readonly setSections: Dispatch<SetStateAction<Record<string, boolean>>>;
}


function numberText(value: number | null, unit = 's'): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${formatEngineeringNumber(value)} ${unit}`;
}

function statusTone(status: 'PASS' | 'FAIL' | 'NOT_EVALUABLE'): 'success' | 'danger' | 'neutral' {
  if (status === 'PASS') return 'success';
  if (status === 'FAIL') return 'danger';
  return 'neutral';
}

const HEADLINE_TO_BADGE: Record<'success' | 'danger' | 'warning' | 'info' | 'normal', 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  normal: 'neutral',
};

export function OvercurrentAnalysisPanel({
  state,
  dispatch,
  timelineSnapshot = null,
  inputDraftValid = true,
  onDeviceFocus,
  className = '',
  sections,
  setSections,
}: OvercurrentAnalysisPanelProps) {
  const model = useMemo(() => buildOvercurrentAnalysisModel(state, timelineSnapshot), [state, timelineSnapshot]);
  const challenge = useMemo(() => buildOvercurrentGuidedChallengeModel(state), [state]);

  const setOpen = (key: string, open: boolean) => setSections((current) => ({ ...current, [key]: open }));
  const integratedInputInvalid = !inputDraftValid || model.status === 'INVALID';
  // When the page-level banner is already shown (inputDraftValid === false),
  // suppress the duplicate Analysis invalid banner to avoid Gestalt similarity collision.
  const showAnalysisInvalidBanner = integratedInputInvalid && inputDraftValid;
  const displayedHeadline = !inputDraftValid
    ? { label: 'INPUT INVALID / OUTPUT HELD', detail: 'Correct the invalid parameter draft before continuing.', tone: 'warning' as const }
    : model.headline;

  return (
    <aside className={`overcurrent-analysis-panel simulator-theme ${className}`.trim()} aria-label='Overcurrent analysis and learning' role='region'>
      {showAnalysisInvalidBanner && (
        <div className='overcurrent-analysis-invalid' role='status' aria-live='assertive' aria-atomic='true'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>{!inputDraftValid ? 'Correct the invalid parameter draft before validation.' : model.issues[0]?.detail ?? 'Correct invalid engineering input before continuing.'}</span>
        </div>
      )}

      <ParameterGroup
        title='Relay / Coordination Status'
        open={sections.status}
        onOpenChange={(open) => setOpen('status', open)}
        badge={displayedHeadline.label}
        badgeTone={HEADLINE_TO_BADGE[displayedHeadline.tone]}
        summary={<SectionSummary columns={1}><SummaryMetric label='Status' value={<span className='font-eng'>{displayedHeadline.label}</span>} tone={HEADLINE_TO_BADGE[displayedHeadline.tone]} sublabel={displayedHeadline.detail} /></SectionSummary>}
      >
        {state.studyMode === 'COORDINATION_LAB' ? (
          <div className='overcurrent-validation-state'>
            <span>RUN-ALL VALIDATION</span>
            <b>{state.validationState.status}</b>
            {state.validationState.status === 'COMPLETE' && (
              <small>{state.validationState.audit.passedCaseCount} / {state.validationState.audit.totalCaseCount} configured cases passed</small>
            )}
          </div>
        ) : (
          <div className='overcurrent-analysis-empty'>{displayedHeadline.detail}</div>
        )}
      </ParameterGroup>

      <GuidedChallengeCard
        model={challenge}
        dispatch={dispatch}
        validationDisabled={state.playbackState === 'RUNNING' || state.playbackState === 'PAUSED' || integratedInputInvalid}
      />

      {state.topology.deviceIds.length > 1 && (
        <ParameterGroup
          title='Operating Order'
          open={sections.order}
          onOpenChange={(open) => setOpen('order', open)}
          badge={model.operatingOrder.length > 0 ? `${model.operatingOrder.length} RELAYS` : '—'}
          summary={<SectionSummary columns={1}><SummaryMetric label='First' value={model.operatingOrder[0]?.deviceLabel ?? '—'} /></SectionSummary>}
        >
          <div className='overcurrent-analysis-table'>
            {model.operatingOrder.map((row, index) => (
              <button
                key={row.deviceId}
                type='button'
                data-selected={state.selectedDeviceId === row.deviceId}
                aria-pressed={state.selectedDeviceId === row.deviceId}
                onClick={() => {
                  dispatch({ type: 'SELECT_DEVICE', deviceId: row.deviceId });
                  onDeviceFocus?.(row.deviceId);
                }}
              >
                <span className='font-eng'>{String(index + 1).padStart(2, '0')}</span>
                <b>{row.deviceLabel}</b>
                <small>{row.role === 'BACKUP' ? `BACKUP ${row.backupOrder ?? ''}` : row.role}</small>
                <em className='font-eng'>{row.selectedElement ?? '—'} · {numberText(row.tripTimeSec)}</em>
              </button>
            ))}
            {model.operatingOrder.length === 0 && <div className='overcurrent-analysis-empty'>No active operating order.</div>}
          </div>
        </ParameterGroup>
      )}

      {state.studyMode === 'COORDINATION_LAB' && (
        <ParameterGroup
          title='Coordination Audit'
          open={sections.audit}
          onOpenChange={(open) => setOpen('audit', open)}
          badge={model.violations.length ? `${model.violations.length} FAIL` : model.checks.length ? 'PASS' : '—'}
          badgeTone={model.violations.length ? 'danger' : model.checks.length ? 'success' : 'neutral'}
          summary={<SectionSummary columns={1}><SummaryMetric label='Status' value={model.violations.length ? 'VIOLATIONS' : model.checks.length ? 'CLEAR' : '—'} /></SectionSummary>}
        >
          {model.violations.length > 0 && (
            <>
              {model.worstCaseLabel && <div className='overcurrent-worst-case'><span>WORST CONFIGURED CASE</span><b className='font-eng'>{model.worstCaseLabel}</b></div>}
              <div className='overcurrent-violation-list'>
                {model.violations.map((violation) => (
                  <div key={violation.key} data-tone={violation.tone}>
                    <b>{violation.title}</b>
                    <span>{violation.detail}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {model.violations.length === 0 && model.worstCaseLabel && <div className='overcurrent-worst-case'><span>WORST CONFIGURED CASE</span><b className='font-eng'>{model.worstCaseLabel}</b></div>}

          {model.checks.length > 0 && (
            <div className='overcurrent-check-grid'>
              {model.checks.map((check) => (
                <div key={check.dimension} data-tone={statusTone(check.status)}>
                  <span>{check.label}</span>
                  <b>{check.status}</b>
                  <small>{check.violationCount ? `${check.violationCount} violation${check.violationCount === 1 ? '' : 's'}` : 'No violation'}</small>
                </div>
              ))}
            </div>
          )}

          {model.coordinationMargins.length > 0 && (
            <>
              <div className='overcurrent-analysis-subhead'>Coordination Margins</div>
              <div className='overcurrent-margin-list'>
                {model.coordinationMargins.map((row) => (
                  <div key={row.pairId} data-status={row.status}>
                    <span><b>{row.primaryLabel}</b> → <b>{row.backupLabel}</b></span>
                    <span className='font-eng'>Δt {numberText(row.observedCtiSec)} / {numberText(row.requiredCtiSec)}</span>
                    <em>{row.status}</em>
                  </div>
                ))}
              </div>
            </>
          )}
        </ParameterGroup>
      )}

      <ParameterGroup
        title='Relay Current / Current Multiple'
        open={sections.measurement}
        onOpenChange={(open) => setOpen('measurement', open)}
        summary={<SectionSummary columns={1}><SummaryMetric label='Selected' value={model.measurements.find((item) => item.deviceId === state.selectedDeviceId)?.deviceLabel ?? '—'} /></SectionSummary>}
      >
        <div className='overcurrent-analysis-measurements'>
          {model.measurements.map((row) => (
            <button
              key={row.deviceId}
              type='button'
              data-selected={state.selectedDeviceId === row.deviceId}
              aria-pressed={state.selectedDeviceId === row.deviceId}
              onClick={() => {
                dispatch({ type: 'SELECT_DEVICE', deviceId: row.deviceId });
                onDeviceFocus?.(row.deviceId);
              }}
            >
              <b>{row.deviceLabel}</b>
              <span className='font-eng'>{formatEngineeringNumber(row.primaryCurrentA)} A pri</span>
              <span className='font-eng'>{formatEngineeringNumber(row.relayCurrentASecondary)} A sec</span>
              <span className='font-eng'>M {row.currentMultiple === null ? '—' : formatEngineeringNumber(row.currentMultiple)}</span>
            </button>
          ))}
        </div>
      </ParameterGroup>

      {model.settingImpacts.length > 0 && (
        <ParameterGroup
          title="Setting Impact"
          open={sections.impact}
          onOpenChange={(open) => setOpen('impact', open)}
          badge={`${model.settingImpacts.length} CHANGE${model.settingImpacts.length === 1 ? '' : 'S'}`}
          badgeTone="info"
          summary={<SectionSummary columns={1}><SummaryMetric label="Changed settings" value={<span className='font-eng'>{String(model.settingImpacts.length)}</span>} /></SectionSummary>}
        >
          {model.comparison && (
            <div className="overcurrent-analysis-comparison">
              <span>INITIAL → CURRENT</span>
              <div><small>Violations</small><b className="font-eng">{model.comparison.initialViolations} → {model.comparison.currentViolations}</b></div>
              <div><small>Cases passed</small><b className="font-eng">{model.comparison.initialPassedCases}/{model.comparison.totalCases} → {model.comparison.currentPassedCases}/{model.comparison.totalCases}</b></div>
              <div><small>Worst CTI surplus</small><b className="font-eng">{numberText(model.comparison.initialWorstCtiSurplusSec)} → {numberText(model.comparison.currentWorstCtiSurplusSec)}</b></div>
            </div>
          )}
          <div className="overcurrent-impact-list">
            {model.settingImpacts.map((impact) => (
              <div key={impact.key}>
                <span>{impact.parameter}</span>
                <b className="font-eng">{impact.before} → {impact.after}</b>
                <small><strong>Affects</strong> {impact.affects.join(' · ')}</small>
                <small><strong>Unchanged</strong> {impact.unchanged.join(' · ')}</small>
              </div>
            ))}
          </div>
        </ParameterGroup>
      )}

      {state.topology.deviceIds.length > 1 && (
        <ParameterGroup
          title="Calculation Details"
          open={sections.calculation}
          onOpenChange={(open) => setOpen('calculation', open)}
          defaultOpen={false}
          summary={<SectionSummary columns={1}><SummaryMetric label="Relay traces" value={<span className='font-eng'>{String(model.calculationDetails.length)}</span>} /></SectionSummary>}
        >
          <div className="overcurrent-calculation-list">
            {model.calculationDetails.map((detail) => <code key={detail}>{detail}</code>)}
          </div>
        </ParameterGroup>
      )}

      {model.events.length > 0 && (
        <ParameterGroup
          title='Events'
          open={sections.events}
          onOpenChange={(open) => setOpen('events', open)}
          defaultOpen={false}
          badge={String(model.events.length)}
          summary={<SectionSummary columns={1}><SummaryMetric label='Recorded events' value={<span className='font-eng'>{String(model.events.length)}</span>} /></SectionSummary>}
        >
          <div className='overcurrent-analysis-events'>
            {model.events.map((event) => (
              <div key={event.id}>
                <span className='font-eng'>{formatEngineeringNumber(event.timeSec)} s</span>
                <b>{event.type.replace(/_/g, ' ')}</b>
                <small>{'deviceId' in event ? event.deviceId : 'faultCaseId' in event ? event.faultCaseId : 'profileId' in event ? event.profileId : ''}</small>
              </div>
            ))}
          </div>
        </ParameterGroup>
      )}
    </aside>
  );
}
