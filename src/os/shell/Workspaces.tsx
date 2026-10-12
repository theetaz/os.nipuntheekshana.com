import { reducedMotion } from '../lib/motion-preferences';

export function Workspaces() {
  return <nav className="mb-module mb-workspaces" aria-label="Workspaces">{['Desktop', 'Hello', 'Work', 'Projects', 'Board'].map((name, index) =>
    <button key={name} type="button" aria-label={`Workspace ${index + 1}: ${name}`} title={name}
      aria-current={index === 0 ? 'true' : undefined} tabIndex={index === 0 ? 0 : -1} data-workspace={`ws-${name.toLowerCase()}`}
      onClick={() => document.getElementById(`ws-${name.toLowerCase()}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })}>
      <span aria-hidden="true">{index + 1}</span>
    </button>)}</nav>;
}
