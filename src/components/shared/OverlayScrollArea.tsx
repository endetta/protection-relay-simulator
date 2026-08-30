import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface OverlayScrollAreaProps {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  viewportClassName?: string;
  orientation?: 'vertical' | 'horizontal';
}

interface IndicatorGeometry {
  visible: boolean;
  position: number;
  length: number;
}

const EDGE_INSET = 4;
const MIN_THUMB_PX = 22;
const THUMB_THICKNESS_PX = 2;

export function OverlayScrollArea({
  children,
  ariaLabel,
  className = '',
  viewportClassName = '',
  orientation = 'vertical',
}: OverlayScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [indicator, setIndicator] = useState<IndicatorGeometry>({ visible: false, position: 0, length: 0 });

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (orientation === 'horizontal') {
      const { clientWidth, scrollWidth, scrollLeft } = viewport;
      const overflow = scrollWidth - clientWidth;
      if (clientWidth <= 0 || overflow <= 1) {
        setIndicator((current) => current.visible ? { visible: false, position: 0, length: 0 } : current);
        return;
      }
      const trackLength = Math.max(0, clientWidth - EDGE_INSET * 2);
      const length = Math.min(trackLength, Math.max(MIN_THUMB_PX, trackLength * (clientWidth / scrollWidth)));
      const travel = Math.max(0, trackLength - length);
      const progress = Math.min(1, Math.max(0, scrollLeft / overflow));
      const position = EDGE_INSET + travel * progress;
      setIndicator((current) => {
        if (current.visible && Math.abs(current.position - position) < 0.25 && Math.abs(current.length - length) < 0.25) return current;
        return { visible: true, position, length };
      });
      return;
    }

    const { clientHeight, scrollHeight, scrollTop } = viewport;
    const overflow = scrollHeight - clientHeight;
    if (clientHeight <= 0 || overflow <= 1) {
      setIndicator((current) => current.visible ? { visible: false, position: 0, length: 0 } : current);
      return;
    }
    const trackLength = Math.max(0, clientHeight - EDGE_INSET * 2);
    const length = Math.min(trackLength, Math.max(MIN_THUMB_PX, trackLength * (clientHeight / scrollHeight)));
    const travel = Math.max(0, trackLength - length);
    const progress = Math.min(1, Math.max(0, scrollTop / overflow));
    const position = EDGE_INSET + travel * progress;
    setIndicator((current) => {
      if (current.visible && Math.abs(current.position - position) < 0.25 && Math.abs(current.length - length) < 0.25) return current;
      return { visible: true, position, length };
    });
  }, [orientation]);

  const requestMeasure = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measure();
    });
  }, [measure]);

  const onScroll = useCallback(() => {
    setActive(true);
    requestMeasure();
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setActive(false), 520);
  }, [requestMeasure]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const observer = new ResizeObserver(requestMeasure);
    observer.observe(viewport);
    observer.observe(content);
    window.addEventListener('resize', requestMeasure);
    requestMeasure();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', requestMeasure);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [requestMeasure]);

  const isHorizontal = orientation === 'horizontal';
  const trackStyle = isHorizontal
    ? { width: `${indicator.length}px`, transform: `translateX(${indicator.position}px)`, height: `${THUMB_THICKNESS_PX}px` }
    : { height: `${indicator.length}px`, transform: `translateY(${indicator.position}px)`, width: `${THUMB_THICKNESS_PX}px` };

  return (
    <div
      className={`overlay-scroll-shell ${isHorizontal ? 'overlay-scroll-shell-horizontal' : ''} ${className}`.trim()}
      data-scrollable={indicator.visible ? 'true' : 'false'}
      data-orientation={orientation}
    >
      <div
        ref={viewportRef}
        className={`overlay-scroll-viewport ${isHorizontal ? 'overlay-scroll-viewport-horizontal' : ''} ${viewportClassName}`.trim()}
        role='region'
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={onScroll}
      >
        <div ref={contentRef} className='overlay-scroll-content'>
          {children}
        </div>
      </div>
      <span
        className='overlay-scroll-track'
        aria-hidden='true'
        data-visible={indicator.visible ? 'true' : 'false'}
        data-orientation={orientation}
      >
        <span
          className='overlay-scroll-thumb'
          data-active={active ? 'true' : 'false'}
          data-orientation={orientation}
          style={trackStyle as React.CSSProperties}
        />
      </span>
    </div>
  );
}
