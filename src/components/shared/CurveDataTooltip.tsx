import { forwardRef, type CSSProperties } from 'react';

export type CurveTooltipTone = 'info' | 'restrain' | 'operate' | 'warning';

export interface CurveTooltipRow {
  label: string;
  value: string;
  tone?: CurveTooltipTone;
}

interface Props {
  title: string;
  context: string;
  tone?: CurveTooltipTone;
  primaryLabel?: string;
  primaryValue?: string;
  rows: CurveTooltipRow[];
  style: CSSProperties;
}

export const CurveDataTooltip = forwardRef<HTMLDivElement, Props>(function CurveDataTooltip(
  { title, context, tone = 'info', primaryLabel, primaryValue, rows, style },
  ref,
) {
  return (
    <div ref={ref} role='tooltip' className='curve-data-tooltip' data-tone={tone} style={style}>
      <div className='curve-data-tooltip-header'>
        <span className='curve-data-tooltip-rail' aria-hidden='true' />
        <span className='curve-data-tooltip-title'>{title}</span>
        <span className='curve-data-tooltip-context'>{context}</span>
      </div>
      <div className='curve-data-tooltip-body'>
        {primaryLabel && primaryValue && (
          <div className='curve-data-tooltip-primary'>
            <span>{primaryLabel}</span>
            <b>{primaryValue}</b>
          </div>
        )}
        <div className='curve-data-tooltip-rows'>
          {rows.map((row) => (
            <div className='curve-data-tooltip-row' key={`${row.label}-${row.value}`} data-tone={row.tone ?? 'info'}>
              <span>{row.label}</span>
              <b>{row.value}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
