import { forwardRef, type HTMLAttributes } from 'react';
export interface PillProps extends HTMLAttributes<HTMLSpanElement> { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
export const Pill = forwardRef<HTMLSpanElement, PillProps>(function Pill(
  { tone = 'neutral', className = '', style, ...props }, ref,
) {
  const color = tone === 'neutral' ? 'var(--os-ink-2)' : `var(--os-${tone})`;
  return <span {...props} ref={ref} className={`inline-flex min-h-6 items-center gap-1 rounded-pill px-2 text-caption ${className}`}
    style={{ color, background: `color-mix(in oklch, ${color} 8%, transparent)`, ...style }} />;
});
