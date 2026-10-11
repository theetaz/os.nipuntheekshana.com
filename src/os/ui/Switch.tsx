import { forwardRef, type ButtonHTMLAttributes } from 'react';
export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean; label: string; onChange?: (checked: boolean) => void;
}
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, label, onChange, className = '', children, onClick, ...props }, ref,
) {
  return <button {...props} ref={ref} type="button" role="switch" aria-checked={checked} aria-label={label}
    className={`inline-flex min-h-7 items-center gap-2 rounded-control text-ui disabled:opacity-50 ${className}`}
    onClick={event => { onClick?.(event); if (!event.defaultPrevented) onChange?.(!checked); }}>
    <span aria-hidden="true" className={`flex h-5 w-9 shrink-0 items-center rounded-pill border border-line-strong px-0.5 ${checked ? 'bg-accent justify-end' : 'bg-sunken justify-start'}`}>
      <span className="size-4 rounded-pill bg-window shadow-card" />
    </span>{children}
  </button>;
});
