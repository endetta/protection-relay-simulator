import { useEffect, useState, type ReactNode } from 'react';
import { OverlayScrollArea } from '../components/shared/OverlayScrollArea';

interface SimulatorLayoutProps {
  parameters?: ReactNode;
  simulation?: ReactNode;
  analysis?: ReactNode;
  parametersAction?: ReactNode;
  simulationAction?: ReactNode;
  analysisAction?: ReactNode;
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
}: SimulatorLayoutProps) {
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

  return (
    <div className='simulator-layout h-full min-h-0 gap-2.5 p-2.5'>
      <a href='#sim-parameters' className='overcurrent-visually-hidden focus:not-focus-visible:hidden'>Skip to parameters</a>
      <nav className='simulator-anchor-nav' aria-label='Simulator sections'>
        <a href='#sim-parameters' aria-current={activeSection === 'sim-parameters' ? 'true' : undefined}>Parameters</a>
        <a href='#sim-live' aria-current={activeSection === 'sim-live' ? 'true' : undefined}>Simulation</a>
        <a href='#sim-analysis' aria-current={activeSection === 'sim-analysis' ? 'true' : undefined}>Analysis</a>
      </nav>

      <section id='sim-parameters' className='simulator-column simulator-column-parameters flex min-h-0 min-w-0 flex-col scroll-mt-12'>
        <ColumnTitle action={parametersAction}>Parameters</ColumnTitle>
        <OverlayScrollArea ariaLabel='Parameters scroll area' className='simulator-column-body min-h-0 flex-1'>
          {parameters}
        </OverlayScrollArea>
      </section>

      <section id='sim-live' className='simulator-column simulator-column-live flex min-h-0 min-w-0 flex-col scroll-mt-12'>
        <ColumnTitle action={simulationAction}>Live Simulation</ColumnTitle>
        <OverlayScrollArea ariaLabel='Live simulation scroll area' className='simulator-live-body min-h-0 flex-1'>
          {simulation}
        </OverlayScrollArea>
      </section>

      <section id='sim-analysis' className='simulator-column simulator-column-analysis flex min-h-0 min-w-0 flex-col scroll-mt-12'>
        <ColumnTitle action={analysisAction}>Analysis</ColumnTitle>
        <OverlayScrollArea ariaLabel='Analysis scroll area' className='simulator-column-body min-h-0 flex-1'>
          {analysis}
        </OverlayScrollArea>
      </section>
    </div>
  );
}
