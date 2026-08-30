import { useId, useState, type ReactNode } from 'react';

type BadgeTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';
type SectionVariant = 'parameter' | 'support';

interface Props {
  title: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  summary?: ReactNode;
  badge?: ReactNode;
  badgeTone?: BadgeTone;
  variant?: SectionVariant;
  children: ReactNode;
}

export function ParameterGroup({
  title,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  summary,
  badge,
  badgeTone = 'neutral',
  variant = 'parameter',
  children,
}: Props) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? localOpen;
  const contentId = useId();

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setLocalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section className={`parameter-group parameter-group-${variant} mb-1.5 overflow-hidden rounded-md`}>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        title={open ? `Hide ${title}` : `Show ${title}`}
        className='parameter-group-header w-full px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.085em] transition'
      >
        <span className='parameter-group-title-slot'>
          <span className='parameter-group-marker' aria-hidden='true' />
          <span className='parameter-group-title-text'>{title}</span>
        </span>
        <span className='parameter-group-status-slot'>
          {badge && <span className='parameter-group-badge' data-tone={badgeTone}>{badge}</span>}
        </span>
        <span aria-hidden='true' className={`parameter-group-chevron ${open ? 'is-open' : ''}`}>›</span>
      </button>

      {!open && summary && (
        <div className='parameter-group-summary border-t px-2.5 py-2'>{summary}</div>
      )}

      <div
        id={contentId}
        aria-hidden={!open}
        hidden={!open}
        className='parameter-group-body space-y-3 border-t p-2.5'
      >
        {children}
      </div>
    </section>
  );
}
