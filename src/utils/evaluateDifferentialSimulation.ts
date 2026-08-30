import { calculateDifferential, type DifferentialResult } from '../engines/differential';
import { applyCT } from '../engines/measurementChain';
import { calculateSystemDerived, resolvePrimaryCurrents, type SystemDerived } from '../engines/systemModel';
import type { DifferentialSimulatorState } from './differentialState';

export interface ValidDifferentialSimulation {
  systemDerived: SystemDerived;
  i1s: number;
  i2s: number;
  result: DifferentialResult;
  margin: number;
}

export type DifferentialSimulationEvaluation =
  | { ok: true; value: ValidDifferentialSimulation }
  | { ok: false; error: string };

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Simulation arithmetic produced an invalid engineering result.';
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} exceeded the supported numeric range.`);
}

/**
 * Non-throwing evaluation boundary used by the UI.
 * Engine functions remain strict and may throw RangeError for invalid/non-finite
 * engineering arithmetic; this function converts those failures into an INVALID
 * simulator state so React rendering can keep the last valid result on screen.
 */
export function evaluateDifferentialSimulation(state: DifferentialSimulatorState): DifferentialSimulationEvaluation {
  try {
    const systemDerived = calculateSystemDerived(state.system);

    // In Load Driven mode, validate that the active physical condition can also
    // resolve finite terminal currents. This catches finite-but-overflowing fault
    // multiples even if the reducer intentionally retains the last safe currents.
    if (state.inputMode === 'load') resolvePrimaryCurrents(state.system, state.condition);

    const i1s = applyCT(state.i1p, state.ct1);
    const i2s = applyCT(state.i2p, state.ct2);
    const result = calculateDifferential({ i1: i1s, i2: i2s, ...state.settings });
    const margin = result.iDiff - result.iOpLimit;

    assertFinite(systemDerived.apparentLoadMVA, 'Derived apparent load');
    assertFinite(systemDerived.loadingPct, 'Loading percentage');
    assertFinite(systemDerived.ratedI1A, 'Terminal-1 rated current');
    assertFinite(systemDerived.ratedI2A, 'Terminal-2 rated current');
    assertFinite(systemDerived.loadI1A, 'Terminal-1 load current');
    assertFinite(systemDerived.loadI2A, 'Terminal-2 load current');
    assertFinite(i1s, 'CT1 measured current');
    assertFinite(i2s, 'CT2 measured current');
    assertFinite(result.iDiff, 'Differential current');
    assertFinite(result.iBias, 'Bias current');
    assertFinite(result.iOpLimit, 'Operate threshold');
    assertFinite(margin, 'Operate margin');

    return { ok: true, value: { systemDerived, i1s, i2s, result, margin } };
  } catch (error) {
    return { ok: false, error: toMessage(error) };
  }
}
