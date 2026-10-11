import type { ComponentType } from 'react';
import type { SkeletonKind } from '../types/apps';
function LoadingSkeleton() { return <div role="status">Loading…</div>; }
export const skeletons: Record<SkeletonKind, ComponentType> = {
  'sidebar-grid': LoadingSkeleton, 'three-pane': LoadingSkeleton, document: LoadingSkeleton,
  terminal: LoadingSkeleton, canvas: LoadingSkeleton, form: LoadingSkeleton, note: LoadingSkeleton,
};
