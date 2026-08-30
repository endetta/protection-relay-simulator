import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { parseEngineeringDraft } from '../../utils/engineering';
import { usePressRepeat } from '../../hooks/usePressRepeat';
import { InfoDot } from './InfoDot';

/** Localizable prose for the generic auto-generated field help/error/aria strings. */
export interface NumberFieldIntl {
  validInputLabel?: string;
  typicalBandLabel?: string;
  typicalBandOutside?: string;
  invalidDraft?: string;
  increaseLabel?: (label: string) => string;
  decreaseLabel?: (label: string) => string;
}

const DEFAULT_INTL: Required<Omit<NumberFieldIntl, 'increaseLabel' | 'decreaseLabel'>> & NumberFieldIntl = {
  validInputLabel: 'Valid input',
  typicalBandLabel: 'Typical study band',
  typicalBandOutside: 'Values outside this band may still be valid.',
  invalidDraft: 'Invalid draft — last valid value remains in the simulation.',
};

interface FieldProps {
  label: string;
  unit: string;
  value: number;
  min?: number;
  max?: number;
  typicalMin?: number;
  typicalMax?: number;
  step?: number;
  onChange: (v: number) => void;
  onValidityChange?: (valid: boolean) => void;
  syncKey?: number;
  info?: string;
  intl?: NumberFieldIntl;
}

function rangeLabel(min: number | undefined, max: number | undefined, unit: string): string | null {
  if (min === undefined && max === undefined) return null;
  const lower = min ?? '−∞';
  const upper = max ?? '∞';
  return `${lower} to ${upper} ${unit}`;
}

function decimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(value).toLowerCase();
  if (text.includes('e-')) {
    const [coefficient, exponentText] = text.split('e-');
    const exponent = Number(exponentText);
    const decimals = coefficient.includes('.') ? coefficient.split('.')[1].length : 0;
    return exponent + decimals;
  }
  return text.includes('.') ? text.split('.')[1].length : 0;
}

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value));
}

export function NumberField({
  label,
  unit,
  value,
  min,
  max,
  typicalMin,
  typicalMax,
  step = 0.1,
  onChange,
  onValidityChange,
  syncKey = 0,
  info,
  intl = {},
}: FieldProps) {
  const i18n = { ...DEFAULT_INTL, ...intl };
  const inputId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(String(value));
  const draftRef = useRef(String(value));
  const previousValidity = useRef<boolean | null>(null);

  const updateDraft = (next: string) => {
    draftRef.current = next;
    setDraft(next);
  };

  useEffect(() => {
    const next = String(value);
    draftRef.current = next;
    setDraft(next);
  }, [value, syncKey]);

  const parsedDraft = useMemo(() => parseEngineeringDraft(draft, min, max), [draft, min, max]);
  const parsed = parsedDraft.value;
  const valid = parsedDraft.valid;
  const unusual = valid && parsed !== null && (
    (typicalMin !== undefined && parsed < typicalMin)
    || (typicalMax !== undefined && parsed > typicalMax)
  );

  useEffect(() => {
    if (previousValidity.current === valid) return;
    previousValidity.current = valid;
    onValidityChange?.(valid);
  }, [onValidityChange, valid]);

  const validRange = rangeLabel(min, max, unit);
  const typicalRange = rangeLabel(typicalMin, typicalMax, unit);
  const help = [
    info,
    validRange ? `${i18n.validInputLabel}: ${validRange}.` : null,
    typicalRange ? `${i18n.typicalBandLabel}: ${typicalRange}. ${i18n.typicalBandOutside}` : null,
  ].filter(Boolean).join(' ');

  const stepValue = (direction: 1 | -1): boolean => {
    const liveDraft = parseEngineeringDraft(draftRef.current, min, max);
    const base = liveDraft.valid && liveDraft.value !== null ? liveDraft.value : value;
    const precision = Math.min(10, Math.max(decimalPlaces(step), decimalPlaces(base)) + 2);
    const next = clamp(Number((base + direction * step).toFixed(precision)), min, max);
    if (!Number.isFinite(next) || Object.is(next, base)) return false;
    updateDraft(String(next));
    onChange(next);
    return true;
  };

  const atMin = min !== undefined && valid && parsed !== null && parsed <= min;
  const atMax = max !== undefined && valid && parsed !== null && parsed >= max;
  const incrementPress = usePressRepeat(() => stepValue(1), atMax);
  const decrementPress = usePressRepeat(() => stepValue(-1), atMin);

  return (
    <div className='number-field grid min-w-0 content-start gap-1.5 text-xs'>
      <div className='number-field-label flex min-w-0 items-center gap-1.5 font-semibold uppercase tracking-[0.045em]'>
        <label htmlFor={inputId} className='min-w-0 flex-1 whitespace-nowrap text-[9.5px] leading-[1.35]'>{label}</label>
        {help && <InfoDot help={help} />}
      </div>

      <div className='number-field-control grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center'>
        <div className='number-stepper relative min-w-0'>
          <input
            id={inputId}
            type='number'
            value={draft}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const nextDraft = e.target.value;
              updateDraft(nextDraft);
              const next = parseEngineeringDraft(nextDraft, min, max);
              if (next.valid && next.value !== null) onChange(next.value);
            }}
            onWheel={(event) => {
              // Prevent accidental numeric changes while the user is scrolling a panel.
              if (document.activeElement === event.currentTarget) event.currentTarget.blur();
            }}
            aria-invalid={!valid}
            aria-describedby={!valid ? errorId : undefined}
            data-tone={!valid ? 'invalid' : unusual ? 'warning' : 'normal'}
            className='number-field-input min-w-0 w-full rounded border px-2 py-1.5 text-right font-eng text-[12px] leading-4 focus:outline-none'
          />
          <div className='number-stepper-buttons absolute inset-y-[1px] right-[1px] grid grid-rows-2 overflow-hidden rounded-r-[3px] border-l'>
            <button
              type='button'
              aria-label={i18n.increaseLabel?.(label) ?? `Increase ${label}`}
              disabled={atMax}
              {...incrementPress}
              className='number-stepper-button flex items-center justify-center border-b text-[7px] leading-none disabled:cursor-not-allowed disabled:opacity-30'
            >
              ▲
            </button>
            <button
              type='button'
              aria-label={i18n.decreaseLabel?.(label) ?? `Decrease ${label}`}
              disabled={atMin}
              {...decrementPress}
              className='number-stepper-button flex items-center justify-center text-[7px] leading-none disabled:cursor-not-allowed disabled:opacity-30'
            >
              ▼
            </button>
          </div>
        </div>
        <span className='number-field-unit shrink-0 text-[9px] leading-none'>{unit}</span>
      </div>

      {!valid && (
        <span id={errorId} className='text-[9px] leading-tight text-[var(--sim-red)]'>{i18n.invalidDraft}</span>
      )}
    </div>
  );
}
