import { forwardRef, type ButtonHTMLAttributes } from 'react';
export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> { selected?: boolean }
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, className = '', ...props }, ref,
) { return <button {...props} ref={ref} type="button" aria-pressed={selected}
  className={`inline-flex min-h-7 items-center gap-1 rounded-pill border px-2.5 text-caption disabled:opacity-50 ${selected ? 'border-accent bg-accent-soft text-ink' : 'border-line-strong text-ink-2 hover:bg-hover'} ${className}`} />; });
