/**
 * Overcurrent Relay domain contracts (O02, refined by O05 integration).
 *
 * These types are intentionally UI-independent and calculation-free.
 * They encode the vocabulary and data relationships locked by the
 * authoritative Overcurrent PRD and O01 Engineering Specification.
 */

export type ProtectionDeviceId = string;
export type StudyLocationId = string;
export type FaultCaseId = string;
export type LoadCaseId = string;
export type CurrentProfileId = string;
export type FaultLocationProfileId = string;
export type CoordinationPairId = string;
export type CoordinationRequirementId = string;
export type StudyPresetId = string;
export type StudySnapshotId = string;
export type TimelineEventId = string;
export type TCCLayerId = string;

export type OvercurrentStudyMode = 'SINGLE_RELAY' | 'COORDINATION_LAB';
export type StudyGuidanceMode = 'GUIDED' | 'FREE';
export type OvercurrentTimingMode51 = 'INVERSE' | 'DEFINITE';
export type OvercurrentInverseCurveId =
  | 'IEC_SI'
  | 'IEC_VI'
  | 'IEC_EI'
  | 'IEEE_MI'
  | 'IEEE_VI'
  | 'IEEE_EI';
export type PlaybackSpeed = 1 | 5 | 10;
export type FaultCurrentCategory = 'MIN' | 'NOMINAL' | 'MAX' | 'CUSTOM';
export type LoadCurrentCategory = 'NORMAL' | 'MAXIMUM' | 'CUSTOM';
export type CurrentInterpolationMode = 'STEP' | 'LINEAR';
export type TCCCurrentDomain = 'PRIMARY_A' | 'SECONDARY_A' | 'CURRENT_MULTIPLE';

export type DomainIssueCode =
  | 'NON_FINITE_INPUT'
  | 'NUMERICAL_RANGE'
  | 'NON_POSITIVE_CT_RATIO'
  | 'INVALID_SETTING_RANGE'
  | 'MISSING_REFERENCE'
  | 'INVALID_TOPOLOGY'
  | 'INVALID_PROFILE'
  | 'INVALID_COORDINATION_PAIR'
  | 'INVALID_TIMELINE_STATE';

export interface DomainIssue {
  readonly code: DomainIssueCode;
  readonly path?: string;
  readonly detail?: string;
}

export type DomainEvaluation<T> =
  | {
      readonly status: 'VALID';
      readonly value: T;
    }
  | {
      readonly status: 'INVALID';
      readonly issues: readonly DomainIssue[];
    };

export interface CTConfiguration {
  /** CT primary rating in primary amperes. */
  readonly primaryRatedA: number;
  /** CT secondary rating in secondary amperes. */
  readonly secondaryRatedA: number;
  /** Signed ratio/measurement error percentage as locked by O01. */
  readonly ratioErrorPct: number;
}

export interface Overcurrent51Settings {
  readonly enabled: boolean;
  /** 51 pickup in CT-secondary amperes. */
  readonly pickupASecondary: number;
  readonly timingMode: OvercurrentTimingMode51;
  /** Stored for inverse mode; ignored by definite-time evaluation. */
  readonly inverseCurveId: OvercurrentInverseCurveId;
  /** Normalized O01 time-scale scalar. UI labels this TMS or Time Dial. */
  readonly timeScale: number;
  /** Stored for definite-time mode; ignored by inverse evaluation. */
  readonly definiteDelaySec: number;
}

export interface Overcurrent50Settings {
  readonly enabled: boolean;
  /** Instantaneous high-set pickup in CT-secondary amperes. */
  readonly pickupASecondary: number;
}

export interface BreakerConfiguration {
  /** Intentional study-model breaker clearing interval after trip output. */
  readonly clearingTimeSec: number;
}

export interface OvercurrentDeviceSettings {
  readonly ct: CTConfiguration;
  readonly phase51: Overcurrent51Settings;
  readonly phase50: Overcurrent50Settings;
  readonly breaker: BreakerConfiguration;
}

export interface ProtectionDeviceBase {
  readonly id: ProtectionDeviceId;
  readonly label: string;
  /** Stable display/series ordering hint; not a protection decision by itself. */
  readonly order: number;
}

export interface OvercurrentProtectionDevice extends ProtectionDeviceBase {
  readonly kind: 'OVERCURRENT_50_51';
  readonly settings: OvercurrentDeviceSettings;
}

/**
 * Intentionally a union alias so future protection-device kinds can be added
 * without rewriting topology, study, snapshot, or presentation contracts.
 */
export type ProtectionDevice = OvercurrentProtectionDevice;

export interface ProtectionChain {
  readonly primaryDeviceId: ProtectionDeviceId;
  /** Ordered nearest-to-farthest backup chain. */
  readonly backupDeviceIds: readonly ProtectionDeviceId[];
}

export interface StudyLocation {
  readonly id: StudyLocationId;
  readonly label: string;
  /**
   * Optional normalized visual/study position for radial scrubber support.
   * It is preset study metadata, not an impedance/distance calculation.
   */
  readonly normalizedPosition?: number;
}

export type StudyTopologyKind = 'SINGLE_RELAY_FEEDER' | 'RADIAL_FEEDER';

export interface StudyTopology {
  readonly id: string;
  readonly label: string;
  readonly kind: StudyTopologyKind;
  /** Ordered upstream-to-downstream for current radial V1 studies. */
  readonly deviceIds: readonly ProtectionDeviceId[];
  readonly locations: readonly StudyLocation[];
}

export interface DevicePrimaryCurrentMap {
  readonly [deviceId: ProtectionDeviceId]: number;
}

export interface CurrentProfileSample {
  /** Engineering time from profile start. */
  readonly timeSec: number;
  readonly primaryCurrentAByDevice: DevicePrimaryCurrentMap;
}

export interface CurrentProfile {
  readonly id: CurrentProfileId;
  readonly label: string;
  readonly interpolation: CurrentInterpolationMode;
  /** Samples must be deterministic and monotonically ordered by time in O05/O07. */
  readonly samples: readonly CurrentProfileSample[];
}

export type StudyCurrentDefinition =
  | {
      readonly kind: 'STATIC';
      readonly primaryCurrentAByDevice: DevicePrimaryCurrentMap;
    }
  | {
      readonly kind: 'PROFILE';
      readonly profileId: CurrentProfileId;
    };

/** Semantic alias retained for fault-study readability. */
export type FaultCurrentDefinition = StudyCurrentDefinition;

export interface LoadCase {
  readonly id: LoadCaseId;
  readonly label: string;
  readonly category: LoadCurrentCategory;
  readonly current: StudyCurrentDefinition;
}

export interface FaultCase {
  readonly id: FaultCaseId;
  readonly label: string;
  readonly locationId: StudyLocationId;
  readonly category: FaultCurrentCategory;
  readonly current: FaultCurrentDefinition;
  /** Explicit study relationship; never inferred from a hidden short-circuit solver. */
  readonly protectionChain: ProtectionChain;
  /**
   * Optional study-policy exception for an upstream instantaneous element that is
   * intentionally permitted to operate for this configured fault. Absence means
   * the default O01 radial policy: backup 50 pickup is overreach.
   */
  readonly allowedBackupInstantaneousDeviceIds?: readonly ProtectionDeviceId[];
  /** Optional independent fault-clear event before relay/breaker isolation. */
  readonly externalClearTimeSec?: number;
  /** Optional profile after an external clear or study-defined topology transition. */
  readonly postFaultProfileId?: CurrentProfileId;
}

export interface FaultLocationProfileSample {
  readonly normalizedPosition: number;
  readonly primaryCurrentAByDevice: DevicePrimaryCurrentMap;
}

export interface FaultLocationProfileSegment {
  readonly startPosition: number;
  readonly endPosition: number;
  readonly locationId: StudyLocationId;
  /** Explicit role map for this configured scrubber interval. */
  readonly protectionChain: ProtectionChain;
}

export interface FaultLocationProfile {
  readonly id: FaultLocationProfileId;
  readonly label: string;
  readonly interpolation: 'LINEAR';
  /** Explicit preset study samples for scrubber visualization/evaluation. */
  readonly samples: readonly FaultLocationProfileSample[];
  /**
   * Optional configured protection-zone intervals. O05 uses these to change
   * primary/backup roles during a scrubber study without inferring network
   * topology or fault impedance.
   */
  readonly segments?: readonly FaultLocationProfileSegment[];
}

export interface CoordinationPair {
  readonly id: CoordinationPairId;
  readonly locationId: StudyLocationId;
  readonly primaryDeviceId: ProtectionDeviceId;
  readonly backupDeviceId: ProtectionDeviceId;
  /** 1 = nearest backup, 2 = next upstream backup, etc. */
  readonly backupOrder: number;
}

export interface CTIBudget {
  readonly breakerAllowanceSec: number;
  readonly relayTimingAllowanceSec: number;
  readonly studySafetyMarginSec: number;
}

export interface CoordinationRequirement {
  readonly id: CoordinationRequirementId;
  readonly pairId: CoordinationPairId;
  readonly requiredCtiSec: number;
  /** Optional explanatory decomposition; requiredCtiSec remains authoritative. */
  readonly budget?: CTIBudget;
}

export interface MeasurementResult {
  readonly primaryCurrentA: number;
  readonly idealSecondaryCurrentA: number;
  readonly measuredSecondaryCurrentA: number;
}

export type Overcurrent51StaticStatus = 'DISABLED' | 'BELOW_PICKUP' | 'PICKUP';
export type Overcurrent50StaticStatus = 'DISABLED' | 'BELOW_PICKUP' | 'PICKUP';
export type OvercurrentSelectedElement = '50' | '51' | null;

export interface Overcurrent51OperatingResult {
  readonly status: Overcurrent51StaticStatus;
  readonly currentMultiple: number | null;
  /** Theoretical 51 operate time; null when not picked up. */
  readonly operateTimeSec: number | null;
  readonly timingMode: OvercurrentTimingMode51;
}

export interface Overcurrent50OperatingResult {
  readonly status: Overcurrent50StaticStatus;
  /** O01 V1 model: zero intentional relay delay when 50 picks up. */
  readonly operateTimeSec: 0 | null;
}

export interface OperatingResult {
  readonly deviceId: ProtectionDeviceId;
  readonly measurement: MeasurementResult;
  readonly element51: Overcurrent51OperatingResult;
  readonly element50: Overcurrent50OperatingResult;
  /** 50 has arbitration priority when both are eligible. */
  readonly selectedElement: OvercurrentSelectedElement;
  readonly selectedTripTimeSec: number | null;
}

export type CoordinationPairStatus = 'PASS' | 'FAIL' | 'NOT_EVALUABLE';

export interface CoordinationPairResult {
  readonly pairId: CoordinationPairId;
  readonly primaryTripTimeSec: number | null;
  readonly backupTripTimeSec: number | null;
  readonly observedCtiSec: number | null;
  readonly requiredCtiSec: number;
  /** observedCtiSec - requiredCtiSec when evaluable. */
  readonly surplusSec: number | null;
  readonly status: CoordinationPairStatus;
}

export type CoordinationViolationType =
  | 'TIME_GRADING'
  | 'SELECTIVITY_FAIL'
  | 'INSTANTANEOUS_OVERREACH'
  | 'SENSITIVITY_RISK'
  | 'LOAD_SECURITY_FAIL'
  | 'BACKUP_NOT_AVAILABLE';

export interface CoordinationViolation {
  readonly type: CoordinationViolationType;
  /** One of faultCaseId/loadCaseId/profileId identifies the evaluated study context. */
  readonly faultCaseId?: FaultCaseId;
  readonly loadCaseId?: LoadCaseId;
  readonly profileId?: FaultLocationProfileId;
  readonly normalizedPosition?: number;
  readonly pairId?: CoordinationPairId;
  readonly deviceId?: ProtectionDeviceId;
  readonly observedValue?: number;
  readonly requiredValue?: number;
  readonly unit?: string;
}

export type CoordinationAuditDimension =
  | 'SENSITIVITY'
  | 'SELECTIVITY'
  | 'TIME_GRADING'
  | 'INSTANTANEOUS_REACH'
  | 'LOAD_SECURITY'
  | 'BACKUP_AVAILABILITY';

export interface CoordinationAuditDimensionResult {
  readonly dimension: CoordinationAuditDimension;
  readonly status: 'PASS' | 'FAIL' | 'NOT_EVALUABLE';
  readonly violationCount: number;
}

export interface CoordinationAuditResult {
  readonly status: 'COORDINATED' | 'COORDINATION_INCOMPLETE' | 'NOT_EVALUABLE';
  readonly passedCaseCount: number;
  readonly totalCaseCount: number;
  readonly dimensions: readonly CoordinationAuditDimensionResult[];
  readonly violations: readonly CoordinationViolation[];
  readonly worstCase?: {
    readonly faultCaseId: FaultCaseId;
    readonly pairId: CoordinationPairId;
    readonly observedCtiSec: number;
    readonly requiredCtiSec: number;
    readonly surplusSec: number;
  };
}

export interface CoordinationOperatingOrderEntry {
  readonly deviceId: ProtectionDeviceId;
  readonly role: 'PRIMARY' | 'BACKUP' | 'OTHER';
  readonly backupOrder: number | null;
  readonly selectedElement: OvercurrentSelectedElement;
  readonly tripTimeSec: number | null;
}

export interface CoordinationFaultCaseResult {
  readonly faultCaseId: FaultCaseId;
  readonly locationId: StudyLocationId;
  readonly category: FaultCurrentCategory;
  readonly deviceResults: Readonly<Record<ProtectionDeviceId, OperatingResult>>;
  readonly operatingOrder: readonly CoordinationOperatingOrderEntry[];
  readonly pairResults: readonly CoordinationPairResult[];
  readonly violations: readonly CoordinationViolation[];
  readonly status: 'PASS' | 'FAIL';
}

export interface LoadSecurityDeviceResult {
  readonly deviceId: ProtectionDeviceId;
  readonly relayCurrentASecondary: number;
  readonly pickup51ASecondary: number | null;
  readonly pickup50ASecondary: number | null;
  readonly margin51ASecondary: number | null;
  readonly margin50ASecondary: number | null;
  readonly status: 'PASS' | 'FAIL';
}

export interface LoadSecurityCaseResult {
  readonly loadCaseId: LoadCaseId;
  readonly deviceResults: readonly LoadSecurityDeviceResult[];
  readonly violations: readonly CoordinationViolation[];
  readonly status: 'PASS' | 'FAIL';
}

export interface CoordinationEnvelopePairPoint {
  readonly pairId: CoordinationPairId;
  readonly primaryTripTimeSec: number | null;
  readonly backupTripTimeSec: number | null;
  readonly minimumBackupTimeSec: number | null;
  readonly observedCtiSec: number | null;
  readonly requiredCtiSec: number;
  readonly surplusSec: number | null;
  readonly status: CoordinationPairStatus;
  readonly instantaneousOverreach: boolean;
}

export interface CoordinationEnvelopePoint {
  readonly normalizedPosition: number;
  readonly locationId: StudyLocationId | null;
  readonly protectionChain: ProtectionChain | null;
  readonly primaryCurrentAByDevice: DevicePrimaryCurrentMap;
  readonly pairPoints: readonly CoordinationEnvelopePairPoint[];
  readonly violations: readonly CoordinationViolation[];
}

export interface CoordinationEnvelopeResult {
  readonly profileId: FaultLocationProfileId;
  readonly points: readonly CoordinationEnvelopePoint[];
  readonly worstPoint?: {
    readonly normalizedPosition: number;
    readonly locationId: StudyLocationId | null;
    readonly pairId: CoordinationPairId;
    readonly observedCtiSec: number;
    readonly requiredCtiSec: number;
    readonly surplusSec: number;
  };
}

export interface OvercurrentCoordinationStudyResult {
  readonly audit: CoordinationAuditResult;
  readonly faultCaseResults: readonly CoordinationFaultCaseResult[];
  readonly loadSecurityResults: readonly LoadSecurityCaseResult[];
  readonly envelopes: readonly CoordinationEnvelopeResult[];
}

export type OvercurrentRelayTimelineState =
  | 'BELOW_PICKUP'
  | '51_TIMING'
  | '50_TRIPPED'
  | '51_TRIPPED'
  | 'BREAKER_OPENING'
  | 'BREAKER_OPEN'
  | 'RESET'
  | 'INVALID';

export type OvercurrentPlaybackState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE' | 'INVALID';

interface TimelineEventBase {
  readonly id: TimelineEventId;
  /** Engineering timestamp, never wall-clock time. */
  readonly timeSec: number;
}

export type TimelineEvent =
  | (TimelineEventBase & {
      readonly type: 'FAULT_APPLIED';
      readonly faultCaseId: FaultCaseId;
    })
  | (TimelineEventBase & {
      readonly type: 'CURRENT_PROFILE_CHANGED';
      readonly profileId: CurrentProfileId;
    })
  | (TimelineEventBase & {
      readonly type: '51_PICKUP';
      readonly deviceId: ProtectionDeviceId;
    })
  | (TimelineEventBase & {
      readonly type: '50_TRIP';
      readonly deviceId: ProtectionDeviceId;
    })
  | (TimelineEventBase & {
      readonly type: '51_TRIP';
      readonly deviceId: ProtectionDeviceId;
    })
  | (TimelineEventBase & {
      readonly type: 'BREAKER_OPENING';
      readonly deviceId: ProtectionDeviceId;
    })
  | (TimelineEventBase & {
      readonly type: 'BREAKER_OPEN';
      readonly deviceId: ProtectionDeviceId;
    })
  | (TimelineEventBase & {
      readonly type: 'FAULT_ISOLATED';
      readonly faultCaseId: FaultCaseId;
      readonly clearingDeviceId?: ProtectionDeviceId;
    })
  | (TimelineEventBase & {
      readonly type: '51_RESET';
      readonly deviceId: ProtectionDeviceId;
    });

export interface RelayTimelineSnapshot {
  readonly deviceId: ProtectionDeviceId;
  readonly state: OvercurrentRelayTimelineState;
  /** 0..1 accumulated 51 operate quantity for the current timing episode. */
  readonly operateProgress51: number;
  readonly tripOutputTimeSec: number | null;
  readonly breakerOpenTimeSec: number | null;
}

export interface TimelineSnapshot {
  readonly engineeringTimeSec: number;
  readonly playbackState: OvercurrentPlaybackState;
  readonly faultCaseId: FaultCaseId | null;
  readonly relays: Readonly<Record<ProtectionDeviceId, RelayTimelineSnapshot>>;
  readonly events: readonly TimelineEvent[];
}

export type TCCLayerKind =
  | 'RELAY_CURVE'
  | 'INSTANTANEOUS_BOUNDARY'
  | 'FAULT_CURRENT_LINE'
  | 'OPERATING_POINT'
  | 'PICKUP_BOUNDARY'
  | 'LOAD_REGION'
  | 'MINIMUM_FAULT_REFERENCE'
  | 'MAXIMUM_FAULT_REFERENCE'
  | 'COORDINATION_CORRIDOR'
  | 'COORDINATION_VIOLATION_ENVELOPE'
  | 'COORDINATION_BRACKET'
  | 'INITIAL_SETTING_GHOST'
  | 'STUDY_MARKER'
  | 'EQUIPMENT_LIMIT';

interface TCCLayerBase {
  readonly id: TCCLayerId;
  readonly kind: TCCLayerKind;
  readonly label: string;
  readonly visible: boolean;
  readonly zIndex: number;
}

export interface TCCRelayCurveLayer extends TCCLayerBase {
  readonly kind: 'RELAY_CURVE' | 'INITIAL_SETTING_GHOST';
  readonly deviceId: ProtectionDeviceId;
}

export interface TCCInstantaneousBoundaryLayer extends TCCLayerBase {
  readonly kind: 'INSTANTANEOUS_BOUNDARY';
  readonly deviceId: ProtectionDeviceId;
  readonly pickupASecondary: number;
}

export interface TCCFaultCurrentLineLayer extends TCCLayerBase {
  readonly kind: 'FAULT_CURRENT_LINE';
  readonly faultCaseId: FaultCaseId;
  readonly primaryCurrentA?: number;
}

export interface TCCOperatingPointLayer extends TCCLayerBase {
  readonly kind: 'OPERATING_POINT';
  readonly deviceId: ProtectionDeviceId;
  readonly faultCaseId?: FaultCaseId;
  readonly primaryCurrentA: number;
  readonly secondaryCurrentA: number;
  readonly currentMultiple: number;
  readonly operateTimeSec: number;
  readonly role?: 'PRIMARY' | 'BACKUP';
}

export interface TCCReferenceLayer extends TCCLayerBase {
  readonly kind:
    | 'PICKUP_BOUNDARY'
    | 'LOAD_REGION'
    | 'MINIMUM_FAULT_REFERENCE'
    | 'MAXIMUM_FAULT_REFERENCE'
    | 'STUDY_MARKER'
    | 'EQUIPMENT_LIMIT';
  readonly minCurrent?: number;
  readonly maxCurrent?: number;
  readonly unit?: 'A_PRIMARY' | 'A_SECONDARY' | 'MULTIPLE';
}

export interface TCCCoordinationLayer extends TCCLayerBase {
  readonly kind: 'COORDINATION_CORRIDOR' | 'COORDINATION_VIOLATION_ENVELOPE' | 'COORDINATION_BRACKET';
  readonly pairId: CoordinationPairId;
  readonly requiredCtiSec: number;
}

export type TCCLayer =
  | TCCRelayCurveLayer
  | TCCInstantaneousBoundaryLayer
  | TCCFaultCurrentLineLayer
  | TCCOperatingPointLayer
  | TCCReferenceLayer
  | TCCCoordinationLayer;

export interface TCCViewState {
  readonly currentDomain: TCCCurrentDomain;
  readonly scaleMode: 'CHARACTERISTIC' | 'FIT_POINT';
  readonly layers: readonly TCCLayer[];
}

export interface StudySnapshot {
  readonly id: StudySnapshotId;
  readonly label: string;
  readonly devicesById: Readonly<Record<ProtectionDeviceId, ProtectionDevice>>;
  readonly coordinationRequirements: readonly CoordinationRequirement[];
  readonly selectedFaultCaseId?: FaultCaseId;
}


export type StudyRequirementKey =
  | 'SENSITIVITY'
  | 'SELECTIVITY'
  | 'TIME_GRADING'
  | 'INSTANTANEOUS_REACH'
  | 'LOAD_SECURITY'
  | 'BACKUP_AVAILABILITY';

export interface StudyObjective {
  readonly title: string;
  readonly requirementKeys: readonly StudyRequirementKey[];
}

export type GuidedHintLevel = 'LOCATION' | 'PARAMETER_FAMILY' | 'DIRECTION';

export interface GuidedHint {
  readonly level: GuidedHintLevel;
  readonly text: string;
  readonly faultCaseId?: FaultCaseId;
  readonly pairId?: CoordinationPairId;
  readonly deviceId?: ProtectionDeviceId;
}

export interface StudyLearningMetadata {
  readonly objective?: StudyObjective;
  readonly hints: readonly GuidedHint[];
  readonly completionNotes?: readonly string[];
}

export type OvercurrentValidationState =
  | { readonly status: 'IDLE' }
  | { readonly status: 'RUNNING' }
  | {
      readonly status: 'COMPLETE';
      readonly audit: CoordinationAuditResult;
    }
  | {
      readonly status: 'INVALID';
      readonly issues: readonly DomainIssue[];
    };

export interface OvercurrentStudyDefinition {
  readonly id: StudyPresetId;
  readonly label: string;
  readonly mode: OvercurrentStudyMode;
  readonly guidance: StudyGuidanceMode;
  readonly topology: StudyTopology;
  readonly devicesById: Readonly<Record<ProtectionDeviceId, ProtectionDevice>>;
  /** Explicit load/reference cases used by Explore and load-security studies. */
  readonly loadCases: readonly LoadCase[];
  readonly faultCases: readonly FaultCase[];
  readonly currentProfiles: readonly CurrentProfile[];
  readonly faultLocationProfiles: readonly FaultLocationProfile[];
  readonly coordinationPairs: readonly CoordinationPair[];
  readonly coordinationRequirements: readonly CoordinationRequirement[];
  readonly validationCaseIds: readonly FaultCaseId[];
  readonly loadSecurityCaseIds: readonly LoadCaseId[];
  /** Stable preset initialization hints; no hidden runtime defaults. */
  readonly defaultSelectedDeviceId?: ProtectionDeviceId;
  readonly defaultLoadCaseId?: LoadCaseId;
  readonly defaultFaultCaseId?: FaultCaseId;
  /** Guided/free-study metadata only; never an alternate engineering source of truth. */
  readonly learning?: StudyLearningMetadata;
}

export interface OvercurrentUISectionState {
  readonly [sectionId: string]: boolean;
}

export interface OvercurrentSimulatorState {
  readonly studyMode: OvercurrentStudyMode;
  readonly guidanceMode: StudyGuidanceMode;
  readonly studyPresetId: StudyPresetId;
  readonly topology: StudyTopology;
  readonly selectedDeviceId: ProtectionDeviceId | null;
  readonly activeLoadCaseId: LoadCaseId | null;
  readonly activeFaultCaseId: FaultCaseId | null;
  readonly simulationSpeed: PlaybackSpeed;
  readonly playbackState: OvercurrentPlaybackState;
  readonly devicesById: Readonly<Record<ProtectionDeviceId, ProtectionDevice>>;
  readonly coordinationRequirements: readonly CoordinationRequirement[];
  readonly initialSnapshot: StudySnapshot | null;
  readonly comparisonSnapshot: StudySnapshot | null;
  readonly validationState: OvercurrentValidationState;
  readonly uiSectionState: OvercurrentUISectionState;
}
