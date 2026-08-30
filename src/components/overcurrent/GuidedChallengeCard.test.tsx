import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildOvercurrentGuidedChallengeModel } from '../../presentation/overcurrentGuidedChallenge';
import {
  createInitialOvercurrentParameterState,
  overcurrentParameterReducer,
  type OvercurrentParameterAction,
} from '../../utils/overcurrentState';
import { GuidedChallengeCard } from './GuidedChallengeCard';

const noopDispatch = (_action: OvercurrentParameterAction) => undefined;

describe('O13 Guided Challenge card', () => {
  it('renders objective, pending requirements, run-all validation, and progressive-hint contract', () => {
    const state = createInitialOvercurrentParameterState('COORD-03');
    const markup = renderToStaticMarkup(<GuidedChallengeCard model={buildOvercurrentGuidedChallengeModel(state)} dispatch={noopDispatch} />);
    expect(markup).toContain('GUIDED STUDY · COORD-03');
    expect(markup).toContain('STUDY OBJECTIVE');
    expect(markup).toContain('Sensitivity');
    expect(markup).toContain('Run Coordination Test');
    expect(markup).toContain('0/3');
    expect(markup).toContain('Reveal next hint');
    expect(markup).not.toContain('WHY THIS WORKS');
  });

  it('renders only the hints revealed by reducer-owned challenge progress', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = overcurrentParameterReducer(state, { type: 'REVEAL_GUIDED_HINT' });
    const markup = renderToStaticMarkup(<GuidedChallengeCard model={buildOvercurrentGuidedChallengeModel(state)} dispatch={noopDispatch} />);
    expect(markup).toContain('HINT 1 · LOCATION');
    expect(markup).not.toContain('HINT 2 · PARAMETER FAMILY');
  });

  it('shows Why This Works only after explicit verified validation', () => {
    let state = createInitialOvercurrentParameterState('COORD-02');
    state = overcurrentParameterReducer(state, { type: 'SET_DEVICE_51_TIME_SCALE', deviceId: 'R2', value: 0.19 });
    state = overcurrentParameterReducer(state, { type: 'RUN_COORDINATION_TEST' });
    const markup = renderToStaticMarkup(<GuidedChallengeCard model={buildOvercurrentGuidedChallengeModel(state)} dispatch={noopDispatch} />);
    expect(markup).toContain('COORDINATION VERIFIED');
    expect(markup).toContain('6 / 6 STUDY CASES PASSED');
    expect(markup).toContain('WHY THIS WORKS');
    expect(markup).toContain('CTI margin');
  });
});
