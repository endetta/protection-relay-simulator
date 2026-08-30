/**
 * Measurement chain (instrument-transformer scaling, NOT relay math).
 * The current reference model is intentionally simple: ideal CT ratio plus a
 * configurable ratio-error term. CT saturation is not modelled here.
 */
export interface CTConfig {
  /** CT primary rated current (A). Must be > 0. */
  priRated: number;
  /** CT secondary rated current (A). Must be > 0. */
  secRated: number;
  /** CT ratio error in percent. Values <= -100 % are not physically accepted by this model. */
  errorPct: number;
}

export function validateCTConfig(cfg: CTConfig): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(cfg.priRated) || cfg.priRated <= 0) errors.push('CT primary rating must be finite and > 0 A.');
  if (!Number.isFinite(cfg.secRated) || cfg.secRated <= 0) errors.push('CT secondary rating must be finite and > 0 A.');
  if (!Number.isFinite(cfg.errorPct) || cfg.errorPct <= -100) errors.push('CT ratio error must be finite and greater than -100 %.');
  return errors;
}

function assertValidMeasurementInput(priA: number, cfg: CTConfig): void {
  const errors = validateCTConfig(cfg);
  if (!Number.isFinite(priA)) errors.push('Primary current must be finite.');
  if (errors.length > 0) throw new RangeError(errors.join(' '));
}

function assertFiniteResult(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} exceeded the supported numeric range.`);
  return value;
}

/**
 * Convert a signed primary RMS current through a CT to ideal secondary current.
 * I_sec = I_pri * (secRated / priRated)
 */
export function ctSecondary(priA: number, cfg: CTConfig): number {
  assertValidMeasurementInput(priA, cfg);
  const ratio = assertFiniteResult(cfg.secRated / cfg.priRated, 'CT ratio');
  return assertFiniteResult(priA * ratio, 'CT secondary current');
}

/**
 * Apply the simplified CT ratio-error model.
 * I_meas = I_sec * (1 + errorPct / 100)
 */
export function applyCT(priA: number, cfg: CTConfig): number {
  assertValidMeasurementInput(priA, cfg);
  const secondary = ctSecondary(priA, cfg);
  const errorFactor = assertFiniteResult(1 + cfg.errorPct / 100, 'CT ratio-error factor');
  return assertFiniteResult(secondary * errorFactor, 'Measured CT secondary current');
}
