import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';
export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> { title: string; body?: ReactNode; icon?: ReactNode; action?: ReactNode }
export const EmptyState = forwardRef<HTMLElement, EmptyStateProps>(function EmptyState({ title, body, icon, action, className = '', ...props }, ref) {
  const id = useId();
  return <section {...props} ref={ref} aria-labelledby={id} className={`flex flex-col items-center gap-3 p-6 text-center ${className}`}>
    {icon && <span aria-hidden="true" className="text-ink-3 [&>svg]:size-8">{icon}</span>}
    <h2 id={id} className="text-ui-strong">{title}</h2>{body && <div className="max-w-prose text-ui text-ink-2">{body}</div>}{action}
  </section>;
});
