import { forwardRef, useId, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { nextFocusIndex } from '../lib/focus';
export interface SegmentOption { value: string; label: ReactNode; disabled?: boolean }
export interface SegmentedProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string; options: readonly SegmentOption[]; value: string;
  onChange?: (value: string) => void;
}
export const Segmented = forwardRef<HTMLDivElement, SegmentedProps>(function Segmented(
  { label, options, value, onChange, className = '', ...props }, ref,
) {
  const id = useId(); const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);
  const selected = options.findIndex(o => o.value === value && !o.disabled);
  return <div {...props} ref={ref} role="radiogroup" aria-label={label}
    className={`inline-flex max-w-full gap-0.5 rounded-control bg-sunken p-0.5 ${className}`}>
    {options.map((option, index) => <button key={option.value} id={`${id}-${index}`} type="button" role="radio"
      aria-checked={option.value === value} disabled={option.disabled}
      tabIndex={index === (selected < 0 ? enabled[0] : selected) ? 0 : -1}
      ref={node => { buttons.current[index] = node; }}
      onClick={() => onChange?.(option.value)} onKeyDown={event => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const position = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
          : nextFocusIndex(enabled.indexOf(index), ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1, enabled.length);
        const next = enabled[position]; if (next === undefined) return;
        buttons.current[next]?.focus(); onChange?.(options[next]!.value);
      }} className={`min-h-7 min-w-7 rounded-menu-item px-2 text-ui disabled:opacity-50 ${option.value === value ? 'bg-raised text-ink shadow-card' : 'text-ink-2 hover:bg-hover'}`}>{option.label}</button>)}
  </div>;
});
