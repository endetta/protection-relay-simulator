import { useCallback, useMemo, useReducer, useState } from 'react';
import { SimulatorHeader, type SimulatorHeaderTone } from '../components/SimulatorHeader';
import { EngineeringViewOverlay } from '../components/shared/EngineeringViewOverlay';
import { DistanceParameterPanel } from '../components/distance/DistanceParameterPanel';
import { DistanceOneLine } from '../components/distance/DistanceOneLine';
import { DistanceGuidedChallengeCard } from '../components/distance/DistanceGuidedChallengeCard';
import { RxPlane } from '../components/distance/RxPlane';
import { SimulatorLayout } from '../layouts/SimulatorLayout';
import { evaluateDistanceDevice } from '../engines/distanceMeasurement';
import type { DistanceOperatingResult } from '../types/distance';
import {
  createInitialDistanceState,
  distanceStateReducer,
} from '../utils/distanceState';
import './distanceSimulator.css';

function headerTone(status: DistanceOperatingResult['displayStatus']): SimulatorHeaderTone {
  if (status === 'OPERATE') return 'operate';
  if (status === 'INVALID') return 'invalid';
  return 'restrain';
}

export function DistanceSimulator() {
  const [state, dispatch] = useReducer(
    distanceStateReducer,
    undefined,
    createInitialDistanceState,
  );
  const [helpOpen, setHelpOpen] = useState(false);

  const result = useMemo<DistanceOperatingResult>(
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

  const statusLabel = result.displayStatus === 'INVALID' ? 'INPUT INVALID' : result.displayStatus;
  const statusTone = headerTone(result.displayStatus);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const leftColumn = (
    <div className='distance-parameter-col'>
      <DistanceParameterPanel state={state} dispatch={dispatch} />
      <RxPlane study={state.study} result={result} />
    </div>
  );

  const rightColumn = (
    <div className='distance-simulation-col'>
      {result.displayStatus === 'INVALID' && (
        <div className='distance-page-invalid' role='status' aria-live='polite'>
          <b>INPUT INVALID · OUTPUT HELD</b>
          <span>Correct the highlighted parameter before running the simulation.</span>
        </div>
      )}
      <DistanceOneLine study={state.study} />
      <DistanceGuidedChallengeCard study={state.study} />
    </div>
  );

  return (
    <div className='distance-simulator-page simulator-theme relative flex h-full min-h-0 flex-col'>
      <SimulatorHeader
        moduleLabel='Distance Relay'
        scenario={state.study.presetId ?? 'Custom'}
        status={statusLabel}
        statusTone={statusTone}
        onReset={reset}
        onHelp={() => setHelpOpen(true)}
        helpAriaLabel='Open Distance relay help'
      />
      <div className='min-h-0 flex-1'>
        <SimulatorLayout
          parameters={leftColumn}
          simulation={rightColumn}
          parametersAction={null}
          simulationAction={null}
        />
      </div>

      <EngineeringViewOverlay
        open={helpOpen}
        title='Distance Relay Reference'
        kicker='Protection reference'
        onClose={() => setHelpOpen(false)}
        className='distance-help-overlay'
      >
        <p>Distance relay reference content to be authored.</p>
      </EngineeringViewOverlay>
    </div>
  );
}