import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import './engineeringViewOverlay.css';

interface EngineeringViewOverlayProps {
  readonly open: boolean;
  readonly title: string;
  readonly kicker?: string;
  readonly onClose: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
  readonly className?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function EngineeringViewOverlay({
  open,
  title,
  kicker = 'Expanded engineering view',
  onClose,
  returnFocusRef,
  children,
  className = '',
}: EngineeringViewOverlayProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    previousFocusRef.current = returnFocusRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusDialog = () => closeButtonRef.current?.focus();
    const frame = typeof window !== 'undefined' ? window.requestAnimationFrame(focusDialog) : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      if (frame !== null && typeof window !== 'undefined') window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const returnTarget = returnFocusRef?.current ?? previousFocusRef.current;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [onClose, open, returnFocusRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='engineering-view-overlay-backdrop'
      role='presentation'
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`engineering-view-overlay ${className}`.trim()}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className='engineering-view-overlay-header'>
          <div>
            <span>{kicker}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type='button'
            className='engineering-view-overlay-close'
            onClick={onClose}
            aria-label={`Close expanded ${title}`}
          >
            Close
          </button>
        </header>
        <div className='engineering-view-overlay-body'>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
