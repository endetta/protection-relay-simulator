import { memo, type FC } from 'react';
import type { DistanceStudyDefinition } from '../../types/distance';
import './distanceGuidedChallengeCard.css';

export interface DistanceGuidedChallengeCardProps {
  readonly study: DistanceStudyDefinition;
  readonly className?: string;
}

const DISTANCE_CHALLENGES: readonly { id: string; label: string; description: string }[] = [
  {
    id: 'DIST-01',
    label: 'Underreach Prevention',
    description:
      'Zone 1 reach shrinks at low fault currents. Select DIST-01 and confirm Z1 picks up the internal fault before the current drops.',
  },
  {
    id: 'DIST-02',
    label: 'Overreach Prevention',
    description:
      'High fault currents can push the apparent impedance past the mho boundary (overreach). Switch to DIST-02 and observe the double-ended forward-reverse behavior.',
  },
  {
    id: 'ZONE2-TIMING',
    label: 'Zone 2 Timing',
    description:
      'Z2 is a time-delayed backup. Lower Z1 reach until it no longer sees the fault, then step the fault into Z2 and time the delayed trip.',
  },
  {
    id: 'DIST-04',
    label: 'Load Encroachment',
    description:
      'Heavy load plus arc resistance pulls the impedance into the load region. Load DIST-04 confirms every zone is suppressed — RESTRAIN.',
  },
];

export const DistanceGuidedChallengeCard: FC<DistanceGuidedChallengeCardProps> = memo(
  function DistanceGuidedChallengeCard({ study, className = '' }: DistanceGuidedChallengeCardProps) {
    return (
      <section
        className={`distance-guided-challenge simulator-theme ${className}`.trim()}
        aria-label='Guided distance challenge'
      >
        <header className='distance-guided-challenge-header'>
          <span className='distance-guided-challenge-kicker'>Guided Study</span>
          <h2 className='distance-guided-challenge-title'>Challenges</h2>
        </header>

        <ul className='distance-guided-challenge-list'>
          {DISTANCE_CHALLENGES.map((challenge) => (
            <li
              key={challenge.id}
              className='distance-guided-challenge-item'
              data-active={study.presetId === challenge.id ? 'true' : 'false'}
            >
              <span className='distance-guided-challenge-item-label'>{challenge.label}</span>
              <p className='distance-guided-challenge-item-desc'>{challenge.description}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  },
);
