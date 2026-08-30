export type DifferentialCharacteristicMode = 'dual' | 'multi';

export interface DifferentialSettings {
  /** Minimum operate current / horizontal characteristic level in CT-secondary amperes. */
  iSet: number;
  /** First bias-current turning point: end of the horizontal Iset section. */
  biasBreakpoint1: number;
  /** Percentage-restraint slope between breakpoint 1 and breakpoint 2. */
  slope1: number;
  /** Second bias-current turning point: transition from Slope 1 to Slope 2. */
  biasBreakpoint2: number;
  /** Percentage-restraint slope above breakpoint 2 in dual-slope mode. */
  slope2: number;
  /** Dual uses Iset + S1 + S2. Multi additionally enables breakpoint 3 + S3. */
  characteristicMode: DifferentialCharacteristicMode;
  /** Third turning point, used only in multi-slope mode. */
  biasBreakpoint3: number;
  /** Percentage-restraint slope above breakpoint 3 in multi-slope mode. */
  slope3: number;
}

export type NumericDifferentialSettingKey = Exclude<keyof DifferentialSettings, 'characteristicMode'>;

export interface DifferentialInputs extends DifferentialSettings {
  /** Signed scalar RMS current entering the protected zone from terminal 1, in CT-secondary A. */
  i1: number;
  /** Signed scalar RMS current entering the protected zone from terminal 2, in CT-secondary A. */
  i2: number;
}

export type DifferentialDecision = 'OPERATE' | 'RESTRAIN';

export interface DifferentialResult {
  iDiff: number;
  iBias: number;
  iOpLimit: number;
  decision: DifferentialDecision;
}

export function validateDifferentialSettings(settings: DifferentialSettings): string[] {
  const errors: string[] = [];
  const finiteNonNegative: Array<[number, string]> = [
    [settings.iSet, 'Iset'],
    [settings.biasBreakpoint1, 'Bias breakpoint 1'],
    [settings.biasBreakpoint2, 'Bias breakpoint 2'],
    [settings.biasBreakpoint3, 'Bias breakpoint 3'],
    [settings.slope1, 'Slope 1'],
    [settings.slope2, 'Slope 2'],
    [settings.slope3, 'Slope 3'],
  ];
  for (const [value, label] of finiteNonNegative) {
    if (!Number.isFinite(value) || value < 0) errors.push(`${label} must be finite and >= 0.`);
  }
  if (Number.isFinite(settings.biasBreakpoint1) && Number.isFinite(settings.biasBreakpoint2) && settings.biasBreakpoint2 <= settings.biasBreakpoint1) {
    errors.push('Bias breakpoint 2 must be greater than breakpoint 1.');
  }
  if (settings.characteristicMode === 'multi' && Number.isFinite(settings.biasBreakpoint2) && Number.isFinite(settings.biasBreakpoint3) && settings.biasBreakpoint3 <= settings.biasBreakpoint2) {
    errors.push('Bias breakpoint 3 must be greater than breakpoint 2 in multi-slope mode.');
  }
  if (settings.characteristicMode !== 'dual' && settings.characteristicMode !== 'multi') errors.push('Characteristic mode must be dual or multi.');
  return errors;
}

export function validateDifferentialInputs(inputs: DifferentialInputs): string[] {
  const errors = validateDifferentialSettings(inputs);
  if (!Number.isFinite(inputs.i1)) errors.push('I1 must be finite.');
  if (!Number.isFinite(inputs.i2)) errors.push('I2 must be finite.');
  return errors;
}

function assertValidSettings(settings: DifferentialSettings): void {
  const errors = validateDifferentialSettings(settings);
  if (errors.length > 0) throw new RangeError(errors.join(' '));
}

function finiteResult(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} exceeded the supported numeric range.`);
  return value;
}

export function operateLimit(iBias: number, settings: DifferentialSettings): number {
  assertValidSettings(settings);
  if (!Number.isFinite(iBias) || iBias < 0) throw new RangeError('Bias current must be finite and >= 0 A.');

  const { iSet, biasBreakpoint1: bp1, biasBreakpoint2: bp2, biasBreakpoint3: bp3 } = settings;
  if (iBias <= bp1) return iSet;

  const atBp2 = finiteResult(iSet + (settings.slope1 / 100) * (bp2 - bp1), 'Slope-1 operate threshold');
  if (iBias <= bp2) return finiteResult(iSet + (settings.slope1 / 100) * (iBias - bp1), 'Slope-1 operate threshold');

  if (settings.characteristicMode === 'dual' || iBias <= bp3) {
    return finiteResult(atBp2 + (settings.slope2 / 100) * (iBias - bp2), 'Slope-2 operate threshold');
  }

  const atBp3 = finiteResult(atBp2 + (settings.slope2 / 100) * (bp3 - bp2), 'Breakpoint-3 operate threshold');
  return finiteResult(atBp3 + (settings.slope3 / 100) * (iBias - bp3), 'Slope-3 operate threshold');
}

export function calculateDifferential(inputs: DifferentialInputs): DifferentialResult {
  const errors = validateDifferentialInputs(inputs);
  if (errors.length > 0) throw new RangeError(errors.join(' '));

  const iDiff = finiteResult(Math.abs(inputs.i1 + inputs.i2), 'Differential current');
  // Divide each magnitude before addition to avoid avoidable overflow in
  // (|I1| + |I2|) / 2 while preserving the same mathematical definition.
  const iBias = finiteResult(Math.abs(inputs.i1) / 2 + Math.abs(inputs.i2) / 2, 'Bias current');
  const iOpLimit = operateLimit(iBias, inputs);
  const decision: DifferentialDecision = iDiff > iOpLimit ? 'OPERATE' : 'RESTRAIN';
  return { iDiff, iBias, iOpLimit, decision };
}
