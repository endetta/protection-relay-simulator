/**
 * Underfrequency parameter-state validation + active evaluation (UFR).
 *
 * Mirrors the O08 / D08 pattern:
 *   - `validateUnderfrequencyParameterState` runs the structural study
 *     validation plus the state↔study cross-references, so an invalid draft
 *     can never reach playback ("INPUT INVALID / OUTPUT HELD");
 *   - `evaluateActiveUnderfrequency` runs the full static engine over the
 *     resolved online set to produce the closed-form reference the UI
 *     renders from the timeline (not the timeline itself — that is memoised
 *     separately from the study);
 *   - `canBeginUnderfrequencyRun` gates playback on IDLE + VALID.
 */

import type {
  DomainEvaluation,
  DomainIssue,
  UnderfrequencySimulatorState,
  UnderfrequencyStaticResult,
} from '../types/underfrequency';
import { evaluateUnderfrequencySystem } from '../engines/underfrequency';
import { validateUnderfrequencyStudyDefinition } from '../studies/underfrequencyStudy';

function issue(code: DomainIssue['code'], path: string, detail: string): DomainIssue {
  return { code, path, detail };
}

export function validateUnderfrequencyParameterState(
  state: UnderfrequencySimulatorState,
): DomainEvaluation<UnderfrequencySimulatorState> {
  const issues: DomainIssue[] = [];

  const structural = validateUnderfrequencyStudyDefinition(state.study);
  if (structural.status === 'INVALID') issues.push(...structural.issues);

  if (state.presetId !== state.study.id) {
    issues.push(issue('INVALID_TOPOLOGY', 'presetId', 'State dan definisi studi menggunakan preset ID yang berbeda.'));
  }
  const playback = state.playbackState;
  if (playback !== 'IDLE' && playback !== 'RUNNING' && playback !== 'PAUSED' && playback !== 'COMPLETE' && playback !== 'INVALID') {
    issues.push(issue('NUMERICAL_RANGE', 'playbackState', 'Playback state di luar rentang.'));
  }

  return issues.length > 0
    ? { status: 'INVALID', issues }
    : { status: 'VALID', value: state };
}

export interface ActiveUnderfrequencyEvaluation {
  /** The static closed-form reference (U01 § 11) for the current online set. */
  readonly staticResult: UnderfrequencyStaticResult;
}

export function evaluateActiveUnderfrequency(
  state: UnderfrequencySimulatorState,
): DomainEvaluation<ActiveUnderfrequencyEvaluation> {
  const validState = validateUnderfrequencyParameterState(state);
  if (validState.status === 'INVALID') return validState;

  const staticResult = evaluateUnderfrequencySystem({
    system: state.study.system,
    generators: state.study.generators,
    uflsStages: state.study.uflsStages,
  });
  if (staticResult.status === 'INVALID') return staticResult;

  return { status: 'VALID', value: { staticResult: staticResult.value } };
}

export function canBeginUnderfrequencyRun(state: UnderfrequencySimulatorState): boolean {
  if (state.playbackState !== 'IDLE') return false;
  return validateUnderfrequencyParameterState(state).status === 'VALID';
}
