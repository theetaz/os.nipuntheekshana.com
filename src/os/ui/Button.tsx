import { forwardRef, type ButtonHTMLAttributes } from 'react';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 28 | 32 | 36;
}
const variants = {
  primary: 'bg-accent text-on-accent rounded-pill',
  secondary: 'bg-raised text-ink border border-line-strong rounded-control',
  ghost: 'bg-transparent text-ink hover:bg-hover rounded-control',
  danger: 'bg-raised text-danger border border-[var(--os-danger)] rounded-control',
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 32, className = '', style, type = 'button', ...props }, ref,
) {
  return <button {...props} type={type} ref={ref} data-accent-filled={variant === 'primary' || undefined}
    className={`inline-flex shrink-0 items-center justify-center gap-2 px-3 text-ui-strong transition-colors duration-120 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    style={{ minHeight: size, ...style }} />;
});
