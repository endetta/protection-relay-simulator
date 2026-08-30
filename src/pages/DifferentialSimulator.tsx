import { type AnimationEvent, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  type DifferentialCharacteristicMode,
  type NumericDifferentialSettingKey,
} from '../engines/differential';
import { type CTConfig } from '../engines/measurementChain';
import { type LoadDrivenSystem } from '../engines/systemModel';
import { SimulatorLayout } from '../layouts/SimulatorLayout';
import { SimulatorHeader } from '../components/SimulatorHeader';
import { CharacteristicCurve } from '../components/CharacteristicCurve';
import { DifferentialZoneDiagram } from '../components/DifferentialZoneDiagram';
import { MeasurementChainView } from '../components/MeasurementChainView';
import { FaultControls } from '../components/FaultControls';
import { EventLog, type EventItem, type EventType } from '../components/EventLog';
import { InfoDot } from '../components/shared/InfoDot';
import { NumberField } from '../components/shared/NumberField';
import { Metric } from '../components/shared/Metric';
import { ParameterGroup } from '../components/shared/ParameterGroup';
import { SectionSummary, SummaryEntity, SummaryMetric, SummaryText } from '../components/shared/SectionSummary';
import { formatEngineeringNumber } from '../utils/engineering';
import { evaluateDifferentialSimulation, type ValidDifferentialSimulation } from '../utils/evaluateDifferentialSimulation';
import type { DifferentialDisplayStatus } from '../types/simulator';
import { PRESETS, getPreset, type OperatingInputMode, type PresetId } from '../utils/presets';
import {
  createInitialDifferentialState,
  differentialStateReducer,
  scenarioDescription,
  scenarioLabel,
} from '../utils/differentialState';

const MAX_EVENTS = 12;

type SectionKey =
  | 'scenario' | 'system' | 'ct' | 'relay' | 'fault'
  | 'curve' | 'protected' | 'dependency'
  | 'systemModel' | 'measured' | 'calculated' | 'operating' | 'details' | 'events';

const INITIAL_SECTIONS: Record<SectionKey, boolean> = {
  scenario: true,
  system: true,
  ct: true,
  relay: true,
  fault: false,
  curve: true,
  protected: true,
  dependency: true,
  systemModel: true,
  measured: true,
  calculated: true,
  operating: true,
  details: false,
  events: false,
};

const PARAMETER_SECTION_KEYS: SectionKey[] = ['scenario', 'system', 'ct', 'relay', 'fault'];
const SUPPORT_SECTION_KEYS: SectionKey[] = ['protected', 'dependency'];
const ANALYSIS_SECTION_KEYS: SectionKey[] = ['systemModel', 'measured', 'calculated', 'operating', 'details', 'events'];

export function DifferentialSimulator() {
  const [state, dispatch] = useReducer(differentialStateReducer, undefined, createInitialDifferentialState);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [affectedKeys, setAffectedKeys] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [inputSyncKey, setInputSyncKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [previousPoint, setPreviousPoint] = useState<{ x: number; y: number } | null>(null);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>(INITIAL_SECTIONS);
  const [directReferenceOpen, setDirectReferenceOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [themeTransition, setThemeTransition] = useState<{ direction: 'to-light' | 'to-dark'; id: number } | null>(null);

  const themeModeRef = useRef<'dark' | 'light'>('dark');
  themeModeRef.current = themeMode;

  const themeTimersRef = useRef<number[]>([]);

  const clearThemeTimers = useCallback(() => {
    themeTimersRef.current.forEach((t) => window.clearTimeout(t));
    themeTimersRef.current = [];
  }, []);

  const toggleTheme = useCallback(() => {
    // Respect reduced motion: switch instantly without overlay
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clearThemeTimers();
      setThemeTransition(null);
      setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
      return;
    }

    clearThemeTimers();
    const current = themeModeRef.current;
    const next = current === 'dark' ? 'light' : 'dark';
    const direction = next === 'light' ? 'to-light' : 'to-dark';
    const id = Date.now();

    setThemeTransition({ direction, id });

    // Swap the theme at 85% of the 1800ms sweep, while the overlay is still
    // fully opaque, so the change is never seen. The overlay is torn down by
    // its own animationend event (handleThemeOverlayEnd) instead of a second
    // hardcoded timeout, so JS can never drift out of sync with CSS.
    const timer = window.setTimeout(() => {
      setThemeMode(next);
    }, 1530);

    // Watchdog: if animationend never fires (animation suppressed by a
    // mid-session reduced-motion toggle, background-tab throttling, etc.),
    // remove the overlay anyway so it can never get permanently stuck.
    const watchdog = window.setTimeout(() => {
      setThemeTransition((current) => (current && current.id === id ? null : current));
    }, 2200);

    themeTimersRef.current.push(timer, watchdog);
  }, [clearThemeTimers]);

  // Fires when the overlay's background sweep (including its 85%→100%
  // fade-out) finishes. Guarded on event.target so child icon animations do
  // not trigger it, and on the transition id so a stale event can never tear
  // down a newer overlay.
  const handleThemeOverlayEnd = useCallback((event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const finishedId = Number(event.currentTarget.dataset.transitionId);
    setThemeTransition((current) => (current && current.id === finishedId ? null : current));
  }, []);

  // Never leave a pending theme timer behind after unmount.
  useEffect(() => clearThemeTimers, [clearThemeTimers]);

  const pulseTimer = useRef<number | null>(null);
  const previousPointTimer = useRef<number | null>(null);
  const eventIdRef = useRef(0);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const previousDecisionRef = useRef<'OPERATE' | 'RESTRAIN' | null>(null);
  const helpCloseRef = useRef<HTMLButtonElement | null>(null);
  const helpDialogRef = useRef<HTMLDivElement | null>(null);
  const helpReturnFocusRef = useRef<HTMLElement | null>(null);

  const pushEvent = useCallback((type: EventType, text: string) => {
    setEvents((current) => [
      { id: ++eventIdRef.current, timestamp: Date.now(), type, text },
      ...current,
    ].slice(0, MAX_EVENTS));
  }, []);

  const pulse = useCallback((keys: readonly string[]) => {
    setAffectedKeys([...new Set(keys)]);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setAffectedKeys([]), 720);
  }, []);

  useEffect(() => () => {
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    if (previousPointTimer.current) window.clearTimeout(previousPointTimer.current);
    themeTimersRef.current.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    helpReturnFocusRef.current = document.activeElement as HTMLElement | null;
    helpCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHelpOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !helpDialogRef.current) return;
      const focusable = Array.from(helpDialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])',
      )).filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      helpReturnFocusRef.current?.focus();
    };
  }, [helpOpen]);

  const setValidity = (field: string) => (valid: boolean) => {
    setInvalidFields((current) => {
      const nextInvalid = !valid;
      if (current[field] === nextInvalid) return current;
      return { ...current, [field]: nextInvalid };
    });
  };

  const draftValid = !Object.values(invalidFields).some(Boolean);
  const evaluation = evaluateDifferentialSimulation(state);
  const lastValidEvaluationRef = useRef<ValidDifferentialSimulation | null>(null);
  const lastValidEngineeringStateRef = useRef(state);

  if (evaluation.ok) {
    lastValidEvaluationRef.current = evaluation.value;
    lastValidEngineeringStateRef.current = state;
  }

  const heldEvaluation = evaluation.ok ? evaluation.value : lastValidEvaluationRef.current;
  if (!heldEvaluation) throw new Error('Canonical differential simulator state failed validation.');

  const displayState = evaluation.ok ? state : lastValidEngineeringStateRef.current;
  const { systemDerived, i1s, i2s, result, margin } = heldEvaluation;
  const simulationValid = draftValid && evaluation.ok;
  const effectiveStatus: DifferentialDisplayStatus = simulationValid ? result.decision : 'INVALID';
  const evaluationError = !draftValid
    ? 'One or more parameter drafts are incomplete or outside their allowed range.'
    : evaluation.ok === false
      ? evaluation.error
      : null;
  const faultOn = state.faultKind !== 'none';
  const operate = effectiveStatus === 'OPERATE';
  const setSectionOpen = (key: SectionKey, open: boolean) => setSections((current) => ({ ...current, [key]: open }));
  const setSectionGroup = (keys: SectionKey[], open: boolean) => setSections((current) => {
    const next = { ...current };
    keys.forEach((key) => { next[key] = open; });
    return next;
  });
  const anyOpen = (keys: SectionKey[]) => keys.some((key) => sections[key]);
  const invalidIn = (...keys: string[]) => keys.some((key) => invalidFields[key]);
  const sectionInvalid = {
    system: invalidIn('rating-mva', 'side1-kv', 'side2-kv', 'load-mw', 'power-factor', 'i1p', 'i2p'),
    ct: invalidIn('ct1-pri', 'ct1-sec', 'ct1-err', 'ct2-pri', 'ct2-sec', 'ct2-err'),
    relay: invalidIn('iset', 'bp1', 'slope1', 'bp2', 'slope2', 'bp3', 'slope3'),
    fault: invalidIn('fault-multiple'),
  };

  useEffect(() => {
    if (!simulationValid) return;
    const next = { x: result.iBias, y: result.iDiff };
    const last = lastPointRef.current;
    if (last && (last.x !== next.x || last.y !== next.y)) {
      setPreviousPoint(last);
      if (previousPointTimer.current) window.clearTimeout(previousPointTimer.current);
      previousPointTimer.current = window.setTimeout(() => setPreviousPoint(null), 2500);
    }
    lastPointRef.current = next;
  }, [result.iBias, result.iDiff, simulationValid]);

  useEffect(() => {
    if (!simulationValid) return;
    const previous = previousDecisionRef.current;
    if (previous && previous !== result.decision) {
      pushEvent(
        'RELAY',
        result.decision === 'OPERATE'
          ? 'Relay decision changed to OPERATE; trip output asserted.'
          : 'Relay decision returned to RESTRAIN; trip output deasserted.',
      );
    }
    previousDecisionRef.current = result.decision;
  }, [pushEvent, result.decision, simulationValid]);

  const syncInputs = () => {
    setInvalidFields({});
    setInputSyncKey((key) => key + 1);
  };

  const applyPreset = (presetId: PresetId) => {
    const preset = getPreset(presetId);
    if (!preset) return;
    dispatch({ type: 'APPLY_PRESET', presetId });
    syncInputs();
    pushEvent('SCENARIO', `${preset.label} applied.`);
    pulse(['i1', 'i2', 'idiff', 'ibias', 'iop', 'curve', 'point', 'system']);
  };

  const reset = () => {
    dispatch({ type: 'RESET' });
    syncInputs();
    setPreviousPoint(null);
    lastPointRef.current = null;
    previousDecisionRef.current = null;
    setAffectedKeys([]);
    setEvents([{ id: ++eventIdRef.current, timestamp: Date.now(), type: 'SYSTEM', text: 'Reset completed; Normal Load and reference relay settings restored.' }]);
  };

  const clearFault = () => {
    dispatch({ type: 'CLEAR_FAULT' });
    syncInputs();
    pushEvent('FAULT', 'Fault cleared; pre-fault physical state restored.');
    pulse(['i1', 'i2', 'idiff', 'ibias', 'iop', 'curve', 'point', 'system']);
  };

  const changeInputMode = (mode: OperatingInputMode) => {
    if (faultOn) return;
    dispatch({ type: 'SET_INPUT_MODE', mode });
    syncInputs();
    pushEvent('PARAMETER', `Operating input changed to ${mode === 'load' ? 'Load Driven' : 'Direct Current'}.`);
    pulse(['i1', 'i2', 'idiff', 'ibias', 'iop', 'curve', 'point', 'system']);
  };

  const changeSystem = (key: keyof LoadDrivenSystem, value: number) => {
    dispatch({ type: 'SET_SYSTEM', key, value });
    pulse(['i1', 'i2', 'idiff', 'ibias', 'iop', 'point', 'system']);
  };

  const changeCurrent = (side: 1 | 2, value: number) => {
    dispatch({ type: 'SET_CURRENT', side, value });
    pulse([side === 1 ? 'i1' : 'i2', 'idiff', 'ibias', 'iop', 'point']);
  };

  const changeCT = (side: 1 | 2, value: CTConfig) => {
    dispatch({ type: 'SET_CT', side, value });
    pulse([side === 1 ? 'i1' : 'i2', 'idiff', 'ibias', 'iop', 'point']);
  };

  const changeSetting = (key: NumericDifferentialSettingKey, value: number) => {
    dispatch({ type: 'SET_SETTING', key, value });
    pulse(['iop', 'curve', 'point']);
  };

  const changeCharacteristicMode = (mode: DifferentialCharacteristicMode) => {
    dispatch({ type: 'SET_CHARACTERISTIC_MODE', mode });
    syncInputs();
    pushEvent('PARAMETER', `Differential characteristic changed to ${mode === 'dual' ? 'Dual-Slope' : 'Multi-Slope'}.`);
    pulse(['iop', 'curve', 'point']);
  };

  const scenarioText = scenarioLabel(state);
  const headerStatus = effectiveStatus;
  const activeConditionLabel = displayState.condition.kind === 'load'
    ? 'LOAD'
    : displayState.condition.kind === 'internal-fault'
      ? `INTERNAL ${formatEngineeringNumber(displayState.condition.currentMultiple)}×`
      : `EXTERNAL ${formatEngineeringNumber(displayState.condition.currentMultiple)}×`;
  const directCurrentSource = displayState.inputMode === 'direct';
  const loadCurrentSource = displayState.inputMode === 'load' && displayState.condition.kind === 'load';
  const faultCurrentSource = displayState.inputMode === 'load' && displayState.condition.kind !== 'load';
  const currentSourceLabel = directCurrentSource
    ? 'Direct primary current inputs'
    : loadCurrentSource
      ? 'Sload / (√3 × VLL)'
      : `${formatEngineeringNumber(displayState.condition.currentMultiple)}× terminal Irated`;

  const parameters = (
    <div>
      <ParameterGroup title='Scenario' open={sections.scenario} onOpenChange={(open) => setSectionOpen('scenario', open)} summary={<SummaryText label='Source scenario'>{scenarioText}</SummaryText>} badge={state.scenarioId === 'custom' ? 'CUSTOM' : 'PRESET'} badgeTone={state.scenarioId === 'custom' ? 'info' : 'neutral'}>
        <label className='grid gap-1.5'>
          <span className='flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--sim-text-secondary)]'>
            <span>Active scenario</span>
            <InfoDot help={`${scenarioDescription(state)} Scenario presets define the physical system/CT condition; relay settings remain independently adjustable.`} />
          </span>
          <select
            value={state.scenarioId}
            onChange={(e) => {
              if (e.target.value !== 'custom') applyPreset(e.target.value as PresetId);
            }}
            className='min-w-0 w-full rounded border px-2.5 py-2 text-[12px] focus:outline-none'
          >
            {state.scenarioId === 'custom' && <option value='custom'>Custom / Modified</option>}
            {PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
        </label>
      </ParameterGroup>

      <ParameterGroup title='System / Operating Input' open={sections.system} onOpenChange={(open) => setSectionOpen('system', open)} summary={faultOn ? (
        <SectionSummary columns={2} ariaLabel='Active fault source summary'>
          <SummaryMetric label='Fault source' value={currentSourceLabel} tone='danger' />
          <SummaryMetric label='Condition' value={activeConditionLabel} tone='danger' />
        </SectionSummary>
      ) : (
        <SectionSummary columns={2} ariaLabel='Operating current summary'>
          <SummaryMetric label='I1 Primary' value={formatEngineeringNumber(displayState.i1p)} unit='A' />
          <SummaryMetric label='I2 Primary' value={formatEngineeringNumber(displayState.i2p)} unit='A' />
        </SectionSummary>
      )} badge={sectionInvalid.system ? 'INVALID' : faultOn ? 'OVERRIDE' : state.inputMode === 'direct' ? 'DIRECT' : 'LOAD'} badgeTone={sectionInvalid.system ? 'warning' : faultOn ? 'danger' : 'info'}>
        <label className='grid gap-1.5'>
          <span className='flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.045em] text-[var(--sim-text-secondary)]'>
            <span>Input mode</span>
            <InfoDot help='Load Driven derives terminal current from the active physical condition. Under normal LOAD, Sload = P/pf drives terminal current. During simplified fault conditions, current is intentionally defined by the fault multiple × terminal Irated. Direct Current allows signed primary currents to be entered explicitly.' />
          </span>
          <select
            value={state.inputMode}
            disabled={faultOn}
            aria-describedby={faultOn ? 'fault-input-override-note' : undefined}
            onChange={(e) => changeInputMode(e.target.value as OperatingInputMode)}
            className='min-w-0 w-full rounded border px-2.5 py-2 text-[11.5px] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70'
          >
            <option value='load'>Load Driven</option>
            <option value='direct'>Direct Current</option>
          </select>
          {faultOn && (
            <span id='fault-input-override-note' className='fault-override-note'>
              FAULT OVERRIDE · {formatEngineeringNumber(displayState.condition.kind === 'load' ? state.faultInjectionMultiple : displayState.condition.currentMultiple)}× IRATED · Clear fault to restore the pre-fault input mode.
            </span>
          )}
        </label>

        {state.inputMode === 'load' ? (
          <>
            <div className='grid grid-cols-2 gap-x-2.5 gap-y-2.5'>
              <NumberField label='Rated MVA (Sn)' unit='MVA' value={state.system.transformerRatingMVA} min={0.1} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('rating-mva')} onChange={(v) => changeSystem('transformerRatingMVA', v)} info='Transformer rated apparent power Sn. It sets loading percentage and terminal rated current. Under normal LOAD the actual load current is driven by Sload = P/pf; during a simplified fault Sn affects current through Irated.' />
              <NumberField label='V1 (L-L)' unit='kV' value={state.system.side1KV} min={0.1} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('side1-kv')} onChange={(v) => changeSystem('side1KV', v)} info='Terminal-1 rated line-to-line voltage. Current uses I = S/(√3 × VLL) for the active current source.' />
              <NumberField label='V2 (L-L)' unit='kV' value={state.system.side2KV} min={0.1} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('side2-kv')} onChange={(v) => changeSystem('side2KV', v)} info='Terminal-2 rated line-to-line voltage. Changing voltage changes the corresponding physical winding current.' />
              <NumberField label='Load P' unit='MW' value={state.system.activeLoadMW} min={0} step={0.5} syncKey={inputSyncKey} onValidityChange={setValidity('load-mw')} onChange={(v) => changeSystem('activeLoadMW', v)} info='Three-phase active power before a fault. Sload is derived as P/pf. During an active simplified fault, this remains the pre-fault load reference while fault current is controlled by × Irated.' />
              <NumberField label='PF' unit='p.u.' value={state.system.powerFactor} min={0.1} max={1} step={0.01} syncKey={inputSyncKey} onValidityChange={setValidity('power-factor')} onChange={(v) => changeSystem('powerFactor', v)} info='Displacement power-factor magnitude used to derive Sload = P/pf. It drives current in the normal LOAD condition, not the explicit × Irated fault-current study control.' />
            </div>
            <div className={`sim-derived-card transition ${affectedKeys.includes('system') ? 'ring-1 ring-inset ring-[#38BDF8]' : ''}`}>
              <div className='grid grid-cols-2 gap-x-3 gap-y-2'>
                <div>
                  <div className='sim-derived-stat-label'>Sload · derived</div>
                  <div className='sim-derived-stat-value'>{formatEngineeringNumber(systemDerived.apparentLoadMVA)} MVA</div>
                </div>
                <div>
                  <div className='sim-derived-stat-label'>Loading</div>
                  <div className='sim-derived-stat-value'>{formatEngineeringNumber(systemDerived.loadingPct)}%</div>
                </div>
                <div className='col-span-2'>
                  <div className='sim-derived-stat-label'>Terminal Irated · I1 / I2</div>
                  <div className='sim-derived-stat-value'>{formatEngineeringNumber(systemDerived.ratedI1A)} / {formatEngineeringNumber(systemDerived.ratedI2A)} A</div>
                </div>
              </div>
              <div className='sim-current-source'>
                <div className='sim-current-source-title'>Current source</div>
                <div className='sim-current-source-value'>{currentSourceLabel}</div>
                {faultCurrentSource && (
                  <span className='sim-current-source-note'>
                    Pre-fault Sload remains {formatEngineeringNumber(systemDerived.apparentLoadMVA)} MVA while <b>{activeConditionLabel}</b> is active.
                  </span>
                )}
                {directCurrentSource && (
                  <span className='sim-current-source-note'>
                    I1 and I2 primary are the active source-of-truth. System values remain reference data until Load Driven is selected.
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
              <NumberField label='I1 Prim.' unit='A' value={state.i1p} step={10} syncKey={inputSyncKey} onValidityChange={setValidity('i1p')} onChange={(value) => changeCurrent(1, value)} info='Signed scalar RMS primary current at terminal 1. Positive current is defined as entering the protected zone.' />
              <NumberField label='I2 Prim.' unit='A' value={state.i2p} step={10} syncKey={inputSyncKey} onValidityChange={setValidity('i2p')} onChange={(value) => changeCurrent(2, value)} info='Signed scalar RMS primary current at terminal 2. Positive current is defined as entering the protected zone.' />
            </div>
            <div className='reference-system-card'>
              <div className='flex items-center justify-between gap-2'>
                <div>
                  <div className='reference-system-title'>Reference system · fault injection</div>
                  <div className='reference-system-values font-eng'>Sn {formatEngineeringNumber(state.system.transformerRatingMVA)} MVA · V1 {formatEngineeringNumber(state.system.side1KV)} kV · V2 {formatEngineeringNumber(state.system.side2KV)} kV</div>
                  <div className='reference-system-values font-eng'>Irated {formatEngineeringNumber(systemDerived.ratedI1A)} / {formatEngineeringNumber(systemDerived.ratedI2A)} A</div>
                </div>
                <button type='button' className='section-utility-button shrink-0' onClick={() => setDirectReferenceOpen((open) => !open)}>{directReferenceOpen ? 'Hide ref.' : 'Edit ref.'}</button>
              </div>
              <div hidden={!directReferenceOpen} aria-hidden={!directReferenceOpen} className='mt-2.5 grid grid-cols-2 gap-2.5 border-t border-[var(--sim-border)] pt-2.5'>
                <NumberField label='Rated MVA' unit='MVA' value={state.system.transformerRatingMVA} min={0.1} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('rating-mva')} onChange={(v) => changeSystem('transformerRatingMVA', v)} info='Reference transformer rating used to calculate terminal Irated for simplified fault injection.' />
                <NumberField label='V1 (L-L)' unit='kV' value={state.system.side1KV} min={0.1} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('side1-kv')} onChange={(v) => changeSystem('side1KV', v)} info='Reference terminal-1 line-to-line voltage used for rated-current calculation during fault injection.' />
                <NumberField label='V2 (L-L)' unit='kV' value={state.system.side2KV} min={0.1} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('side2-kv')} onChange={(v) => changeSystem('side2KV', v)} info='Reference terminal-2 line-to-line voltage used for rated-current calculation during fault injection.' />
                <NumberField label='Load P' unit='MW' value={state.system.activeLoadMW} min={0} step={0.5} syncKey={inputSyncKey} onValidityChange={setValidity('load-mw')} onChange={(v) => changeSystem('activeLoadMW', v)} info='Stored load reference used when switching back to Load Driven.' />
                <NumberField label='PF' unit='p.u.' value={state.system.powerFactor} min={0.1} max={1} step={0.01} syncKey={inputSyncKey} onValidityChange={setValidity('power-factor')} onChange={(v) => changeSystem('powerFactor', v)} info='Stored power-factor reference used when switching back to Load Driven.' />
              </div>
              <div className='reference-system-note'>Direct Current controls I1/I2 now. The reference system only supplies rated-current context for simplified ×Irated fault studies and for a later switch to Load Driven.</div>
            </div>
          </>
        )}
      </ParameterGroup>

      <ParameterGroup title='CT / Instrument' open={sections.ct} onOpenChange={(open) => setSectionOpen('ct', open)} summary={<SectionSummary columns={2} ariaLabel='CT ratio and error summary'>
        <SummaryEntity title='CT1' primary={`${formatEngineeringNumber(state.ct1.priRated)} / ${formatEngineeringNumber(state.ct1.secRated)} A`} secondaryLabel='Error' secondaryValue={`${formatEngineeringNumber(state.ct1.errorPct)}%`} />
        <SummaryEntity title='CT2' primary={`${formatEngineeringNumber(state.ct2.priRated)} / ${formatEngineeringNumber(state.ct2.secRated)} A`} secondaryLabel='Error' secondaryValue={`${formatEngineeringNumber(state.ct2.errorPct)}%`} />
      </SectionSummary>} badge={sectionInvalid.ct ? 'INVALID' : (state.ct1.errorPct !== 1 || state.ct2.errorPct !== 1 || state.ct1.priRated !== 100 || state.ct2.priRated !== 750) ? 'ADJUSTED' : 'MATCHED'} badgeTone={sectionInvalid.ct ? 'warning' : 'neutral'}>
        <div className='grid grid-cols-2 gap-2.5'>
          <div className='rounded-md border border-[#D1D5DB] bg-white px-2 py-2.5 simulator-theme'>
            <div className='border-b border-[#D1D5DB] pb-2 text-[10px] font-extrabold uppercase tracking-[0.10em] text-[#1F2937]'>CT1</div>
            <div className='mt-2.5 grid content-start gap-2.5'>
              <NumberField label='Prim. rated' unit='A' value={state.ct1.priRated} min={1} step={50} syncKey={inputSyncKey} onValidityChange={setValidity('ct1-pri')} onChange={(v) => changeCT(1, { ...state.ct1, priRated: v })} info='Rated primary current of CT1. Together with its secondary rating, it defines the CT transformation ratio applied to terminal-1 primary current.' />
              <NumberField label='Sec. rated' unit='A' value={state.ct1.secRated} min={1} max={5} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('ct1-sec')} onChange={(v) => changeCT(1, { ...state.ct1, secRated: v })} info='Rated secondary current of CT1 used by the simplified measurement model. Common relay current inputs are 1 A or 5 A; this simulator permits 1–5 A for study.' />
              <NumberField label='Ratio error' unit='%' value={state.ct1.errorPct} min={-10} max={10} step={0.5} syncKey={inputSyncKey} onValidityChange={setValidity('ct1-err')} onChange={(v) => changeCT(1, { ...state.ct1, errorPct: v })} info='Simplified CT ratio-error term represented as percentage scaling of ideal secondary current. CT saturation is not modelled.' />
            </div>
          </div>
          <div className='rounded-md border border-[#D1D5DB] bg-white px-2 py-2.5 simulator-theme'>
            <div className='border-b border-[#D1D5DB] pb-2 text-[10px] font-extrabold uppercase tracking-[0.10em] text-[#1F2937]'>CT2</div>
            <div className='mt-2.5 grid content-start gap-2.5'>
              <NumberField label='Prim. rated' unit='A' value={state.ct2.priRated} min={1} step={50} syncKey={inputSyncKey} onValidityChange={setValidity('ct2-pri')} onChange={(v) => changeCT(2, { ...state.ct2, priRated: v })} info='Rated primary current of CT2. Unequal effective CT scaling between terminals produces spill current during through-current conditions.' />
              <NumberField label='Sec. rated' unit='A' value={state.ct2.secRated} min={1} max={5} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('ct2-sec')} onChange={(v) => changeCT(2, { ...state.ct2, secRated: v })} info='Rated secondary current of CT2 used by the simplified measurement model.' />
              <NumberField label='Ratio error' unit='%' value={state.ct2.errorPct} min={-10} max={10} step={0.5} syncKey={inputSyncKey} onValidityChange={setValidity('ct2-err')} onChange={(v) => changeCT(2, { ...state.ct2, errorPct: v })} info='Simplified CT ratio-error term. Positive values increase measured secondary magnitude relative to the ideal ratio output.' />
            </div>
          </div>
        </div>
      </ParameterGroup>

      <ParameterGroup title='Differential Relay' open={sections.relay} onOpenChange={(open) => setSectionOpen('relay', open)} summary={<SectionSummary columns={state.settings.characteristicMode === 'multi' ? 4 : 3} compact ariaLabel='Differential relay setting summary'>
        <SummaryMetric label='Iset' value={formatEngineeringNumber(state.settings.iSet)} unit='A sec' />
        <SummaryMetric label='Slope 1' value={`${formatEngineeringNumber(state.settings.slope1)}%`} />
        <SummaryMetric label='Slope 2' value={`${formatEngineeringNumber(state.settings.slope2)}%`} />
        {state.settings.characteristicMode === 'multi' && <SummaryMetric label='Slope 3' value={`${formatEngineeringNumber(state.settings.slope3)}%`} />}
      </SectionSummary>} badge={sectionInvalid.relay ? 'INVALID' : state.settings.characteristicMode === 'multi' ? 'MULTI' : 'DUAL'} badgeTone={sectionInvalid.relay ? 'warning' : 'info'}>
        <label className='grid gap-1.5'>
          <span className='flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.045em] text-[var(--sim-text-secondary)]'>
            <span>Characteristic</span>
            <InfoDot help='Dual-Slope uses a horizontal minimum operate level (Iset), then Slope 1 and Slope 2. Multi-Slope adds a third turning point and Slope 3 for study of an additional high-restraint segment.' />
          </span>
          <select
            value={state.settings.characteristicMode}
            onChange={(e) => changeCharacteristicMode(e.target.value as DifferentialCharacteristicMode)}
            className='min-w-0 w-full rounded border px-2.5 py-2 text-[11.5px] focus:outline-none'
          >
            <option value='dual'>Dual-Slope</option>
            <option value='multi'>Multi-Slope</option>
          </select>
        </label>

        <div className='grid grid-cols-2 gap-x-2.5 gap-y-2.5'>
          <NumberField label='Iset / Min Iop' unit='A sec' value={state.settings.iSet} min={0} step={0.05} syncKey={inputSyncKey} onValidityChange={setValidity('iset')} onChange={(v) => changeSetting('iSet', v)} info='Minimum operate-current setting. The characteristic remains horizontal at Iset from zero bias current through Bias Breakpoint 1.' />
          <NumberField label='Bias BP1' unit='A sec' value={state.settings.biasBreakpoint1} min={0} max={Math.max(0, state.settings.biasBreakpoint2 - 0.01)} step={0.1} syncKey={inputSyncKey} onValidityChange={setValidity('bp1')} onChange={(v) => changeSetting('biasBreakpoint1', v)} info='First turning point: end of the horizontal minimum-operate section and beginning of Slope 1.' />
          <NumberField label='Slope 1' unit='%' value={state.settings.slope1} min={0} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('slope1')} onChange={(v) => changeSetting('slope1', v)} info='Percentage-restraint slope between Bias Breakpoint 1 and Bias Breakpoint 2.' />
          <NumberField label='Bias BP2' unit='A sec' value={state.settings.biasBreakpoint2} min={state.settings.biasBreakpoint1 + 0.01} max={state.settings.characteristicMode === 'multi' ? Math.max(state.settings.biasBreakpoint1 + 0.02, state.settings.biasBreakpoint3 - 0.01) : undefined} step={0.1} syncKey={inputSyncKey} onValidityChange={setValidity('bp2')} onChange={(v) => changeSetting('biasBreakpoint2', v)} info='Second turning point: transition from Slope 1 to Slope 2.' />
          <NumberField label='Slope 2' unit='%' value={state.settings.slope2} min={0} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('slope2')} onChange={(v) => changeSetting('slope2', v)} info='Percentage-restraint slope above Bias Breakpoint 2 in dual-slope mode, or until Bias Breakpoint 3 in multi-slope mode.' />
          {state.settings.characteristicMode === 'multi' && (
            <>
              <NumberField label='Bias BP3' unit='A sec' value={state.settings.biasBreakpoint3} min={state.settings.biasBreakpoint2 + 0.01} step={0.1} syncKey={inputSyncKey} onValidityChange={setValidity('bp3')} onChange={(v) => changeSetting('biasBreakpoint3', v)} info='Third turning point used only in multi-slope mode; it starts the Slope 3 segment.' />
              <NumberField label='Slope 3' unit='%' value={state.settings.slope3} min={0} step={1} syncKey={inputSyncKey} onValidityChange={setValidity('slope3')} onChange={(v) => changeSetting('slope3', v)} info='Additional high-restraint percentage slope used above Bias Breakpoint 3 in multi-slope mode.' />
            </>
          )}
        </div>
      </ParameterGroup>

      <ParameterGroup title='Internal Fault Injection' open={sections.fault} onOpenChange={(open) => setSectionOpen('fault', open)} summary={<SectionSummary columns={faultOn ? 2 : 1} ariaLabel='Internal fault injection summary'>
        <SummaryMetric label='Fault level' value={`${formatEngineeringNumber(state.faultInjectionMultiple)} × Irated`} tone={faultOn ? 'danger' : 'neutral'} />
        {faultOn && <SummaryMetric label='Condition' value={activeConditionLabel} tone='danger' />}
      </SectionSummary>} badge={sectionInvalid.fault ? 'INVALID' : faultOn ? 'FAULT ACTIVE' : 'READY'} badgeTone={sectionInvalid.fault ? 'warning' : faultOn ? 'danger' : 'neutral'}>
        <NumberField label='Fault level' unit='× Ir' value={state.faultInjectionMultiple} min={1} max={20} step={0.5} syncKey={inputSyncKey} onValidityChange={setValidity('fault-multiple')} onChange={(v) => dispatch({ type: 'SET_FAULT_MULTIPLE', value: v })} info='Simplified fault-current magnitude expressed as a multiple of each terminal rated current. This is a study control, not a short-circuit network calculation.' />
        <FaultControls
          faultOn={faultOn}
          canApply={simulationValid}
          onApply={() => {
            if (!simulationValid) {
              pushEvent('SYSTEM', 'Fault application blocked while simulator input is invalid; restore a valid engineering state first.');
              return;
            }
            dispatch({ type: 'APPLY_INTERNAL_FAULT' });
            syncInputs();
            pushEvent('FAULT', `Internal fault applied at ${formatEngineeringNumber(state.faultInjectionMultiple)}× rated terminal current; current source temporarily switched to the ×Irated fault model and pre-fault state saved.`);
            pulse(['i1', 'i2', 'idiff', 'ibias', 'iop', 'curve', 'point', 'system']);
          }}
          onClear={clearFault}
        />
        <div className='text-[9px] leading-4 text-[var(--sim-text-muted)]'>External-fault studies remain available from Scenario presets; this control injects the interactive internal-fault study only.</div>
      </ParameterGroup>
    </div>
  );

  const live = (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      {!simulationValid && (
        <div className='shrink-0 rounded border border-[#8A5B12] bg-[#211A0E] px-2.5 py-1.5 text-[10px] leading-4 text-[#FBBF24]'>
          INPUT INVALID — output held on last valid data{evaluationError ? ` · ${evaluationError}` : ''}
        </div>
      )}

      <div className={`sim-curve-card scenario-surface-transition flex flex-col p-2 ${sections.curve ? 'min-h-[300px] flex-1' : 'shrink-0'} ${affectedKeys.includes('curve') ? 'shadow-[0_0_0_1px_rgba(56,189,248,0.38)]' : ''}`}>
        <div className='mb-0.5 flex shrink-0 items-center justify-between gap-2'>
          <div className='sim-curve-title'>Differential Characteristic</div>
          <div className='flex items-center gap-2'>
            <div className='sim-curve-meta font-eng'>Idiff vs Ibias</div>
            <button type='button' className='section-utility-button' aria-expanded={sections.curve} onClick={() => setSectionOpen('curve', !sections.curve)}>{sections.curve ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        {!sections.curve && (
          <div className='parameter-group-summary border-t px-2.5 py-2'>
            <SectionSummary columns={4} compact ariaLabel='Characteristic operating-point summary'>
              <SummaryMetric label='Ibias' value={formatEngineeringNumber(result.iBias)} unit='A sec' />
              <SummaryMetric label='Idiff' value={formatEngineeringNumber(result.iDiff)} unit='A sec' />
              <SummaryMetric label='Iop' value={formatEngineeringNumber(result.iOpLimit)} unit='A sec' />
              <SummaryMetric label='State' value={effectiveStatus === 'INVALID' ? 'HELD' : effectiveStatus} tone={effectiveStatus === 'INVALID' ? 'warning' : operate ? 'danger' : 'success'} />
            </SectionSummary>
          </div>
        )}
        <div hidden={!sections.curve} aria-hidden={!sections.curve} className='min-h-0 flex-1'>
          <CharacteristicCurve
            iDiff={result.iDiff}
            iBias={result.iBias}
            iOpLimit={result.iOpLimit}
            status={effectiveStatus}
            settings={displayState.settings}
            prev={previousPoint}
            highlighted={affectedKeys.includes('curve')}
          />
        </div>
      </div>

      <ParameterGroup
        title='Protected Zone'
        variant='support'
        open={sections.protected}
        onOpenChange={(open) => setSectionOpen('protected', open)}
        summary={<SectionSummary columns={2} ariaLabel='Protected-zone current summary'>
          <SummaryMetric label='Side 1' value={formatEngineeringNumber(displayState.i1p)} unit='A' tone={effectiveStatus === 'OPERATE' ? 'danger' : effectiveStatus === 'INVALID' ? 'warning' : 'success'} />
          <SummaryMetric label='Side 2' value={formatEngineeringNumber(displayState.i2p)} unit='A' tone={effectiveStatus === 'OPERATE' ? 'danger' : effectiveStatus === 'INVALID' ? 'warning' : 'success'} />
        </SectionSummary>}
        badge={effectiveStatus === 'INVALID' ? 'HELD' : effectiveStatus === 'OPERATE' ? 'TRIP' : 'NO TRIP'}
        badgeTone={effectiveStatus === 'INVALID' ? 'warning' : effectiveStatus === 'OPERATE' ? 'danger' : 'success'}
      >
        <div className='mb-1 flex items-center justify-end'>
          <InfoDot help='Reference sign convention: positive current is defined as entering the protected zone from each terminal. Healthy through-current therefore has opposite signs at the two terminals.' />
        </div>
        <DifferentialZoneDiagram i1p={displayState.i1p} i2p={displayState.i2p} faultKind={displayState.faultKind} affectedKeys={affectedKeys} status={effectiveStatus} />
      </ParameterGroup>

      <ParameterGroup
        title='Measurement Dependency'
        variant='support'
        open={sections.dependency}
        onOpenChange={(open) => setSectionOpen('dependency', open)}
        summary={<SectionSummary columns={3} compact ariaLabel='Differential measurement summary'>
          <SummaryMetric label='Idiff' value={formatEngineeringNumber(result.iDiff)} unit='A sec' />
          <SummaryMetric label='Ibias' value={formatEngineeringNumber(result.iBias)} unit='A sec' />
          <SummaryMetric label='Iop' value={formatEngineeringNumber(result.iOpLimit)} unit='A sec' />
        </SectionSummary>}
        badge={effectiveStatus === 'INVALID' ? 'HELD' : effectiveStatus === 'OPERATE' ? 'TRIP' : 'HEALTHY'}
        badgeTone={effectiveStatus === 'INVALID' ? 'warning' : effectiveStatus === 'OPERATE' ? 'danger' : 'success'}
      >
        <div className='mb-1 flex items-center justify-end'>
          <InfoDot help='Both CT-secondary currents feed differential-current and bias/restraint-current calculations. Bias current and the configured characteristic determine Iop; the relay compares Idiff with that threshold.' />
        </div>
        <MeasurementChainView i1s={i1s} i2s={i2s} iDiff={result.iDiff} iBias={result.iBias} iOpLimit={result.iOpLimit} affectedKeys={affectedKeys} status={effectiveStatus} />
      </ParameterGroup>
    </div>
  );

  const thresholdRegion = result.iBias <= displayState.settings.biasBreakpoint1
    ? `Iop = Iset = ${formatEngineeringNumber(result.iOpLimit)} A sec`
    : result.iBias <= displayState.settings.biasBreakpoint2
      ? `Iop = Iset + S1×(Ibias−BP1) = ${formatEngineeringNumber(result.iOpLimit)} A sec`
      : displayState.settings.characteristicMode === 'multi' && result.iBias > displayState.settings.biasBreakpoint3
        ? `Iop = T(BP3) + S3×(Ibias−BP3) = ${formatEngineeringNumber(result.iOpLimit)} A sec`
        : `Iop = T(BP2) + S2×(Ibias−BP2) = ${formatEngineeringNumber(result.iOpLimit)} A sec`;

  const analysis = (
    <div className='space-y-2.5 text-xs'>
      <div className='sim-relay-decision' data-state={effectiveStatus === 'INVALID' ? 'invalid' : operate ? 'operate' : 'restrain'}>
        <div className='flex items-center justify-between gap-2'>
          <span className='sim-relay-label uppercase'>Relay Decision</span>
          <span className={`font-eng text-[12px] font-bold ${!simulationValid ? 'text-[#FBBF24]' : operate ? 'text-[#F87171]' : 'text-[#34D399]'}`}>
            {effectiveStatus === 'INVALID' ? 'INPUT INVALID' : result.decision}
          </span>
        </div>
        <div className='sim-relay-subtle mt-1 flex items-center justify-between gap-2'>
          <span>Trip output</span>
          <span className='font-eng font-semibold text-[var(--sim-text)]'>{effectiveStatus === 'INVALID' ? 'HELD' : operate ? 'ASSERTED' : 'DEASSERTED'}</span>
        </div>
      </div>

      <ParameterGroup title='System Model' open={sections.systemModel} onOpenChange={(open) => setSectionOpen('systemModel', open)} summary={<SectionSummary columns={2} ariaLabel='System reference summary'>
        <SummaryMetric label='Rating' value={formatEngineeringNumber(displayState.system.transformerRatingMVA)} unit='MVA' />
        <SummaryMetric label='Irated I1 / I2' value={`${formatEngineeringNumber(systemDerived.ratedI1A)} / ${formatEngineeringNumber(systemDerived.ratedI2A)}`} unit='A' />
      </SectionSummary>} badge={directCurrentSource ? 'REFERENCE' : 'ACTIVE'} badgeTone={directCurrentSource ? 'neutral' : 'info'}>
        <div className='grid grid-cols-2 gap-1.5'>
          <Metric label='Sload (derived)' value={systemDerived.apparentLoadMVA} unit='MVA' />
          <Metric label='Loading' value={systemDerived.loadingPct} unit='%' />
          <Metric label='Rated I1' value={systemDerived.ratedI1A} unit='A' />
          <Metric label='Rated I2' value={systemDerived.ratedI2A} unit='A' />
        </div>
      </ParameterGroup>

      <ParameterGroup title='Measured Current' open={sections.measured} onOpenChange={(open) => setSectionOpen('measured', open)} summary={<SectionSummary columns={2} ariaLabel='Measured CT-secondary current summary'>
        <SummaryMetric label='I1 Secondary' value={formatEngineeringNumber(i1s)} unit='A sec' />
        <SummaryMetric label='I2 Secondary' value={formatEngineeringNumber(i2s)} unit='A sec' />
      </SectionSummary>}>
        <div className='grid grid-cols-2 gap-1.5'>
          <Metric label='I1 Prim.' value={displayState.i1p} unit='A' />
          <Metric label='I2 Prim.' value={displayState.i2p} unit='A' />
          <Metric label='I1 secondary' value={i1s} unit='A sec' />
          <Metric label='I2 secondary' value={i2s} unit='A sec' />
        </div>
      </ParameterGroup>

      <ParameterGroup title='Calculated' open={sections.calculated} onOpenChange={(open) => setSectionOpen('calculated', open)} summary={<SectionSummary columns={3} compact ariaLabel='Differential measurement summary'>
          <SummaryMetric label='Idiff' value={formatEngineeringNumber(result.iDiff)} unit='A sec' />
          <SummaryMetric label='Ibias' value={formatEngineeringNumber(result.iBias)} unit='A sec' />
          <SummaryMetric label='Iop' value={formatEngineeringNumber(result.iOpLimit)} unit='A sec' />
        </SectionSummary>} badge={effectiveStatus === 'INVALID' ? 'HELD' : operate ? 'OPERATE' : 'RESTRAIN'} badgeTone={effectiveStatus === 'INVALID' ? 'warning' : operate ? 'danger' : 'success'}>
        <div className='grid grid-cols-2 gap-1.5'>
          <Metric label='Idiff' value={result.iDiff} unit='A sec' />
          <Metric label='Ibias' value={result.iBias} unit='A sec' />
          <Metric label='Threshold' value={result.iOpLimit} unit='A sec' />
          <Metric label='Margin' value={margin} unit='A sec' tone={!simulationValid ? 'warning' : margin > 0 ? 'operate' : 'restrain'} />
        </div>
      </ParameterGroup>

      <ParameterGroup title='Operating Condition' open={sections.operating} onOpenChange={(open) => setSectionOpen('operating', open)} summary={<SectionSummary columns={2} ariaLabel='Operating condition summary'>
        <SummaryMetric label='Condition' value={activeConditionLabel} />
        <SummaryMetric label='Relay state' value={effectiveStatus === 'INVALID' ? 'OUTPUT HELD' : effectiveStatus} tone={effectiveStatus === 'INVALID' ? 'warning' : operate ? 'danger' : 'success'} />
      </SectionSummary>}>
        <div className='font-eng text-[10.5px] leading-[1.55] text-[var(--sim-text)]'>
          {activeConditionLabel} · Idiff {formatEngineeringNumber(result.iDiff)} A sec · Iop {formatEngineeringNumber(result.iOpLimit)} A sec<br />
          {!simulationValid
            ? 'LAST VALID DATA · Relay output HELD until inputs return to a valid engineering state.'
            : operate
              ? 'Idiff > Iop → OPERATE → Trip output ASSERTED'
              : 'Idiff ≤ Iop → RESTRAIN → Trip output DEASSERTED'}
        </div>
      </ParameterGroup>

      <ParameterGroup title='Calculation Details' open={sections.details} onOpenChange={(open) => setSectionOpen('details', open)} summary={<SummaryText label='Trace'>8-step engineering calculation path</SummaryText>}>
        <div className='font-eng text-[10px] leading-[1.6] text-[var(--sim-text-muted)]'>
          1) System: Sn = {formatEngineeringNumber(displayState.system.transformerRatingMVA)} MVA; Sload = P/pf = {formatEngineeringNumber(systemDerived.apparentLoadMVA)} MVA; loading = {formatEngineeringNumber(systemDerived.loadingPct)}%<br />
          2) Active current source: {currentSourceLabel}; I1 = {formatEngineeringNumber(displayState.i1p)} A; I2 = {formatEngineeringNumber(displayState.i2p)} A ({activeConditionLabel})<br />
          3) CT1: I1s = I1 × ({displayState.ct1.secRated}/{displayState.ct1.priRated}) × (1+{displayState.ct1.errorPct}/100) = {formatEngineeringNumber(i1s)} A sec<br />
          4) CT2: I2s = I2 × ({displayState.ct2.secRated}/{displayState.ct2.priRated}) × (1+{displayState.ct2.errorPct}/100) = {formatEngineeringNumber(i2s)} A sec<br />
          5) Idiff = |I1s + I2s| = {formatEngineeringNumber(result.iDiff)} A sec<br />
          6) Ibias = (|I1s| + |I2s|)/2 = {formatEngineeringNumber(result.iBias)} A sec<br />
          7) {thresholdRegion}<br />
          8) {effectiveStatus === 'INVALID' ? 'INPUT INVALID → relay output HELD on last valid data' : result.decision === 'OPERATE' ? 'Idiff > Iop → OPERATE' : 'Idiff ≤ Iop → RESTRAIN'}
        </div>
      </ParameterGroup>

      <ParameterGroup title='Events' open={sections.events} onOpenChange={(open) => setSectionOpen('events', open)} summary={<SummaryText label='Event log'>{events.length} recorded event{events.length === 1 ? '' : 's'}</SummaryText>}>
        <EventLog events={events} />
      </ParameterGroup>
    </div>
  );

  return (
    <div
      className={`simulator-theme simulator-theme-${themeMode} relative flex h-full min-h-0 flex-col`}
    >
      {themeTransition && (
        <div
          key={themeTransition.id}
          className='theme-transition-overlay theme-transition-overlay--active'
          data-direction={themeTransition.direction}
          data-transition-id={themeTransition.id}
          onAnimationEnd={handleThemeOverlayEnd}
          aria-hidden='true'
        >
          {/* Moon icon — white, visible on black background */}
          <svg className='theme-transition-icon theme-transition-icon--moon' viewBox='0 0 64 64' width='80' height='80' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M52 36A20 20 0 0 1 28 12a20 20 0 1 0 24 24Z' />
          </svg>
          {/* Sun icon — dark gray, visible on white background */}
          <svg className='theme-transition-icon theme-transition-icon--sun' viewBox='0 0 64 64' width='80' height='80' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
            <circle cx='32' cy='32' r='10' />
            <path d='M32 8v8M32 48v8M56 32h-8M16 32H8M48.5 15.5l-5.7 5.7M21.2 42.8l-5.7 5.7M48.5 48.5l-5.7-5.7M21.2 21.2l-5.7-5.7' />
          </svg>
        </div>
      )}
      <SimulatorHeader
        scenario={scenarioText}
        status={headerStatus}
        onReset={reset}
        onHelp={() => setHelpOpen(true)}
        enableThemeToggle={true}
        themeMode={themeMode}
        onThemeToggle={toggleTheme}
      />
      <div className='min-h-0 flex-1'>
        <SimulatorLayout
          parameters={parameters}
          simulation={live}
          analysis={analysis}
          parametersAction={<button type='button' className='section-utility-button' onClick={() => setSectionGroup(PARAMETER_SECTION_KEYS, !anyOpen(PARAMETER_SECTION_KEYS))}>{anyOpen(PARAMETER_SECTION_KEYS) ? 'Collapse all' : 'Expand all'}</button>}
          simulationAction={<button type='button' className='section-utility-button' onClick={() => setSectionGroup(SUPPORT_SECTION_KEYS, !anyOpen(SUPPORT_SECTION_KEYS))}>{anyOpen(SUPPORT_SECTION_KEYS) ? 'Hide support' : 'Show support'}</button>}
          analysisAction={<button type='button' className='section-utility-button' onClick={() => setSectionGroup(ANALYSIS_SECTION_KEYS, !anyOpen(ANALYSIS_SECTION_KEYS))}>{anyOpen(ANALYSIS_SECTION_KEYS) ? 'Collapse all' : 'Expand all'}</button>}
        />
      </div>

      {helpOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4' role='dialog' aria-modal='true' aria-labelledby='differential-help-title'>
          <div ref={helpDialogRef} className='max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded border border-[var(--sim-border)] bg-[var(--sim-panel)] p-4 shadow-2xl engineering-scrollbar simulator-theme'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h2 id='differential-help-title' className='text-sm font-semibold uppercase tracking-wider text-[var(--sim-text)]'>Differential Model Help</h2>
                <p className='mt-1 text-[10.5px] text-[var(--sim-text-muted)]'>Model scope, parameter definitions, input limits, and calculation conventions.</p>
              </div>
              <button ref={helpCloseRef} type='button' onClick={() => setHelpOpen(false)} className='rounded border border-[var(--sim-border)] px-2 py-1 text-xs text-[var(--sim-text-muted)] hover:text-[var(--sim-text)]'>Close</button>
            </div>

            <div className='mt-3 grid gap-3 text-[10.5px] leading-relaxed text-[var(--sim-text-secondary)] md:grid-cols-2'>
              <section className='rounded border border-[var(--sim-border)] bg-[var(--sim-panel-raised)] p-2.5 simulator-theme'>
                <h3 className='mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sim-text)]'>System model</h3>
                <p><b className='text-[var(--sim-text)]'>Load Driven:</b> under normal LOAD, active load and power factor determine Sload and terminal current through Sload = √3 × VLL × I. Transformer rating Sn sets loading percentage and terminal Irated. During a simplified fault, the active current source intentionally changes to the explicit fault multiple × Irated; Sload remains the pre-fault reference.</p>
                <p className='mt-1.5'><b className='text-[var(--sim-text)]'>Direct Current:</b> signed primary terminal currents are the active source-of-truth. The stored system reference remains available because simplified fault injection temporarily uses the selected fault multiple × terminal Irated.</p>
                <p className='mt-1.5'><b className='text-[var(--sim-text)]'>Sign convention:</b> positive current is defined as entering the protected zone from each terminal.</p>
              </section>

              <section className='rounded border border-[var(--sim-border)] bg-[var(--sim-panel-raised)] p-2.5 simulator-theme'>
                <h3 className='mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sim-text)]'>Characteristic</h3>
                <p><b className='text-[var(--sim-text)]'>Iset / Min Iop:</b> horizontal minimum operate-current level at low restraint current.</p>
                <p className='mt-1.5'><b className='text-[var(--sim-text)]'>BP1:</b> first turning point; the characteristic leaves the horizontal Iset section and enters Slope 1.</p>
                <p className='mt-1.5'><b className='text-[var(--sim-text)]'>BP2:</b> transition from Slope 1 to Slope 2. Multi-Slope mode adds BP3 and Slope 3.</p>
                <p className='mt-1.5'>All sloped segments are continuous at their turning points. OPERATE occurs only when Idiff is strictly greater than the calculated threshold.</p>
              </section>

              <section className='rounded border border-[var(--sim-border)] bg-[var(--sim-panel-raised)] p-2.5 simulator-theme'>
                <h3 className='mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sim-text)]'>CT / measurement</h3>
                <dl className='space-y-1.5'>
                  <div><dt className='font-semibold text-[var(--sim-text)]'>CT primary rated current</dt><dd>Primary current used in the CT ratio. Simulator valid input: ≥ 1 A.</dd></div>
                  <div><dt className='font-semibold text-[var(--sim-text)]'>CT secondary rated current</dt><dd>Secondary current used in the CT ratio. Simulator study input: 1–5 A.</dd></div>
                  <div><dt className='font-semibold text-[var(--sim-text)]'>CT ratio error</dt><dd>Simplified percentage scaling of ideal CT-secondary current. Simulator study input: −10% to +10%.</dd></div>
                </dl>
              </section>

              <section className='rounded border border-[var(--sim-border)] bg-[var(--sim-panel-raised)] p-2.5 simulator-theme'>
                <h3 className='mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sim-text)]'>Graph behavior</h3>
                <p>The default view prioritizes the characteristic so turning points and slopes remain readable. If an operating point is outside that view, an edge marker reports the real coordinates. Use <b className='text-[var(--sim-text)]'>Fit Point</b> to temporarily expand the axes around the point.</p>
              </section>

              <section className='rounded border border-[var(--sim-border)] bg-[var(--sim-panel-raised)] p-2.5 md:col-span-2 simulator-theme'>
                <h3 className='mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sim-text)]'>Scope limits</h3>
                <p><b className='text-[var(--sim-text)]'>Not modelled:</b> complex phasor angle, transformer vector-group compensation, zero-sequence compensation, CT saturation, magnetizing inrush/harmonic restraint, breaker opening time, and post-trip network dynamics. CT ratios are explicit user settings; there is no hidden automatic vector/tap compensation.</p>
                <p className='mt-1.5'><b className='text-[var(--sim-text)]'>Input safety:</b> invalid drafts or non-finite/overflowing derived results are contained. Live visualization stays on the last valid engineering state and relay output is explicitly HELD until the inputs return to a valid state.</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
