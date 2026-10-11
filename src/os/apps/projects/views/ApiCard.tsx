import type { BrandApi } from '../../../types/content';

export function ApiCard({ api }: { api: BrandApi }) {
  return <section className="project-api-card" aria-label="API example">
    <h3>API example</h3><p className="project-api-request"><strong>{api.method}</strong><code>{api.host}{api.path}</code></p>
    <p className="project-api-response"><span>{api.status}</span>{api.time && <span>{api.time}</span>}</p>
    <pre><code>{api.body}</code></pre>
  </section>;
}
