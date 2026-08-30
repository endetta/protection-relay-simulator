import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { SimulatorHeader, type SimulatorHeaderTone } from '../components/SimulatorHeader';
import { EngineeringViewOverlay } from '../components/shared/EngineeringViewOverlay';
import { OperatingSequence } from '../components/overcurrent/OperatingSequence';
import { OvercurrentAnalysisPanel } from '../components/overcurrent/OvercurrentAnalysisPanel';
import { OvercurrentParameterPanel } from '../components/overcurrent/OvercurrentParameterPanel';
import { RadialProtectionDiagram } from '../components/overcurrent/RadialProtectionDiagram';
import { TimeCurrentCurve } from '../components/overcurrent/TimeCurrentCurve';
import { SimulatorLayout } from '../layouts/SimulatorLayout';
import { buildOvercurrentAnalysisModel, type AnalysisTone } from '../presentation/overcurrentAnalysis';
import type { TimelineSnapshot } from '../types/overcurrent';
import {
  createInitialOvercurrentParameterState,
  overcurrentParameterReducer,
} from '../utils/overcurrentState';
import './overcurrentSimulator.css';

function headerTone(tone: AnalysisTone): SimulatorHeaderTone {
  if (tone === 'danger') return 'operate';
  if (tone === 'warning') return 'invalid';
  if (tone === 'success') return 'restrain';
  if (tone === 'normal') return 'neutral';
  return 'info';
}

export function OvercurrentSimulator() {
  const [state, dispatch] = useReducer(
    overcurrentParameterReducer,
    undefined,
    createInitialOvercurrentParameterState,
  );
  const [timelineSnapshot, setTimelineSnapshot] = useState<TimelineSnapshot | null>(null);
  const [parameterDraftValid, setParameterDraftValid] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [syncKey, setSyncKey] = useState(0);

  // Section open/close state lifted from the panels so the collapse-all
  // controls can live in the column headers (next to the column titles).
  const [parameterSections, setParameterSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      study: true,
      system: true,
      coordination: true,
      simulation: true,
    };
    state.topology.deviceIds.forEach((deviceId) => {
      initial[`device:${deviceId}`] = deviceId === state.selectedDeviceId;
    });
    return initial;
  });
  const [analysisSections, setAnalysisSections] = useState<Record<string, boolean>>(() => ({
    status: true,
    study: false,
    order: false,
    measurement: false,
    audit: true,
    impact: true,
    calculation: false,
    events: false,
  }));

  // Keep device-specific parameter sections in sync with the selected device
  // and the active topology (mirrors the behavior previously in OvercurrentParameterPanel).
  useEffect(() => {
    setParameterSections((current) => {
      const next = { ...current };
      state.topology.deviceIds.forEach((deviceId) => {
        const key = `device:${deviceId}`;
        if (!(key in next) || deviceId === state.selectedDeviceId) {
          next[key] = deviceId === state.selectedDeviceId;
        }
      });
      return next;
    });
  }, [state.selectedDeviceId, state.studyPresetId, state.topology.deviceIds]);

  const parameterSectionKeys = Object.keys(parameterSections);
  const analysisSectionKeys = Object.keys(analysisSections);
  const anyParameterOpen = parameterSectionKeys.some((key) => parameterSections[key]);
  const anyAnalysisOpen = analysisSectionKeys.some((key) => analysisSections[key]);
  const setParameterSectionGroup = (next: boolean) =>
    setParameterSections(Object.fromEntries(parameterSectionKeys.map((key) => [key, next])));
  const setAnalysisSectionGroup = (next: boolean) =>
    setAnalysisSections(Object.fromEntries(analysisSectionKeys.map((key) => [key, next])));

  const analysisModel = useMemo(
    () => buildOvercurrentAnalysisModel(state, timelineSnapshot),
    [state, timelineSnapshot],
  );

  const handleTimelineSnapshotChange = useCallback((snapshot: TimelineSnapshot | null) => {
    setTimelineSnapshot(snapshot);
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setTimelineSnapshot(null);
    setParameterDraftValid(true);
    setSyncKey((k) => k + 1);
  }, []);

  // The global header reports executed/validated state, not a predicted
  // static operating result for a merely selected fault case. Detailed
  // predicted pickup/trip information remains available in Analysis/TCC.
  const headerUsesEngineeringOutcome = state.playbackState !== 'IDLE'
    || state.validationState.status === 'COMPLETE';
  const statusLabel = !parameterDraftValid || analysisModel.status === 'INVALID'
    ? 'INPUT INVALID'
    : headerUsesEngineeringOutcome
      ? analysisModel.headline.label
      : 'READY';
  const statusTone: SimulatorHeaderTone = !parameterDraftValid || analysisModel.status === 'INVALID'
    ? 'invalid'
    : headerUsesEngineeringOutcome
      ? headerTone(analysisModel.headline.tone)
      : 'neutral';
  const parameters = (
    <OvercurrentParameterPanel
      state={state}
      dispatch={dispatch}
      syncKey={syncKey}
      onValidityChange={setParameterDraftValid}
      sections={parameterSections}
      setSections={setParameterSections}
    />
  );

  const simulation = (
    <div className='overcurrent-live-stack'>
      {!parameterDraftValid && (
        <div className='overcurrent-page-invalid' role='status' aria-live='polite'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>Correct the highlighted parameter draft before starting or validating an engineering run.</span>
        </div>
      )}
      <TimeCurrentCurve state={state} dispatch={dispatch} />
      <RadialProtectionDiagram
        state={state}
        dispatch={dispatch}
        timelineSnapshot={timelineSnapshot}
      />
      <OperatingSequence
        state={state}
        dispatch={dispatch}
        onTimelineSnapshotChange={handleTimelineSnapshotChange}
      />
    </div>
  );

  const analysis = (
    <OvercurrentAnalysisPanel
      state={state}
      dispatch={dispatch}
      timelineSnapshot={timelineSnapshot}
      inputDraftValid={parameterDraftValid}
      sections={analysisSections}
      setSections={setAnalysisSections}
    />
  );

  return (
    <div className='overcurrent-simulator-page simulator-theme relative flex h-full min-h-0 flex-col'>
      <SimulatorHeader
        moduleLabel='Overcurrent Relay'
        scenario={state.studyDefinition.label}
        status={statusLabel}
        statusLabel={statusLabel}
        statusTone={statusTone}
        onReset={reset}
        onHelp={() => setHelpOpen(true)}
        helpAriaLabel='Open Overcurrent relay help'
      />
      <div className='min-h-0 flex-1'>
        <SimulatorLayout
          parameters={parameters}
          simulation={simulation}
          analysis={analysis}
          parametersAction={<button type='button' className='section-utility-button' onClick={() => setParameterSectionGroup(!anyParameterOpen)}>{anyParameterOpen ? 'Collapse all' : 'Expand all'}</button>}
          analysisAction={<button type='button' className='section-utility-button' onClick={() => setAnalysisSectionGroup(!anyAnalysisOpen)}>{anyAnalysisOpen ? 'Collapse all' : 'Expand all'}</button>}
        />
      </div>

      <EngineeringViewOverlay
        open={helpOpen}
        title='Overcurrent Relay Reference'
        kicker='Protection reference'
        onClose={() => setHelpOpen(false)}
        className='overcurrent-help-overlay'
      >
        <div className='overcurrent-help-grid'>
          <section>
            <h3>50 vs 51</h3>
            <p><b>50 Instantaneous</b> operates above its enabled high-set threshold with no intentional relay delay in this simulator. <b>51 Time Overcurrent</b> operates above pickup using the selected inverse or definite-time characteristic.</p>
          </section>
          <section>
            <h3>Pickup vs Trip</h3>
            <p>Pickup means measured relay current is strictly above the enabled threshold. A picked-up 51 element still requires its operating time to expire before trip output.</p>
          </section>
          <section>
            <h3>Current multiple</h3>
            <p><span className='font-eng'>M = Irelay / Ipickup</span>. Inverse 51 time is evaluated only for <span className='font-eng'>M &gt; 1</span>.</p>
          </section>
          <section>
            <h3>TMS / Time Dial</h3>
            <p>IEC inverse curves use the TMS label. IEEE inverse curves use Time Dial. Both scale the accepted curve equation without changing measured current.</p>
          </section>
          <section>
            <h3>Supported curves</h3>
            <p>IEC Standard, Very, and Extremely Inverse; IEEE Moderately, Very, and Extremely Inverse; plus Definite Time.</p>
          </section>
          <section>
            <h3>Primary, backup &amp; CTI</h3>
            <p>The intended primary should clear first. Adjacent upstream backups are checked against the configured coordination-time interval (CTI) requirement.</p>
          </section>
          <section>
            <h3>Load / minimum-fault window</h3>
            <p>Pickup must remain secure above configured maximum load while the intended relay still detects the configured minimum fault. Coordination validation checks both conditions where required.</p>
          </section>
          <section>
            <h3>Apply Fault vs Run Coordination Test</h3>
            <p><b>Apply Fault</b> runs one selected discrete time-domain experiment. <b>Run Coordination Test</b> evaluates every configured validation case and is required for Guided-study verification.</p>
          </section>
          <section className='overcurrent-help-limit'>
            <h3>Study-data limitation</h3>
            <p>Fault currents, locations, profiles, and interpolation are configured study data. This release does not contain a hidden short-circuit network solver, directional element, CT saturation model, or ring/meshed coordination solver.</p>
          </section>
        </div>
      </EngineeringViewOverlay>
    </div>
  );
}
