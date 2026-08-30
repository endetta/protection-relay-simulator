export type EventType = 'SCENARIO' | 'PARAMETER' | 'FAULT' | 'RELAY' | 'SYSTEM';

export interface EventItem {
  id: number;
  timestamp: number;
  type: EventType;
  text: string;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function EventLog({ events }: { events: EventItem[] }) {
  return (
    <div className='space-y-1'>
      {events.length === 0 && <div className='text-[10px] text-[var(--sim-text-muted)]'>No events yet.</div>}
      {events.map((event) => (
        <div key={event.id} className='grid grid-cols-[54px_58px_1fr] gap-1 font-eng text-[10px] text-[var(--sim-text-muted)]'>
          <span>{formatTime(event.timestamp)}</span>
          <span className='text-[var(--sim-text-dim)]'>{event.type}</span>
          <span className='text-[var(--sim-text-secondary)]'>{event.text}</span>
        </div>
      ))}
    </div>
  );
}
