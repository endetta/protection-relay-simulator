export type RelayStatus = 'OPERATE' | 'RESTRAIN' | 'ALARM';
export type DifferentialDisplayStatus = 'OPERATE' | 'RESTRAIN' | 'INVALID';

export type ZoneId = 'parameters' | 'simulation' | 'analysis';

export interface EngineeringValue<T extends number = number> {
  value: T;
  unit: string;
}

export interface ParameterDefinition {
  key: string;
  label: string;
  unit: string;
}

// Differential scenario presets intentionally live in src/utils/presets.ts.
// Keeping one production source of truth prevents tests and UI from drifting apart.
