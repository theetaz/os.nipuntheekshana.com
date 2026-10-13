import { forwardRef, type HTMLAttributes } from 'react';
export interface DeviceFrameProps extends HTMLAttributes<HTMLDivElement> { kind: 'phone' | 'browser' | 'bare'; bar?: string }
export const DeviceFrame = forwardRef<HTMLDivElement, DeviceFrameProps>(function DeviceFrame({ kind, bar, children, className = '', ...props }, ref) {
  return <div {...props} ref={ref} className={`overflow-hidden ${kind === 'phone' ? 'rounded-[18px] border-4 border-ink bg-ink' : kind === 'browser' ? 'rounded-control border border-line-strong bg-titlebar' : ''} ${className}`}>
    {kind === 'browser' && <div className="flex min-h-3.5 items-center gap-1 px-2 text-caption-2 text-ink-2">
      <span aria-hidden="true" className="flex gap-1">{['close', 'min', 'max'].map(tone => <span key={tone} className="size-1.5 rounded-pill" style={{ background: `var(--k-wb-${tone})` }} />)}</span>
      {bar && <span className="ml-2 truncate">{bar}</span>}
    </div>}{children}
  </div>;
});
