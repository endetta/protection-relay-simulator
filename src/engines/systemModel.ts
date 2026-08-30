export interface LoadDrivenSystem {
  /** Transformer three-phase rated apparent power. */
  transformerRatingMVA: number;
  /** Terminal-1 rated line-to-line voltage. */
  side1KV: number;
  /** Terminal-2 rated line-to-line voltage. */
  side2KV: number;
  /** Three-phase active load before a fault is applied. */
  activeLoadMW: number;
  /** Displacement power factor magnitude used to derive apparent load. */
  powerFactor: number;
}

export type SystemConditionKind = 'load' | 'internal-fault' | 'external-fault';

export interface SystemCondition {
  kind: SystemConditionKind;
  /** Fault-current magnitude expressed as a multiple of each terminal rated current. */
  currentMultiple: number;
}

export interface SystemDerived {
  apparentLoadMVA: number;
  loadingPct: number;
  ratedI1A: number;
  ratedI2A: number;
  loadI1A: number;
  loadI2A: number;
}

export interface PrimaryCurrents {
  i1p: number;
  i2p: number;
}

const SQRT3 = Math.sqrt(3);
const KILO_PER_SQRT3 = 1_000 / SQRT3;

export function validateLoadDrivenSystem(system: LoadDrivenSystem): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(system.transformerRatingMVA) || system.transformerRatingMVA <= 0) errors.push('Transformer rating must be finite and > 0 MVA.');
  if (!Number.isFinite(system.side1KV) || system.side1KV <= 0) errors.push('Side-1 voltage must be finite and > 0 kV.');
  if (!Number.isFinite(system.side2KV) || system.side2KV <= 0) errors.push('Side-2 voltage must be finite and > 0 kV.');
  if (!Number.isFinite(system.activeLoadMW) || system.activeLoadMW < 0) errors.push('Active load must be finite and >= 0 MW.');
  if (!Number.isFinite(system.powerFactor) || system.powerFactor <= 0 || system.powerFactor > 1) errors.push('Power factor must be finite, > 0, and <= 1.');
  return errors;
}

export function validateSystemCondition(condition: SystemCondition): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(condition.currentMultiple) || condition.currentMultiple <= 0) errors.push('Current multiple must be finite and > 0.');
  return errors;
}

function assertSystem(system: LoadDrivenSystem): void {
  const errors = validateLoadDrivenSystem(system);
  if (errors.length > 0) throw new RangeError(errors.join(' '));
}

function assertFiniteResult(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} exceeded the supported numeric range.`);
  return value;
}

function threePhaseCurrentA(apparentPowerMVA: number, lineVoltageKV: number): number {
  // Divide before multiplying by the engineering-unit conversion constant to
  // preserve additional headroom for very large but still finite inputs.
  return assertFiniteResult((apparentPowerMVA / lineVoltageKV) * KILO_PER_SQRT3, 'Three-phase current');
}

/**
 * Calculate three-phase transformer/load quantities using S = sqrt(3) * V_LL * I.
 * Power factor is used only to convert active load MW to apparent load MVA.
 */
export function calculateSystemDerived(system: LoadDrivenSystem): SystemDerived {
  assertSystem(system);
  const apparentLoadMVA = assertFiniteResult(system.activeLoadMW / system.powerFactor, 'Derived apparent load');
  const loadingPct = assertFiniteResult((apparentLoadMVA / system.transformerRatingMVA) * 100, 'Loading percentage');
  const ratedI1A = threePhaseCurrentA(system.transformerRatingMVA, system.side1KV);
  const ratedI2A = threePhaseCurrentA(system.transformerRatingMVA, system.side2KV);
  const loadI1A = threePhaseCurrentA(apparentLoadMVA, system.side1KV);
  const loadI2A = threePhaseCurrentA(apparentLoadMVA, system.side2KV);
  return { apparentLoadMVA, loadingPct, ratedI1A, ratedI2A, loadI1A, loadI2A };
}

/**
 * Resolve signed primary currents for the simplified two-terminal study model.
 * Positive current is defined as entering the protected zone from each terminal.
 */
export function resolvePrimaryCurrents(system: LoadDrivenSystem, condition: SystemCondition): PrimaryCurrents {
  const conditionErrors = validateSystemCondition(condition);
  if (conditionErrors.length > 0) throw new RangeError(conditionErrors.join(' '));
  const derived = calculateSystemDerived(system);

  if (condition.kind === 'load') {
    return { i1p: derived.loadI1A, i2p: -derived.loadI2A };
  }

  const i1Fault = assertFiniteResult(derived.ratedI1A * condition.currentMultiple, 'Terminal-1 fault current');
  const i2Fault = assertFiniteResult(derived.ratedI2A * condition.currentMultiple, 'Terminal-2 fault current');
  return condition.kind === 'internal-fault'
    ? { i1p: i1Fault, i2p: i2Fault }
    : { i1p: i1Fault, i2p: -i2Fault };
}
