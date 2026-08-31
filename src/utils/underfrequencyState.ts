/**
 * Underfrequency Relay study-state reducer (UFR).
 *
 * Pure, UI-independent state transitions. Mirrors the O08 Overcurrent /
 * Distance pattern:
 *   - registry presets are immutable; edits produce a new
 *     `UnderfrequencyStudyDefinition` and never mutate the registry;
 *   - `APPLY_PRESET` resets the entire study from the registry;
 *   - per-field numeric setters clamp / reject non-finite values so an
 *     invalid draft cannot enter the engineering state;
 *   - any genuine engineering mutation resets playback to IDLE so a
 *     previously completed run can't be shown against changed state;
 *   - `modified` reports whether the editable study has diverged from the
 *     last applied preset so the UI can flag "Modified".
 *
 * The reducer is consumed by the UnderfrequencySimulator page and is the
 * single source of truth for which preset / system / generator / relay /
 * UFLS-stage / disturbance values are in effect at the UI.
 */

import type {
  GeneratorId,
  UnderfrequencyDisturbanceStep,
  UnderfrequencyGeneratorData,
  UnderfrequencyPlaybackSpeed,
  UnderfrequencyPlaybackState,
  UnderfrequencyPresetId,
  UnderfrequencyRelaySettings,
  UnderfrequencySimulatorState,
  UnderfrequencyStudyDefinition,
  UnderfrequencySystemData,
  UflsStageId,
  UflsStageSettings,
} from '../types/underfrequency';
import {
  DEFAULT_UNDERFREQUENCY_PRESET_ID,
  getUnderfrequencyStudyPreset,
} from '../studies/underfrequencyPresets';

// ─────────────────────────── Public action type ────────────────────────────

export type UnderfrequencyAction =
  | { readonly type: 'APPLY_PRESET'; readonly presetId: UnderfrequencyPresetId }
  | { readonly type: 'RESET' }
  | { readonly type: 'SET_SYSTEM'; readonly patch: Partial<UnderfrequencySystemData> }
  | { readonly type: 'SET_GENERATOR'; readonly generatorId: GeneratorId; readonly patch: Partial<UnderfrequencyGeneratorData> }
  | { readonly type: 'SET_RELAY'; readonly patch: Partial<UnderfrequencyRelaySettings> }
  | { readonly type: 'SET_UFLS_STAGE'; readonly stageId: UflsStageId; readonly patch: Partial<UflsStageSettings> }
  | { readonly type: 'SET_DISTURBANCE_DEFICIT_MW'; readonly mw: number }
  | { readonly type: 'ADD_GENERATOR_LOSS'; readonly generatorId: GeneratorId; readonly timeSec: number }
  | { readonly type: 'REMOVE_DISTURBANCE_STEP'; readonly stepId: string }
  | { readonly type: 'SET_SIMULATION_SPEED'; readonly speed: UnderfrequencyPlaybackSpeed }
  | { readonly type: 'SET_SCRUB_TIME'; readonly timeSec: number | null }
  | { readonly type: 'BEGIN_RUN' }
  | { readonly type: 'SET_PLAYBACK_STATE'; readonly playbackState: UnderfrequencyPlaybackState }
  | { readonly type: 'CLEAR_RUN' };

// ───────────────────── Numeric-hygiene helpers ────────────────────────────

function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Return `value` only when it is finite; otherwise return `fallback`. */
function safe(value: number, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

/** Shallow merge that drops non-finite numeric values from `patch`. */
function sanitise<T extends object>(base: T, patch: Partial<T>): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (typeof value === 'number' && !isFiniteNumber(value)) continue;
    result[key] = value;
  }
  return result as T;
}

/** Structural equality for two `UnderfrequencyStudyDefinition` objects. */
export function studyEquals(a: UnderfrequencyStudyDefinition, b: UnderfrequencyStudyDefinition): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ───────────────────── Reducer / init helpers ──────────────────────────────

/** Materialise an editable `UnderfrequencyStudyDefinition` from a registry preset. */
export function studyFromPreset(preset: ReturnType<typeof getUnderfrequencyStudyPreset>): UnderfrequencyStudyDefinition {
  return {
    id: preset.study.id,
    label: preset.study.label,
    description: preset.study.description,
    system: { ...preset.study.system },
    generators: preset.study.generators.map((g) => ({ ...g })),
    relay: { ...preset.study.relay },
    uflsStages: preset.study.uflsStages.map((s) => ({ ...s })),
    disturbanceSteps: preset.study.disturbanceSteps.map((s) => ({ ...s })),
    notes: preset.study.notes,
  };
}

export function createInitialUnderfrequencyState(
  presetId: UnderfrequencyPresetId = DEFAULT_UNDERFREQUENCY_PRESET_ID,
): UnderfrequencySimulatorState {
  const preset = getUnderfrequencyStudyPreset(presetId);
  return {
    presetId,
    study: studyFromPreset(preset),
    modified: false,
    playbackState: 'IDLE',
    simulationSpeed: 1,
    scrubTimeSec: null,
  };
}

/**
 * Compare the active study with the canonical preset to update the `modified`
 * flag and reset playback — any genuine engineering mutation invalidates a
 * previously completed run (O15 hardening pattern).
 */
function flagModified(state: UnderfrequencySimulatorState, next: UnderfrequencyStudyDefinition): UnderfrequencySimulatorState {
  const preset = getUnderfrequencyStudyPreset(state.presetId);
  const presetStudy = studyFromPreset(preset);
  return {
    ...state,
    study: next,
    modified: !studyEquals(presetStudy, next),
    playbackState: 'IDLE',
    scrubTimeSec: null,
  };
}

// ─────────────────────────── Reducer ──────────────────────────────────────

export function underfrequencyReducer(state: UnderfrequencySimulatorState, action: UnderfrequencyAction): UnderfrequencySimulatorState {
  switch (action.type) {
    case 'APPLY_PRESET': {
      const preset = getUnderfrequencyStudyPreset(action.presetId);
      return {
        presetId: preset.id,
        study: studyFromPreset(preset),
        modified: false,
        playbackState: 'IDLE',
        simulationSpeed: state.simulationSpeed,
        scrubTimeSec: null,
      };
    }
    case 'RESET': {
      const preset = getUnderfrequencyStudyPreset(state.presetId);
      return {
        ...state,
        study: studyFromPreset(preset),
        modified: false,
        playbackState: 'IDLE',
        scrubTimeSec: null,
      };
    }
    case 'SET_SYSTEM': {
      return flagModified(state, { ...state.study, system: sanitise(state.study.system, action.patch) });
    }
    case 'SET_GENERATOR': {
      const nextGenerators = state.study.generators.map((g) =>
        g.id === action.generatorId ? sanitise(g, action.patch) : g,
      );
      return flagModified(state, { ...state.study, generators: nextGenerators });
    }
    case 'SET_RELAY': {
      return flagModified(state, { ...state.study, relay: sanitise(state.study.relay, action.patch) });
    }
    case 'SET_UFLS_STAGE': {
      const nextStages = state.study.uflsStages.map((s) =>
        s.id === action.stageId ? sanitise(s, action.patch) : s,
      );
      return flagModified(state, { ...state.study, uflsStages: nextStages });
    }
    case 'SET_DISTURBANCE_DEFICIT_MW': {
      if (!isFiniteNumber(action.mw)) return state;
      // A manual ΔP replaces the disturbance schedule with a single load step.
      // Non-positive (or zero) clears the disturbance back to the nominal case.
      const clamped = Math.max(0, action.mw);
      const steps =
        clamped === 0
          ? []
          : [{ id: 'D-MANUAL', kind: 'LOAD_STEP' as const, timeSec: 0, mw: clamped }];
      return flagModified(state, { ...state.study, disturbanceSteps: steps });
    }
    case 'ADD_GENERATOR_LOSS': {
      const generatorId = action.generatorId;
      if (!state.study.generators.some((g) => g.id === generatorId)) return state;
      if (state.study.disturbanceSteps.some((s) => s.kind !== 'LOAD_STEP' && s.generatorId === generatorId)) return state;
      const timestamp = safe(action.timeSec, 0);
      const step: UnderfrequencyDisturbanceStep = {
        id: `D-LOSS-${generatorId}`,
        kind: 'GENERATOR_LOSS',
        timeSec: timestamp,
        generatorId,
      };
      return flagModified(state, { ...state.study, disturbanceSteps: [...state.study.disturbanceSteps, step] });
    }
    case 'REMOVE_DISTURBANCE_STEP': {
      const nextSteps = state.study.disturbanceSteps.filter((s) => s.id !== action.stepId);
      return flagModified(state, { ...state.study, disturbanceSteps: nextSteps });
    }
    case 'SET_SIMULATION_SPEED': {
      return { ...state, simulationSpeed: action.speed };
    }
    case 'SET_SCRUB_TIME': {
      if (action.timeSec === null) return { ...state, scrubTimeSec: null };
      if (!isFiniteNumber(action.timeSec)) return state;
      return { ...state, scrubTimeSec: action.timeSec };
    }
    case 'BEGIN_RUN': {
      return { ...state, playbackState: 'RUNNING' };
    }
    case 'SET_PLAYBACK_STATE': {
      return { ...state, playbackState: action.playbackState };
    }
    case 'CLEAR_RUN': {
      return { ...state, playbackState: 'IDLE', scrubTimeSec: null };
    }
  }
}
