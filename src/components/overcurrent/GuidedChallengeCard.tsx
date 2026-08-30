import type { Dispatch } from 'react';
import type { OvercurrentGuidedChallengeModel } from '../../presentation/overcurrentGuidedChallenge';
import type { OvercurrentParameterAction } from '../../utils/overcurrentState';
import './guidedChallengeCard.css';

export interface GuidedChallengeCardProps {
  readonly model: OvercurrentGuidedChallengeModel;
  readonly dispatch: Dispatch<OvercurrentParameterAction>;
  readonly validationDisabled?: boolean;
}

function toneForRequirement(status: OvercurrentGuidedChallengeModel['requirements'][number]['status']): string {
  if (status === 'PASS') return 'success';
  if (status === 'FAIL') return 'danger';
  if (status === 'NOT_EVALUABLE') return 'warning';
  return 'neutral';
}

function hintLevelLabel(level: OvercurrentGuidedChallengeModel['hints'][number]['level']): string {
  if (level === 'PARAMETER_FAMILY') return 'PARAMETER FAMILY';
  return level;
}

export function GuidedChallengeCard({ model, dispatch, validationDisabled = false }: GuidedChallengeCardProps) {
  if (!model.applicable) return null;
  const statusTone = model.status === 'VERIFIED'
    ? 'success'
    : model.status === 'INCOMPLETE' || model.status === 'INVALID'
      ? 'danger'
      : model.status === 'VALIDATION_REQUIRED'
        ? 'warning'
        : 'info';

  return (
    <section className='overcurrent-guided-challenge' aria-label='Guided coordination challenge'>
      <header role='status' aria-live='polite' aria-atomic='true'>
        <div>
          <span>GUIDED STUDY · {model.presetId}</span>
          <b>{model.presetLabel}</b>
        </div>
        <em data-tone={statusTone}>{model.statusLabel}</em>
      </header>

      <div className='overcurrent-guided-objective'>
        <span>STUDY OBJECTIVE</span>
        <b>{model.objectiveTitle}</b>
        <small>{model.statusDetail}</small>
      </div>

      <div className='overcurrent-guided-requirements'>
        {model.requirements.map((requirement) => (
          <div key={requirement.key} data-tone={toneForRequirement(requirement.status)}>
            <span>{requirement.label}</span>
            <b>{requirement.status}</b>
          </div>
        ))}
      </div>

      <div className='overcurrent-guided-validation'>
        <div>
          <span>RUN-ALL VALIDATION</span>
          <b>{model.passedCaseCount === null ? 'NOT VALIDATED' : `${model.passedCaseCount} / ${model.totalCaseCount} STUDY CASES PASSED`}</b>
        </div>
        <button
          type='button'
          disabled={validationDisabled}
          title={validationDisabled ? 'Validation is unavailable while a timed run is active or engineering input is invalid.' : undefined}
          onClick={() => dispatch({ type: 'RUN_COORDINATION_TEST' })}
        >
          Run Coordination Test
        </button>
      </div>

      <div className='overcurrent-guided-hints'>
        <div className='overcurrent-guided-subhead'>
          <span>PROGRESSIVE HINTS</span>
          <b>{model.revealedHints.length}/{model.hints.length}</b>
        </div>
        {model.revealedHints.map((hint, index) => (
          <div className='overcurrent-guided-hint' key={`${hint.level}:${index}:${hint.text}`}>
            <span>HINT {index + 1} · {hintLevelLabel(hint.level)}</span>
            <b>{hint.text}</b>
          </div>
        ))}
        {model.revealedHints.length === 0 && (
          <small>Hints reveal in order: location → parameter family → direction. Exact setting values are intentionally withheld.</small>
        )}
        {model.canRevealHint && (
          <button type='button' onClick={() => dispatch({ type: 'REVEAL_GUIDED_HINT' })}>
            Reveal next hint
          </button>
        )}
      </div>

      {model.status === 'VERIFIED' && (
        <div className='overcurrent-guided-why'>
          <span>WHY THIS WORKS</span>
          {model.whyThisWorks.map((item) => <p key={item}>{item}</p>)}
          {model.completionNotes.map((item) => <small key={item}>{item}</small>)}
        </div>
      )}
    </section>
  );
}
