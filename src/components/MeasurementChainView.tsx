import type { DifferentialDisplayStatus } from '../types/simulator';
import { formatEngineeringNumber } from '../utils/engineering';

interface Props {
  i1s: number;
  i2s: number;
  iDiff: number;
  iBias: number;
  iOpLimit: number;
  affectedKeys: readonly string[];
  status: DifferentialDisplayStatus;
}

type Tone = 'restrain' | 'trip' | 'neutral';

function Value({
  label,
  value,
  active,
  tone,
}: {
  label: string;
  value: string;
  active: boolean;
  tone: Tone;
}) {
  const toneClass = tone === 'trip'
    ? 'border-[var(--sim-red-border)] bg-[var(--sim-red-bg)] ring-1 ring-inset ring-[var(--sim-red-ring)]'
    : tone === 'restrain'
      ? active
        ? 'border-[var(--sim-green-border)] bg-[var(--sim-green-bg)] ring-1 ring-inset ring-[var(--sim-green-ring)]'
        : 'border-[var(--sim-green-border-soft)] bg-[var(--sim-green-bg-soft)]'
      : active
        ? 'border-[var(--sim-border-strong)] bg-[var(--sim-panel-elevated)] ring-1 ring-inset ring-[var(--sim-border-strong)]'
        : 'border-transparent bg-[var(--sim-panel)]';

  const labelClass = tone === 'trip'
    ? 'text-[var(--sim-red-text)]'
    : tone === 'restrain'
      ? 'text-[var(--sim-green-text)]'
      : 'text-[var(--sim-text-muted)]';

  return (
    <div className={`min-w-0 rounded border px-1.5 py-1 transition-[background-color,border-color,box-shadow] duration-300 ${toneClass}`}>
      <div className={`truncate text-[8.8px] font-semibold uppercase tracking-[0.06em] ${labelClass}`}>{label}</div>
      <div className='truncate font-eng text-[11.5px] leading-4 text-[var(--sim-text)]'>{value}</div>
    </div>
  );
}

export function MeasurementChainView({ i1s, i2s, iDiff, iBias, iOpLimit, affectedKeys, status }: Props) {
  const active = (key: string) => affectedKeys.includes(key);
  const amp = (value: number) => `${formatEngineeringNumber(value)} A sec`;
  const trip = status === 'OPERATE';
  const invalid = status === 'INVALID';
  const restrain = status === 'RESTRAIN';
  const arrowTone = invalid ? 'text-[var(--sim-amber-text)]' : trip ? 'text-[var(--sim-red-text)]' : 'text-[var(--sim-green-text)]';
  const groupTone = invalid ? 'border-[var(--sim-amber-border)] bg-[var(--sim-amber-bg)]' : trip ? 'border-[var(--sim-red-border)] bg-[var(--sim-red-bg)]' : 'border-[var(--sim-green-border-soft)] bg-[var(--sim-green-bg-soft)]';

  return (
    <div className='grid grid-cols-[1.1fr_auto_1.45fr_auto_0.8fr] items-stretch gap-1.5'>
      <div className={`grid grid-cols-2 gap-1 rounded border p-1 ${groupTone}`}>
        <Value label='I1 sec' value={amp(i1s)} active={active('i1')} tone={restrain ? 'restrain' : 'neutral'} />
        <Value label='I2 sec' value={amp(i2s)} active={active('i2')} tone={restrain ? 'restrain' : 'neutral'} />
      </div>

      <div className={`flex items-center justify-center font-eng text-[12px] ${arrowTone}`} aria-hidden='true'>→</div>

      <div className={`grid grid-cols-2 gap-1 rounded border p-1 ${groupTone}`}>
        <Value label='Idiff · |I1+I2|' value={amp(iDiff)} active={active('idiff')} tone={invalid ? 'neutral' : trip ? 'trip' : 'restrain'} />
        <Value label='Ibias · mean |I|' value={amp(iBias)} active={active('ibias')} tone={restrain ? 'restrain' : 'neutral'} />
      </div>

      <div className={`flex items-center justify-center font-eng text-[12px] ${arrowTone}`} aria-hidden='true'>→</div>

      <div className={`rounded border p-1 ${groupTone}`}>
        <Value label='Iop threshold' value={amp(iOpLimit)} active={active('iop')} tone={invalid ? 'neutral' : trip ? 'trip' : 'restrain'} />
      </div>
    </div>
  );
}
