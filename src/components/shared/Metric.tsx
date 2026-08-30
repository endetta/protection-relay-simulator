import { formatEngineeringNumber } from '../../utils/engineering';

type MetricTone = 'normal' | 'info' | 'operate' | 'restrain' | 'warning';

interface Props {
  label: string;
  value: number | string;
  unit?: string;
  tone?: MetricTone;
}

export function Metric({ label, value, unit, tone = 'normal' }: Props) {
  const display = typeof value === 'number' ? formatEngineeringNumber(value) : value;
  return (
    <div className='metric-card rounded-md border px-2.5 py-2' data-tone={tone}>
      <div className='metric-label text-[9.5px] font-semibold uppercase tracking-[0.075em]'>{label}</div>
      <div className='metric-value mt-0.5 font-eng text-[13.5px] leading-5'>{display}{unit ? ` ${unit}` : ''}</div>
    </div>
  );
}
