import { forwardRef, type HTMLAttributes } from 'react';
export const Kbd = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Kbd(
  { className = '', ...props }, ref,
) { return <kbd {...props} ref={ref} className={`rounded border border-line-strong bg-sunken px-1 text-caption-2 text-mono ${className}`} />; });
