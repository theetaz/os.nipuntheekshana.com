import { forwardRef } from 'react';
import { CloudOff } from 'lucide-react';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { Button } from './Button';
export interface ErrorStateProps extends Omit<EmptyStateProps, 'title'> { title?: string; onRetry?: () => void; simpleHref?: string }
export const ErrorState = forwardRef<HTMLElement, ErrorStateProps>(function ErrorState(
  { title = "This app didn't load.", body = 'Check your connection and try again.', onRetry, simpleHref, action, ...props }, ref,
) {
  return <EmptyState {...props} ref={ref} title={title} body={body} icon={<CloudOff />} action={action ?? <div className="flex flex-wrap items-center gap-3">
    {onRetry && <Button variant="primary" onClick={onRetry}>Try again</Button>}
    {simpleHref && <a className="text-accent-ink underline" href={simpleHref}>Open simple view</a>}
  </div>} />;
});
