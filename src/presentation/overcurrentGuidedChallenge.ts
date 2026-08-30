import type {
  CoordinationAuditDimension,
  CoordinationAuditDimensionResult,
  GuidedHint,
  StudyRequirementKey,
} from '../types/overcurrent';
import type { OvercurrentParameterState } from '../utils/overcurrentState';

export type GuidedChallengeStatus =
  | 'NOT_APPLICABLE'
  | 'READY'
  | 'VALIDATION_REQUIRED'
  | 'INCOMPLETE'
  | 'VERIFIED'
  | 'INVALID';

export type GuidedChallengeRequirementStatus = 'PENDING' | 'PASS' | 'FAIL' | 'NOT_EVALUABLE';

export interface GuidedChallengeRequirementRow {
  readonly key: StudyRequirementKey;
  readonly label: string;
  readonly status: GuidedChallengeRequirementStatus;
  readonly violationCount: number;
}

export interface OvercurrentGuidedChallengeModel {
  readonly applicable: boolean;
  readonly presetId: string;
  readonly presetLabel: string;
  readonly status: GuidedChallengeStatus;
  readonly statusLabel: string;
  readonly statusDetail: string;
  readonly objectiveTitle: string | null;
  readonly requirements: readonly GuidedChallengeRequirementRow[];
  readonly passedCaseCount: number | null;
  readonly totalCaseCount: number;
  readonly hints: readonly GuidedHint[];
  readonly revealedHints: readonly GuidedHint[];
  readonly canRevealHint: boolean;
  readonly completionNotes: readonly string[];
  readonly whyThisWorks: readonly string[];
}

const REQUIREMENT_LABELS: Readonly<Record<StudyRequirementKey, string>> = {
  SENSITIVITY: 'Sensitivity',
  SELECTIVITY: 'Selectivity',
  TIME_GRADING: 'Time Grading',
  INSTANTANEOUS_REACH: '50 Reach',
  LOAD_SECURITY: 'Load Security',
  BACKUP_AVAILABILITY: 'Backup Availability',
};

const DIMENSION_BY_REQUIREMENT: Readonly<Record<StudyRequirementKey, CoordinationAuditDimension>> = {
  SENSITIVITY: 'SENSITIVITY',
  SELECTIVITY: 'SELECTIVITY',
  TIME_GRADING: 'TIME_GRADING',
  INSTANTANEOUS_REACH: 'INSTANTANEOUS_REACH',
  LOAD_SECURITY: 'LOAD_SECURITY',
  BACKUP_AVAILABILITY: 'BACKUP_AVAILABILITY',
};

function requirementRows(
  keys: readonly StudyRequirementKey[],
  dimensions: readonly CoordinationAuditDimensionResult[] | null,
): GuidedChallengeRequirementRow[] {
  return keys.map((key) => {
    const result = dimensions?.find((entry) => entry.dimension === DIMENSION_BY_REQUIREMENT[key]);
    return {
      key,
      label: REQUIREMENT_LABELS[key],
      status: result?.status ?? 'PENDING',
      violationCount: result?.violationCount ?? 0,
    };
  });
}

function whyThisWorks(requirements: readonly GuidedChallengeRequirementRow[]): string[] {
  const passed = new Set(requirements.filter((entry) => entry.status === 'PASS').map((entry) => entry.key));
  const result: string[] = [];
  if (passed.has('SENSITIVITY')) result.push('Configured minimum-fault primaries remain above their enabled 51 pickup thresholds.');
  if (passed.has('LOAD_SECURITY')) result.push('Configured maximum load remains below the enabled protection pickup thresholds.');
  if (passed.has('SELECTIVITY')) result.push('Required downstream primaries operate before their adjacent upstream backups.');
  if (passed.has('TIME_GRADING')) result.push('Every required primary-backup CTI margin meets or exceeds its configured target.');
  if (passed.has('INSTANTANEOUS_REACH')) result.push('No required upstream backup 50 element overreaches a configured downstream fault.');
  if (passed.has('BACKUP_AVAILABILITY')) result.push('Required upstream backups remain available for the configured minimum-fault cases.');
  return result;
}

function statusText(status: GuidedChallengeStatus, modified: boolean): Pick<OvercurrentGuidedChallengeModel, 'statusLabel' | 'statusDetail'> {
  switch (status) {
    case 'VERIFIED':
      return { statusLabel: 'COORDINATION VERIFIED', statusDetail: 'All configured validation cases and required study objectives pass.' };
    case 'INCOMPLETE':
      return { statusLabel: 'COORDINATION INCOMPLETE', statusDetail: 'The latest complete validation still contains a required coordination failure.' };
    case 'INVALID':
      return { statusLabel: 'INPUT INVALID / OUTPUT HELD', statusDetail: 'Correct invalid engineering input before validating the challenge.' };
    case 'VALIDATION_REQUIRED':
      return { statusLabel: 'VALIDATION REQUIRED', statusDetail: 'Engineering settings changed. Run Coordination Test to validate the complete configured study.' };
    case 'READY':
      return { statusLabel: 'READY TO INVESTIGATE', statusDetail: modified ? 'Review the current engineering state, then validate all configured cases.' : 'Investigate the intentional initial coordination problem before changing settings.' };
    case 'NOT_APPLICABLE':
    default:
      return { statusLabel: 'FREE STUDY', statusDetail: 'Guided challenge workflow is not active.' };
  }
}

export function buildOvercurrentGuidedChallengeModel(
  state: OvercurrentParameterState,
): OvercurrentGuidedChallengeModel {
  const learning = state.studyDefinition.learning;
  const objective = learning?.objective;
  const applicable = state.studyMode === 'COORDINATION_LAB'
    && state.guidanceMode === 'GUIDED'
    && objective !== undefined;

  if (!applicable || !objective) {
    const status = statusText('NOT_APPLICABLE', state.modified);
    return {
      applicable: false,
      presetId: state.studyPresetId,
      presetLabel: state.studyDefinition.label,
      status: 'NOT_APPLICABLE',
      ...status,
      objectiveTitle: null,
      requirements: [],
      passedCaseCount: null,
      totalCaseCount: state.studyDefinition.validationCaseIds.length,
      hints: [],
      revealedHints: [],
      canRevealHint: false,
      completionNotes: [],
      whyThisWorks: [],
    };
  }

  const validation = state.validationState;
  const audit = validation.status === 'COMPLETE' ? validation.audit : null;
  const requirements = requirementRows(objective.requirementKeys, audit?.dimensions ?? null);
  const requiredAllPass = requirements.length > 0 && requirements.every((entry) => entry.status === 'PASS');
  const allCasesPass = audit !== null
    && audit.totalCaseCount > 0
    && audit.passedCaseCount === audit.totalCaseCount;

  let challengeStatus: GuidedChallengeStatus;
  if (validation.status === 'INVALID') {
    challengeStatus = 'INVALID';
  } else if (validation.status === 'COMPLETE') {
    challengeStatus = audit?.status === 'COORDINATED' && allCasesPass && requiredAllPass
      ? 'VERIFIED'
      : 'INCOMPLETE';
  } else if (state.modified) {
    challengeStatus = 'VALIDATION_REQUIRED';
  } else {
    challengeStatus = 'READY';
  }

  const hints = learning?.hints ?? [];
  const revealedCount = Math.max(0, Math.min(state.guidedChallengeProgress.revealedHintCount, hints.length));
  const status = statusText(challengeStatus, state.modified);
  return {
    applicable: true,
    presetId: state.studyPresetId,
    presetLabel: state.studyDefinition.label,
    status: challengeStatus,
    ...status,
    objectiveTitle: objective.title,
    requirements,
    passedCaseCount: audit?.passedCaseCount ?? null,
    totalCaseCount: audit?.totalCaseCount ?? state.studyDefinition.validationCaseIds.length,
    hints,
    revealedHints: hints.slice(0, revealedCount),
    canRevealHint: revealedCount < hints.length,
    completionNotes: learning?.completionNotes ?? [],
    whyThisWorks: challengeStatus === 'VERIFIED' ? whyThisWorks(requirements) : [],
  };
}
