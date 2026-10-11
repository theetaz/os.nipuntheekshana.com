import type { ClientArchiveItem } from '../../../types/content';

export function ArchiveView({ archive }: { archive: ClientArchiveItem[] }) {
  return <section className="projects-archive" id="projects-archive">
    <h2>Before open source</h2><p>A few things I built before I started working in the open.</p>
    <table><caption className="sr-only">Archived projects</caption><thead><tr><th scope="col">Project</th><th scope="col">Year</th><th scope="col">Stack</th></tr></thead>
      <tbody>{archive.map(item => <tr key={item.title}><td><strong>{item.title}</strong><p>{item.note}</p></td><td>{item.year}</td><td>{item.stack}</td></tr>)}</tbody>
    </table>
  </section>;
}
