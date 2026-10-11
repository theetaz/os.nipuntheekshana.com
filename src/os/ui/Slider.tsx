import { forwardRef, useId, type InputHTMLAttributes } from 'react';
export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string; onChange?: (value: number) => void;
}
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { label, id: suppliedId, className = '', onChange, ...props }, ref,
) {
  const id = useId();
  return <label htmlFor={suppliedId ?? id} className={`inline-flex items-center gap-3 text-ui ${className}`}>
    <span>{label}</span><input {...props} id={suppliedId ?? id} ref={ref} type="range"
      className="min-h-7 min-w-0 accent-accent" onChange={event => onChange?.(event.currentTarget.valueAsNumber)} />
  </label>;
});
