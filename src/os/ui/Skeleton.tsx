import { forwardRef, type HTMLAttributes } from 'react';
export const Skeleton = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Skeleton({ className = '', children, ...props }, ref) {
  return <div {...props} ref={ref} role="status" aria-label="Loading" className={`relative overflow-hidden ${className}`}>
    <span className="sr-only">Loading…</span><div aria-hidden="true">{children}</div>
    <style>{`@keyframes os-skeleton-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      .os-skeleton-part { background-color: var(--os-sunken); background-image: linear-gradient(90deg, transparent, color-mix(in oklch, var(--os-raised) 35%, transparent), transparent); background-size: 200% 100%; animation: os-skeleton-shimmer 1.4s linear infinite; }
      @media (prefers-reduced-motion: reduce) { html:not([data-motion="full"]) .os-skeleton-part { animation: none; } }
      html[data-motion="reduce"] .os-skeleton-part { animation: none; }`}</style>
  </div>;
});
export const SkeletonText = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function SkeletonText({ className = '', ...props }, ref) {
  return <div {...props} ref={ref} aria-hidden="true" className={`os-skeleton-part my-2 h-3 rounded ${className}`} />;
});
export const SkeletonTile = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function SkeletonTile({ className = '', ...props }, ref) {
  return <div {...props} ref={ref} aria-hidden="true" className={`os-skeleton-part size-16 rounded-icon ${className}`} />;
});
