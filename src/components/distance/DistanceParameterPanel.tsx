import { memo, useId, type Dispatch } from 'react';
import { listDistanceStudyPresets } from '../../studies/distancePresets';
import type {
  DistanceCharacteristicType,
  DistanceFaultType,
  DistanceSchemeType,
  DistanceStudyPresetId,
  DistanceTopologyId,
  DistanceZoneSettings,
} from '../../types/distance';
import { SectionSummary, SummaryMetric, type SummaryTone } from '../shared/SectionSummary';
import { formatEngineeringNumber } from '../../utils/engineering';
import { evaluateDistanceDevice } from '../../engines/distanceMeasurement';
import type { DistanceAction, DistanceSimulatorState } from '../../utils/distanceState';
import { NumberField } from '../shared/NumberField';
import { ParameterGroup } from '../shared/ParameterGroup';
import './distanceParameterPanel.css';

export interface DistanceParameterPanelProps {
  readonly state: DistanceSimulatorState;
  readonly dispatch: Dispatch<DistanceAction>;
}

const TOPOLOGIES: readonly { value: DistanceTopologyId; label: string }[] = [
  { value: 'SINGLE_ENDED', label: 'SINGLE-ENDED' },
  { value: 'DOUBLE_ENDED', label: 'DOUBLE-ENDED' },
  { value: 'TAPPED', label: 'TAPPED LOAD' },
];

const SCHEMES: readonly { value: DistanceSchemeType; label: string }[] = [
  { value: 'NONE', label: 'DIRECT TRIP' },
  { value: 'PUTT', label: 'PUTT' },
  { value: 'POTT', label: 'POTT' },
  { value: 'DCB', label: 'DCB' },
  { value: 'DTT', label: 'DTT' },
];

const CHARACTERISTICS: readonly { value: DistanceCharacteristicType; label: string }[] = [
  { value: 'MHO_CIRCLE', label: 'MHO CIRCLE' },
  { value: 'QUADRILATERAL', label: 'QUADRILATERAL' },
];

const FAULT_TYPES: readonly { value: DistanceFaultType; label: string }[] = [
  { value: 'THREE_PHASE', label: 'THREE-PHASE' },
  { value: 'SINGLE_LINE_GROUND', label: 'SLG' },
  { value: 'PHASE_PHASE', label: 'PHASE-PHASE' },
];

function DistanceParameterPanelComponent({ state, dispatch }: DistanceParameterPanelProps) {
  const presets = listDistanceStudyPresets();
  const presetId = useId();
  const topologyId = useId();
  const schemeId = useId();
  const charId = useId();

  const { study } = state;
  const useQuad = study.settings.characteristicType === 'QUADRILATERAL';

  // Mirror the page's evaluation so the summary metrics stay live.
  const result = evaluateDistanceDevice({
    vLLKvPrimary: study.system.vLLKvPrimary,
    faultCurrentA: study.faultCurrentA,
    faultType: study.faultType,
    k0: study.k0,
    rArcOhmPrimary: study.settings.rArcOhmPrimary,
    z1AngleDeg: study.line.z1AngleDeg,
    settings: study.settings,
    faultPct: study.faultPct,
  });

  const statusTone: SummaryTone =
    result.displayStatus === 'OPERATE'
      ? 'danger'
      : result.displayStatus === 'INVALID'
        ? 'warning'
        : 'success';

  return (
    <section className='distance-parameter-panel simulator-theme' aria-label='Distance relay parameters'>
      <header className='distance-parameter-panel-header'>
        <span className='distance-parameter-panel-kicker'>Study · distance relay</span>
        <h2 className='distance-parameter-panel-title'>Parameters</h2>
      </header>

      <div className='distance-parameter-panel-body'>
        <ParameterGroup title='Preset'>
          <label htmlFor={presetId} className='distance-parameter-select'>
            <span className='distance-parameter-label'>PRESET</span>
            <select
              id={presetId}
              value={state.presetId}
              onChange={(event) =>
                dispatch({ type: 'APPLY_PRESET', presetId: event.target.value as DistanceStudyPresetId })
              }
              className='min-w-0 w-full rounded border px-2.5 py-2 text-[11.5px]'
              aria-label='Distance preset'
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.id} · {preset.label}
                </option>
              ))}
            </select>
          </label>
        </ParameterGroup>

        <ParameterGroup title='Topology & Scheme'>
          <label htmlFor={topologyId} className='distance-parameter-select'>
            <span className='distance-parameter-label'>TOPOLOGY</span>
            <select
              id={topologyId}
              value={study.topology}
              onChange={(event) =>
                dispatch({ type: 'SET_TOPOLOGY', topology: event.target.value as DistanceTopologyId })
              }
              className='min-w-0 w-full rounded border px-2.5 py-2 text-[11.5px]'
              aria-label='Topology'
            >
              {TOPOLOGIES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={schemeId} className='distance-parameter-select'>
            <span className='distance-parameter-label'>SCHEME</span>
            <select
              id={schemeId}
              value={study.scheme}
              onChange={(event) =>
                dispatch({ type: 'SET_SCHEME', scheme: event.target.value as DistanceSchemeType })
              }
              className='min-w-0 w-full rounded border px-2.5 py-2 text-[11.5px]'
              aria-label='Teleprotection scheme'
            >
              {SCHEMES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </ParameterGroup>

        <ParameterGroup title='Characteristic'>
          <label htmlFor={charId} className='distance-parameter-select'>
            <span className='distance-parameter-label'>CHARACTERISTIC</span>
            <select
              id={charId}
              value={study.settings.characteristicType}
              onChange={(event) =>
                dispatch({
                  type: 'SET_CHARACTERISTIC_TYPE',
                  characteristic: event.target.value as DistanceCharacteristicType,
                })
              }
              className='min-w-0 w-full rounded border px-2.5 py-2 text-[11.5px]'
              aria-label='Characteristic'
            >
              {CHARACTERISTICS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </ParameterGroup>

        <ParameterGroup title='Zones'>
          <ZoneFields zone={1} settings={state.study.settings.zone1} dispatch={dispatch} />
          <ZoneFields zone={2} settings={state.study.settings.zone2} dispatch={dispatch} />
          <ZoneFields zone={3} settings={state.study.settings.zone3} dispatch={dispatch} />
        </ParameterGroup>

        {useQuad && (
          <ParameterGroup title='Quadrilateral'>
            <NumberField
              label='Z REACH'
              unit='Ω'
              value={study.settings.quadrilateral.zReachOhmSecondary}
              min={1}
              max={200}
              step={0.5}
              onChange={(value) => dispatch({ type: 'SET_QUADRILATERAL', patch: { zReachOhmSecondary: value } })}
            />
            <NumberField
              label='K (BLINDER)'
              unit=''
              value={study.settings.quadrilateral.k}
              min={0}
              max={1}
              step={0.05}
              onChange={(value) => dispatch({ type: 'SET_QUADRILATERAL', patch: { k: value } })}
            />
            <NumberField
              label='α (BOTTOM TILT)'
              unit='°'
              value={study.settings.quadrilateral.alphaDeg}
              min={-30}
              max={30}
              step={1}
              onChange={(value) => dispatch({ type: 'SET_QUADRILATERAL', patch: { alphaDeg: value } })}
            />
            <NumberField
              label='β (TOP TILT)'
              unit='°'
              value={study.settings.quadrilateral.betaDeg}
              min={45}
              max={120}
              step={1}
              onChange={(value) => dispatch({ type: 'SET_QUADRILATERAL', patch: { betaDeg: value } })}
            />
          </ParameterGroup>
        )}

        <ParameterGroup title='Fault'>
          <label className='distance-parameter-select'>
            <span className='distance-parameter-label'>FAULT TYPE</span>
            <select
              value={study.faultType}
              onChange={(event) =>
                dispatch({ type: 'SET_FAULT_TYPE', value: event.target.value as DistanceFaultType })
              }
              className='min-w-0 w-full rounded border px-2.5 py-2 text-[11.5px]'
              aria-label='Fault type'
            >
              {FAULT_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label='FAULT CURRENT'
            unit='A'
            value={study.faultCurrentA}
            min={0}
            max={50000}
            step={50}
            onChange={(value) => dispatch({ type: 'SET_FAULT_CURRENT_A', value })}
          />
          <NumberField
            label='FAULT LOCATION'
            unit='%'
            value={study.faultPct}
            min={0}
            max={120}
            step={1}
            onChange={(value) => dispatch({ type: 'SET_FAULT_PCT', value })}
          />
          <NumberField
            label='ARC RESISTANCE'
            unit='Ω'
            value={study.settings.rArcOhmPrimary}
            min={0}
            max={200}
            step={1}
            onChange={(value) => dispatch({ type: 'SET_ARC_OHM_PRIMARY', value })}
          />
          <NumberField
            label='K₀ (ZERO-SEQ)'
            unit=''
            value={study.k0}
            min={-1}
            max={3}
            step={0.05}
            onChange={(value) => dispatch({ type: 'SET_K0', value })}
          />
        </ParameterGroup>

        <SectionSummary ariaLabel='Distance evaluation summary' columns={3}>
          <SummaryMetric label='STATUS' value={result.displayStatus} tone={statusTone} />
          <SummaryMetric
            label='Z APPARENT'
            value={formatEngineeringNumber(result.impedance.magnitudeOhmSecondary)}
            unit='Ω'
          />
          <SummaryMetric label='TRIP ZONE' value={result.tripZone ?? '—'} />
        </SectionSummary>
      </div>
    </section>
  );
}

function ZoneFields({ zone, settings, dispatch }: { zone: 1 | 2 | 3; settings: DistanceZoneSettings; dispatch: Dispatch<DistanceAction> }) {
  return (
    <fieldset className='distance-parameter-zone'>
      <legend className='distance-parameter-zone-legend'>Z{zone}</legend>
      <label className='distance-parameter-toggle'>
        <input
          type='checkbox'
          checked={settings.enabled}
          onChange={(event) => dispatch({ type: 'SET_ZONE', zone, patch: { enabled: event.target.checked } })}
        />
        <span>ENABLED</span>
      </label>
      <NumberField
        label={`Z${zone} REACH`}
        unit='Ω'
        value={settings.reachOhmSecondary}
        min={1}
        max={200}
        step={0.5}
        onChange={(value) => dispatch({ type: 'SET_ZONE', zone, patch: { reachOhmSecondary: value } })}
      />
      <NumberField
        label={`Z${zone} TILT`}
        unit='°'
        value={settings.thetaCharDeg}
        min={45}
        max={89}
        step={1}
        onChange={(value) => dispatch({ type: 'SET_ZONE', zone, patch: { thetaCharDeg: value } })}
      />
      <NumberField
        label={`Z${zone} DELAY`}
        unit='s'
        value={settings.timeDelaySec}
        min={0}
        max={2}
        step={0.05}
        onChange={(value) => dispatch({ type: 'SET_ZONE', zone, patch: { timeDelaySec: value } })}
      />
    </fieldset>
  );
}

export const DistanceParameterPanel = memo(DistanceParameterPanelComponent);
