import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface RelayModule {
  id: string;
  label: string;
  path?: string;
}

const RELAY_MODULES: RelayModule[] = [
  { id: 'overcurrent', label: 'Overcurrent Relay', path: '/simulator/overcurrent' },
  { id: 'differential', label: 'Differential Relay', path: '/simulator/differential' },
  { id: 'distance', label: 'Distance Relay', path: '/simulator/distance' },
  { id: 'underfrequency', label: 'Underfrequency Relay', path: '/simulator/underfrequency' },
];

export function SimulatorHome() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const openModule = (module: RelayModule) => {
    if (!module.path || selectedId) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setSelectedId(module.id);

    timerRef.current = window.setTimeout(
      () => navigate(module.path as string),
      reduceMotion ? 40 : 360,
    );
  };

  return (
    <section
      className={`protection-home ${selectedId ? 'is-leaving' : ''}`}
      aria-label='Protection System relay selection'
    >
      <div className='protection-home-grid' aria-hidden='true' />
      <div className='protection-home-cluster'>
        <h1 className='protection-home-title'>Protection System</h1>

        <nav className='protection-home-menu' aria-label='Protection relay simulators'>
          {RELAY_MODULES.map((module) => {
            const isSelected = selectedId === module.id;
            const isAvailable = Boolean(module.path);

            return (
              <button
                key={module.id}
                type='button'
                className={`protection-home-option ${isSelected ? 'is-selected' : ''}`}
                data-available={isAvailable ? 'true' : 'false'}
                aria-disabled={!isAvailable}
                onClick={() => openModule(module)}
              >
                <span className='protection-home-option-rail' aria-hidden='true' />
                <span className='protection-home-option-label'>{module.label}</span>
                <span className='protection-home-option-line' aria-hidden='true' />
              </button>
            );
          })}
        </nav>
      </div>

      <div className='protection-home-route-wipe' aria-hidden='true' />
    </section>
  );
}
