import { useCallback, useMemo, useReducer, useState } from 'react';
import { SimulatorHeader, type SimulatorHeaderTone } from '../components/SimulatorHeader';
import { EngineeringViewOverlay } from '../components/shared/EngineeringViewOverlay';
import { FrequencyTimelineChart } from '../components/underfrequency/FrequencyTimelineChart';
import { GeneratorDiagram } from '../components/underfrequency/GeneratorDiagram';
import { SheddingChart } from '../components/underfrequency/SheddingChart';
import { UnderfrequencyAnalysisPanel } from '../components/underfrequency/UnderfrequencyAnalysisPanel';
import { UnderfrequencyParameterPanel } from '../components/underfrequency/UnderfrequencyParameterPanel';
import { UnderfrequencySld } from '../components/underfrequency/UnderfrequencySld';
import { SimulatorLayout } from '../layouts/SimulatorLayout';
import { buildUnderfrequencyAnalysisModel, type UnderfrequencyTone } from '../presentation/underfrequencyAnalysis';
import { buildUnderfrequencySldModel } from '../presentation/underfrequencySld';
import { snapshotAtTime } from '../presentation/underfrequencyTimelineChart';
import { computeUnderfrequencyTimeline } from '../engines/underfrequencyTimeline';
import { useUnderfrequencyPlayback } from './underfrequencyPlayback';
import type {
  UnderfrequencyTimelineSnapshot,
} from '../types/underfrequency';
import {
  createInitialUnderfrequencyState,
  underfrequencyReducer,
} from '../utils/underfrequencyState';
import { evaluateActiveUnderfrequency, canBeginUnderfrequencyRun } from '../utils/evaluateUnderfrequencyParameters';
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
  const [parameterDraftValid, setParameterDraftValid] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  // View mode: UI preference, not engineering state (D1/D5).
  const [viewMode, setViewMode] = useState<'sld' | 'curve' | 'split'>('sld');
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
    calculation: true,
    events: false,
  }));

  // Parameter groups comprise the static study/system/relay/UFLS/disturbance/
  // simulation sections plus one collapsible group per generator (gen:G1..G4).
  // The generator keys are dynamic — they follow the study's generator set — so
  // they must be derived from state.study.generators here. `Object.keys(parameterSections)`
  // alone misses them, which is why collapse-all used to leave G1..G4 open (a
  // missing `open` key falls back to `defaultOpen = true` in ParameterGroup).
  const parameterSectionKeys = [
    'study', 'system', 'relay', 'ufls', 'disturbance', 'simulation',
    ...state.study.generators.map((g) => `gen:${g.id}`),
  ];
  const analysisSectionKeys = Object.keys(analysisSections);
  const anyParameterOpen = parameterSectionKeys.some((key) => parameterSections[key] ?? true);
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

  // Page-level playback clock: one scrubTimeSec in the reducer, one snapshot
  // resolution here — every consumer (SLD, chart, generator diagram) renders
  // from the same visible snapshot, so views stay synchronized.
  const totalTimeSec = run?.finalTimeSec ?? 0;
  useUnderfrequencyPlayback({
    playbackState: state.playbackState,
    simulationSpeed: state.simulationSpeed,
    totalTimeSec,
    scrubTimeSec: state.scrubTimeSec,
    dispatch,
  });

  const visibleSnapshot: UnderfrequencyTimelineSnapshot | null = useMemo(() => {
    if (!run || run.status !== 'VALID' || run.snapshots.length === 0) return null;
    return snapshotAtTime(run.snapshots, state.scrubTimeSec);
  }, [run, state.scrubTimeSec]);

  const sldModel = useMemo(
    () => buildUnderfrequencySldModel(state.study, visibleSnapshot, run),
    [state.study, visibleSnapshot, run],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
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

  const playbackDisabled = !parameterDraftValid || !canBeginUnderfrequencyRun(state);
  const isRunning = state.playbackState === 'RUNNING';
  const isPaused = state.playbackState === 'PAUSED';
  const canScrub = run?.status === 'VALID' && run.snapshots.length > 0 && totalTimeSec > 0;
  const scrubValue = state.scrubTimeSec ?? 0;

  const playbackBar = (
    <div className='underfrequency-playback' role='group' aria-label='Kontrol pemutaran simulasi global'>
      <div className='underfrequency-playback-buttons'>
        {isRunning ? (
          <button
            type='button'
            className='underfrequency-action-button'
            aria-label='Jeda pemutaran'
            onClick={() => dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'PAUSED' })}
          >
            Pause
          </button>
        ) : isPaused ? (
          <button
            type='button'
            className='underfrequency-action-button'
            aria-label='Lanjutkan pemutaran'
            onClick={() => dispatch({ type: 'SET_PLAYBACK_STATE', playbackState: 'RUNNING' })}
          >
            Resume
          </button>
        ) : (
          <button
            type='button'
            className='underfrequency-action-button'
            data-tone='primary'
            disabled={playbackDisabled}
            aria-label='Mulai engineering run'
            onClick={() => dispatch({ type: 'BEGIN_RUN' })}
          >
            Run
          </button>
        )}
        <button
          type='button'
          className='underfrequency-action-button'
          disabled={state.playbackState === 'IDLE'}
          aria-label='Bersihkan run'
          onClick={() => dispatch({ type: 'CLEAR_RUN' })}
        >
          Clear
        </button>
      </div>

      <div className='underfrequency-speed' role='group' aria-label='Kecepatan pemutaran'>
        {([1, 5, 10] as const).map((speed) => (
          <button
            key={speed}
            type='button'
            aria-pressed={state.simulationSpeed === speed}
            aria-label={`Set kecepatan ${speed}×`}
            data-active={state.simulationSpeed === speed ? 'true' : 'false'}
            onClick={() => dispatch({ type: 'SET_SIMULATION_SPEED', speed })}
          >
            {speed}×
          </button>
        ))}
      </div>

      <div className='underfrequency-scrub'>
        <input
          type='range'
          min={0}
          max={totalTimeSec > 0 ? totalTimeSec : 1}
          step={0.01}
          value={canScrub ? scrubValue : 0}
          disabled={!canScrub}
          aria-label='Geser waktu simulasi'
          onChange={(e) => dispatch({ type: 'SET_SCRUB_TIME', timeSec: Number.parseFloat(e.target.value) })}
        />
        <span className='underfrequency-scrub-readout font-eng'>
          {scrubValue.toFixed(2)}s / {totalTimeSec.toFixed(2)}s
        </span>
      </div>

      <div
        className='underfrequency-run-status'
        role='status'
        aria-live='polite'
        aria-atomic='true'
        data-state={!parameterDraftValid ? 'invalid' : state.playbackState.toLowerCase()}
      >
        <span>Run</span>
        <b>{!parameterDraftValid ? 'INPUT INVALID · OUTPUT HELD' : state.playbackState}</b>
      </div>
    </div>
  );

  const viewTabs = (
    <div className='underfrequency-view-tabs' role='tablist' aria-label='Mode tampilan simulasi'>
      {(['sld', 'curve', 'split'] as const).map((mode) => (
        <button
          key={mode}
          type='button'
          role='tab'
          id={`underfrequency-tab-${mode}`}
          aria-selected={viewMode === mode}
          aria-controls='underfrequency-view-panel'
          data-active={viewMode === mode ? 'true' : 'false'}
          onClick={() => setViewMode(mode)}
        >
          {mode === 'sld' ? 'SLD' : mode === 'curve' ? 'Curve' : 'Split'}
        </button>
      ))}
    </div>
  );

  const sldView = <UnderfrequencySld model={sldModel} />;
  const curveView = (
    <FrequencyTimelineChart
      run={run}
      study={state.study}
      scrubTimeSec={state.scrubTimeSec}
      visibleSnapshot={visibleSnapshot}
    />
  );

  const viewPanel = (
    <div id='underfrequency-view-panel' role='tabpanel' aria-labelledby={`underfrequency-tab-${viewMode}`} className='underfrequency-view-panel'>
      {viewMode === 'sld' && sldView}
      {viewMode === 'curve' && curveView}
      {viewMode === 'split' && (
        <div className='underfrequency-split'>
          {sldView}
          {curveView}
        </div>
      )}
    </div>
  );

  const simulation = (
    <div className='underfrequency-live-stack'>
      {!parameterDraftValid && (
        <div className='underfrequency-page-invalid' role='status' aria-live='polite'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>Perbaiki draf parameter yang disorot sebelum memulai engineering run.</span>
        </div>
      )}
      {playbackBar}
      {viewTabs}
      {viewPanel}
      <div className='underfrequency-live-cards'>
        <GeneratorDiagram snapshot={visibleSnapshot} study={state.study} />
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
        helpAriaLabel='Buka bantuan Underfrequency Relay'
        intl={{
          scenarioPrefix: 'Skenario: ',
          resetLabel: 'Atur ulang',
          homeAriaLabel: 'Kembali ke halaman utama Protection System Simulator',
          homeTitle: 'Kembali ke halaman utama',
        }}
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
          parametersAction={<button type='button' className='section-utility-button' onClick={() => setParameterSectionGroup(!anyParameterOpen)}>{anyParameterOpen ? 'Collapse' : 'Expand'}</button>}
          analysisAction={<button type='button' className='section-utility-button' onClick={() => setAnalysisSectionGroup(!anyAnalysisOpen)}>{anyAnalysisOpen ? 'Collapse' : 'Expand'}</button>}
          intl={{
            skipToParameters: 'Lompat ke parameter',
            stepsAriaLabel: 'Langkah simulasi',
            sectionsAriaLabel: 'Bagian simulasi',
            showAllLabel: 'Tampilkan semua',
            parametersTitle: 'Parameter',
            simulationTitle: 'Simulasi',
            analysisTitle: 'Analisis',
            liveTitle: 'Simulasi Langsung',
            parametersAriaLabel: 'Area gulir parameter',
            simulationAriaLabel: 'Area gulir simulasi langsung',
            analysisAriaLabel: 'Area gulir analisis',
          }}
        />
      </div>

      <EngineeringViewOverlay
        open={helpOpen}
        title='Referensi Underfrequency Relay'
        kicker='Proteksi Underfrequency'
        onClose={() => setHelpOpen(false)}
        className='underfrequency-help-overlay'
        intl={{
          defaultKicker: 'Tampilan engineering diperluas',
          closeLabel: 'Tutup',
          closeAriaLabel: (t) => `Tutup ${t}`,
        }}
      >
        <div className='underfrequency-help-grid'>
          <section>
            <h3>Underfrequency (81U)</h3>
            <p>Sebuah <b>81U underfrequency relay</b> mengukur frekuensi sistem dan beroperasi (underpick) ketika frekuensi turun di bawah threshold yang disetel. Elemen ini adalah elemen proteksi di balik skema <b>UFLS (Underfrequency Load Shedding)</b> yang melepas beban untuk menghentikan penurunan frekuensi setelah defisit pembangkitan.</p>
          </section>
          <section>
            <h3>Inertia &amp; ROCOF</h3>
            <p>Pembangkit yang hilang menimbulkan defisit netto <span className='font-eng'>D₀</span>. Inertia island <span className='font-eng'>H_sys</span> menentukan laju perubahan awal: <span className='font-eng'>df/dt|₀ = −(f_nom/(2·H_sys))·(D₀/S_base)</span>. Semakin besar inertia, semakin lambat penurunan awal.</p>
          </section>
          <section>
            <h3>Governor / droop response</h3>
            <p>Setiap unit sinkron menaikkan output sesuai <b>droop</b>-nya: <span className='font-eng'>resp_i = −(Δf/f_nom)·(MVA_i/R_i)</span>, dibatasi oleh headroom yang tersedia. Ketika semua unit jenuh, <span className='font-eng'>β_pu</span> habis dan risiko collapse meningkat.</p>
          </section>
          <section>
            <h3>UFLS ladder</h3>
            <p>Stage ber-armed (siap) ketika <span className='font-eng'>f &lt; threshold</span> (strict, bukan sama). Setelah delay yang disetel, stage trip dan melepas sebagian dari base load sebelum gangguan. Threshold harus menurun antar stage (Stage 1 tertinggi).</p>
          </section>
          <section>
            <h3>Strict pickup</h3>
            <p>Pickup menggunakan pertidaksamaan strict ditambah toleransi: <span className='font-eng'>f &lt; threshold &amp;&amp; !nearlyEqual(f, threshold)</span>. Tepat di threshold, relay tidak ber-armed.</p>
          </section>
          <section>
            <h3>Generator RPM</h3>
            <p>Untuk mesin sinkron, <span className='font-eng'>N = 120·f/poles</span>. Setiap unit mencakup 1–2 poles per pasangan; diagram menunjukkan kecepatan yang dihasilkan pada frekuensi saat ini.</p>
          </section>
          <section>
            <h3>Run vs Static reference</h3>
            <p>Timeline <b>Run</b> adalah solusi time-domain penuh termasuk UFLS delays dan peristiwa governor saturation. Hasil closed-form statis adalah parity reference yang dituju, dipakai sebagai fallback ketika tidak ada run.</p>
          </section>
          <section className='underfrequency-help-limit'>
            <h3>PLN-standard note</h3>
            <p>Threshold UFLS dan shed fraction mencerminkan <b>praktik island PLN yang umum</b> (49.50/49.00/48.50/48.00 Hz, 5/10/15/20%) dan ditandai <span className='font-eng'>plnVerificationRequired</span> menunggu pengecekan grid-code resmi.</p>
          </section>
        </div>
      </EngineeringViewOverlay>
    </div>
  );
}
