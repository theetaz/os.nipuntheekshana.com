import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
export interface StatusBarProps extends HTMLAttributes<HTMLDivElement> { hint?: ReactNode }
export const StatusBar = forwardRef<HTMLDivElement, StatusBarProps>(function StatusBar({ children, hint, className = '', ...props }, ref) {
  return <div {...props} ref={ref} className={`flex min-h-7 flex-wrap items-center justify-between gap-2 border-t border-line bg-titlebar px-3 text-caption text-ink-2 ${className}`}>
    <span role="status" aria-live="polite">{children}</span>{hint && <span>{hint}</span>}
  </div>;
});
