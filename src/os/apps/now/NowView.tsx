import type { ClientProfile } from '../../types/content';
import './p3-5-now.css';

export function NowView({ now }: { now: ClientProfile['now'] }) {
  const updated = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${now.updated}T00:00:00Z`));
  return <article className="now-document">
    <h1>Now</h1>
    <ol role="list" aria-label="Current focus">{now.items.map((item, index) => <li key={item}>
      <span className="now-number" aria-hidden="true">{index + 1}.</span><span>{item}</span>
    </li>)}</ol>
    <footer>
      <p>Updated <time dateTime={now.updated}>{updated}</time> · Colombo</p>
      <a href="https://nownownow.com" target="_blank" rel="noreferrer">Inspired by nownownow.com ↗</a>
    </footer>
  </article>;
}
