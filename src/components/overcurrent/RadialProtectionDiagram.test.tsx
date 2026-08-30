import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { evaluateOvercurrentTimeline } from '../../engines/overcurrentTimeline';
import { getOvercurrentStudyPreset } from '../../studies/overcurrentPresets';
import { initializeOvercurrentSimulatorState } from '../../studies/overcurrentStudy';
import type {
  OvercurrentProtectionDevice,
  OvercurrentStudyDefinition,
  TimelineSnapshot,
} from '../../types/overcurrent';
import {
  createInitialOvercurrentParameterState,
  type OvercurrentParameterAction,
  type OvercurrentParameterState,
} from '../../utils/overcurrentState';
import { RadialProtectionDiagram } from './RadialProtectionDiagram';

const noopDispatch = (_action: OvercurrentParameterAction) => undefined;

function renderState(
  state: OvercurrentParameterState,
  timelineSnapshot: TimelineSnapshot | null = null,
): string {
  return renderToStaticMarkup(
    <RadialProtectionDiagram
      state={state}
      timelineSnapshot={timelineSnapshot}
      dispatch={noopDispatch}
    />,
  );
}

function fourRelayState(): OvercurrentParameterState {
  const base = getOvercurrentStudyPreset('OVC-04')!.devicesById.R1 as OvercurrentProtectionDevice;
  const ids = ['UPSTREAM', 'MID_A', 'MID_B', 'FEEDER'];
  const devices = ids.map((id, index): OvercurrentProtectionDevice => ({
    ...base,
    id,
    label: id,
    order: index + 1,
  }));
  const study: OvercurrentStudyDefinition = {
    id: 'O09-FOUR',
    label: 'Four Relay SLD Contract',
    mode: 'COORDINATION_LAB',
    guidance: 'FREE',
    topology: {
      id: 'O09-FOUR:TOPOLOGY',
      label: 'Four Relay Radial Feeder',
      kind: 'RADIAL_FEEDER',
      deviceIds: ids,
      locations: [{ id: 'F4', label: 'Downstream Fault', normalizedPosition: 0.9 }],
    },
    devicesById: Object.fromEntries(devices.map((device) => [device.id, device])),
    loadCases: [],
    faultCases: [{
      id: 'O09-FOUR:F4',
      label: 'F4 Fault',
      locationId: 'F4',
      category: 'CUSTOM',
      current: { kind: 'STATIC', primaryCurrentAByDevice: Object.fromEntries(ids.map((id) => [id, 2000])) },
      protectionChain: { primaryDeviceId: 'FEEDER', backupDeviceIds: ['MID_B', 'MID_A', 'UPSTREAM'] },
    }],
    currentProfiles: [],
    faultLocationProfiles: [],
    coordinationPairs: [],
    coordinationRequirements: [],
    validationCaseIds: ['O09-FOUR:F4'],
    loadSecurityCaseIds: [],
    defaultSelectedDeviceId: 'FEEDER',
    defaultFaultCaseId: 'O09-FOUR:F4',
  };
  const initialized = initializeOvercurrentSimulatorState(study);
  if (initialized.status === 'INVALID') throw new Error(JSON.stringify(initialized.issues));
  return {
    ...initialized.value,
    studyDefinition: study,
    faultLocationSelection: null,
    modified: false,
    guidedChallengeProgress: { revealedHintCount: 0 },
  };
}

describe('O09 Radial Protection Diagram', () => {
  it('renders a labeled, keyboard-accessible three-relay SLD with active roles and fault', () => {
    const markup = renderState(createInitialOvercurrentParameterState('COORD-02'));

    expect(markup).toContain('single-line diagram');
    expect(markup).toContain('Three Relay Radial Feeder');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('SOURCE');
    expect(markup).toContain('LOAD');
    expect(markup.match(/class="overcurrent-sld-device"/g)).toHaveLength(3);
    expect(markup.match(/class="overcurrent-sld-fault"/g)).toHaveLength(3);
    expect(markup).toContain('R3, PRIMARY, breaker closed, 6000.0 amperes primary');
    expect(markup).toContain('R2, BACKUP 1, breaker closed, 6000.0 amperes primary');
    expect(markup).toContain('R1, BACKUP 2, breaker closed, 6000.0 amperes primary');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('renders single-relay load state without inventing an active fault', () => {
    const markup = renderState(createInitialOvercurrentParameterState('OVC-01'));
    expect(markup).toContain('Single Relay Feeder');
    expect(markup).toContain('LOAD STUDY');
    expect(markup).toContain('R1, STANDBY, breaker closed, 600.00 amperes primary');
    expect(markup).not.toContain('Configured fault-location profile');
  });

  it('renders O07 breaker-open and fault-isolated state without UI timing logic', () => {
    const state = createInitialOvercurrentParameterState('COORD-02');
    const timeline = evaluateOvercurrentTimeline({
      study: state.studyDefinition,
      faultCaseId: state.activeFaultCaseId!,
      playbackSpeed: 10,
    });
    expect(timeline.status).toBe('VALID');
    if (timeline.status !== 'VALID') throw new Error('Expected a valid O07 timeline.');

    const markup = renderState(state, timeline.value);
    expect(markup).toContain('FAULT ISOLATED');
    expect(markup).toContain('data-breaker="OPEN"');
    expect(markup).toContain('BREAKER OPEN');
    expect(markup).toContain('breaker open');
  });

  it('renders a synthetic four-relay topology without relay-specific component code', () => {
    const markup = renderState(fourRelayState());
    expect(markup.match(/class="overcurrent-sld-device"/g)).toHaveLength(4);
    expect(markup).toContain('FEEDER, PRIMARY');
    expect(markup).toContain('MID_B, BACKUP 1');
    expect(markup).toContain('MID_A, BACKUP 2');
    expect(markup).toContain('UPSTREAM, BACKUP 3');
  });

  it('keeps O10 TCC, O11 sequence, Analysis, and route integration outside O09', () => {
    const markup = renderState(createInitialOvercurrentParameterState('COORD-01'));
    expect(markup).not.toContain('Time-Current Characteristic');
    expect(markup).not.toContain('Operating Sequence');
    expect(markup).not.toContain('Coordination Inspector');
    expect(markup).not.toContain('PROTECTION SYSTEM SIMULATOR');
  });
});
