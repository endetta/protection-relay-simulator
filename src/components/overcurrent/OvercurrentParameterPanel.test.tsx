import { renderToStaticMarkup } from 'react-dom/server';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { getOvercurrentStudyPreset } from '../../studies/overcurrentPresets';
import { initializeOvercurrentSimulatorState } from '../../studies/overcurrentStudy';
import type { OvercurrentProtectionDevice, OvercurrentStudyDefinition } from '../../types/overcurrent';
import {
  createInitialOvercurrentParameterState,
  type OvercurrentParameterAction,
  type OvercurrentParameterState,
} from '../../utils/overcurrentState';
import { OvercurrentParameterPanel } from './OvercurrentParameterPanel';

function renderState(state: OvercurrentParameterState): string {
  const Wrapper = () => {
    const [sections, setSections] = useState<Record<string, boolean>>({
      study: true,
      system: true,
      coordination: true,
      simulation: true,
    });
    return (
      <OvercurrentParameterPanel
        state={state}
        dispatch={(_action: OvercurrentParameterAction) => undefined}
        sections={sections}
        setSections={setSections}
      />
    );
  };
  return renderToStaticMarkup(<Wrapper />);
}

function renderPreset(presetId: string): string {
  return renderState(createInitialOvercurrentParameterState(presetId));
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
    id: 'O08-FOUR',
    label: 'Four Relay Parameter Contract',
    mode: 'COORDINATION_LAB',
    guidance: 'FREE',
    topology: {
      id: 'O08-FOUR:TOPOLOGY',
      label: 'Four Relay Radial Feeder',
      kind: 'RADIAL_FEEDER',
      deviceIds: ids,
      locations: [{ id: 'F4', label: 'Downstream Fault' }],
    },
    devicesById: Object.fromEntries(devices.map((device) => [device.id, device])),
    loadCases: [],
    faultCases: [{
      id: 'O08-FOUR:F4',
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
    validationCaseIds: ['O08-FOUR:F4'],
    loadSecurityCaseIds: [],
    defaultSelectedDeviceId: 'FEEDER',
    defaultFaultCaseId: 'O08-FOUR:F4',
  };
  const initialized = initializeOvercurrentSimulatorState(study);
  if (initialized.status === 'INVALID') throw new Error(JSON.stringify(initialized.issues));
  return { ...initialized.value, studyDefinition: study, faultLocationSelection: null, modified: false, guidedChallengeProgress: { revealedHintCount: 0 } };
}

describe('O08 Overcurrent Parameter UI', () => {
  it('renders a data-driven three-relay editor with R10 parameter grammar', () => {
    const markup = renderPreset('COORD-02');
    expect(markup).toContain('Scenario / Study');
    expect(markup).toContain('System / Current');
    expect(markup).toContain('R1 · UPSTREAM');
    expect(markup).toContain('R2 · MIDDLE');
    expect(markup).toContain('R3 · DOWNSTREAM');
    expect(markup.match(/CT \/ Instrument/g)).toHaveLength(3);
    expect(markup.match(/51 Time Overcurrent/g)).toHaveLength(3);
    expect(markup.match(/50 Instantaneous/g)).toHaveLength(3);
    expect(markup.match(/Breaker Study/g)).toHaveLength(3);
    expect(markup).toContain('Coordination Target');
    expect(markup).toContain('Required CTI');
  });

  it('renders precise units, strict mode-specific controls, and deterministic run controls', () => {
    const markup = renderPreset('OVC-06');
    expect(markup).toContain('A primary');
    expect(markup).toContain('A sec');
    expect(markup).toContain('Definite delay');
    expect(markup).toContain('Apply Fault');
    expect(markup).toContain('Clear Fault');
    expect(markup).toContain('Reset Preset');
    expect(markup).toContain('Playback speed');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('keeps core controls accessible and does not pull later SLD/TCC/sequence phases into O08', () => {
    const markup = renderPreset('COORD-01');
    expect(markup).toContain('aria-label="Overcurrent relay parameter editor"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="Simulation playback speed"');
    expect(markup).toContain('Show parameter help');
    expect(markup).not.toContain('Time-Current Characteristic');
    expect(markup).not.toContain('Operating Sequence');
    expect(markup).not.toContain('Radial Protection Diagram');
  });

  it('renders a synthetic four-relay topology without adding relay-specific form code', () => {
    const markup = renderState(fourRelayState());
    expect(markup).toContain('UPSTREAM · UPSTREAM');
    expect(markup).toContain('MID_A · INTERMEDIATE 1');
    expect(markup).toContain('MID_B · INTERMEDIATE 2');
    expect(markup).toContain('FEEDER · DOWNSTREAM');
    expect(markup.match(/CT \/ Instrument/g)).toHaveLength(4);
    expect(markup.match(/51 Time Overcurrent/g)).toHaveLength(4);
  });
});
