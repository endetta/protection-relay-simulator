/**
 * Underfrequency Relay domain contracts (U01, per underfrequency-relay.md).
 *
 * These types are intentionally UI-independent and calculation-free.
 * They encode the vocabulary and data relationships locked by the
 * authoritative Underfrequency U01 Engineering Specification.
 */

// ─────────────────────────────── ID aliases ────────────────────────────────

export type UnderfrequencyPresetId = string;
export type GeneratorId = string; // 'G1' | 'G2' | ...
export type UflsStageId = string; // 'S1' | 'S2' | ...
export type UnderfrequencyEventId = string;
export type UnderfrequencyTimelineEventId = string;

// ────────────────────────── Enumeration / union types ──────────────────────

/** U01 § 6.1 — disturbance event kinds. */
export type UnderfrequencyDisturbanceStepKind =
  | 'GENERATOR_LOSS'
  | 'LOAD_STEP'
  | 'GENERATOR_BLOCK';

/** U01 § 5.1 / § 11.1 — per-generator operating status. */
export type UnderfrequencyGeneratorStatus =
  | 'ONLINE'
  | 'TRIPPED'
  | 'AT_GOVERNOR_LIMIT';

/** U01 § 11.1 — steady-state classification of the final solving. */
export type UnderfrequencySteadyStateStatus =
  | 'SETTLED'
  | 'COLLAPSE';

/** U01 § 11.2 — evaluation display status. */
export type UnderfrequencyDisplayStatus = 'OPERATE' | 'RESTRAIN' | 'INVALID';

/** U01 § 11 — the net-deficit solving status. */
export type UnderfrequencySolveStatus =
  | 'SETTLED'
  | 'COLLAPSE'
  | 'DEFICIT_EXCEEDS_AVAILABLE_GENERATION';

// ─────────────────── Domain evaluation (shared O02 pattern) ────────────────

export type UnderfrequencyDomainIssueCode =
  | 'NON_FINITE_INPUT'
  | 'NUMERICAL_RANGE'
  | 'NON_POSITIVE_INERTIA'
  | 'NON_POSITIVE_DROOP'
  | 'NON_POSITIVE_HEADROOM'
  | 'NON_POSITIVE_MVA'
  | 'INVALID_POLES'
  | 'NON_POSITIVE_F_NOM'
  | 'DEFICIT_EXCEEDS_AVAILABLE_GENERATION'
  | 'INVALID_UFLS_ORDER'
  | 'NON_POSITIVE_SHED_FRACTION'
  | 'INVALID_TOPOLOGY';

export interface UnderfrequencyDomainIssue {
  readonly code: UnderfrequencyDomainIssueCode;
  readonly path?: string;
  readonly detail?: string;
}

export type DomainEvaluation<T> =
  | { readonly status: 'VALID'; readonly value: T }
  | {
      readonly status: 'INVALID';
      readonly issues: readonly UnderfrequencyDomainIssue[];
    };

/** Shared domain-issue alias so the rest of the codebase can reference a generic domain issue. */
export type DomainIssue = UnderfrequencyDomainIssue;
export type DomainIssueCode = UnderfrequencyDomainIssueCode;

// ──────────────────────────── System configuration ─────────────────────────
// U01 § 5.2 / § 4.1.

export interface UnderfrequencySystemData {
  /** Nominal frequency (Hz). Default 50. */
  readonly fNominalHz: number;
  /** Study system line-to-line voltage (kV). Display-only; no network model. */
  readonly voltageKv: number;
  /** Pre-disturbance total load (MW). Used as the base for UFLS shed amounts. */
  readonly baseLoadMw: number;
}

// ──────────────────────────── Generator configuration ───────────────────────
// U01 § 5.1.

export interface UnderfrequencyGeneratorData {
  readonly id: GeneratorId;
  readonly label: string;
  /** Rated MW (nameplate). */
  readonly mwRated: number;
  /** MVA rating — used for inertia weighting and S_base. */
  readonly mva: number;
  /** Inertia constant H (seconds). */
  readonly inertiaSec: number;
  /** Droop R (per-unit). e.g. 0.05 = 5%. */
  readonly droopPu: number;
  /** Synchronous pole count — used only for RPM display. */
  readonly poles: number;
  /** Maximum achievable governor output (MW). */
  readonly governorMaxMw: number;
  /** Pre-disturbance output P0 (MW). */
  readonly initialMw: number;
  /** Pre-disturbance operating status. */
  readonly status: UnderfrequencyGeneratorStatus;
}

// ──────────────────────────── Relay settings ───────────────────────────────
// U01 § 9.1.

export interface UnderfrequencyRelaySettings {
  readonly enabled: boolean;
  /** Display label — ANSI function is 81U (underfrequency). */
  readonly modelLabel: string;
}

// ──────────────────────────── UFLS stage settings ──────────────────────────
// U01 § 9.1.

export interface UflsStageSettings {
  readonly id: UflsStageId;
  readonly label: string;
  readonly enabled: boolean;
  /** Arming threshold (Hz). Pickup is strict: f < threshold && !nearlyEqual. */
  readonly thresholdHz: number;
  /** Intentional reset-definite-time delay (seconds). */
  readonly timeDelaySec: number;
  /** Fraction of pre-disturbance load shed on trip / 100. */
  readonly shedFractionPct: number;
}

// ──────────────────────────── Disturbance step ─────────────────────────────
// U01 § 6.1.

export interface UnderfrequencyDisturbanceStep {
  readonly id: UnderfrequencyEventId;
  readonly kind: UnderfrequencyDisturbanceStepKind;
  /** Engineering time the step applies (seconds). */
  readonly timeSec: number;
  /** Required for GENERATOR_LOSS / GENERATOR_BLOCK. */
  readonly generatorId?: GeneratorId;
  /** MW magnitude (loss/block positive; load step signed). */
  readonly mw?: number;
}

// ──────────────────────────── Study definition ─────────────────────────────
// The full offline study, pre-playback. U01 § 5-10.

export interface UnderfrequencyStudyDefinition {
  readonly id: UnderfrequencyPresetId;
  readonly label: string;
  readonly description: string;
  readonly system: UnderfrequencySystemData;
  readonly generators: readonly UnderfrequencyGeneratorData[];
  readonly relay: UnderfrequencyRelaySettings;
  readonly uflsStages: readonly UflsStageSettings[];
  /** Disturbance schedule, ordered (but not required strictly) by timeSec. */
  readonly disturbanceSteps: readonly UnderfrequencyDisturbanceStep[];
  readonly notes?: {
    readonly plnVerificationRequired?: boolean;
    readonly sourceNote?: string;
  };
}

// ──────────────────────────── Preset (registry) ────────────────────────────
// U01 § 10. A preset is a fully-realised study definition plus a stable id.

export interface UnderfrequencyStudyPreset {
  readonly id: UnderfrequencyPresetId;
  readonly label: string;
  readonly description: string;
  readonly study: UnderfrequencyStudyDefinition;
}

// ──────────────────────────── Static result ────────────────────────────────
// U01 § 11.1. The closed-form reference used for timeline parity.

export interface UnderfrequencyGovernorResult {
  readonly generatorId: GeneratorId;
  readonly droopResponseMw: number;
  readonly actualOutputMw: number;
  readonly headroomMw: number;
  readonly saturated: boolean;
  /** The deviation at which this unit just reaches its headroom (Hz). */
  readonly saturatingDeltaHz: number;
}

export interface UnderfrequencyUflsStageResult {
  readonly stageId: UflsStageId;
  readonly thresholdHz: number;
  readonly shedMw: number;
  readonly operated: boolean;
}

export interface UnderfrequencyStaticResult {
  readonly sBaseMva: number;
  readonly hSysSec: number;
  readonly betaPu: number;
  readonly betaMwPerHz: number;
  /** df/dt|₀ for the initial post-disturbance deficit (Hz/s). */
  readonly initialRocofHzPerSec: number;
  /** D₀ — initial post-disturbance deficit, pre-governor (MW). */
  readonly initialDeficitMw: number;
  /** Closed-form steady-state frequency (Hz); null on collapse. */
  readonly steadyStateHz: number | null;
  readonly steadyStateStatus: UnderfrequencySteadyStateStatus;
  readonly solveStatus: UnderfrequencySolveStatus;
  readonly governorResults: readonly UnderfrequencyGovernorResult[];
  readonly uflsStageResults: readonly UnderfrequencyUflsStageResult[];
  readonly totalShedMw: number;
  readonly generatorStatus: Readonly<Record<GeneratorId, UnderfrequencyGeneratorStatus>>;
  readonly displayStatus: UnderfrequencyDisplayStatus;
  readonly issues: readonly DomainIssue[];
}

// ──────────────────────────── Timeline ─────────────────────────────────────
// U01 § 8. Time-domain run emitted by computeUnderfrequencyTimeline.

export type UnderfrequencyTimelineEventType =
  | 'DISTURBANCE_APPLIED'
  | 'GOVERNOR_SATURATION'
  | 'GOVERNOR_UNSATURATION'
  | 'UFLS_ARMED'
  | 'UFLS_TIMER_RESET'
  | 'UFLS_TRIP'
  | 'STEADY_STATE_REACHED'
  | 'COLLAPSE'
  | 'STAGE_RESET';

export interface UnderfrequencyTimelineEvent {
  readonly id: UnderfrequencyTimelineEventId;
  /** Engineering timestamp (never wall-clock). */
  readonly timeSec: number;
  readonly type: UnderfrequencyTimelineEventType;
  readonly detail?: string;
  readonly stageId?: UflsStageId;
  readonly generatorId?: GeneratorId;
  readonly shedMw?: number;
}

export interface UnderfrequencyGeneratorSnapshot {
  readonly generatorId: GeneratorId;
  readonly status: UnderfrequencyGeneratorStatus;
  readonly outputMw: number;
  readonly governorResponseMw: number;
  readonly headroomMw: number;
  readonly saturated: boolean;
  /** Synchronous speed (rpm) derived from frequency at this snapshot. */
  readonly rpm: number;
}

export interface UnderfrequencyTimelineSnapshot {
  readonly engineeringTimeSec: number;
  readonly frequencyHz: number;
  readonly rocofHzPerSec: number;
  readonly deficitMw: number;
  readonly generators: readonly UnderfrequencyGeneratorSnapshot[];
  readonly armedStageIds: readonly UflsStageId[];
  readonly operatedStageIds: readonly UflsStageId[];
}

export interface UnderfrequencyTimelineRun {
  readonly studyId: UnderfrequencyPresetId;
  readonly snapshots: readonly UnderfrequencyTimelineSnapshot[];
  readonly events: readonly UnderfrequencyTimelineEvent[];
  readonly finalFrequencyHz: number | null;
  readonly finalTimeSec: number;
  readonly steadyStateStatus: UnderfrequencySteadyStateStatus;
  readonly status: 'VALID' | 'INVALID';
  readonly issues: readonly DomainIssue[];
}

// ──────────────────────────── Playback state ───────────────────────────────
// UI playback control; engineering-time-decoupled.

export type UnderfrequencyPlaybackState =
  | 'IDLE'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETE'
  | 'INVALID';

export type UnderfrequencyPlaybackSpeed = 1 | 5 | 10;

// ──────────────────────────── Simulator state ──────────────────────────────
// Small reducer state, mirroring DistanceSimulatorState rather than the
// much larger Overcurrent state. The timeline is memoised from the study.

export interface UnderfrequencySimulatorState {
  readonly presetId: UnderfrequencyPresetId;
  readonly study: UnderfrequencyStudyDefinition;
  readonly modified: boolean;
  readonly playbackState: UnderfrequencyPlaybackState;
  readonly simulationSpeed: UnderfrequencyPlaybackSpeed;
  /** Engineering-time scrub target; -1 or undefined means "show final". */
  readonly scrubTimeSec: number | null;
}
