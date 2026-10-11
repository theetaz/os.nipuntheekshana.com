import { Bike, Camera, CircleDot, Cpu, Music, Waves } from 'lucide-react';
import type { ClientProfile } from '../../../types/content';

const icons = { music: Music, camera: Camera, bike: Bike, wave: Waves, pins: CircleDot, chip: Cpu };

export function Life({ hobbies }: { hobbies: ClientProfile['hobbies'] }) {
  return <>
    <h2 className="about-heading">Life</h2>
    <div className="about-cards about-life">
      {hobbies.map(hobby => {
        const Icon = icons[hobby.icon as keyof typeof icons];
        return <article key={hobby.name} className="about-card">
          {Icon && <Icon size={24} strokeWidth={1.5} aria-hidden="true" />}
          <h3>{hobby.name}</h3><p>{hobby.note}</p>
        </article>;
      })}
    </div>
  </>;
}
