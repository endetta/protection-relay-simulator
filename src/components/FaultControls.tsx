interface Props {
  faultOn: boolean;
  canApply: boolean;
  onApply: () => void;
  onClear: () => void;
}

export function FaultControls({ faultOn, canApply, onApply, onClear }: Props) {
  return (
    <div className='flex gap-2'>
      <button
        type='button'
        onClick={onApply}
        disabled={faultOn || !canApply}
        className='flex-1 rounded border border-[var(--sim-border-strong)] bg-[var(--sim-control)] px-2 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-[var(--sim-text-secondary)] transition hover:border-[var(--sim-accent)] hover:bg-[var(--sim-control-hover)] hover:text-[var(--sim-text)] disabled:cursor-not-allowed disabled:opacity-40'
      >
        Apply Internal Fault
      </button>
      <button
        type='button'
        onClick={onClear}
        disabled={!faultOn}
        className='flex-1 rounded border border-[var(--sim-border-strong)] bg-[var(--sim-control)] px-2 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-[var(--sim-text-secondary)] transition hover:border-[var(--sim-accent)] hover:bg-[var(--sim-control-hover)] hover:text-[var(--sim-text)] disabled:cursor-not-allowed disabled:opacity-40'
      >
        Clear Fault
      </button>
    </div>
  );
}
