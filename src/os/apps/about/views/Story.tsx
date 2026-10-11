import type { ClientProfile } from '../../../types/content';

export function Story({ chapters }: { chapters: ClientProfile['chapters'] }) {
  return <>
    <h2 className="about-heading">Story</h2>
    <ol className="about-timeline">
      {chapters.map(chapter => <li key={chapter.year}>
        <div className="about-year">{chapter.year}</div>
        <h3>{chapter.title}</h3>
        <p>{chapter.body}</p>
      </li>)}
    </ol>
  </>;
}
