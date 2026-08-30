import type { ReactNode } from 'react';

type SummaryTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface SummaryGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  compact?: boolean;
  ariaLabel?: string;
}

interface SummaryMetricProps {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: SummaryTone;
  sublabel?: ReactNode;
}

interface SummaryEntityProps {
  title: string;
  primary: ReactNode;
  secondaryLabel?: string;
  secondaryValue?: ReactNode;
  tone?: SummaryTone;
}

export function SectionSummary({ children, columns = 2, compact = false, ariaLabel }: SummaryGridProps) {
  return (
    <div
      className={`section-summary-grid section-summary-cols-${columns}${compact ? ' is-compact' : ''}`}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function SummaryMetric({ label, value, unit, tone = 'neutral', sublabel }: SummaryMetricProps) {
  return (
    <div className='section-summary-metric' data-tone={tone}>
      <div className='section-summary-label'>{label}</div>
      <div className='section-summary-value-row'>
        <span className='section-summary-value'>{value}</span>
        {unit && <span className='section-summary-unit'>{unit}</span>}
      </div>
      {sublabel && <div className='section-summary-sublabel'>{sublabel}</div>}
    </div>
  );
}

export function SummaryEntity({ title, primary, secondaryLabel, secondaryValue, tone = 'neutral' }: SummaryEntityProps) {
  return (
    <div className='section-summary-entity' data-tone={tone}>
      <div className='section-summary-entity-title'>{title}</div>
      <div className='section-summary-entity-primary'>{primary}</div>
      {secondaryLabel && (
        <div className='section-summary-entity-secondary'>
          <span>{secondaryLabel}</span>
          <b>{secondaryValue}</b>
        </div>
      )}
    </div>
  );
}

export function SummaryText({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className='section-summary-text'>
      {label && <div className='section-summary-label'>{label}</div>}
      <div className='section-summary-text-value'>{children}</div>
    </div>
  );
}
