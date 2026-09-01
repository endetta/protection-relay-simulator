/**
 * Distance Relay study-state reducer (D03).
 *
 * Pure, UI-independent state transitions. Mirrors the O08 Overcurrent
 * pattern:
 *   - registry presets are immutable; edits produce a new
 *     `DistanceStudyDefinition` and never mutate the registry;
 *   - `APPLY_PRESET` resets the entire study from the registry;
 *   - per-field numeric setters clamp / reject non-finite values so an
 *     invalid draft cannot enter the engineering state;
 *   - `isDirty` reports whether the editable study has diverged from
 *     the last applied preset so the UI can flag "Modified".
 */

import type {
  DistanceCharacteristicType,
  DistanceDeviceSettings,
  DistanceFaultType,
  DistanceLoadEncroachmentSettings,
  DistanceQuadrilateralSettings,
  DistanceSchemeType,
  DistanceStudyDefinition,
  DistanceStudyPresetId,
  DistanceSystemData,
  DistanceTopologyId,
  DistanceZoneSettings,
} from '../types/distance';
import { DEFAULT_DISTANCE_PRESET_ID, getDistanceStudyPreset } from '../studies/distancePresets';

// ─────────────────────────── Public types ──────────────────────────────────

export interface DistanceSimulatorState {
  readonly study: DistanceStudyDefinition;
  readonly presetId: DistanceStudyPresetId;
  readonly modified: boolean;
}

export type DistanceAction =
  | { readonly type: 'APPLY_PRESET'; readonly presetId: DistanceStudyPresetId }
  | { readonly type: 'RESET' }
  | { readonly type: 'SET_TOPOLOGY'; readonly topology: DistanceTopologyId }
  | { readonly type: 'SET_SCHEME'; readonly scheme: DistanceSchemeType }
  | { readonly type: 'SET_CHARACTERISTIC_TYPE'; readonly characteristic: DistanceCharacteristicType }
  | { readonly type: 'SET_SYSTEM'; readonly patch: Partial<DistanceSystemData> }
  | { readonly type: 'SET_LINE'; readonly patch: Partial<DistanceStudyDefinition['line']> }
  | { readonly type: 'SET_FAULT_CURRENT_A'; readonly value: number }
  | { readonly type: 'SET_FAULT_PCT'; readonly value: number }
  | { readonly type: 'SET_FAULT_TYPE'; readonly value: DistanceFaultType }
  | { readonly type: 'SET_K0'; readonly value: number }
  | { readonly type: 'SET_ARC_OHM_PRIMARY'; readonly value: number }
  | { readonly type: 'SET_CT'; readonly patch: Partial<DistanceDeviceSettings['ct']> }
  | { readonly type: 'SET_VT'; readonly patch: Partial<DistanceDeviceSettings['vt']> }
  | { readonly type: 'SET_ZONE'; readonly zone: 1 | 2 | 3; readonly patch: Partial<DistanceZoneSettings> }
  | { readonly type: 'SET_QUADRILATERAL'; readonly patch: Partial<DistanceQuadrilateralSettings> }
  | { readonly type: 'SET_LOAD_ENCROACHMENT'; readonly patch: Partial<DistanceLoadEncroachmentSettings> }
  | { readonly type: 'SET_BREAKER'; readonly patch: Partial<DistanceDeviceSettings['breaker']> };

// ───────────────────── Numeric-hygiene helpers ────────────────────────────

function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function safe(value: number, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function sanitise<T extends object>(base: T, patch: Partial<T>): T {
  const next = base as Record<string, unknown>;
  const result: Record<string, unknown> = { ...next };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (typeof value === 'number' && !isFiniteNumber(value)) continue;
    result[key] = value;
  }
  return result as T;
}

export function studyEquals(a: DistanceStudyDefinition, b: DistanceStudyDefinition): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ───────────────────── Reducer / init helpers ──────────────────────────────

export function createInitialDistanceState(presetId: DistanceStudyPresetId = DEFAULT_DISTANCE_PRESET_ID): DistanceSimulatorState {
  const preset = getDistanceStudyPreset(presetId);
  return {
    study: studyFromPreset(preset),
    presetId,
    modified: false,
  };
}

export function studyFromPreset(preset: ReturnType<typeof getDistanceStudyPreset>): DistanceStudyDefinition {
  return {
    topology: preset.topology,
    scheme: preset.scheme,
    system: { ...preset.system },
    line: { ...preset.line },
    settings: cloneSettings(preset.settings),
    faultCurrentA: preset.faultCurrentA,
    faultType: preset.faultType,
    k0: preset.k0,
    faultPct: preset.faultPct,
    presetId: preset.id,
  };
}

function cloneSettings(settings: DistanceDeviceSettings): DistanceDeviceSettings {
  return {
    ct: { ...settings.ct },
    vt: { ...settings.vt },
    characteristicType: settings.characteristicType,
    zone1: { ...settings.zone1 },
    zone2: { ...settings.zone2 },
    zone3: { ...settings.zone3 },
    quadrilateral: { ...settings.quadrilateral },
    loadEncroachment: { ...settings.loadEncroachment },
    rArcOhmPrimary: settings.rArcOhmPrimary,
    breaker: { ...settings.breaker },
  };
}

function flagModified(state: DistanceSimulatorState, next: DistanceStudyDefinition): DistanceSimulatorState {
  const preset = getDistanceStudyPreset(state.presetId);
  const presetStudy = studyFromPreset(preset);
  return { ...state, study: next, modified: !studyEquals(presetStudy, next) };
}

// ─────────────────────────── Reducer ──────────────────────────────────────

export function distanceStateReducer(state: DistanceSimulatorState, action: DistanceAction): DistanceSimulatorState {
  switch (action.type) {
    case 'APPLY_PRESET': {
      const preset = getDistanceStudyPreset(action.presetId);
      return { study: studyFromPreset(preset), presetId: preset.id, modified: false };
    }
    case 'RESET': {
      const preset = getDistanceStudyPreset(state.presetId);
      return { study: studyFromPreset(preset), presetId: state.presetId, modified: false };
    }
    case 'SET_TOPOLOGY': {
      const nextStudy: DistanceStudyDefinition = { ...state.study, topology: action.topology };
      return flagModified(state, nextStudy);
    }
    case 'SET_SCHEME': {
      const nextStudy: DistanceStudyDefinition = { ...state.study, scheme: action.scheme };
      return flagModified(state, nextStudy);
    }
    case 'SET_CHARACTERISTIC_TYPE': {
      const next: DistanceDeviceSettings = { ...state.study.settings, characteristicType: action.characteristic };
      const nextStudy: DistanceStudyDefinition = { ...state.study, settings: next };
      return flagModified(state, nextStudy);
    }
    case 'SET_SYSTEM': {
      const nextStudy: DistanceStudyDefinition = { ...state.study, system: sanitise(state.study.system, action.patch) };
      return flagModified(state, nextStudy);
    }
    case 'SET_LINE': {
      const nextStudy: DistanceStudyDefinition = { ...state.study, line: sanitise(state.study.line, action.patch) };
      return flagModified(state, nextStudy);
    }
    case 'SET_FAULT_CURRENT_A': {
      if (!isFiniteNumber(action.value) || action.value < 0) return state;
      const nextStudy: DistanceStudyDefinition = { ...state.study, faultCurrentA: action.value };
      return flagModified(state, nextStudy);
    }
    case 'SET_FAULT_PCT': {
      if (!isFiniteNumber(action.value)) return state;
      const clamped = Math.min(100, Math.max(0, action.value));
      const nextStudy: DistanceStudyDefinition = { ...state.study, faultPct: clamped };
      return flagModified(state, nextStudy);
    }
    case 'SET_FAULT_TYPE': {
      const nextStudy: DistanceStudyDefinition = { ...state.study, faultType: action.value };
      return flagModified(state, nextStudy);
    }
    case 'SET_K0': {
      if (!isFiniteNumber(action.value) || action.value < -0.99) return state;
      const nextStudy: DistanceStudyDefinition = { ...state.study, k0: action.value };
      return flagModified(state, nextStudy);
    }
    case 'SET_ARC_OHM_PRIMARY': {
      if (!isFiniteNumber(action.value) || action.value < 0) return state;
      const nextStudy: DistanceStudyDefinition = { ...state.study, settings: { ...state.study.settings, rArcOhmPrimary: action.value } };
      return flagModified(state, nextStudy);
    }
    case 'SET_CT': {
      const next: DistanceDeviceSettings['ct'] = sanitise(state.study.settings.ct, action.patch);
      const nextStudy: DistanceStudyDefinition = { ...state.study, settings: { ...state.study.settings, ct: next } };
      return flagModified(state, nextStudy);
    }
    case 'SET_VT': {
      const next: DistanceDeviceSettings['vt'] = sanitise(state.study.settings.vt, action.patch);
      const nextStudy: DistanceStudyDefinition = { ...state.study, settings: { ...state.study.settings, vt: next } };
      return flagModified(state, nextStudy);
    }
    case 'SET_ZONE': {
      const key = `zone${action.zone}` as 'zone1' | 'zone2' | 'zone3';
      const next: DistanceZoneSettings = sanitise(state.study.settings[key], action.patch);
      const nextStudy: DistanceStudyDefinition = {
        ...state.study,
        settings: { ...state.study.settings, [key]: next },
      };
      return flagModified(state, nextStudy);
    }
    case 'SET_QUADRILATERAL': {
      const next: DistanceQuadrilateralSettings = sanitise(state.study.settings.quadrilateral, action.patch);
      const nextStudy: DistanceStudyDefinition = { ...state.study, settings: { ...state.study.settings, quadrilateral: next } };
      return flagModified(state, nextStudy);
    }
    case 'SET_LOAD_ENCROACHMENT': {
      const next: DistanceLoadEncroachmentSettings = sanitise(state.study.settings.loadEncroachment, action.patch);
      const nextStudy: DistanceStudyDefinition = { ...state.study, settings: { ...state.study.settings, loadEncroachment: next } };
      return flagModified(state, nextStudy);
    }
    case 'SET_BREAKER': {
      const next: DistanceDeviceSettings['breaker'] = sanitise(state.study.settings.breaker, action.patch);
      const nextStudy: DistanceStudyDefinition = { ...state.study, settings: { ...state.study.settings, breaker: next } };
      return flagModified(state, nextStudy);
    }
  }
}

// ───────────────────────── Derived selectors ──────────────────────────────

export interface DerivedDistanceStudy {
  readonly presetLabel: string;
  readonly faultTypeLabel: string;
  readonly lineImpedancePrimaryOhm: number;
  readonly zLineSecondary: number;
}

export function deriveDistanceStudy(state: DistanceSimulatorState): DerivedDistanceStudy {
  const preset = getDistanceStudyPreset(state.presetId);
  const lineImpedancePrimaryOhm = state.study.line.z1OhmPerKmPrimary * state.study.line.lengthKm;
  const vtRatio = (state.study.settings.vt.primaryRatedKv * 1000) / Math.sqrt(3) / state.study.settings.vt.secondaryRatedV;
  const ctRatio = state.study.settings.ct.primaryRatedA / state.study.settings.ct.secondaryRatedA;
  const zLineSecondary = lineImpedancePrimaryOhm * (ctRatio / vtRatio);
  return {
    presetLabel: preset.label,
    faultTypeLabel: faultTypeLabel(state.study.faultType),
    lineImpedancePrimaryOhm: safe(lineImpedancePrimaryOhm, 0),
    zLineSecondary: safe(zLineSecondary, 0),
  };
}

export function faultTypeLabel(type: DistanceFaultType): string {
  switch (type) {
    case 'THREE_PHASE':
      return '3-Phase';
    case 'PHASE_PHASE':
      return 'Phase-Phase';
    case 'SINGLE_LINE_GROUND':
      return 'SLG';
  }
}
