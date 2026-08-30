import { useEffect, useState, type ReactNode } from 'react';
import { OverlayScrollArea } from '../components/shared/OverlayScrollArea';

interface SimulatorStep {
  /** Section id the step anchors to (must match one of the section ids). */
  id: string;
  /** Short ordinal shown as the number chip, e.g. '1'. */
  num: string;
  /** Visible label, e.g. 'Studi & Parameter'. */
  label: string;
}

/** Localizable layout chrome (English defaults; other modules unchanged). */
export interface SimulatorLayoutIntl {
  skipToParameters?: string;
  stepsAriaLabel?: string;
  sectionsAriaLabel?: string;
  showAllLabel?: string;
  parametersTitle?: string;
  simulationTitle?: string;
  analysisTitle?: string;
  liveTitle?: string;
  parametersAriaLabel?: string;
  simulationAriaLabel?: string;
  analysisAriaLabel?: string;
  parametersNavLabel?: string;
  simulationNavLabel?: string;
  analysisNavLabel?: string;
}

interface SimulatorLayoutProps {
  parameters?: ReactNode;
  simulation?: ReactNode;
  analysis?: ReactNode;
  parametersAction?: ReactNode;
  simulationAction?: ReactNode;
  analysisAction?: ReactNode;
  /**
   * When provided, the anchor nav renders as a numbered step guide. The active
   * step dims the other columns (soft emphasis, never locking) and a trailing
   * "Show all" control clears the focus. Absent -> the plain anchor nav.
   */
  steps?: SimulatorStep[];
  /** Focused step id; null/undefined -> "Show all" (no column dimming). */
  activeStep?: string | null;
  onStepChange?: (id: string | null) => void;
  intl?: SimulatorLayoutIntl;
}

function ColumnTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className='simulator-column-heading'>
      <span className='simulator-column-heading-spacer' aria-hidden='true' />
      <h2 className='simulator-column-title'>
        <span className='simulator-column-accent' aria-hidden='true' />
        <span>{children}</span>
      </h2>
      <div className='simulator-column-action'>{action}</div>
    </div>
  );
}

export function SimulatorLayout({
  parameters,
  simulation,
  analysis,
  parametersAction,
  simulationAction,
  analysisAction,
  steps,
  activeStep,
  onStepChange,
  intl = {},
}: SimulatorLayoutProps) {
  const i18n = {
    skipToParameters: 'Skip to parameters',
    stepsAriaLabel: 'Simulator steps',
    sectionsAriaLabel: 'Simulator sections',
    showAllLabel: 'Show all',
    parametersTitle: 'Parameters',
    simulationTitle: 'Simulation',
    analysisTitle: 'Analysis',
    liveTitle: 'Live Simulation',
    parametersAriaLabel: 'Parameters scroll area',
    simulationAriaLabel: 'Live simulation scroll area',
    analysisAriaLabel: 'Analysis scroll area',
    parametersNavLabel: 'Parameters',
    simulationNavLabel: 'Simulation',
    analysisNavLabel: 'Analysis',
    ...intl,
  };
  const [activeSection, setActiveSection] = useState('sim-parameters');

  useEffect(() => {
    const sections = [
      document.getElementById('sim-parameters'),
      document.getElementById('sim-live'),
      document.getElementById('sim-analysis'),
    ].filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: [0.5], rootMargin: '-20% 0px -20% 0px' }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // When the step guide is active, each column carries its own focus state.
  const stepActiveFor = (id: string): string | undefined =>
    steps && activeStep ? (activeStep === id ? 'true' : 'false') : undefined;

  return (
    <div className='simulator-layout h-full min-h-0 gap-2.5 p-2.5'>
      <a href='#sim-parameters' className='overcurrent-visually-hidden focus:not-focus-visible:hidden'>{i18n.skipToParameters}</a>
      {steps ? (
        <nav className='simulator-anchor-nav' aria-label={i18n.stepsAriaLabel}>
          {steps.map((step) => (
            <a
              key={step.id}
              href={`#${step.id}`}
              aria-current={activeSection === step.id ? 'true' : undefined}
              data-step-active={activeStep === step.id ? 'true' : undefined}
              onClick={() => onStepChange?.(step.id)}
            >
              <span className='simulator-step-num' aria-hidden='true'>{step.num}</span>
              <span className='simulator-step-label'>{step.label}</span>
            </a>
          ))}
          {activeStep != null && (
            <button
              type='button'
              className='simulator-step-show-all'
              onClick={() => onStepChange?.(null)}
            >
              {i18n.showAllLabel}
            </button>
          )}
        </nav>
      ) : (
        <nav className='simulator-anchor-nav' aria-label={i18n.sectionsAriaLabel}>
          <a href='#sim-parameters' aria-current={activeSection === 'sim-parameters' ? 'true' : undefined}>{i18n.parametersNavLabel}</a>
          <a href='#sim-live' aria-current={activeSection === 'sim-live' ? 'true' : undefined}>{i18n.simulationNavLabel}</a>
          <a href='#sim-analysis' aria-current={activeSection === 'sim-analysis' ? 'true' : undefined}>{i18n.analysisNavLabel}</a>
        </nav>
      )}

      <section id='sim-parameters' data-step-active={stepActiveFor('sim-parameters')} className='simulator-column simulator-column-parameters flex min-h-0 min-w-0 flex-col scroll-mt-12'>
        <ColumnTitle action={parametersAction}>{i18n.parametersTitle}</ColumnTitle>
        <OverlayScrollArea ariaLabel={i18n.parametersAriaLabel} className='simulator-column-body min-h-0 flex-1'>
          {parameters}
        </OverlayScrollArea>
      </section>

      <section id='sim-live' data-step-active={stepActiveFor('sim-live')} className='simulator-column simulator-column-live flex min-h-0 min-w-0 flex-col scroll-mt-12'>
        <ColumnTitle action={simulationAction}>{i18n.liveTitle}</ColumnTitle>
        <OverlayScrollArea ariaLabel={i18n.simulationAriaLabel} className='simulator-live-body min-h-0 flex-1'>
          {simulation}
        </OverlayScrollArea>
      </section>

      <section id='sim-analysis' data-step-active={stepActiveFor('sim-analysis')} className='simulator-column simulator-column-analysis flex min-h-0 min-w-0 flex-col scroll-mt-12'>
        <ColumnTitle action={analysisAction}>{i18n.analysisTitle}</ColumnTitle>
        <OverlayScrollArea ariaLabel={i18n.analysisAriaLabel} className='simulator-column-body min-h-0 flex-1'>
          {analysis}
        </OverlayScrollArea>
      </section>
    </div>
  );
}
