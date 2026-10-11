import type { ClientProfile } from '../../../types/content';

export function Principles({ principles }: { principles: ClientProfile['principles'] }) {
  return <>
    <h2 className="about-heading">Principles</h2>
    <div className="about-cards">
      {principles.map(principle => <article key={principle.title} className="about-card">
        <h3>{principle.title}</h3><p>{principle.body}</p>
      </article>)}
    </div>
  </>;
}
