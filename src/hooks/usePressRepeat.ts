import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

type RepeatAction = () => boolean | void;

/**
 * Pointer press/repeat behavior for compact engineering steppers.
 * A pointer press applies one step immediately, then repeats with a faster cadence
 * the longer the control is held. Keyboard-generated clicks still apply one step.
 */
export function usePressRepeat(action: RepeatAction, disabled = false) {
  const actionRef = useRef(action);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startedAtRef.current = 0;
  }, []);

  const scheduleNext = useCallback((delay: number) => {
    timerRef.current = window.setTimeout(function tick() {
      const changed = actionRef.current();
      if (changed === false) {
        stop();
        return;
      }

      const elapsed = performance.now() - startedAtRef.current;
      const nextDelay = elapsed < 1_400 ? 130 : elapsed < 2_700 ? 75 : 45;
      timerRef.current = window.setTimeout(tick, nextDelay);
    }, delay);
  }, [stop]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can be unavailable in synthetic/browser-test environments.
    }

    stop();
    const changed = actionRef.current();
    if (changed === false) return;
    startedAtRef.current = performance.now();
    scheduleNext(380);
  }, [disabled, scheduleNext, stop]);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    stop();
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // No-op when the pointer was already released/cancelled.
    }
  }, [stop]);

  const onClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    // Pointer activation is handled on pointerdown to avoid a duplicate step on click.
    // detail === 0 represents keyboard/programmatic button activation.
    if (!disabled && event.detail === 0) actionRef.current();
  }, [disabled]);

  useEffect(() => {
    const stopOnBlur = () => stop();
    const stopOnVisibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stopOnBlur);
    document.addEventListener('visibilitychange', stopOnVisibility);
    return () => {
      window.removeEventListener('blur', stopOnBlur);
      document.removeEventListener('visibilitychange', stopOnVisibility);
      stop();
    };
  }, [stop]);

  return {
    onPointerDown,
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    onLostPointerCapture: stop,
    onClick,
  };
}
