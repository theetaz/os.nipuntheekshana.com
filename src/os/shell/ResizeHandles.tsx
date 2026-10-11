import type { ResizeEdge } from './useWindowResize';
const edges: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
export function ResizeHandles() {
  return <>{edges.map(edge => <div key={edge} className="window-resize-handle" data-resize-handle={edge} aria-hidden="true" />)}</>;
}
