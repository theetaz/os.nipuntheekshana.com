import type { ComponentType } from 'react';
import type { SkeletonKind } from '../types/apps';
function Bars() { return <>{[70, 90, 55, 80, 65].map((width, index) => <i key={index} className="window-skeleton-bar" style={{ width: `${width}%` }} />)}</>; }
function Skeleton({ kind }: { kind: SkeletonKind }) {
  return <div className="window-skeleton" data-skeleton={kind} role="status" aria-label="Loading app">
    <span className="sr-only">Loading…</span>
    <div className="window-skeleton-layout" aria-hidden="true">
      {['sidebar-grid', 'three-pane', 'form'].includes(kind) && <aside><Bars /></aside>}
      {kind === 'three-pane' && <div className="window-skeleton-list"><Bars /><Bars /></div>}
      <div className="window-skeleton-main">
        {kind === 'sidebar-grid' ? <div className="window-skeleton-tiles">{[0, 1, 2, 3, 4, 5].map(tile => <i key={tile} />)}</div>
          : kind === 'canvas' ? <i className="window-skeleton-canvas" /> : <Bars />}
      </div>
    </div>
  </div>;
}
export const skeletons: Record<SkeletonKind, ComponentType> = {
  'sidebar-grid': () => <Skeleton kind="sidebar-grid" />, 'three-pane': () => <Skeleton kind="three-pane" />,
  document: () => <Skeleton kind="document" />, terminal: () => <Skeleton kind="terminal" />,
  canvas: () => <Skeleton kind="canvas" />, form: () => <Skeleton kind="form" />, note: () => <Skeleton kind="note" />,
};
