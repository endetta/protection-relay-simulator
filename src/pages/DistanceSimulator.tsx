import { useCallback, useMemo, useReducer } from 'react';
import { SimulatorLayout } from '../layouts/SimulatorLayout';
import { SimulatorHeader } from '../components/SimulatorHeader';
import { NumberField } from '../components/shared/NumberField';
import { ParameterGroup } from '../components/shared/ParameterGroup';
import { InfoDot } from '../components/shared/InfoDot';
import { evaluateDistanceDevice } from '../engines/distanceMeasurement';
import { computeDistanceTimeline } from '../engines/distanceTimeline';
import {
  createInitialDistanceState,
  deriveDistanceStudy,
  distanceStateReducer,
  faultTypeLabel,
} from '../utils/distanceState';
import { DEFAULT_DISTANCE_PRESET_ID, DISTANCE_STUDY_PRESETS } from '../studies/distancePresets';
import type { DistanceFaultType, DistanceStudyPresetId } from '../types/distance';
import { DistanceOneLine } from '../components/distance/DistanceOneLine';
import { RxPlane } from '../components/distance/RxPlane';
import { DistanceAnalysisPanel } from '../components/distance/DistanceAnalysisPanel';
import { DistanceOperatingSequence } from '../components/distance/DistanceOperatingSequence';

/**
 * Distance Relay Simulator — D03 / D04 / D05 / D06 page.
 *
 * Composes the D02 pure engine, the D03 study-state reducer, the D04
 * one-line diagram, the D05 R/X plane, and the D06 Analysis panel into
 * a single authoritative workspace. UI hierarchy follows Differential
 * R10 / Overcurrent O15: graphite surfaces, steel-cyan accent, green =
 * RESTRAIN, red = OPERATE, amber = warning / invalid / load.
 */

const FAULT_TYPES: readonly { id: DistanceFaultType; label: string }[] = [
  { id: 'THREE_PHASE', label: '3-Phase' },
  { id: 'PHASE_PHASE', label: 'Phase-Phase' },
  { id: 'SINGLE_LINE_GROUND', label: 'SLG' },
];

const RX_DOMAIN_HALF_OHM = 16;

export function DistanceSimulator() {
  const [state, dispatch] = useReducer(distanceStateReducer, undefined, () => createInitialDistanceState(DEFAULT_DISTANCE_PRESET_ID));
  const derived = useMemo(() => deriveDistanceStudy(state), [state]);

  const result = useMemo(
    () =>
      evaluateDistanceDevice({
        vLLKvPrimary: state.study.system.vLLKvPrimary,
        faultCurrentA: state.study.faultCurrentA,
        faultType: state.study.faultType,
        k0: state.study.k0,
        rArcOhmPrimary: state.study.settings.rArcOhmPrimary,
        z1AngleDeg: state.study.line.z1AngleDeg,
        settings: state.study.settings,
        faultPct: state.study.faultPct,
      }),
    [state.study],
  );

  const statusTone =
    result.displayStatus === 'OPERATE' ? 'operate' : result.displayStatus === 'INVALID' ? 'invalid' : 'restrain';

  const timeline = useMemo(() => computeDistanceTimeline(state.study), [state.study]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const applyPreset = useCallback((id: DistanceStudyPresetId) => dispatch({ type: 'APPLY_PRESET', presetId: id }), []);

  const arcBlindspotWarning = state.study.settings.rArcOhmPrimary > 0;

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <SimulatorHeader
        scenario={`${derived.presetLabel} · ${faultTypeLabel(state.study.faultType)}`}
        status={result.displayStatus}
        statusTone={statusTone}
        moduleLabel='Distance Relay'
        onReset={reset}
      />
      <div className='min-h-0 flex-1'>
        <SimulatorLayout
          parameters={
            <div className='flex flex-col gap-2'>
              <ParameterGroup title='Presets' defaultOpen={true} summary={state.modified ? <span className='text-[10px] text-[#ffb020]'>MODIFIED</span> : undefined}>
                <div className='flex flex-col gap-1'>
                  {DISTANCE_STUDY_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type='button'
                      className={`rounded border px-2 py-1 text-left text-[11px] ${state.presetId === preset.id ? 'border-[#3aa0ff] text-[#3aa0ff]' : 'border-[#2a3340] text-[#9fb0c0] hover:border-[#3a4654]'}`}
                      onClick={() => applyPreset(preset.id)}
                    >
                      <div className='font-semibold'>{preset.label}</div>
                      <div className='text-[10px] text-[#6b7a8a]'>{preset.description}</div>
                    </button>
                  ))}
                </div>
              </ParameterGroup>

              <ParameterGroup title='System' defaultOpen={true} summary={<InfoDot help='Primary line-to-line voltage (kV) and study frequency (Hz). Frequency is a display label only; the impedance equations do not change with frequency.' />}>
                <NumberField label='V LL (kV)' unit='kV' value={state.study.system.vLLKvPrimary} min={1} max={1000} step={1} onChange={(v) => dispatch({ type: 'SET_SYSTEM', patch: { vLLKvPrimary: v } })} />
                <NumberField label='Length' unit='km' value={state.study.line.lengthKm} min={1} max={1000} step={1} onChange={(v) => dispatch({ type: 'SET_LINE', patch: { lengthKm: v } })} />
                <NumberField label='z1 (Ω/km)' unit='Ω/km' value={state.study.line.z1OhmPerKmPrimary} min={0.01} max={5} step={0.01} onChange={(v) => dispatch({ type: 'SET_LINE', patch: { z1OhmPerKmPrimary: v } })} />
                <NumberField label='z0 (Ω/km)' unit='Ω/km' value={state.study.line.z0OhmPerKmPrimary} min={0.01} max={10} step={0.01} onChange={(v) => dispatch({ type: 'SET_LINE', patch: { z0OhmPerKmPrimary: v } })} />
              </ParameterGroup>

              <ParameterGroup title='Fault' defaultOpen={true} summary={<InfoDot help='Study fault current (A), fault type, location along the line (%), and zero-sequence compensation factor k₀ for SLG.' />}>
                <NumberField label='Fault current' unit='A' value={state.study.faultCurrentA} min={0} max={100000} step={100} onChange={(v) => dispatch({ type: 'SET_FAULT_CURRENT_A', value: v })} />
                <div className='flex gap-1'>
                  {FAULT_TYPES.map((ft) => (
                    <button
                      key={ft.id}
                      type='button'
                      className={`flex-1 rounded border px-1 py-1 text-[10.5px] ${state.study.faultType === ft.id ? 'border-[#3aa0ff] text-[#3aa0ff]' : 'border-[#2a3340] text-[#9fb0c0]'}`}
                      onClick={() => dispatch({ type: 'SET_FAULT_TYPE', value: ft.id })}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
                <NumberField label='Fault location' unit='%' value={state.study.faultPct} min={0} max={100} step={1} onChange={(v) => dispatch({ type: 'SET_FAULT_PCT', value: v })} />
                {state.study.faultType === 'SINGLE_LINE_GROUND' && (
                  <NumberField label='k₀ (SLG)' unit='' value={state.study.k0} min={-0.99} max={5} step={0.05} onChange={(v) => dispatch({ type: 'SET_K0', value: v })} />
                )}
                <NumberField label='R arc' unit='Ω' value={state.study.settings.rArcOhmPrimary} min={0} max={500} step={1} onChange={(v) => dispatch({ type: 'SET_ARC_OHM_PRIMARY', value: v })} />
              </ParameterGroup>

              <ParameterGroup title='Zone 1' defaultOpen={true}>
                <NumberField label='Z1 reach' unit='Ω sec' value={state.study.settings.zone1.reachOhmSecondary} min={0.1} max={50} step={0.1} onChange={(v) => dispatch({ type: 'SET_ZONE', zone: 1, patch: { reachOhmSecondary: v } })} />
                <NumberField label='θ char' unit='°' value={state.study.settings.zone1.thetaCharDeg} min={0} max={90} step={1} onChange={(v) => dispatch({ type: 'SET_ZONE', zone: 1, patch: { thetaCharDeg: v } })} />
              </ParameterGroup>
              <ParameterGroup title='Zone 2' defaultOpen={true}>
                <NumberField label='Z2 reach' unit='Ω sec' value={state.study.settings.zone2.reachOhmSecondary} min={0.1} max={50} step={0.1} onChange={(v) => dispatch({ type: 'SET_ZONE', zone: 2, patch: { reachOhmSecondary: v } })} />
                <NumberField label='θ char' unit='°' value={state.study.settings.zone2.thetaCharDeg} min={0} max={90} step={1} onChange={(v) => dispatch({ type: 'SET_ZONE', zone: 2, patch: { thetaCharDeg: v } })} />
                <NumberField label='Z2 delay' unit='s' value={state.study.settings.zone2.timeDelaySec} min={0} max={5} step={0.05} onChange={(v) => dispatch({ type: 'SET_ZONE', zone: 2, patch: { timeDelaySec: v } })} />
              </ParameterGroup>
              <ParameterGroup title='Zone 3' defaultOpen={true}>
                <NumberField label='Z3 reach' unit='Ω sec' value={state.study.settings.zone3.reachOhmSecondary} min={0.1} max={50} step={0.1} onChange={(v) => dispatch({ type: 'SET_ZONE', zone: 3, patch: { reachOhmSecondary: v } })} />
                <NumberField label='Z3 delay' unit='s' value={state.study.settings.zone3.timeDelaySec} min={0} max={5} step={0.05} onChange={(v) => dispatch({ type: 'SET_ZONE', zone: 3, patch: { timeDelaySec: v } })} />
              </ParameterGroup>

              <ParameterGroup title='Breaker' defaultOpen={true} summary={<InfoDot help='Breaker clearing time applied after the trip output. This is a study-model value; mechanical breaker dynamics are out of scope.' />}>
                <NumberField label='Clearing time' unit='s' value={state.study.settings.breaker.clearingTimeSec} min={0} max={5} step={0.05} onChange={(v) => dispatch({ type: 'SET_BREAKER', patch: { clearingTimeSec: v } })} />
              </ParameterGroup>
            </div>
          }
          simulation={
            <div className='flex h-full min-h-0 flex-col gap-2'>
              <DistanceOneLine
                faultPct={state.study.faultPct}
                tripZone={result.tripZone}
                displayStatus={result.displayStatus}
                loadRegion={result.loadRegion}
                lineLengthKm={state.study.line.lengthKm}
                systemKv={state.study.system.vLLKvPrimary}
                className='flex-shrink-0'
              />
              <div className='min-h-0 flex-1'>
                <RxPlane
                  impedance={result.impedance}
                  zone1={state.study.settings.zone1}
                  zone2={state.study.settings.zone2}
                  zone3={state.study.settings.zone3}
                  load={state.study.settings.loadEncroachment}
                  loadRegion={result.loadRegion}
                  domainHalfOhm={RX_DOMAIN_HALF_OHM}
                />
              </div>
              {arcBlindspotWarning && (
                <div className='rounded border border-[#ffb020]/40 bg-[#ffb020]/8 px-2.5 py-1.5 text-[11px] text-[#ffb020]'>
                  Arc resistance is non-zero. The mho blind spot may shift the apparent impedance outside the zone; the simplified model does not auto-compensate.
                </div>
              )}
            </div>
          }
          analysis={
            <div className='flex flex-col gap-2'>
              <DistanceAnalysisPanel result={result} faultPct={state.study.faultPct} lineLengthKm={state.study.line.lengthKm} />
              <DistanceOperatingSequence timeline={timeline} />
            </div>
          }
        />
      </div>
    </div>
  );
}
