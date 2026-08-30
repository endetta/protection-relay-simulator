import { Link } from 'react-router-dom';

type DifferentialSimulatorStatus = 'OPERATE' | 'RESTRAIN' | 'INVALID';
export type SimulatorHeaderTone = 'operate' | 'restrain' | 'invalid' | 'info' | 'neutral';

/** Localizable header chrome (English defaults; other modules unchanged). */
interface SimulatorHeaderIntl {
  scenarioPrefix?: string;
  resetLabel?: string;
  homeAriaLabel?: string;
  homeTitle?: string;
  homeText?: string;
}

interface Props {
  scenario: string;
  /** Existing Differential status remains supported; other modules may supply a module-specific label. */
  status: DifferentialSimulatorStatus | string;
  statusLabel?: string;
  statusTone?: SimulatorHeaderTone;
  moduleLabel?: string;
  onReset: () => void;
  onHelp?: () => void;
  helpAriaLabel?: string;
  /** When true, the header renders a theme toggle (Differential only). */
  enableThemeToggle?: boolean;
  themeMode?: 'dark' | 'light';
  onThemeToggle?: () => void;
  intl?: SimulatorHeaderIntl;
}

function defaultTone(status: string): SimulatorHeaderTone {
  if (status === 'OPERATE') return 'operate';
  if (status === 'INVALID') return 'invalid';
  if (status === 'RESTRAIN') return 'restrain';
  return 'info';
}

export function SimulatorHeader({
  scenario,
  status,
  statusLabel,
  statusTone,
  moduleLabel = 'Differential Relay',
  onReset,
  onHelp,
  helpAriaLabel = 'Open differential relay help',
  enableThemeToggle = false,
  themeMode = 'dark',
  onThemeToggle,
  intl = {},
}: Props) {
  const tone = statusTone ?? defaultTone(status);
  const label = statusLabel ?? (status === 'INVALID' ? 'INPUT INVALID' : status);
  const i18n = {
    scenarioPrefix: 'Scenario: ',
    resetLabel: 'Reset',
    homeAriaLabel: 'Back to Protection System homepage',
    homeTitle: 'Back to homepage',
    homeText: 'Protection System Simulator',
    ...intl,
  };

  return (
    <header className='simulator-header flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2'>
      <div className='flex min-w-0 items-baseline gap-2 text-[12.5px] font-semibold uppercase tracking-[0.07em]'>
        <Link to='/' className='simulator-home-button' aria-label={i18n.homeAriaLabel} title={i18n.homeTitle}>{i18n.homeText}</Link>
        <span className='simulator-header-separator'>/</span>
        <h1 className='simulator-header-module text-inherit font-inherit'>{moduleLabel}</h1>
      </div>
      <div className='flex min-w-0 flex-wrap items-center justify-end gap-3'>
        <span className='simulator-header-scenario text-[10.5px] uppercase tracking-[0.065em]'>
          {i18n.scenarioPrefix}<span title={scenario}>{scenario}</span>
        </span>
        <span className='simulator-status flex items-center gap-1.5 rounded border px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.05em]' data-tone={tone} role='status' aria-live='polite' aria-atomic='true'>
          <span className='simulator-status-dot h-1.5 w-1.5 rounded-full'></span>
          {label}
        </span>
        {enableThemeToggle && onThemeToggle && (
          <button
            type='button'
            onClick={onThemeToggle}
            className='simulator-header-action rounded border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.05em]'
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span aria-hidden='true' className='inline-flex items-center gap-1.5'>
              {themeMode === 'dark' ? (
                <svg viewBox='0 0 16 16' width='12' height='12' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
                  <circle cx='8' cy='8' r='3' />
                  <path d='M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6L3.4 3.4' />
                </svg>
              ) : (
                <svg viewBox='0 0 16 16' width='12' height='12' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z' />
                </svg>
              )}
              {themeMode === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>
        )}
        <button type='button' onClick={onReset} className='simulator-header-action rounded border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.05em]'>
          {i18n.resetLabel}
        </button>
        {onHelp && (
          <button type='button' onClick={onHelp} aria-label={helpAriaLabel} className='simulator-header-action rounded border px-2 py-1 text-[11px]'>
            ?
          </button>
        )}
      </div>
    </header>
  );
}
