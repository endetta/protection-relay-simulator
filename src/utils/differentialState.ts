import type {
  DifferentialCharacteristicMode,
  DifferentialSettings,
  NumericDifferentialSettingKey,
} from '../engines/differential';
import type { CTConfig } from '../engines/measurementChain';
import { resolvePrimaryCurrents, type LoadDrivenSystem, type SystemCondition } from '../engines/systemModel';
import {
  DEFAULT_PRESET_ID,
  DEFAULT_SETTINGS,
  requirePreset,
  type FaultKind,
  type OperatingInputMode,
  type PresetId,
  type ScenarioId,
} from './presets';

export interface DifferentialSystemSnapshot {
  inputMode: OperatingInputMode;
  system: LoadDrivenSystem;
  condition: SystemCondition;
  i1p: number;
  i2p: number;
  ct1: CTConfig;
  ct2: CTConfig;
  scenarioId: ScenarioId;
  baseScenarioId: PresetId;
  faultKind: FaultKind;
}

export interface DifferentialSimulatorState extends DifferentialSystemSnapshot {
  settings: DifferentialSettings;
  preFault: DifferentialSystemSnapshot | null;
  faultInjectionMultiple: number;
}

export type DifferentialAction =
  | { type: 'APPLY_PRESET'; presetId: PresetId }
  | { type: 'SET_INPUT_MODE'; mode: OperatingInputMode }
  | { type: 'SET_SYSTEM'; key: keyof LoadDrivenSystem; value: number }
  | { type: 'SET_CURRENT'; side: 1 | 2; value: number }
  | { type: 'SET_CT'; side: 1 | 2; value: CTConfig }
  | { type: 'SET_SETTING'; key: NumericDifferentialSettingKey; value: number }
  | { type: 'SET_CHARACTERISTIC_MODE'; mode: DifferentialCharacteristicMode }
  | { type: 'SET_FAULT_MULTIPLE'; value: number }
  | { type: 'APPLY_INTERNAL_FAULT' }
  | { type: 'CLEAR_FAULT' }
  | { type: 'RESET' };

function cloneCT(ct: CTConfig): CTConfig {
  return { ...ct };
}

function cloneSystem(system: LoadDrivenSystem): LoadDrivenSystem {
  return { ...system };
}

function cloneCondition(condition: SystemCondition): SystemCondition {
  return { ...condition };
}

function physicalStateFromPreset(presetId: PresetId): DifferentialSystemSnapshot {
  const preset = requirePreset(presetId);
  return {
    inputMode: preset.inputMode,
    system: cloneSystem(preset.system),
    condition: cloneCondition(preset.condition),
    i1p: preset.i1p,
    i2p: preset.i2p,
    ct1: cloneCT(preset.ct1),
    ct2: cloneCT(preset.ct2),
    scenarioId: preset.id,
    baseScenarioId: preset.id,
    faultKind: preset.faultKind,
  };
}

function snapshot(state: DifferentialSimulatorState): DifferentialSystemSnapshot {
  return {
    inputMode: state.inputMode,
    system: cloneSystem(state.system),
    condition: cloneCondition(state.condition),
    i1p: state.i1p,
    i2p: state.i2p,
    ct1: cloneCT(state.ct1),
    ct2: cloneCT(state.ct2),
    scenarioId: state.scenarioId,
    baseScenarioId: state.baseScenarioId,
    faultKind: state.faultKind,
  };
}

function markCustom(state: DifferentialSimulatorState): DifferentialSimulatorState {
  return state.scenarioId === 'custom' ? state : { ...state, scenarioId: 'custom' };
}

function tryResolvePrimaryCurrents(system: LoadDrivenSystem, condition: SystemCondition) {
  try {
    return resolvePrimaryCurrents(system, condition);
  } catch {
    return null;
  }
}

function withLoadCurrents(state: DifferentialSimulatorState): DifferentialSimulatorState {
  if (state.inputMode !== 'load') return state;
  const next = tryResolvePrimaryCurrents(state.system, state.condition);
  return next ? { ...state, ...next } : state;
}

export function createInitialDifferentialState(): DifferentialSimulatorState {
  return {
    ...physicalStateFromPreset(DEFAULT_PRESET_ID),
    settings: { ...DEFAULT_SETTINGS },
    preFault: null,
    faultInjectionMultiple: 5,
  };
}

export function differentialStateReducer(
  state: DifferentialSimulatorState,
  action: DifferentialAction,
): DifferentialSimulatorState {
  switch (action.type) {
    case 'APPLY_PRESET': {
      const nextPhysical = physicalStateFromPreset(action.presetId);
      const nextPreFault =
        nextPhysical.faultKind !== 'none' && state.faultKind === 'none'
          ? snapshot(state)
          : nextPhysical.faultKind === 'none'
            ? null
            : state.preFault;

      return {
        ...state,
        ...nextPhysical,
        preFault: nextPreFault,
      };
    }

    case 'SET_INPUT_MODE': {
      // Active simplified faults own the current source (× terminal Irated).
      // Keep the pre-fault input mode immutable until CLEAR_FAULT restores the snapshot.
      if (state.faultKind !== 'none') return state;
      let next = markCustom({ ...state, inputMode: action.mode });
      if (action.mode === 'load') next = withLoadCurrents(next);
      return next;
    }

    case 'SET_SYSTEM': {
      let next = markCustom({ ...state, system: { ...state.system, [action.key]: action.value } });
      next = withLoadCurrents(next);
      return next;
    }

    case 'SET_CURRENT': {
      const next = markCustom({ ...state, inputMode: 'direct' });
      return action.side === 1 ? { ...next, i1p: action.value } : { ...next, i2p: action.value };
    }

    case 'SET_CT': {
      const next = markCustom(state);
      return action.side === 1
        ? { ...next, ct1: cloneCT(action.value) }
        : { ...next, ct2: cloneCT(action.value) };
    }

    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };

    case 'SET_CHARACTERISTIC_MODE': {
      const biasBreakpoint3 = action.mode === 'multi' && state.settings.biasBreakpoint3 <= state.settings.biasBreakpoint2
        ? state.settings.biasBreakpoint2 + Math.max(0.5, state.settings.biasBreakpoint2 * 0.5)
        : state.settings.biasBreakpoint3;
      return { ...state, settings: { ...state.settings, characteristicMode: action.mode, biasBreakpoint3 } };
    }

    case 'SET_FAULT_MULTIPLE':
      return { ...state, faultInjectionMultiple: action.value };

    case 'APPLY_INTERNAL_FAULT': {
      const preFault = state.faultKind === 'none' ? snapshot(state) : state.preFault;
      const condition: SystemCondition = { kind: 'internal-fault', currentMultiple: state.faultInjectionMultiple };
      const current = tryResolvePrimaryCurrents(state.system, condition);
      if (!current) return state;
      return {
        ...state,
        inputMode: 'load',
        condition,
        ...current,
        scenarioId: 'custom',
        faultKind: 'internal',
        preFault,
      };
    }

    case 'CLEAR_FAULT': {
      if (state.faultKind === 'none') return state;
      const restored = state.preFault ?? physicalStateFromPreset(DEFAULT_PRESET_ID);
      return {
        ...state,
        ...restored,
        faultKind: 'none',
        preFault: null,
      };
    }

    case 'RESET':
      return createInitialDifferentialState();

    default:
      return state;
  }
}

export function scenarioLabel(state: DifferentialSimulatorState): string {
  const base = requirePreset(state.baseScenarioId).label;
  return state.scenarioId === 'custom' ? `Custom (from ${base})` : requirePreset(state.scenarioId).label;
}

export function scenarioDescription(state: DifferentialSimulatorState): string {
  const base = requirePreset(state.baseScenarioId);
  return state.scenarioId === 'custom'
    ? `Modified from ${base.label}. Relay settings remain independent from the physical scenario.`
    : base.description;
}
