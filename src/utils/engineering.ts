export function formatEngineeringValue(value: number, unit: string): string {
  return `${formatEngineeringNumber(value)} ${unit}`;
}

export function formatEngineeringNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0.000';
  if (abs < 0.01) return value.toPrecision(4);
  if (abs < 10) return value.toFixed(4);
  if (abs < 100) return value.toFixed(3);
  if (abs < 1000) return value.toFixed(2);
  return value.toFixed(1);
}

export function validateRange(value: number, min?: number, max?: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export interface EngineeringDraftResult {
  value: number | null;
  valid: boolean;
}

export function parseEngineeringDraft(draft: string, min?: number, max?: number): EngineeringDraftResult {
  if (draft.trim() === '') return { value: null, valid: false };
  const value = Number(draft);
  if (!Number.isFinite(value)) return { value: null, valid: false };
  return { value, valid: validateRange(value, min, max) };
}
