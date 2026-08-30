import { runOvercurrentCoordinationStudy } from '../engines/overcurrentCoordination';
import type {
  CTIBudget,
  FaultCaseId,
  FaultLocationProfileId,
  LoadCaseId,
  OvercurrentInverseCurveId,
  OvercurrentPlaybackState,
  OvercurrentSimulatorState,
  OvercurrentStudyDefinition,
  OvercurrentStudyMode,
  OvercurrentTimingMode51,
  PlaybackSpeed,
  ProtectionDeviceId,
  StudyGuidanceMode,
  StudyPresetId,
  StudySnapshot,
} from '../types/overcurrent';
import {
  getOvercurrentStudyPreset,
  listOvercurrentStudyPresets,
} from '../studies/overcurrentPresets';
import {
  initializeOvercurrentSimulatorState,
  resolveFaultLocationStudy,
} from '../studies/overcurrentStudy';
import { canBeginOvercurrentFaultRun } from './evaluateOvercurrentParameters';

export const DEFAULT_OVERCURRENT_PRESET_ID: StudyPresetId = 'OVC-01';

export interface ActiveFaultLocationSelection {
  readonly profileId: FaultLocationProfileId;
  readonly normalizedPosition: number;
}

export interface GuidedChallengeProgress {
  readonly revealedHintCount: number;
}

export interface OvercurrentParameterState extends OvercurrentSimulatorState {
  /** Current immutable study definition after user edits. */
  readonly studyDefinition: OvercurrentStudyDefinition;
  /**
   * Optional O09 Explore-mode point resolved from configured fault-location
   * profile data. A profile point is not a time-domain FaultCase and therefore
   * cannot begin an O07 run until a discrete fault case is selected.
   */
  readonly faultLocationSelection: ActiveFaultLocationSelection | null;
  /** True when current engineering study data differs from the selected registry preset. */
  readonly modified: boolean;
  /** O13 learning-workflow progress only; never an engineering source of truth. */
  readonly guidedChallengeProgress: GuidedChallengeProgress;
}

type CTNumericKey = 'primaryRatedA' | 'secondaryRatedA' | 'ratioErrorPct';
type CTIBudgetKey = keyof CTIBudget;

export type OvercurrentParameterAction =
  | { readonly type: 'SET_STUDY_MODE'; readonly mode: OvercurrentStudyMode }
  | { readonly type: 'APPLY_PRESET'; readonly presetId: StudyPresetId }
  | { readonly type: 'SET_GUIDANCE_MODE'; readonly guidance: StudyGuidanceMode }
  | { readonly type: 'SELECT_DEVICE'; readonly deviceId: ProtectionDeviceId }
  | { readonly type: 'SELECT_LOAD_CASE'; readonly loadCaseId: LoadCaseId | null }
  | { readonly type: 'SELECT_FAULT_CASE'; readonly faultCaseId: FaultCaseId | null }
  | {
      readonly type: 'SET_FAULT_LOCATION_POSITION';
      readonly profileId: FaultLocationProfileId;
      readonly normalizedPosition: number;
    }
  | {
      readonly type: 'SET_CASE_CURRENT';
      readonly caseKind: 'LOAD' | 'FAULT';
      readonly caseId: LoadCaseId | FaultCaseId;
      readonly deviceId: ProtectionDeviceId;
      readonly valueA: number;
    }
  | {
      readonly type: 'SET_DEVICE_CT';
      readonly deviceId: ProtectionDeviceId;
      readonly key: CTNumericKey;
      readonly value: number;
    }
  | {
      readonly type: 'SET_DEVICE_51_PICKUP';
      readonly deviceId: ProtectionDeviceId;
      readonly valueASecondary: number;
    }
  | {
      readonly type: 'SET_DEVICE_51_TIMING_MODE';
      readonly deviceId: ProtectionDeviceId;
      readonly timingMode: OvercurrentTimingMode51;
    }
  | {
      readonly type: 'SET_DEVICE_51_CURVE';
      readonly deviceId: ProtectionDeviceId;
      readonly curveId: OvercurrentInverseCurveId;
    }
  | {
      readonly type: 'SET_DEVICE_51_TIME_SCALE';
      readonly deviceId: ProtectionDeviceId;
      readonly value: number;
    }
  | {
      readonly type: 'SET_DEVICE_51_DEFINITE_DELAY';
      readonly deviceId: ProtectionDeviceId;
      readonly valueSec: number;
    }
  | {
      readonly type: 'SET_DEVICE_50_ENABLED';
      readonly deviceId: ProtectionDeviceId;
      readonly enabled: boolean;
    }
  | {
      readonly type: 'SET_DEVICE_50_PICKUP';
      readonly deviceId: ProtectionDeviceId;
      readonly valueASecondary: number;
    }
  | {
      readonly type: 'SET_DEVICE_BREAKER_CLEARING';
      readonly deviceId: ProtectionDeviceId;
      readonly valueSec: number;
    }
  | {
      readonly type: 'SET_CTI_BUDGET_PART';
      readonly requirementId: string;
      readonly key: CTIBudgetKey;
      readonly valueSec: number;
    }
  | {
      readonly type: 'SET_REQUIRED_CTI';
      readonly requirementId: string;
      readonly valueSec: number;
    }
  | { readonly type: 'SET_SIMULATION_SPEED'; readonly speed: PlaybackSpeed }
  | { readonly type: 'REVEAL_GUIDED_HINT' }
  | { readonly type: 'RUN_COORDINATION_TEST' }
  | { readonly type: 'BEGIN_FAULT_RUN' }
  | { readonly type: 'SET_PLAYBACK_STATE'; readonly playbackState: OvercurrentPlaybackState }
  | { readonly type: 'CLEAR_FAULT_RUN' }
  | { readonly type: 'RESET' };

function currentSnapshot(study: OvercurrentStudyDefinition, selectedFaultCaseId: FaultCaseId | null): StudySnapshot {
  return {
    id: `${study.id}:CURRENT`,
    label: 'Current Settings',
    devicesById: study.devicesById,
    coordinationRequirements: study.coordinationRequirements,
    selectedFaultCaseId: selectedFaultCaseId ?? undefined,
  };
}

function stateFromPreset(study: OvercurrentStudyDefinition): OvercurrentParameterState {
  const initialized = initializeOvercurrentSimulatorState(study);
  if (initialized.status === 'INVALID') {
    const reason = initialized.issues.map((entry) => entry.detail ?? entry.code).join(' ');
    throw new Error(`Authoritative Overcurrent preset ${study.id} is invalid. ${reason}`);
  }
  return {
    ...initialized.value,
    studyDefinition: study,
    faultLocationSelection: null,
    modified: false,
    guidedChallengeProgress: { revealedHintCount: 0 },
  };
}

export function createInitialOvercurrentParameterState(
  presetId: StudyPresetId = DEFAULT_OVERCURRENT_PRESET_ID,
): OvercurrentParameterState {
  const preset = getOvercurrentStudyPreset(presetId) ?? getOvercurrentStudyPreset(DEFAULT_OVERCURRENT_PRESET_ID);
  if (!preset) throw new Error('The canonical Overcurrent preset registry is empty.');
  return stateFromPreset(preset);
}

export function overcurrentSettingsLocked(state: OvercurrentParameterState): boolean {
  return state.playbackState === 'RUNNING' || state.playbackState === 'PAUSED';
}

function withStudyMutation(
  state: OvercurrentParameterState,
  studyDefinition: OvercurrentStudyDefinition,
): OvercurrentParameterState {
  return {
    ...state,
    studyDefinition,
    studyMode: studyDefinition.mode,
    guidanceMode: studyDefinition.guidance,
    studyPresetId: studyDefinition.id,
    topology: studyDefinition.topology,
    devicesById: studyDefinition.devicesById,
    coordinationRequirements: studyDefinition.coordinationRequirements,
    comparisonSnapshot: currentSnapshot(studyDefinition, state.activeFaultCaseId),
    validationState: { status: 'IDLE' },
    // O15 integration hardening: any genuine engineering mutation invalidates
    // the previously completed timed experiment. A new run must be applied
    // against the changed engineering state.
    playbackState: 'IDLE',
    modified: true,
  };
}

function mutateDevice(
  state: OvercurrentParameterState,
  deviceId: ProtectionDeviceId,
  mutate: (device: OvercurrentStudyDefinition['devicesById'][string]) => OvercurrentStudyDefinition['devicesById'][string],
): OvercurrentParameterState {
  const device = state.studyDefinition.devicesById[deviceId];
  if (!device) return state;
  const nextDevice = mutate(device);
  const devicesById = { ...state.studyDefinition.devicesById, [deviceId]: nextDevice };
  return withStudyMutation(state, { ...state.studyDefinition, devicesById });
}

function replaceCaseCurrent(
  state: OvercurrentParameterState,
  action: Extract<OvercurrentParameterAction, { type: 'SET_CASE_CURRENT' }>,
): OvercurrentParameterState {
  if (!state.studyDefinition.topology.deviceIds.includes(action.deviceId)) return state;

  if (action.caseKind === 'LOAD') {
    const target = state.studyDefinition.loadCases.find((loadCase) => loadCase.id === action.caseId);
    if (!target || target.current.kind !== 'STATIC') return state;
    const loadCases = state.studyDefinition.loadCases.map((loadCase) => {
      if (loadCase.id !== action.caseId || loadCase.current.kind !== 'STATIC') return loadCase;
      return {
        ...loadCase,
        current: {
          ...loadCase.current,
          primaryCurrentAByDevice: {
            ...loadCase.current.primaryCurrentAByDevice,
            [action.deviceId]: action.valueA,
          },
        },
      };
    });
    return withStudyMutation(state, { ...state.studyDefinition, loadCases });
  }

  const target = state.studyDefinition.faultCases.find((faultCase) => faultCase.id === action.caseId);
  if (!target || target.current.kind !== 'STATIC') return state;
  const faultCases = state.studyDefinition.faultCases.map((faultCase) => {
    if (faultCase.id !== action.caseId || faultCase.current.kind !== 'STATIC') return faultCase;
    return {
      ...faultCase,
      current: {
        ...faultCase.current,
        primaryCurrentAByDevice: {
          ...faultCase.current.primaryCurrentAByDevice,
          [action.deviceId]: action.valueA,
        },
      },
    };
  });
  return withStudyMutation(state, { ...state.studyDefinition, faultCases });
}

function updateCoordinationRequirement(
  state: OvercurrentParameterState,
  requirementId: string,
  update: (requirement: OvercurrentStudyDefinition['coordinationRequirements'][number]) => OvercurrentStudyDefinition['coordinationRequirements'][number],
): OvercurrentParameterState {
  if (!state.studyDefinition.coordinationRequirements.some((item) => item.id === requirementId)) return state;
  let changed = false;
  const coordinationRequirements = state.studyDefinition.coordinationRequirements.map((requirement) => {
    if (requirement.id !== requirementId) return requirement;
    const next = update(requirement);
    changed = next !== requirement;
    return next;
  });
  if (!changed) return state;
  return withStudyMutation(state, { ...state.studyDefinition, coordinationRequirements });
}

function choosePresetForMode(mode: OvercurrentStudyMode): OvercurrentStudyDefinition | undefined {
  return listOvercurrentStudyPresets().find((preset) => preset.mode === mode);
}

function settingsActionBlocked(state: OvercurrentParameterState, action: OvercurrentParameterAction): boolean {
  if (!overcurrentSettingsLocked(state)) return false;
  return !(
    action.type === 'SELECT_DEVICE'
    || action.type === 'REVEAL_GUIDED_HINT'
    || action.type === 'SET_SIMULATION_SPEED'
    || action.type === 'SET_PLAYBACK_STATE'
    || action.type === 'CLEAR_FAULT_RUN'
    || action.type === 'RESET'
  );
}

export function overcurrentParameterReducer(
  state: OvercurrentParameterState,
  action: OvercurrentParameterAction,
): OvercurrentParameterState {
  if (settingsActionBlocked(state, action)) return state;

  switch (action.type) {
    case 'SET_STUDY_MODE': {
      if (action.mode === state.studyMode) return state;
      const preset = choosePresetForMode(action.mode);
      return preset ? stateFromPreset(preset) : state;
    }
    case 'APPLY_PRESET': {
      const preset = getOvercurrentStudyPreset(action.presetId);
      return preset ? stateFromPreset(preset) : state;
    }
    case 'SET_GUIDANCE_MODE': {
      if (action.guidance === state.guidanceMode) return state;
      // O13: Guided/Free is learning metadata, not an engineering mutation.
      // Preserve engineering modified/validation state and reset only temporary hint progress.
      return {
        ...state,
        guidanceMode: action.guidance,
        studyDefinition: { ...state.studyDefinition, guidance: action.guidance },
        guidedChallengeProgress: { revealedHintCount: 0 },
      };
    }
    case 'SELECT_DEVICE':
      return state.topology.deviceIds.includes(action.deviceId)
        ? { ...state, selectedDeviceId: action.deviceId }
        : state;
    case 'SELECT_LOAD_CASE':
      return action.loadCaseId === null || state.studyDefinition.loadCases.some((item) => item.id === action.loadCaseId)
        ? { ...state, activeLoadCaseId: action.loadCaseId, playbackState: 'IDLE' }
        : state;
    case 'SELECT_FAULT_CASE':
      return action.faultCaseId === null || state.studyDefinition.faultCases.some((item) => item.id === action.faultCaseId)
        ? { ...state, activeFaultCaseId: action.faultCaseId, faultLocationSelection: null, playbackState: 'IDLE' }
        : state;
    case 'SET_FAULT_LOCATION_POSITION': {
      const resolved = resolveFaultLocationStudy(
        state.studyDefinition,
        action.profileId,
        action.normalizedPosition,
      );
      if (resolved.status === 'INVALID') return state;
      return {
        ...state,
        activeFaultCaseId: null,
        faultLocationSelection: {
          profileId: action.profileId,
          normalizedPosition: resolved.value.normalizedPosition,
        },
        // Explore-only movement must never inherit a completed discrete-fault run.
        playbackState: 'IDLE',
      };
    }
    case 'SET_CASE_CURRENT':
      return replaceCaseCurrent(state, action);
    case 'SET_DEVICE_CT':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          ct: { ...device.settings.ct, [action.key]: action.value },
        },
      }));
    case 'SET_DEVICE_51_PICKUP':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          phase51: { ...device.settings.phase51, pickupASecondary: action.valueASecondary },
        },
      }));
    case 'SET_DEVICE_51_TIMING_MODE':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          phase51: { ...device.settings.phase51, timingMode: action.timingMode },
        },
      }));
    case 'SET_DEVICE_51_CURVE':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          phase51: { ...device.settings.phase51, inverseCurveId: action.curveId },
        },
      }));
    case 'SET_DEVICE_51_TIME_SCALE':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          phase51: { ...device.settings.phase51, timeScale: action.value },
        },
      }));
    case 'SET_DEVICE_51_DEFINITE_DELAY':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          phase51: { ...device.settings.phase51, definiteDelaySec: action.valueSec },
        },
      }));
    case 'SET_DEVICE_50_ENABLED':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          phase50: { ...device.settings.phase50, enabled: action.enabled },
        },
      }));
    case 'SET_DEVICE_50_PICKUP':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          phase50: { ...device.settings.phase50, pickupASecondary: action.valueASecondary },
        },
      }));
    case 'SET_DEVICE_BREAKER_CLEARING':
      return mutateDevice(state, action.deviceId, (device) => ({
        ...device,
        settings: {
          ...device.settings,
          breaker: { clearingTimeSec: action.valueSec },
        },
      }));
    case 'SET_CTI_BUDGET_PART':
      return updateCoordinationRequirement(state, action.requirementId, (requirement) => {
        if (!requirement.budget) return requirement;
        const budget = { ...requirement.budget, [action.key]: action.valueSec };
        const requiredCtiSec = budget.breakerAllowanceSec
          + budget.relayTimingAllowanceSec
          + budget.studySafetyMarginSec;
        return { ...requirement, budget, requiredCtiSec };
      });
    case 'SET_REQUIRED_CTI':
      return updateCoordinationRequirement(state, action.requirementId, (requirement) => (
        requirement.budget ? requirement : { ...requirement, requiredCtiSec: action.valueSec }
      ));
    case 'SET_SIMULATION_SPEED':
      return { ...state, simulationSpeed: action.speed };
    case 'REVEAL_GUIDED_HINT': {
      if (state.guidanceMode !== 'GUIDED' || state.studyMode !== 'COORDINATION_LAB') return state;
      const totalHints = state.studyDefinition.learning?.hints.length ?? 0;
      if (totalHints === 0 || state.guidedChallengeProgress.revealedHintCount >= totalHints) return state;
      return {
        ...state,
        guidedChallengeProgress: {
          revealedHintCount: Math.min(totalHints, state.guidedChallengeProgress.revealedHintCount + 1),
        },
      };
    }
    case 'RUN_COORDINATION_TEST': {
      if (state.studyMode !== 'COORDINATION_LAB') return state;
      const result = runOvercurrentCoordinationStudy(state.studyDefinition);
      return {
        ...state,
        validationState: result.status === 'INVALID'
          ? { status: 'INVALID', issues: result.issues }
          : { status: 'COMPLETE', audit: result.value.audit },
      };
    }
    case 'BEGIN_FAULT_RUN':
      return canBeginOvercurrentFaultRun(state) ? { ...state, playbackState: 'RUNNING' } : state;
    case 'SET_PLAYBACK_STATE':
      return { ...state, playbackState: action.playbackState };
    case 'CLEAR_FAULT_RUN':
      return { ...state, playbackState: 'IDLE' };
    case 'RESET':
      return createInitialOvercurrentParameterState(state.studyPresetId);
  }
}
