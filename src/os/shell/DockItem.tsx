import type { AppMeta } from '../types/apps';
export function DockItem({ app }: { app: AppMeta }) {
  return <a href={app.basePath} aria-label={app.name}><svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true"><use href={`#${app.icon}`} /></svg></a>;
}
