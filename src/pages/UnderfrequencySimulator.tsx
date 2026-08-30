import { useCallback, useMemo, useReducer, useState } from 'react';
import { SimulatorHeader, type SimulatorHeaderTone } from '../components/SimulatorHeader';
import { EngineeringViewOverlay } from '../components/shared/EngineeringViewOverlay';
import { FrequencyTimelineChart } from '../components/underfrequency/FrequencyTimelineChart';
import { GeneratorDiagram } from '../components/underfrequency/GeneratorDiagram';
import { SheddingChart } from '../components/underfrequency/SheddingChart';
import { UnderfrequencyAnalysisPanel } from '../components/underfrequency/UnderfrequencyAnalysisPanel';
import { UnderfrequencyParameterPanel } from '../components/underfrequency/UnderfrequencyParameterPanel';
import { SimulatorLayout } from '../layouts/SimulatorLayout';
import { buildUnderfrequencyAnalysisModel, type UnderfrequencyTone } from '../presentation/underfrequencyAnalysis';
import { computeUnderfrequencyTimeline } from '../engines/underfrequencyTimeline';
import type {
  UnderfrequencyTimelineSnapshot,
} from '../types/underfrequency';
import {
  createInitialUnderfrequencyState,
  underfrequencyReducer,
} from '../utils/underfrequencyState';
import { evaluateActiveUnderfrequency } from '../utils/evaluateUnderfrequencyParameters';
import './underfrequencySimulator.css';

function headerTone(tone: UnderfrequencyTone): SimulatorHeaderTone {
  if (tone === 'danger') return 'operate';
  if (tone === 'warning') return 'invalid';
  if (tone === 'success') return 'restrain';
  if (tone === 'normal') return 'neutral';
  return 'info';
}

export function UnderfrequencySimulator() {
  const [state, dispatch] = useReducer(
    underfrequencyReducer,
    undefined,
    createInitialUnderfrequencyState,
  );
  const [timelineSnapshot, setTimelineSnapshot] = useState<UnderfrequencyTimelineSnapshot | null>(null);
  const [parameterDraftValid, setParameterDraftValid] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  // Step-guide focus: Langkah 1 (Parameters) is focused on load; other columns
  // are softly dimmed but never locked. null -> "Show all" clears the focus.
  const [focusStep, setFocusStep] = useState<string | null>('sim-parameters');

  const [parameterSections, setParameterSections] = useState<Record<string, boolean>>(() => ({
    study: true,
    system: true,
    relay: true,
    ufls: true,
    disturbance: true,
    simulation: true,
  }));
  const [analysisSections, setAnalysisSections] = useState<Record<string, boolean>>(() => ({
    status: true,
    study: false,
    checks: true,
    summary: true,
    phases: false,
    calculation: false,
    events: false,
  }));

  const parameterSectionKeys = Object.keys(parameterSections);
  const analysisSectionKeys = Object.keys(analysisSections);
  const anyParameterOpen = parameterSectionKeys.some((key) => parameterSections[key]);
  const anyAnalysisOpen = analysisSectionKeys.some((key) => analysisSections[key]);
  const setParameterSectionGroup = (next: boolean) =>
    setParameterSections(Object.fromEntries(parameterSectionKeys.map((key) => [key, next])));
  const setAnalysisSectionGroup = (next: boolean) =>
    setAnalysisSections(Object.fromEntries(analysisSectionKeys.map((key) => [key, next])));

  // The timeline is memoised from the study on every engineering change. It is
  // the authoritative time-domain output; the static result is the closed-form
  // reference the parity tests converge to (and only the fallback in the UI).
  const run = useMemo(() => computeUnderfrequencyTimeline(state.study), [state.study]);
  const activeEvaluation = useMemo(() => evaluateActiveUnderfrequency(state), [state]);
  const staticResult = activeEvaluation.status === 'VALID' ? activeEvaluation.value.staticResult : null;

  const analysisModel = useMemo(
    () => buildUnderfrequencyAnalysisModel(state, staticResult, run),
    [state, staticResult, run],
  );

  const handleSnapshotChange = useCallback((snapshot: UnderfrequencyTimelineSnapshot | null) => {
    setTimelineSnapshot(snapshot);
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setTimelineSnapshot(null);
    setParameterDraftValid(true);
    setSyncKey((key) => key + 1);
  }, []);

  const statusLabel = !parameterDraftValid || analysisModel.status === 'INVALID'
    ? 'INPUT INVALID'
    : state.playbackState === 'RUNNING' || state.playbackState === 'PAUSED' || state.playbackState === 'COMPLETE'
      ? analysisModel.headline.label
      : 'READY';
  const statusTone: SimulatorHeaderTone = !parameterDraftValid || analysisModel.status === 'INVALID'
    ? 'invalid'
    : state.playbackState === 'RUNNING' || state.playbackState === 'PAUSED' || state.playbackState === 'COMPLETE'
      ? headerTone(analysisModel.headline.tone)
      : 'neutral';

  const parameters = (
    <UnderfrequencyParameterPanel
      state={state}
      dispatch={dispatch}
      syncKey={syncKey}
      onValidityChange={setParameterDraftValid}
      sections={parameterSections}
      setSections={setParameterSections}
    />
  );

  const simulation = (
    <div className='underfrequency-live-stack'>
      {!parameterDraftValid && (
        <div className='underfrequency-page-invalid' role='status' aria-live='polite'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>Correct the highlighted parameter draft before starting an engineering run.</span>
        </div>
      )}
      <FrequencyTimelineChart
        run={run}
        study={state.study}
        playbackState={state.playbackState}
        simulationSpeed={state.simulationSpeed}
        dispatch={dispatch}
        onSnapshotChange={handleSnapshotChange}
      />
      <div className='underfrequency-live-cards'>
        <GeneratorDiagram snapshot={timelineSnapshot} study={state.study} />
        <SheddingChart
          uflsStages={state.study.uflsStages}
          baseLoadMw={state.study.system.baseLoadMw}
          run={run}
        />
      </div>
    </div>
  );

  const analysis = (
    <UnderfrequencyAnalysisPanel
      state={state}
      staticResult={staticResult}
      run={run}
      inputDraftValid={parameterDraftValid}
      sections={analysisSections}
      setSections={setAnalysisSections}
    />
  );

  return (
    <div className='underfrequency-simulator-page simulator-theme relative flex h-full min-h-0 flex-col'>
      <SimulatorHeader
        moduleLabel='Underfrequency Relay'
        scenario={state.study.label}
        status={statusLabel}
        statusLabel={statusLabel}
        statusTone={statusTone}
        onReset={reset}
        onHelp={() => setHelpOpen(true)}
        helpAriaLabel='Open Underfrequency relay help'
      />
      <div className='min-h-0 flex-1'>
        <SimulatorLayout
          parameters={parameters}
          simulation={simulation}
          analysis={analysis}
          steps={[
            { id: 'sim-parameters', num: '1', label: 'Studi & Parameter' },
            { id: 'sim-live', num: '2', label: 'Simulasi' },
            { id: 'sim-analysis', num: '3', label: 'Analisis' },
          ]}
          activeStep={focusStep}
          onStepChange={setFocusStep}
          parametersAction={<button type='button' className='section-utility-button' onClick={() => setParameterSectionGroup(!anyParameterOpen)}>{anyParameterOpen ? 'Collapse all' : 'Expand all'}</button>}
          analysisAction={<button type='button' className='section-utility-button' onClick={() => setAnalysisSectionGroup(!anyAnalysisOpen)}>{anyAnalysisOpen ? 'Collapse all' : 'Expand all'}</button>}
        />
      </div>

      <EngineeringViewOverlay
        open={helpOpen}
        title='Underfrequency Relay Reference'
        kicker='Underfrequency protection'
        onClose={() => setHelpOpen(false)}
        className='underfrequency-help-overlay'
      >
        <div className='underfrequency-help-grid'>
          <section>
            <h3>Underfrequency (81U)</h3>
            <p>An <b>81U underfrequency relay</b> measures system frequency and underpicks when frequency falls below its set threshold. It is the protective element behind a <b>UFLS (Underfrequency Load Shedding)</b> scheme that sheds load to arrest the decay after a generation deficit.</p>
          </section>
          <section>
            <h3>Inertia &amp; ROCOF</h3>
            <p>A lost generation creates a net deficit <span className='font-eng'>D₀</span>. The island's inertia <span className='font-eng'>H_sys</span> sets the initial rate of change: <span className='font-eng'>df/dt|₀ = −(f_nom/(2·H_sys))·(D₀/S_base)</span>. Higher inertia damps the initial decline.</p>
          </section>
          <section>
            <h3>Governor / droop response</h3>
            <p>Each synchronous unit raises output by its <b>droop</b>: <span className='font-eng'>resp_i = −(Δf/f_nom)·(MVA_i/R_i)</span>, clamped to the available headroom. Saturating every unit exhausts <span className='font-eng'>β_pu</span> and risks collapse.</p>
          </section>
          <section>
            <h3>UFLS ladder</h3>
            <p>Stages arm when <span className='font-eng'>f &lt; threshold</span> (strict, not equal). After the set delay they trip and shed a fraction of the pre-disturbance base load. Thresholds must descend across stages (Stage 1 highest).</p>
          </section>
          <section>
            <h3>Strict pickup</h3>
            <p>Pickup uses a strict inequality plus a tolerance: <span className='font-eng'>f &lt; threshold &amp;&amp; !nearlyEqual(f, threshold)</span>. At exactly the threshold the relay does not arm.</p>
          </section>
          <section>
            <h3>Generator RPM</h3>
            <p>For a synchronous machine, <span className='font-eng'>N = 120·f/poles</span>. Each unit spans 1–2 poles per pair; the diagram shows the resulting speed at the current frequency.</p>
          </section>
          <section>
            <h3>Run vs Static reference</h3>
            <p>The <b>Run</b> timeline is the full time-domain solution including UFLS delays and governor saturation events. The static closed-form result is the parity reference it converges to, used as a fallback when no run exists.</p>
          </section>
          <section className='underfrequency-help-limit'>
            <h3>PLN-standard note</h3>
            <p>UFLS thresholds and shed fractions reflect <b>typical PLN island practice</b> (49.50/49.00/48.50/48.00 Hz, 5/10/15/20%) and are flagged <span className='font-eng'>plnVerificationRequired</span> pending an official grid-code check.</p>
          </section>
        </div>
      </EngineeringViewOverlay>
    </div>
  );
}
