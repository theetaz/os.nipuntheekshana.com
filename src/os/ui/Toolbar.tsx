import { forwardRef, type HTMLAttributes } from 'react';
export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> { label: string }
// A labelled group preserves native Tab order; callers needing toolbar arrow navigation can implement roving focus.
export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar({ label, className = '', ...props }, ref) {
  return <div {...props} ref={ref} role="group" aria-label={label} className={`flex min-h-10 flex-wrap items-center gap-2 border-b border-line bg-titlebar px-3 py-1 ${className}`} />;
});
