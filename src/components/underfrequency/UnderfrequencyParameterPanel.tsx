import { useEffect, useId, useMemo, useState, useCallback, type Dispatch, type ReactNode } from 'react';
import { listUnderfrequencyStudyPresets } from '../../studies/underfrequencyPresets';
import type {
  UnderfrequencyDisturbanceStepKind,
  UnderfrequencyPlaybackSpeed,
  UnderfrequencySimulatorState,
} from '../../types/underfrequency';
import {
  canBeginUnderfrequencyRun,
  validateUnderfrequencyParameterState,
} from '../../utils/evaluateUnderfrequencyParameters';
import { formatEngineeringNumber, formatFrequencyHz } from '../../utils/engineering';
import type { UnderfrequencyAction } from '../../utils/underfrequencyState';
import { InfoDot } from '../shared/InfoDot';
import { NumberField } from '../shared/NumberField';
import { ParameterGroup } from '../shared/ParameterGroup';
import { SectionSummary, SummaryMetric } from '../shared/SectionSummary';
import './underfrequencyParameterPanel.css';

export interface UnderfrequencyParameterPanelProps {
  readonly state: UnderfrequencySimulatorState;
  readonly dispatch: Dispatch<UnderfrequencyAction>;
  /** External Reset/header revisions force all NumberField drafts to canonical values. */
  readonly syncKey?: number;
  readonly onValidityChange?: (valid: boolean) => void;
  /** Controlled section open/close state — lifted to the page for collapse-all wiring. */
  readonly sections: Record<string, boolean>;
  /** Toggle a single section open/closed. */
  readonly setSections: (next: Record<string, boolean>) => void;
}

interface SelectControlProps {
  readonly label: string;
  readonly value: string;
  readonly help?: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
}

function SelectControl({ label, value, help, onChange, children }: SelectControlProps) {
  const selectId = useId();
  return (
    <label className='underfrequency-select-field' htmlFor={selectId}>
      <span className='underfrequency-field-label'>
        <span>{label}</span>
        {help && <InfoDot help={help} />}
      </span>
      <select
        id={selectId}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className='min-w-0 w-full rounded border px-2.5 py-2 text-[13px]'
      >
        {children}
      </select>
    </label>
  );
}

function statusWord(kind: UnderfrequencyDisturbanceStepKind): string {
  if (kind === 'GENERATOR_LOSS') return 'GEN LOSS';
  if (kind === 'GENERATOR_BLOCK') return 'GEN BLOCK';
  return 'LOAD STEP';
}

/**
 * Underfrequency parameter editor. Collapse-by-default groups with bold
 * section titles and a large-font NumberField override (via the panel's own
 * CSS) so the parameter column reads clearly instead of cramming many small
 * fields onto one screen.
 */
export function UnderfrequencyParameterPanel({
  state,
  dispatch,
  syncKey = 0,
  onValidityChange,
  sections,
  setSections,
}: UnderfrequencyParameterPanelProps) {
  const engineeringValidation = useMemo(() => validateUnderfrequencyParameterState(state), [state]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [localSyncKey, setLocalSyncKey] = useState(0);
  const resolvedSyncKey = syncKey * 100_000 + localSyncKey;

  const draftValid = !Object.values(invalidFields).some(Boolean);
  const valid = draftValid && engineeringValidation.status === 'VALID';

  useEffect(() => {
    onValidityChange?.(valid);
  }, [onValidityChange, valid]);

  const setFieldValidity = (fieldId: string) => (fieldValid: boolean) => {
    setInvalidFields((current) => {
      const invalid = !fieldValid;
      if (current[fieldId] === invalid) return current;
      return { ...current, [fieldId]: invalid };
    });
  };

  const issuePaths = engineeringValidation.status === 'INVALID'
    ? engineeringValidation.issues.map((entry) => entry.path ?? entry.code)
    : [];
  const firstIssue = engineeringValidation.status === 'INVALID'
    ? engineeringValidation.issues[0]?.detail ?? engineeringValidation.issues[0]?.code
    : null;
  const issueTouches = (fragment: string) => issuePaths.some((path) => path.includes(fragment));

  const syncDrafts = useCallback(() => {
    setInvalidFields({});
    setLocalSyncKey((current) => current + 1);
  }, []);

  const setOpen = (key: string, open: boolean) => {
    setSections({ ...sections, [key]: open });
  };

  const presets = listUnderfrequencyStudyPresets();
  const system = state.study.system;
  const uflsInvalid = issueTouches('uflsStages');
  const genInvalid = (id: string) => issueTouches(`generators.${id}`) || Object.entries(invalidFields).some(([key, value]) => value && key.startsWith(`gen.${id}`));

  const totalInitialMw = state.study.generators.reduce((sum, g) => sum + g.initialMw, 0);
  const totalReserveMw = state.study.generators.reduce((sum, g) => sum + Math.max(0, g.governorMaxMw - g.initialMw), 0);

  return (
    <div className='underfrequency-parameter-panel simulator-theme' aria-label='Underfrequency relay parameter editor'>
      {(!valid || !draftValid) && (
        <div className='underfrequency-invalid-banner' role='status'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>{!draftValid ? 'Complete every highlighted field within its stated range.' : firstIssue}</span>
        </div>
      )}

      <ParameterGroup
        title='Scenario / Preset'
        open={sections.study}
        onOpenChange={(open) => setOpen('study', open)}
        badge={state.modified ? 'MODIFIED' : 'PRESET'}
        badgeTone={state.modified ? 'info' : 'neutral'}
        summary={(
          <SectionSummary columns={2} ariaLabel='Underfrequency study selection summary'>
            <SummaryMetric label='Preset' value={state.study.label} />
            <SummaryMetric label='Status' value={state.modified ? 'Modified' : 'Nominal'} />
          </SectionSummary>
        )}
      >
        <SelectControl
          label='Scenario preset'
          value={state.study.id}
          onChange={(presetId) => {
            dispatch({ type: 'APPLY_PRESET', presetId });
            syncDrafts();
          }}
          help='Named presets supply system, generator, UFLS, and disturbance data. Reset returns to this preset.'
        >
          {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.id} · {preset.label}</option>)}
        </SelectControl>
        {state.modified && (
          <button type='button' className='underfrequency-reset-preset' onClick={() => { dispatch({ type: 'RESET' }); syncDrafts(); }}>
            Reset to preset
          </button>
        )}
        {state.study.notes?.plnVerificationRequired && (
          <p className='underfrequency-pln-note'>
            <b>PLN STANDARD — NOT VERIFIED</b>
            <span>{state.study.notes.sourceNote ?? 'Typical practice; pending official grid-code verification.'}</span>
          </p>
        )}
      </ParameterGroup>

      <ParameterGroup
        title='System'
        open={sections.system}
        onOpenChange={(open) => setOpen('system', open)}
        badge={issueTouches('system') ? 'INVALID' : 'OK'}
        badgeTone={issueTouches('system') ? 'warning' : 'success'}
        summary={(
          <SectionSummary columns={2} ariaLabel='System summary'>
            <SummaryMetric label='Nominal f' value={formatFrequencyHz(system.fNominalHz)} unit='Hz' />
            <SummaryMetric label='Base load' value={formatEngineeringNumber(system.baseLoadMw)} unit='MW' />
          </SectionSummary>
        )}
      >
        <div className='underfrequency-field-grid'>
          <NumberField label='Nominal frequency' unit='Hz' value={system.fNominalHz} min={40} max={70} step={0.5} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity('system.fNominalHz')} onChange={(value) => dispatch({ type: 'SET_SYSTEM', patch: { fNominalHz: value } })} info='Nominal system frequency. Default 50 Hz.' />
          <NumberField label='Voltage' unit='kV' value={system.voltageKv} min={1} step={5} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity('system.voltageKv')} onChange={(value) => dispatch({ type: 'SET_SYSTEM', patch: { voltageKv: value } })} info='Study line-to-line voltage. Display-only; no network model.' />
          <NumberField label='Base load' unit='MW' value={system.baseLoadMw} min={1} step={10} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity('system.baseLoadMw')} onChange={(value) => dispatch({ type: 'SET_SYSTEM', patch: { baseLoadMw: value } })} info='Pre-disturbance total load, used as the base for UFLS shed amounts.' />
        </div>
        <div className='underfrequency-system-totals' role='status' aria-live='polite'>
          <span>Σ P₀ <b className='font-eng'>{formatEngineeringNumber(totalInitialMw)} MW</b></span>
          <span>Reserve <b className='font-eng'>{formatEngineeringNumber(totalReserveMw)} MW</b></span>
        </div>
      </ParameterGroup>

      {state.study.generators.map((gen) => (
        <ParameterGroup
          key={gen.id}
          title={gen.label}
          open={sections[`gen:${gen.id}`]}
          onOpenChange={(open) => setOpen(`gen:${gen.id}`, open)}
          badge={genInvalid(gen.id) ? 'INVALID' : gen.status}
          badgeTone={genInvalid(gen.id) ? 'warning' : gen.status === 'TRIPPED' ? 'danger' : 'success'}
          summary={(
            <SectionSummary columns={3} compact ariaLabel={`${gen.id} generator summary`}>
              <SummaryMetric label='Rating' value={formatEngineeringNumber(gen.mwRated)} unit='MW' />
              <SummaryMetric label='Droop' value={`${(gen.droopPu * 100).toFixed(1)}%`} />
              <SummaryMetric label='H' value={formatEngineeringNumber(gen.inertiaSec)} unit='s' />
            </SectionSummary>
          )}
        >
          <div className='underfrequency-field-grid'>
            <NumberField label='Rated MW' unit='MW' value={gen.mwRated} min={1} step={10} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`gen.${gen.id}.mwRated`)} onChange={(value) => dispatch({ type: 'SET_GENERATOR', generatorId: gen.id, patch: { mwRated: value } })} info='Nameplate MW rating.' />
            <NumberField label='Rated MVA' unit='MVA' value={gen.mva} min={1} step={10} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`gen.${gen.id}.mva`)} onChange={(value) => dispatch({ type: 'SET_GENERATOR', generatorId: gen.id, patch: { mva: value } })} info='MVA rating, used for inertia weighting and S_base.' />
            <NumberField label='Inertia H' unit='s' value={gen.inertiaSec} min={0.1} step={0.5} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`gen.${gen.id}.inertiaSec`)} onChange={(value) => dispatch({ type: 'SET_GENERATOR', generatorId: gen.id, patch: { inertiaSec: value } })} info='Inertia constant. Larger H damps ROCOF.' />
            <NumberField label='Droop R' unit='p.u.' value={gen.droopPu} min={0.001} step={0.01} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`gen.${gen.id}.droopPu`)} onChange={(value) => dispatch({ type: 'SET_GENERATOR', generatorId: gen.id, patch: { droopPu: value } })} info='Velocity droop. 0.05 = 5%. Smaller R → stiffer governor.' />
            <NumberField label='Poles' unit='' value={gen.poles} min={2} max={64} step={2} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`gen.${gen.id}.poles`)} onChange={(value) => dispatch({ type: 'SET_GENERATOR', generatorId: gen.id, patch: { poles: value } })} info='Synchronous pole count. Used only for RPM display (N = 120·f/poles).' />
            <NumberField label='Initial output' unit='MW' value={gen.initialMw} min={0} step={10} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`gen.${gen.id}.initialMw`)} onChange={(value) => dispatch({ type: 'SET_GENERATOR', generatorId: gen.id, patch: { initialMw: value } })} info='Pre-disturbance output P0.' />
          </div>
          <div className='underfrequency-field-grid'>
            <NumberField label='Governor max' unit='MW' value={gen.governorMaxMw} min={0} step={10} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`gen.${gen.id}.governorMaxMw`)} onChange={(value) => dispatch({ type: 'SET_GENERATOR', generatorId: gen.id, patch: { governorMaxMw: value } })} info='Maximum achievable governor output. Must exceed initial output.' />
            <SelectControl
              label='Status'
              value={gen.status}
              onChange={(status) => dispatch({ type: 'SET_GENERATOR', generatorId: gen.id, patch: { status: status as typeof gen.status } })}
            >
              <option value='ONLINE'>ONLINE</option>
              <option value='TRIPPED'>TRIPPED</option>
              <option value='AT_GOVERNOR_LIMIT'>AT GOVERNOR LIMIT</option>
            </SelectControl>
          </div>
        </ParameterGroup>
      ))}

      <ParameterGroup
        title='Relay'
        open={sections.relay}
        onOpenChange={(open) => setOpen('relay', open)}
        badge={state.study.relay.enabled ? 'ENABLED' : 'DISABLED'}
        badgeTone={state.study.relay.enabled ? 'success' : 'neutral'}
      >
        <div className='underfrequency-relay-readout'>
          <span>Model</span>
          <b>{state.study.relay.modelLabel}</b>
          <span>ANSI function</span>
          <b>81U — Underfrequency</b>
        </div>
        <SelectControl
          label='Relay status'
          value={state.study.relay.enabled ? 'ENABLED' : 'DISABLED'}
          onChange={(value) => dispatch({ type: 'SET_RELAY', patch: { enabled: value === 'ENABLED' } })}
        >
          <option value='ENABLED'>Enabled</option>
          <option value='DISABLED'>Disabled</option>
        </SelectControl>
      </ParameterGroup>

      <ParameterGroup
        title='UFLS Stages'
        open={sections.ufls}
        onOpenChange={(open) => setOpen('ufls', open)}
        badge={uflsInvalid ? 'INVALID' : `${state.study.uflsStages.filter((s) => s.enabled).length} STAGES`}
        badgeTone={uflsInvalid ? 'warning' : 'info'}
        summary={(
          <SectionSummary columns={2} compact ariaLabel='UFLS summary'>
            <SummaryMetric label='Stage 1' value={state.study.uflsStages[0] ? formatFrequencyHz(state.study.uflsStages[0].thresholdHz) : '—'} unit='Hz' />
            <SummaryMetric label='Stage 4' value={state.study.uflsStages[3] ? formatFrequencyHz(state.study.uflsStages[3].thresholdHz) : '—'} unit='Hz' />
          </SectionSummary>
        )}
      >
        <div className='underfrequency-ufls-list'>
          {state.study.uflsStages.map((stage) => (
            <section key={stage.id} className='underfrequency-ufls-stage'>
              <div className='underfrequency-ufls-stage-heading'>
                <b>{stage.label}</b>
                <SelectControl
                  label={`${stage.id} status`}
                  value={stage.enabled ? 'ENABLED' : 'DISABLED'}
                  onChange={(value) => dispatch({ type: 'SET_UFLS_STAGE', stageId: stage.id, patch: { enabled: value === 'ENABLED' } })}
                >
                  <option value='ENABLED'>Enabled</option>
                  <option value='DISABLED'>Disabled</option>
                </SelectControl>
              </div>
              <div className='underfrequency-field-grid'>
                <NumberField label='Threshold' unit='Hz' value={stage.thresholdHz} min={45} max={system.fNominalHz} step={0.1} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`ufls.${stage.id}.threshold`)} onChange={(value) => dispatch({ type: 'SET_UFLS_STAGE', stageId: stage.id, patch: { thresholdHz: value } })} info='Arming threshold. Pickup is strict: f below threshold (not equal). Thresholds must descend across stages.' />
                <NumberField label='Delay' unit='s' value={stage.timeDelaySec} min={0} step={0.05} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`ufls.${stage.id}.delay`)} onChange={(value) => dispatch({ type: 'SET_UFLS_STAGE', stageId: stage.id, patch: { timeDelaySec: value } })} info='Definite-time delay after arming.' />
                <NumberField label='Shed fraction' unit='%' value={stage.shedFractionPct} min={0} max={100} step={5} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`ufls.${stage.id}.shed`)} onChange={(value) => dispatch({ type: 'SET_UFLS_STAGE', stageId: stage.id, patch: { shedFractionPct: value } })} info='Percent of pre-disturbance load shed on trip.' />
              </div>
            </section>
          ))}
        </div>
      </ParameterGroup>

      <ParameterGroup
        title='Disturbance'
        open={sections.disturbance}
        onOpenChange={(open) => setOpen('disturbance', open)}
        badge={`${state.study.disturbanceSteps.length} STEP${state.study.disturbanceSteps.length === 1 ? '' : 'S'}`}
        badgeTone={state.study.disturbanceSteps.length ? 'warning' : 'neutral'}
        summary={(
          <SectionSummary columns={1} ariaLabel='Disturbance summary'>
            <SummaryMetric label='Deficit ΔP' value={state.study.disturbanceSteps.some((s) => s.kind === 'LOAD_STEP') ? formatEngineeringNumber(state.study.disturbanceSteps.find((s) => s.kind === 'LOAD_STEP')?.mw ?? 0) : '0'} unit='MW' />
          </SectionSummary>
        )}
      >
        <div className='underfrequency-disturbance-deficit'>
          <NumberField label='Manual ΔP (load step)' unit='MW' value={state.study.disturbanceSteps.find((s) => s.kind === 'LOAD_STEP')?.mw ?? 0} min={0} step={50} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity('disturbance.deficit')} onChange={(value) => dispatch({ type: 'SET_DISTURBANCE_DEFICIT_MW', mw: value })} info='A manual load-step deficit replaces the disturbance schedule with one event at t = 0. Set to 0 to clear.' />
      </div>

        <div className='underfrequency-disturbance-list'>
          {state.study.disturbanceSteps.map((step) => (
            <div key={step.id} className='underfrequency-disturbance-step'>
              <div className='underfrequency-disturbance-step-identity'>
                <b>{statusWord(step.kind)}</b>
                <span>
                  {step.kind === 'LOAD_STEP'
                    ? `${formatEngineeringNumber(step.mw ?? 0)} MW`
                    : step.generatorId ? `@ ${step.generatorId}` : ''}
                </span>
                <small className='font-eng'>t = {formatEngineeringNumber(step.timeSec)} s</small>
              </div>
              <button
                type='button'
                aria-label={`Remove disturbance step ${step.id}`}
                onClick={() => dispatch({ type: 'REMOVE_DISTURBANCE_STEP', stepId: step.id })}
              >
                Remove
              </button>
            </div>
          ))}
          {state.study.disturbanceSteps.length === 0 && (
            <p className='underfrequency-disturbance-empty'>No disturbance. The preset starts balanced at nominal frequency.</p>
          )}
        </div>

        <div className='underfrequency-section-actions'>
          <span>Add generator loss</span>
          <div>
            {state.study.generators.map((gen) => (
              <button
                key={gen.id}
                type='button'
                disabled={state.study.disturbanceSteps.some((s) => s.generatorId === gen.id && s.kind !== 'LOAD_STEP')}
                onClick={() => dispatch({ type: 'ADD_GENERATOR_LOSS', generatorId: gen.id, timeSec: 0 })}
              >
                {gen.id}
              </button>
            ))}
          </div>
        </div>
      </ParameterGroup>

      <ParameterGroup
        title='Simulation'
        open={sections.simulation}
        onOpenChange={(open) => setOpen('simulation', open)}
        badge={!valid ? 'BLOCKED' : state.playbackState}
        badgeTone={!valid ? 'warning' : state.playbackState === 'COMPLETE' ? 'success' : 'neutral'}
        summary={(
          <SectionSummary columns={2} ariaLabel='Simulation control summary'>
            <SummaryMetric label='Speed' value={`${state.simulationSpeed}×`} />
            <SummaryMetric label='Run state' value={state.playbackState} />
          </SectionSummary>
        )}
      >
        <div className='underfrequency-speed-control' role='group' aria-label='Simulation playback speed'>
          <span>Playback speed</span>
          <div>
            {([1, 5, 10] as const).map((speed: UnderfrequencyPlaybackSpeed) => (
              <button
                key={speed}
                type='button'
                aria-pressed={state.simulationSpeed === speed}
                aria-label={`Set playback speed ${speed}×`}
                data-active={state.simulationSpeed === speed ? 'true' : 'false'}
                onClick={() => dispatch({ type: 'SET_SIMULATION_SPEED', speed })}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>

        <div className='underfrequency-run-status' role='status' aria-live='polite' aria-atomic='true' data-state={!valid ? 'invalid' : state.playbackState.toLowerCase()}>
          <span>Engineering run</span>
          <b>{!valid ? 'INPUT INVALID · OUTPUT HELD' : state.playbackState}</b>
        </div>

        <div className='underfrequency-action-grid'>
          <button
            type='button'
            className='underfrequency-action-button'
            data-tone='primary'
            disabled={!valid || !canBeginUnderfrequencyRun(state)}
            onClick={() => dispatch({ type: 'BEGIN_RUN' })}
          >
            Run
          </button>
          <button
            type='button'
            className='underfrequency-action-button'
            disabled={state.playbackState === 'IDLE'}
            onClick={() => dispatch({ type: 'CLEAR_RUN' })}
          >
            Clear
          </button>
          <button
            type='button'
            className='underfrequency-action-button'
            onClick={() => { dispatch({ type: 'RESET' }); syncDrafts(); }}
          >
            Reset Preset
          </button>
        </div>
      </ParameterGroup>
    </div>
  );
}
