import { memo, useEffect, useId, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { OVERCURRENT_INVERSE_CURVES } from '../../engines/overcurrent';
import { listOvercurrentStudyPresets } from '../../studies/overcurrentPresets';
import type {
  CurrentProfile,
  OvercurrentInverseCurveId,
  OvercurrentStudyMode,
  ProtectionDeviceId,
  StudyCurrentDefinition,
} from '../../types/overcurrent';
import {
  canBeginOvercurrentFaultRun,
  evaluateActiveOvercurrentParameters,
  validateOvercurrentParameterState,
} from '../../utils/evaluateOvercurrentParameters';
import { formatEngineeringNumber } from '../../utils/engineering';
import {
  overcurrentSettingsLocked,
  type OvercurrentParameterAction,
  type OvercurrentParameterState,
} from '../../utils/overcurrentState';
import { InfoDot } from '../shared/InfoDot';
import { NumberField } from '../shared/NumberField';
import { ParameterGroup } from '../shared/ParameterGroup';
import { SectionSummary, SummaryMetric } from '../shared/SectionSummary';
import './overcurrentParameterPanel.css';

interface SelectControlProps {
  readonly label: string;
  readonly value: string;
  readonly disabled?: boolean;
  readonly help?: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
}

function SelectControl({ label, value, disabled = false, help, onChange, children }: SelectControlProps) {
  const selectId = useId();
  
  return (
    <label className='overcurrent-select-field' htmlFor={selectId}>
      <span className='overcurrent-field-label'>
        <span>{label}</span>
        {help && <InfoDot help={help} />}
      </span>
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        aria-disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className='min-w-0 w-full rounded border px-2.5 py-2 text-[11.5px] disabled:cursor-not-allowed disabled:opacity-70'
      >
        {children}
      </select>
    </label>
  );
}

function roleLabel(deviceIds: readonly ProtectionDeviceId[], deviceId: ProtectionDeviceId): string {
  if (deviceIds.length === 1) return 'SINGLE RELAY';
  const index = deviceIds.indexOf(deviceId);
  if (index === 0) return 'UPSTREAM';
  if (index === deviceIds.length - 1) return 'DOWNSTREAM';
  if (deviceIds.length === 3) return 'MIDDLE';
  return `INTERMEDIATE ${index}`;
}

function currentProfileLabel(profiles: readonly CurrentProfile[], current: StudyCurrentDefinition): string {
  if (current.kind === 'STATIC') return 'STATIC STUDY DATA';
  return profiles.find((profile) => profile.id === current.profileId)?.label ?? current.profileId;
}

function firstCurveForFamily(family: 'IEC' | 'IEEE'): OvercurrentInverseCurveId {
  return family === 'IEC' ? 'IEC_SI' : 'IEEE_MI';
}

function issueTouches(paths: readonly string[], fragment: string): boolean {
  return paths.some((path) => path.includes(fragment));
}

export interface OvercurrentParameterPanelProps {
  readonly state: OvercurrentParameterState;
  readonly dispatch: Dispatch<OvercurrentParameterAction>;
  /** External Reset/header revisions can force all NumberField drafts to canonical values. */
  readonly syncKey?: number;
  readonly onValidityChange?: (valid: boolean) => void;
  /** Controlled section open/close state — lifted to the page for collapse-all wiring. */
  readonly sections: Record<string, boolean>;
  /** Toggle a single section open/closed. */
  readonly setSections: Dispatch<SetStateAction<Record<string, boolean>>>;
}

function OvercurrentParameterPanelComponent({
  state,
  dispatch,
  syncKey = 0,
  onValidityChange,
  sections,
  setSections,
}: OvercurrentParameterPanelProps) {
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [localSyncKey, setLocalSyncKey] = useState(0);

  const engineeringValidation = useMemo(() => validateOvercurrentParameterState(state), [state]);
  const activeEvaluation = useMemo(() => evaluateActiveOvercurrentParameters(state), [state]);
  const draftValid = !Object.values(invalidFields).some(Boolean);
  const valid = draftValid && engineeringValidation.status === 'VALID';
  const locked = overcurrentSettingsLocked(state);
  const resolvedSyncKey = syncKey * 100_000 + localSyncKey;

  useEffect(() => {
    onValidityChange?.(valid);
  }, [onValidityChange, valid]);

  const syncDrafts = () => {
    setInvalidFields({});
    setLocalSyncKey((current) => current + 1);
  };

  const setFieldValidity = (fieldId: string) => (fieldValid: boolean) => {
    setInvalidFields((current) => {
      const invalid = !fieldValid;
      if (current[fieldId] === invalid) return current;
      return { ...current, [fieldId]: invalid };
    });
  };

  const setSectionOpen = (sectionId: string, open: boolean) => {
    setSections((current) => ({ ...current, [sectionId]: open }));
  };

  const issuePaths = engineeringValidation.status === 'INVALID'
    ? engineeringValidation.issues.map((entry) => entry.path ?? entry.code)
    : [];
  const firstIssue = engineeringValidation.status === 'INVALID'
    ? engineeringValidation.issues[0]?.detail ?? engineeringValidation.issues[0]?.code
    : null;

  const activeLoadCase = state.activeLoadCaseId === null
    ? undefined
    : state.studyDefinition.loadCases.find((item) => item.id === state.activeLoadCaseId);
  const activeFaultCase = state.activeFaultCaseId === null
    ? undefined
    : state.studyDefinition.faultCases.find((item) => item.id === state.activeFaultCaseId);
  const activeFaultProfile = state.faultLocationSelection === null
    ? undefined
    : state.studyDefinition.faultLocationProfiles.find((item) => item.id === state.faultLocationSelection?.profileId);
  const activeFaultSource = Boolean(activeFaultCase || activeFaultProfile);
  const activeDeviceId = state.selectedDeviceId ?? state.topology.deviceIds[0] ?? null;
  const activePrimaryCurrent = activeDeviceId && activeEvaluation.status === 'VALID'
    ? activeEvaluation.value.primaryCurrentAByDevice[activeDeviceId]
    : undefined;
  const currentSectionInvalid = issueTouches(issuePaths, 'loadCases')
    || issueTouches(issuePaths, 'faultCases')
    || issueTouches(issuePaths, 'currentProfiles')
    || issueTouches(issuePaths, 'faultLocationProfiles')
    || Object.keys(invalidFields).some((key) => key.startsWith('current.') && invalidFields[key]);

  const presetsForMode = listOvercurrentStudyPresets().filter((preset) => preset.mode === state.studyMode);

  const renderCurrentEditor = (
    caseKind: 'LOAD' | 'FAULT',
    caseId: string,
    current: StudyCurrentDefinition,
  ) => {
    if (current.kind === 'PROFILE') {
      return (
        <div className='overcurrent-profile-note'>
          <span>Configured current profile</span>
          <b>{currentProfileLabel(state.studyDefinition.currentProfiles, current)}</b>
          <small>Profile samples remain authoritative; arbitrary waveform editing is not exposed in this release.</small>
        </div>
      );
    }

    return (
      <div className='overcurrent-current-grid'>
        {state.topology.deviceIds.map((deviceId) => {
          const device = state.studyDefinition.devicesById[deviceId];
          const fieldId = `current.${caseKind.toLowerCase()}.${caseId}.${deviceId}`;
          return (
            <div key={`${caseKind}:${caseId}:${deviceId}`}>
              <NumberField
                label={`${device?.label ?? deviceId} ${caseKind === 'LOAD' ? 'Pre-fault' : 'Fault'}`}
                unit='A primary'
                value={current.primaryCurrentAByDevice[deviceId] ?? 0}
                min={0}
                step={100}
                syncKey={resolvedSyncKey}
                onValidityChange={setFieldValidity(fieldId)}
                onChange={(valueA) => dispatch({
                  type: 'SET_CASE_CURRENT',
                  caseKind,
                  caseId,
                  deviceId,
                  valueA,
                })}
                info={`${caseKind === 'LOAD' ? 'Pre-fault/load' : 'Fault'} scalar RMS primary current explicitly configured for ${device?.label ?? deviceId}. It is study data, not a hidden short-circuit calculation.`}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className='overcurrent-parameter-panel simulator-theme' aria-label='Overcurrent relay parameter editor'>
      {!valid && (
        <div className='overcurrent-invalid-banner' role='status'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>{!draftValid ? 'Complete every highlighted field within its stated range.' : firstIssue}</span>
        </div>
      )}

      <ParameterGroup
        title='Scenario / Study'
        open={sections.study}
        onOpenChange={(open) => setSectionOpen('study', open)}
        badge={state.modified ? 'MODIFIED' : 'PRESET'}
        badgeTone={state.modified ? 'info' : 'neutral'}
        summary={(
          <SectionSummary columns={2} ariaLabel='Overcurrent study selection summary'>
            <SummaryMetric label='Mode' value={state.studyMode === 'SINGLE_RELAY' ? 'Single Relay' : 'Coordination Lab'} />
            <SummaryMetric label='Preset' value={state.studyDefinition.label} />
          </SectionSummary>
        )}
      >
        <div className='overcurrent-fieldset'>
          <div className='overcurrent-select-grid'>
            <SelectControl
              label='Study mode'
              value={state.studyMode}
              disabled={locked}
              onChange={(value) => {
                dispatch({ type: 'SET_STUDY_MODE', mode: value as OvercurrentStudyMode });
                syncDrafts();
              }}
              help='Single Relay Study explores one 50/51 device. Coordination Lab uses the same engine across a configured radial primary/backup study.'
            >
              <option value='SINGLE_RELAY'>Single Relay Study</option>
              <option value='COORDINATION_LAB'>Coordination Lab</option>
            </SelectControl>

            <SelectControl
              label='Scenario preset'
              value={state.studyPresetId}
              disabled={locked}
              onChange={(presetId) => {
                dispatch({ type: 'APPLY_PRESET', presetId });
                syncDrafts();
              }}
              help='Named presets supply explicit topology, CT, relay settings, load/fault currents, and study relationships. Reset returns to this preset.'
            >
              {presetsForMode.map((preset) => <option key={preset.id} value={preset.id}>{preset.id} · {preset.label}</option>)}
            </SelectControl>

          </div>
        </div>
      </ParameterGroup>

      <ParameterGroup
        title='System / Current'
        open={sections.system}
        onOpenChange={(open) => setSectionOpen('system', open)}
        badge={currentSectionInvalid ? 'INVALID' : activeFaultProfile ? 'PROFILE STUDY' : activeFaultCase ? 'FAULT STUDY' : 'LOAD'}
        badgeTone={currentSectionInvalid ? 'warning' : activeFaultSource ? 'danger' : 'success'}
        summary={(
          <SectionSummary columns={2} ariaLabel='Active Overcurrent study-current summary'>
            <SummaryMetric label='Active source' value={activeEvaluation.status === 'VALID' ? activeEvaluation.value.source?.label ?? 'None' : 'OUTPUT HELD'} tone={activeEvaluation.status === 'VALID' ? activeFaultSource ? 'danger' : 'success' : 'warning'} />
            <SummaryMetric label={activeDeviceId ? `${activeDeviceId} current` : 'Current'} value={activePrimaryCurrent === undefined ? '—' : formatEngineeringNumber(activePrimaryCurrent)} unit={activePrimaryCurrent === undefined ? undefined : 'A primary'} />
          </SectionSummary>
        )}
      >
        <fieldset disabled={locked} className='overcurrent-fieldset'>
          {state.studyDefinition.loadCases.length > 0 && (
            <div className='overcurrent-current-block'>
              <div className='overcurrent-load-row'>
                <SelectControl
                  label='Pre-fault / load case'
                  value={activeLoadCase?.id ?? ''}
                  disabled={locked}
                  onChange={(loadCaseId) => dispatch({ type: 'SELECT_LOAD_CASE', loadCaseId })}
                  help='Explicit load reference used for Explore and load-security studies. It is kept separate from fault cases.'
                >
                  {state.studyDefinition.loadCases.map((loadCase) => (
                    <option key={loadCase.id} value={loadCase.id}>{loadCase.label} · {loadCase.category}</option>
                  ))}
                </SelectControl>
                {activeLoadCase && renderCurrentEditor('LOAD', activeLoadCase.id, activeLoadCase.current)}
              </div>
            </div>
          )}

          <div className='overcurrent-current-block'>
            <SelectControl
              label='Fault study case'
              value={activeFaultCase?.id ?? ''}
              disabled={locked || state.studyDefinition.faultCases.length === 0}
              onChange={(faultCaseId) => dispatch({ type: 'SELECT_FAULT_CASE', faultCaseId: faultCaseId || null })}
              help='Selects a configured fault location/category/current vector and its explicit primary/backup chain.'
            >
              {state.studyDefinition.faultCases.length === 0 && <option value=''>No fault case configured</option>}
              {activeFaultProfile && <option value=''>Profile Point (No Case)</option>}
              {state.studyDefinition.faultCases.map((faultCase) => (
                <option key={faultCase.id} value={faultCase.id}>{faultCase.label} · {faultCase.category}</option>
              ))}
            </SelectControl>
            {activeFaultProfile && state.faultLocationSelection && activeEvaluation.status === 'VALID'
              ? (
                  <div className='overcurrent-profile-note'>
                    <b>{activeFaultProfile.label}</b>
                    <div className='overcurrent-profile-current-list'>
                      {state.topology.deviceIds.map((deviceId) => (
                        <span key={deviceId}>
                          {deviceId} <b>{formatEngineeringNumber(activeEvaluation.value.primaryCurrentAByDevice[deviceId] ?? 0)} A primary</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              : activeFaultCase
                ? renderCurrentEditor('FAULT', activeFaultCase.id, activeFaultCase.current)
                : <div className='overcurrent-empty-note'>This preset intentionally contains load current only; Apply Fault remains unavailable.</div>}
          </div>
        </fieldset>
      </ParameterGroup>

      {state.topology.deviceIds.map((deviceId) => {
        const device = state.studyDefinition.devicesById[deviceId];
        if (!device) return null;
        const settings = device.settings;
        const curve = OVERCURRENT_INVERSE_CURVES[settings.phase51.inverseCurveId];
        const family = curve.family;
        const familyCurves = Object.values(OVERCURRENT_INVERSE_CURVES).filter((item) => item.family === family);
        const fieldPrefix = `device.${deviceId}`;
        const invalidDraft = Object.entries(invalidFields).some(([key, value]) => value && key.startsWith(fieldPrefix));
        const invalidEngine = issueTouches(issuePaths, `devicesById.${deviceId}`);
        const invalidDevice = invalidDraft || invalidEngine;
        const sectionId = `device:${deviceId}`;
        const selected = state.selectedDeviceId === deviceId;

        return (
          <ParameterGroup
            key={deviceId}
            title={`${device.label} · ${roleLabel(state.topology.deviceIds, deviceId)}`}
            open={sections[sectionId]}
            onOpenChange={(open) => {
              setSectionOpen(sectionId, open);
              if (open) dispatch({ type: 'SELECT_DEVICE', deviceId });
            }}
            badge={invalidDevice ? 'INVALID' : selected ? 'SELECTED' : settings.phase51.timingMode}
            badgeTone={invalidDevice ? 'warning' : selected ? 'info' : 'neutral'}
            summary={(
              <SectionSummary columns={3} compact ariaLabel={`${device.label} relay-setting summary`}>
                <SummaryMetric label='Pickup I>' value={formatEngineeringNumber(settings.phase51.pickupASecondary)} unit='A sec' />
                <SummaryMetric label={settings.phase51.timingMode === 'INVERSE' ? (family === 'IEC' ? 'TMS' : 'Time Dial') : '51 Delay'} value={formatEngineeringNumber(settings.phase51.timingMode === 'INVERSE' ? settings.phase51.timeScale : settings.phase51.definiteDelaySec)} unit={settings.phase51.timingMode === 'INVERSE' ? undefined : 's'} />
                <SummaryMetric label='50 High-set' value={settings.phase50.enabled ? formatEngineeringNumber(settings.phase50.pickupASecondary) : 'OFF'} unit={settings.phase50.enabled ? 'A sec' : undefined} />
              </SectionSummary>
            )}
          >
            <fieldset disabled={locked} className='overcurrent-fieldset'>
              <section className='overcurrent-subsection' data-type='ct' aria-label={`${device.label} CT instrument settings`}>
                <div className='overcurrent-subsection-heading'>
                  <span>CT / Instrument</span>
                </div>
                <div className='overcurrent-field-grid'>
                  <NumberField label='Prim. rated' unit='A' value={settings.ct.primaryRatedA} min={0.001} typicalMin={100} typicalMax={5000} step={50} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.ct.primary`)} onChange={(value) => dispatch({ type: 'SET_DEVICE_CT', deviceId, key: 'primaryRatedA', value })} info='CT primary rated current. Engine validity requires a finite value greater than zero.' />
                  <NumberField label='Sec. rated' unit='A' value={settings.ct.secondaryRatedA} min={0.001} typicalMin={1} typicalMax={5} step={1} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.ct.secondary`)} onChange={(value) => dispatch({ type: 'SET_DEVICE_CT', deviceId, key: 'secondaryRatedA', value })} info='CT secondary rated current. 1 A and 5 A are typical study values; the engine only requires a finite positive rating.' />
                  <NumberField label='Ratio error' unit='%' value={settings.ct.ratioErrorPct} min={-99.999999} typicalMin={-10} typicalMax={10} step={0.5} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.ct.error`)} onChange={(value) => dispatch({ type: 'SET_DEVICE_CT', deviceId, key: 'ratioErrorPct', value })} info='Signed scalar ratio error. Positive error increases measured current. The factor 1 + error/100 must remain greater than zero; no CT saturation is modelled.' />
                </div>
              </section>

              <section className='overcurrent-subsection' data-type='time-overcurrent' aria-label={`${device.label} 51 time-overcurrent settings`}>
                <div className='overcurrent-subsection-heading'>
                  <span>51 Time Overcurrent</span>
                  <small>{settings.phase51.timingMode === 'INVERSE' ? curve.displayName : 'Definite Time'}</small>
                </div>
                <div className='overcurrent-field-grid'>
                  <NumberField label='Pickup I>' unit='A sec' value={settings.phase51.pickupASecondary} min={0.001} step={0.05} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.51.pickup`)} onChange={(valueASecondary) => dispatch({ type: 'SET_DEVICE_51_PICKUP', deviceId, valueASecondary })} info='Strict 51 pickup threshold in CT-secondary amperes. Exact equality is not pickup.' />
                  <SelectControl
                    label='Timing mode'
                    value={settings.phase51.timingMode}
                    disabled={locked}
                    onChange={(timingMode) => {
                      dispatch({ type: 'SET_DEVICE_51_TIMING_MODE', deviceId, timingMode: timingMode as 'INVERSE' | 'DEFINITE' });
                    }}
                    help='Inverse timing follows the approved curve registry. Definite Time uses one fixed delay for every current above pickup.'
                  >
                    <option value='INVERSE'>Inverse Time</option>
                    <option value='DEFINITE'>Definite Time</option>
                  </SelectControl>
                </div>

                <div hidden={settings.phase51.timingMode !== 'INVERSE'} aria-hidden={settings.phase51.timingMode !== 'INVERSE'} className='overcurrent-field-grid overcurrent-mode-fields'>
                  <SelectControl
                    label='Standard family'
                    value={family}
                    disabled={locked}
                    onChange={(nextFamily) => {
                      dispatch({ type: 'SET_DEVICE_51_CURVE', deviceId, curveId: firstCurveForFamily(nextFamily as 'IEC' | 'IEEE') });
                    }}
                    help='IEC and IEEE labels select the corresponding approved O01 inverse-curve family. They share one normalized time-scale scalar in the engine.'
                  >
                    <option value='IEC'>IEC</option>
                    <option value='IEEE'>IEEE / US</option>
                  </SelectControl>
                  <SelectControl
                    label='Curve family'
                    value={settings.phase51.inverseCurveId}
                    disabled={locked}
                    onChange={(curveId) => dispatch({ type: 'SET_DEVICE_51_CURVE', deviceId, curveId: curveId as OvercurrentInverseCurveId })}
                    help='The curve constants and equation are read from the frozen O01 registry; the UI does not calculate an independent approximation.'
                  >
                    {familyCurves.map((item) => <option key={item.id} value={item.id}>{item.displayName.replace(`${item.family} `, '')}</option>)}
                  </SelectControl>
                  <NumberField label={family === 'IEC' ? 'TMS' : 'Time Dial (TD)'} unit='p.u.' value={settings.phase51.timeScale} min={0.05} max={15} typicalMin={0.05} typicalMax={1} step={0.01} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.51.timeScale`)} onChange={(value) => dispatch({ type: 'SET_DEVICE_51_TIME_SCALE', deviceId, value })} info='Normalized O01 time-scale setting. Valid product range is 0.05 to 15.00; it shifts the selected inverse characteristic in time.' />
                </div>

                <div hidden={settings.phase51.timingMode !== 'DEFINITE'} aria-hidden={settings.phase51.timingMode !== 'DEFINITE'} className='overcurrent-field-grid overcurrent-mode-fields'>
                  <NumberField label='Definite delay' unit='s' value={settings.phase51.definiteDelaySec} min={0.001} typicalMin={0.05} typicalMax={10} step={0.05} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.51.definiteDelay`)} onChange={(valueSec) => dispatch({ type: 'SET_DEVICE_51_DEFINITE_DELAY', deviceId, valueSec })} info='Fixed 51 delay after strict pickup. Current magnitude above pickup does not alter this delay.' />
                </div>
              </section>

              <section className='overcurrent-subsection' data-type='instantaneous' aria-label={`${device.label} 50 instantaneous settings`}>
                <div className='overcurrent-subsection-heading'>
                  <span>50 Instantaneous</span>
                  <small>{settings.phase50.enabled ? 'No intentional delay' : 'Disabled'}</small>
                </div>
                <div className='overcurrent-field-grid'>
                  <SelectControl
                    label='50 high-set'
                    value={settings.phase50.enabled ? 'ON' : 'OFF'}
                    disabled={locked}
                    onChange={(value) => {
                      dispatch({ type: 'SET_DEVICE_50_ENABLED', deviceId, enabled: value === 'ON' });
                    }}
                    help='When enabled and measured current strictly exceeds I>>, element 50 has priority over 51 with zero intentional relay delay in the V1 study model.'
                  >
                    <option value='OFF'>Disabled</option>
                    <option value='ON'>Enabled</option>
                  </SelectControl>
                  <NumberField label='Pickup I>>' unit='A sec' value={settings.phase50.pickupASecondary} min={0.001} step={0.1} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.50.pickup`)} onChange={(valueASecondary) => dispatch({ type: 'SET_DEVICE_50_PICKUP', deviceId, valueASecondary })} info='Instantaneous high-set threshold in CT-secondary amperes. Exact equality does not operate.' />
                </div>
              </section>

              <section className='overcurrent-subsection' data-type='breaker' aria-label={`${device.label} breaker study setting`}>
                <div className='overcurrent-subsection-heading'>
                  <span>Breaker Study</span>
                  <small>Trip output ≠ current interruption</small>
                </div>
                <div className='overcurrent-field-grid'>
                  <NumberField label='Clearing time' unit='s' value={settings.breaker.clearingTimeSec} min={0} typicalMin={0.03} typicalMax={0.2} step={0.01} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.breaker.clearing`)} onChange={(valueSec) => dispatch({ type: 'SET_DEVICE_BREAKER_CLEARING', deviceId, valueSec })} info='Fixed study-model interval from relay trip output to breaker open. Zero is allowed as an idealized case; this is not a breaker mechanical model.' />
                </div>
              </section>
            </fieldset>
          </ParameterGroup>
        );
      })}

      {state.coordinationRequirements.length > 0 && (
        <ParameterGroup
          title='Coordination Target'
          open={sections.coordination}
          onOpenChange={(open) => setSectionOpen('coordination', open)}
          badge={issueTouches(issuePaths, 'coordinationRequirements') || Object.entries(invalidFields).some(([key, value]) => value && key.startsWith('coordination.')) ? 'INVALID' : `${state.coordinationRequirements.length} PAIR${state.coordinationRequirements.length === 1 ? '' : 'S'}`}
          badgeTone={issueTouches(issuePaths, 'coordinationRequirements') || Object.entries(invalidFields).some(([key, value]) => value && key.startsWith('coordination.')) ? 'warning' : 'info'}
          summary={(
            <SectionSummary columns={Math.min(3, state.coordinationRequirements.length) as 1 | 2 | 3} ariaLabel='Coordination target summary'>
              {state.coordinationRequirements.slice(0, 3).map((requirement) => {
                const pair = state.studyDefinition.coordinationPairs.find((item) => item.id === requirement.pairId);
                return <SummaryMetric key={requirement.id} label={pair ? `${pair.primaryDeviceId} → ${pair.backupDeviceId}` : requirement.pairId} value={formatEngineeringNumber(requirement.requiredCtiSec)} unit='s CTI' />;
              })}
            </SectionSummary>
          )}
        >
          <fieldset disabled={locked} className='overcurrent-fieldset'>
            <div className='overcurrent-requirement-list'>
              {state.coordinationRequirements.map((requirement) => {
                const pair = state.studyDefinition.coordinationPairs.find((item) => item.id === requirement.pairId);
                const location = pair && state.topology.locations.find((item) => item.id === pair.locationId);
                const fieldPrefix = `coordination.${requirement.id}`;
                return (
                  <section key={requirement.id} className='overcurrent-requirement-card'>
                    <div className='overcurrent-requirement-heading'>
                      <div>
                        <b>{pair ? `${pair.primaryDeviceId} → ${pair.backupDeviceId}` : requirement.pairId}</b>
                        <span>{location?.label ?? pair?.locationId ?? 'Configured pair'}</span>
                      </div>
                      <div className='overcurrent-required-cti'>
                        <span>Required CTI</span>
                        <b>{formatEngineeringNumber(requirement.requiredCtiSec)} s</b>
                      </div>
                    </div>
                    {requirement.budget ? (
                      <div className='overcurrent-field-grid overcurrent-budget-grid'>
                        <NumberField label='Breaker allowance' unit='s' value={requirement.budget.breakerAllowanceSec} min={0} step={0.01} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.breaker`)} onChange={(valueSec) => dispatch({ type: 'SET_CTI_BUDGET_PART', requirementId: requirement.id, key: 'breakerAllowanceSec', valueSec })} info='Configured CTI budget contribution for primary breaker clearing. It is study data, not a universal breaker value.' />
                        <NumberField label='Timing allowance' unit='s' value={requirement.budget.relayTimingAllowanceSec} min={0} step={0.01} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.timing`)} onChange={(valueSec) => dispatch({ type: 'SET_CTI_BUDGET_PART', requirementId: requirement.id, key: 'relayTimingAllowanceSec', valueSec })} info='Configured relay/timing allowance in the educational CTI budget.' />
                        <NumberField label='Study margin' unit='s' value={requirement.budget.studySafetyMarginSec} min={0} step={0.01} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.margin`)} onChange={(valueSec) => dispatch({ type: 'SET_CTI_BUDGET_PART', requirementId: requirement.id, key: 'studySafetyMarginSec', valueSec })} info='Configured study safety margin. The required CTI shown above is always recalculated as the exact sum of all budget components.' />
                      </div>
                    ) : (
                      <NumberField label='Required CTI' unit='s' value={requirement.requiredCtiSec} min={0} step={0.01} syncKey={resolvedSyncKey} onValidityChange={setFieldValidity(`${fieldPrefix}.required`)} onChange={(valueSec) => dispatch({ type: 'SET_REQUIRED_CTI', requirementId: requirement.id, valueSec })} info='Configured minimum backup-minus-primary relay trip-output time. Equality is PASS.' />
                    )}
                  </section>
                );
              })}
            </div>
          </fieldset>
        </ParameterGroup>
      )}

      <ParameterGroup
        title='Simulation'
        open={sections.simulation}
        onOpenChange={(open) => setSectionOpen('simulation', open)}
        badge={!valid ? 'BLOCKED' : state.playbackState}
        badgeTone={!valid ? 'warning' : locked ? 'danger' : state.playbackState === 'COMPLETE' ? 'success' : 'neutral'}
        summary={(
          <SectionSummary columns={2} ariaLabel='Simulation control summary'>
            <SummaryMetric label='Playback' value={`${state.simulationSpeed}×`} />
            <SummaryMetric label='Run state' value={state.playbackState} tone={locked ? 'danger' : state.playbackState === 'COMPLETE' ? 'success' : 'neutral'} />
          </SectionSummary>
        )}
      >
        <div className='overcurrent-speed-control' role='group' aria-label='Simulation playback speed'>
          <span>Playback speed</span>
          <div>
            {([1, 5, 10] as const).map((speed) => (
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

        <div className='overcurrent-run-status' role='status' aria-live='polite' aria-atomic='true' data-state={!valid ? 'invalid' : state.playbackState.toLowerCase()}>
          <span>Engineering run</span>
          <b>{!valid ? 'INPUT INVALID · OUTPUT HELD' : locked ? 'FAULT RUNNING · SETTINGS LOCKED' : state.playbackState}</b>
        </div>

        <div className='overcurrent-action-grid'>
          <button
            type='button'
            className='overcurrent-action-button'
            data-tone='primary'
            disabled={!valid || !canBeginOvercurrentFaultRun(state)}
            onClick={() => dispatch({ type: 'BEGIN_FAULT_RUN' })}
          >
            Apply Fault
          </button>
          <button
            type='button'
            className='overcurrent-action-button'
            disabled={state.playbackState === 'IDLE'}
            onClick={() => dispatch({ type: 'CLEAR_FAULT_RUN' })}
          >
            Clear Fault
          </button>
          <button
            type='button'
            className='overcurrent-action-button'
            onClick={() => {
              dispatch({ type: 'RESET' });
              syncDrafts();
            }}
          >
            Reset Preset
          </button>
        </div>

      </ParameterGroup>
    </div>
  );
}

/**
 * O16 performance: playback updates the page-level timeline snapshot every
 * animation frame. The parameter editor depends only on reducer state, so
 * memoization keeps every NumberField from re-rendering per frame.
 */
export const OvercurrentParameterPanel = memo(OvercurrentParameterPanelComponent);
