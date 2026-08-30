import { calculateOvercurrentDevice, validateStaticDeviceInput } from '../engines/overcurrent';
import type { DomainEvaluation, DomainIssue, OperatingResult, OvercurrentProtectionDevice } from '../types/overcurrent';

function numericalIssue(error: unknown): DomainIssue {
  return {
    code: 'NUMERICAL_RANGE',
    path: 'evaluation',
    detail: error instanceof Error && error.message.trim()
      ? error.message
      : 'Overcurrent arithmetic produced an unsupported numeric result.',
  };
}

/**
 * Non-throwing O03 evaluation boundary for a single 50/51 device.
 * Presentation/timeline layers can hold their last valid result whenever this
 * returns INVALID, matching the hardening policy established by Differential R10.
 */
export function evaluateOvercurrentDevice(
  primaryCurrentA: number,
  device: OvercurrentProtectionDevice,
): DomainEvaluation<OperatingResult> {
  const issues = validateStaticDeviceInput(primaryCurrentA, device);
  if (issues.length > 0) return { status: 'INVALID', issues };

  try {
    return { status: 'VALID', value: calculateOvercurrentDevice(primaryCurrentA, device) };
  } catch (error) {
    return { status: 'INVALID', issues: [numericalIssue(error)] };
  }
}
