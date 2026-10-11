import type { BrandCard } from '../../../types/content';

export function BrandCards({ cards }: { cards: BrandCard[] }) {
  return <div className="project-brand-cards">{cards.map((card, index) => <section key={index} className="project-brand-card" aria-label={card.label}>
    <h3>{card.label}</h3>
    {card.kind === 'stat' ? <><p className="project-stat-value">{card.value}</p>{card.note && <p>{card.note}</p>}
      {card.progress !== undefined && <div className="project-progress" role="progressbar" aria-label={card.label}
        aria-valuenow={Math.round(card.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.max(0, Math.min(1, card.progress)) * 100}%` }} />
      </div>}</> : card.kind === 'steps' ? <><ol>{card.steps.map((step, stepIndex) => <li key={stepIndex}>
        <span aria-hidden="true">{stepIndex + 1}</span>{step}</li>)}</ol>{card.footnote && <p>{card.footnote}</p>}</>
        : <><pre><code>{card.lines.join('\n')}</code></pre>{card.footnote && <p>{card.footnote}</p>}</>}
  </section>)}</div>;
}
