import type { DistanceTimelineRun } from '../../engines/distanceTimeline';

/**
 * Distance Relay Operating Sequence component (D08).
 *
 * Pure-presentation: reads a pre-computed `DistanceTimelineRun` and
 * renders the sequence of events (pickup → trip → breaker clear) as a
 * compact horizontal timeline. Never recomputes relay math.
 *
 * Colors are read from CSS custom properties defined in index.css
 * so the component honours theme tokens (--sim-accent, --sim-green,
 * --sim-amber, --sim-red, --sim-text-muted, --sim-grid, --sim-bg).
 */

export interface DistanceOperatingSequenceProps {
  readonly timeline: DistanceTimelineRun;
}

const TOKEN = {
  green: 'var(--sim-green)',
  red: 'var(--sim-red)',
  amber: 'var(--sim-amber)',
  textMuted: 'var(--sim-text-muted)',
  grid: 'var(--sim-border)',
  surface: 'var(--sim-panel)',
} as const;

function eventColor(kind: string): string {
  if (kind === 'ZONE1_PICKUP' || kind === 'ZONE2_PICKUP' || kind === 'ZONE3_PICKUP') return TOKEN.green;
  if (kind === 'TRIP') return TOKEN.red;
  if (kind === 'BREAKER_CLEAR') return TOKEN.amber;
  return TOKEN.textMuted;
}

function eventLabel(kind: string, zoneId?: string): string {
  if (kind === 'ZONE1_PICKUP') return 'Z1 pickup';
  if (kind === 'ZONE2_PICKUP') return 'Z2 pickup';
  if (kind === 'ZONE3_PICKUP') return 'Z3 pickup';
  if (kind === 'TRIP') return `${zoneId ?? ''} trip`.trim();
  if (kind === 'BREAKER_CLEAR') return 'Breaker open';
  return kind;
}

export function DistanceOperatingSequence({ timeline }: DistanceOperatingSequenceProps) {
  if (timeline.events.length === 0) {
    return (
      <div className='rounded border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] px-3 py-2 text-[11px] text-[color:var(--sim-text-muted)]'>
        No events. The relay remains restrained at the current study.
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between text-[11px] text-[color:var(--sim-text-muted)]'>
        <span>Operating Sequence</span>
        <span>Duration: {timeline.durationSec.toFixed(3)} s</span>
      </div>
      <div className='rounded border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] p-2'>
        <div className='flex flex-col gap-1.5'>
          {timeline.events.map((event, idx) => (
            <div key={idx} className='flex items-center gap-2 text-[11px]'>
              <span
                className='inline-block h-2 w-2 rounded-full'
                style={{ backgroundColor: eventColor(event.kind) }}
              />
              <span className='font-mono text-[color:var(--sim-text-muted)] w-16'>{event.timeSec.toFixed(3)} s</span>
              <span className='text-[color:var(--sim-text)]'>{eventLabel(event.kind, event.zoneId)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
