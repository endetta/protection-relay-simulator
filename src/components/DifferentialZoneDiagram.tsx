import type { DifferentialDisplayStatus } from '../types/simulator';
import type { FaultKind } from '../utils/presets';
import { formatEngineeringNumber } from '../utils/engineering';

interface Props {
  i1p: number;
  i2p: number;
  faultKind: FaultKind;
  affectedKeys: readonly string[];
  status: DifferentialDisplayStatus;
}

type ArrowDirection = 'left' | 'right' | 'none';

function currentDirection(side: 1 | 2, current: number): ArrowDirection {
  if (current === 0) return 'none';
  if (side === 1) return current > 0 ? 'right' : 'left';
  return current > 0 ? 'left' : 'right';
}

function CurrentArrow({ direction, status }: { direction: ArrowDirection; status: DifferentialDisplayStatus }) {
  const stroke = status === 'OPERATE' ? 'var(--sim-red)' : status === 'INVALID' ? 'var(--sim-amber)' : 'var(--sim-green)';

  if (direction === 'none') {
    return (
      <svg viewBox='0 0 58 16' className='h-4 w-14 shrink-0' aria-label='No current direction'>
        <line x1='8' y1='8' x2='50' y2='8' stroke='var(--sim-text-muted)' strokeWidth='1.8' strokeDasharray='4 4' />
      </svg>
    );
  }

  const right = direction === 'right';
  return (
    <svg viewBox='0 0 58 16' className='h-4 w-14 shrink-0' role='img' aria-label={`Current direction ${direction}`}>
      <line
        x1={right ? 5 : 53}
        y1='8'
        x2={right ? 48 : 10}
        y2='8'
        stroke={stroke}
        strokeWidth='2.2'
        strokeLinecap='round'
      />
      <polyline
        points={right ? '41,3 49,8 41,13' : '17,3 9,8 17,13'}
        fill='none'
        stroke={stroke}
        strokeWidth='2.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export function DifferentialZoneDiagram({ i1p, i2p, faultKind, affectedKeys, status }: Props) {
  const i1Active = affectedKeys.includes('i1');
  const i2Active = affectedKeys.includes('i2');
  const internalFault = faultKind === 'internal';
  const externalFault = faultKind === 'external';
  const trip = status === 'OPERATE';
  const invalid = status === 'INVALID';

  const sideTone = (active: boolean) => invalid
    ? 'border-[var(--sim-amber-border)] bg-[var(--sim-amber-bg)]'
    : trip
      ? 'border-[var(--sim-red-border)] bg-[var(--sim-red-bg)]'
      : active
        ? 'border-[var(--sim-green-border)] bg-[var(--sim-green-bg)]'
        : 'border-[var(--sim-green-border-soft)] bg-[var(--sim-green-bg-soft)]';

  return (
    <div className='grid grid-cols-[1fr_auto_1.3fr_auto_1fr] items-center gap-1.5'>
      <div className={`min-w-0 rounded border px-1.5 py-1.5 transition-[background-color,border-color,box-shadow,color] duration-300 ${sideTone(i1Active)}`}>
        <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1'>
          <div className='min-w-0'>
            <div className='truncate text-[8.8px] font-semibold uppercase tracking-[0.06em] text-[var(--sim-text-muted)]'>Side 1 · I1</div>
            <div className='font-eng text-[11.5px] leading-4 text-[var(--sim-text)]'>{formatEngineeringNumber(i1p)} A</div>
          </div>
          <CurrentArrow direction={currentDirection(1, i1p)} status={status} />
        </div>
      </div>

      <div className='flex items-center gap-1' aria-label='Current transformer CT1'>
        <span className='h-5 w-5 rounded-full border-2 border-[var(--sim-text-dim)]' />
        <span className='text-[8.5px] font-semibold text-[var(--sim-text-muted)]'>CT1</span>
      </div>

      <div className={`relative flex min-h-[42px] items-center justify-center rounded border px-2 py-1 transition-[background-color,border-color,box-shadow,color] duration-300 ${invalid ? 'border-[var(--sim-amber-border)] bg-[var(--sim-amber-bg)]' : internalFault || trip ? 'border-[var(--sim-red-border)] bg-[var(--sim-red-bg)]' : 'border-[var(--sim-green-border-soft)] bg-[var(--sim-green-bg-soft)]'}`}>
        <div className='text-center'>
          <div className={`text-[9px] font-semibold uppercase tracking-[0.09em] ${invalid ? 'text-[var(--sim-amber-text)]' : trip ? 'text-[var(--sim-red-text)]' : 'text-[var(--sim-green-text)]'}`}>Protected Zone</div>
          <div className='font-eng text-[9.2px] text-[var(--sim-text-dim)]'>+ current defined into zone</div>
          {invalid
            ? <div className='mt-0.5 text-[8.8px] font-semibold uppercase tracking-[0.08em] text-[var(--sim-amber-text)]'>Last valid data · output held</div>
            : trip && <div className='mt-0.5 text-[8.8px] font-semibold uppercase tracking-[0.08em] text-[var(--sim-red-text)]'>Trip condition active</div>}
        </div>
        {internalFault && <span className='absolute right-1.5 top-1 font-eng text-[9px] font-semibold text-[var(--sim-red)]'>⚡ INT</span>}
        {externalFault && <span className='absolute -right-0.5 bottom-0.5 font-eng text-[8.5px] font-semibold text-[var(--sim-red)]'>EXT ⚡</span>}
      </div>

      <div className='flex items-center gap-1' aria-label='Current transformer CT2'>
        <span className='text-[8.5px] font-semibold text-[var(--sim-text-muted)]'>CT2</span>
        <span className='h-5 w-5 rounded-full border-2 border-[var(--sim-text-dim)]' />
      </div>

      <div className={`min-w-0 rounded border px-1.5 py-1.5 transition-[background-color,border-color,box-shadow,color] duration-300 ${sideTone(i2Active)}`}>
        <div className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1'>
          <CurrentArrow direction={currentDirection(2, i2p)} status={status} />
          <div className='min-w-0 text-right'>
            <div className='truncate text-[8.8px] font-semibold uppercase tracking-[0.06em] text-[var(--sim-text-muted)]'>Side 2 · I2</div>
            <div className='font-eng text-[11.5px] leading-4 text-[var(--sim-text)]'>{formatEngineeringNumber(i2p)} A</div>
          </div>
        </div>
      </div>
    </div>
  );
}
