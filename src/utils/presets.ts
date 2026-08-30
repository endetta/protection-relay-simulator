import type { DifferentialSettings } from '../engines/differential';
import type { CTConfig } from '../engines/measurementChain';
import { resolvePrimaryCurrents, type LoadDrivenSystem, type SystemCondition } from '../engines/systemModel';

export type FaultKind = 'none' | 'internal' | 'external';
export type OperatingInputMode = 'load' | 'direct';

export interface Preset {
  id: string;
  label: string;
  inputMode: OperatingInputMode;
  system: LoadDrivenSystem;
  condition: SystemCondition;
  i1p: number;
  i2p: number;
  ct1: CTConfig;
  ct2: CTConfig;
  faultKind: FaultKind;
  expectedUnderReferenceSettings: 'OPERATE' | 'RESTRAIN';
  description: string;
}

export const DEFAULT_SETTINGS: DifferentialSettings = {
  iSet: 0.2,
  biasBreakpoint1: 0.5,
  slope1: 25,
  biasBreakpoint2: 2,
  slope2: 50,
  characteristicMode: 'dual',
  biasBreakpoint3: 5,
  slope3: 80,
};

/**
 * Reference transformer used by the load-driven educational model.
 * 25 MVA, 150/20 kV gives a 7.5:1 voltage/current-ratio relationship.
 */
export const DEFAULT_SYSTEM: LoadDrivenSystem = {
  transformerRatingMVA: 25,
  side1KV: 150,
  side2KV: 20,
  activeLoadMW: 13.5,
  powerFactor: 0.9,
};

/** CT ratios chosen to approximately normalize rated winding current to the same 1 A-secondary base.
 *  Ratio error defaults to +1 %, a realistic figure for Class 1.0 / 5P protection CTs at rated burden. */
export const DEFAULT_CT1: CTConfig = { priRated: 100, secRated: 1, errorPct: 1 };
export const DEFAULT_CT2: CTConfig = { priRated: 750, secRated: 1, errorPct: 1 };

const cloneSystem = (overrides: Partial<LoadDrivenSystem> = {}): LoadDrivenSystem => ({ ...DEFAULT_SYSTEM, ...overrides });
const cloneCT1 = (overrides: Partial<CTConfig> = {}): CTConfig => ({ ...DEFAULT_CT1, ...overrides });
const cloneCT2 = (overrides: Partial<CTConfig> = {}): CTConfig => ({ ...DEFAULT_CT2, ...overrides });
const condition = (kind: SystemCondition['kind'], currentMultiple = 1): SystemCondition => ({ kind, currentMultiple });
const currents = (system: LoadDrivenSystem, operatingCondition: SystemCondition) => resolvePrimaryCurrents(system, operatingCondition);

const normalSystem = cloneSystem();
const normalCondition = condition('load');
const balancedSystem = cloneSystem({ activeLoadMW: 20.25 }); // 22.5 MVA at pf 0.9 = 90% loading
const balancedCondition = condition('load');
const internalCondition = condition('internal-fault', 5);
const externalCondition = condition('external-fault', 5);
const heavyCondition = condition('external-fault', 10);

export const PRESETS = [
  {
    id: 'normal-load',
    label: 'Normal Load',
    inputMode: 'direct',
    system: normalSystem,
    condition: normalCondition,
    ...currents(normalSystem, normalCondition),
    ct1: cloneCT1(),
    ct2: cloneCT2(),
    faultKind: 'none',
    expectedUnderReferenceSettings: 'RESTRAIN',
    description: 'Healthy 60% reference-load currents presented as explicit Direct Current inputs by default; Load Driven remains available for recalculation from MW, power factor, rating, and terminal voltages.',
  },
  {
    id: 'balanced-through-current',
    label: 'Balanced Through Current',
    inputMode: 'load',
    system: balancedSystem,
    condition: balancedCondition,
    ...currents(balancedSystem, balancedCondition),
    ct1: cloneCT1(),
    ct2: cloneCT2(),
    faultKind: 'none',
    expectedUnderReferenceSettings: 'RESTRAIN',
    description: 'Healthy 90% through-load; transformer-side current magnitudes differ but matched CT ratios normalize the relay currents.',
  },
  {
    id: 'internal-fault',
    label: 'Internal Fault',
    inputMode: 'load',
    system: cloneSystem(),
    condition: internalCondition,
    ...currents(DEFAULT_SYSTEM, internalCondition),
    ct1: cloneCT1(),
    ct2: cloneCT2(),
    faultKind: 'internal',
    expectedUnderReferenceSettings: 'OPERATE',
    description: 'Simplified internal fault at 5× terminal rated current; both signed currents enter the protected zone.',
  },
  {
    id: 'external-fault',
    label: 'External Fault',
    inputMode: 'load',
    system: cloneSystem(),
    condition: externalCondition,
    ...currents(DEFAULT_SYSTEM, externalCondition),
    ct1: cloneCT1(),
    ct2: cloneCT2(),
    faultKind: 'external',
    expectedUnderReferenceSettings: 'RESTRAIN',
    description: 'Simplified external through-fault at 5× rated current; high restraint with opposing terminal current directions.',
  },
  {
    id: 'ct-ratio-mismatch',
    label: 'CT Ratio Mismatch',
    inputMode: 'load',
    system: cloneSystem(),
    condition: externalCondition,
    ...currents(DEFAULT_SYSTEM, externalCondition),
    ct1: cloneCT1(),
    ct2: cloneCT2({ priRated: 800 }),
    faultKind: 'external',
    expectedUnderReferenceSettings: 'RESTRAIN',
    description: 'External through-fault with CT2 primary ratio changed from 750/1 to 800/1, producing spill current while restraint maintains stability.',
  },
  {
    id: 'ct-measurement-error',
    label: 'CT Measurement Error',
    inputMode: 'load',
    system: cloneSystem(),
    condition: externalCondition,
    ...currents(DEFAULT_SYSTEM, externalCondition),
    ct1: cloneCT1(),
    ct2: cloneCT2({ errorPct: 4 }),
    faultKind: 'external',
    expectedUnderReferenceSettings: 'RESTRAIN',
    description: 'CT2 simplified +4% ratio error creates spill current during an external fault while percentage restraint maintains stability.',
  },
  {
    id: 'heavy-through-fault',
    label: 'Heavy Through-Fault',
    inputMode: 'load',
    system: cloneSystem(),
    condition: heavyCondition,
    ...currents(DEFAULT_SYSTEM, heavyCondition),
    ct1: cloneCT1(),
    ct2: cloneCT2(),
    faultKind: 'external',
    expectedUnderReferenceSettings: 'RESTRAIN',
    description: 'Balanced external through-fault at 10× terminal rated current; high restraint current with approximately zero spill current.',
  },
] as const satisfies readonly Preset[];

export type PresetId = (typeof PRESETS)[number]['id'];
export type ScenarioId = PresetId | 'custom';

export const DEFAULT_PRESET_ID: PresetId = 'normal-load';

export function getPreset(id: string): (typeof PRESETS)[number] | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

export function requirePreset(id: PresetId): (typeof PRESETS)[number] {
  const preset = getPreset(id);
  if (!preset) throw new Error(`Unknown differential preset: ${id}`);
  return preset;
}
