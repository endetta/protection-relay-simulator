import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipPosition {
  left: number;
  top: number;
}

const VIEWPORT_GAP = 8;
const TOOLTIP_GAP = 7;
const TOOLTIP_WIDTH = 264;

export function InfoDot({ help }: { help: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ left: VIEWPORT_GAP, top: VIEWPORT_GAP });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !tooltipRef.current) return;

    const update = () => {
      if (!buttonRef.current || !tooltipRef.current) return;
      const anchor = buttonRef.current.getBoundingClientRect();
      const tip = tooltipRef.current.getBoundingClientRect();
      const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);

      let left = anchor.right + TOOLTIP_GAP;
      if (left + width > window.innerWidth - VIEWPORT_GAP) left = anchor.left - width - TOOLTIP_GAP;
      left = Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - width - VIEWPORT_GAP));

      let top = anchor.top + anchor.height / 2 - tip.height / 2;
      top = Math.max(VIEWPORT_GAP, Math.min(top, window.innerHeight - tip.height - VIEWPORT_GAP));
      setPosition({ left, top });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (buttonRef.current?.contains(event.target as Node) || tooltipRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const tooltip = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        id={tooltipId}
        ref={tooltipRef}
        role='tooltip'
        style={{ left: position.left, top: position.top, width: Math.min(TOOLTIP_WIDTH, Math.max(180, window.innerWidth - VIEWPORT_GAP * 2)) }}
        className='fixed z-[100] rounded border border-[var(--sim-tooltip-border)] bg-[var(--sim-tooltip-bg)] px-2.5 py-2 text-[10.5px] normal-case leading-relaxed tracking-normal text-[var(--sim-text)] shadow-2xl'
      >
        {help}
      </div>,
      document.body,
    )
    : null;

  return (
    <span
      className='info-dot-hitbox inline-flex shrink-0 items-center justify-center'
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type='button'
        aria-label='Show parameter help'
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className='info-dot-button inline-flex h-[14px] w-[14px] cursor-help items-center justify-center rounded-full border border-[var(--sim-border-strong)] bg-transparent text-[8px] font-semibold leading-none text-[var(--sim-text-muted)] opacity-90 transition hover:border-[var(--sim-accent)] hover:text-[var(--sim-text)] hover:opacity-100 focus:border-[var(--sim-accent)] focus:text-[var(--sim-text)] focus:opacity-100 focus:outline-none'
      >
        ?
      </button>
      {tooltip}
    </span>
  );
}
