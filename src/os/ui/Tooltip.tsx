import { cloneElement, forwardRef, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { panelMaterial, useFloatingPanel, useOverlayHost, useOverlayPresence } from './Overlay';
export interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'content'> {
  content: string; children: ReactElement<HTMLAttributes<HTMLElement>>; delay?: number;
}
export const Tooltip = forwardRef<HTMLSpanElement, TooltipProps>(function Tooltip(
  { content, children, delay = 600, className = '', ...props }, ref,
) {
  const id = useId(); const host = useOverlayHost(); const anchor = useRef<HTMLSpanElement>(null); const panel = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const present = useOverlayPresence(open, panel, 0.1, host);
  const position = useFloatingPanel(panel, present, anchor, 'top', undefined, 4, host);
  const clear = () => { clearTimeout(timer.current); };
  const hide = () => { clear(); setOpen(false); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') { hide(); event.stopPropagation(); } };
    document.addEventListener('keydown', dismiss, true);
    return () => document.removeEventListener('keydown', dismiss, true);
  }, [open]);
  const tooltip = present ? <span ref={panel} id={id} role="tooltip" inert={!open}
    className={`${panelMaterial} rounded-menu-item px-2 py-0.5 text-caption-2`}
    style={{ ...position, zIndex: 'var(--z-overlay)', maxWidth: 'min(240px, calc(100vw - 16px))' }}
    onMouseEnter={clear} onMouseLeave={hide}>{content}</span> : null;
  return <span {...props} ref={ref} className={`inline-flex ${className}`} onMouseEnter={() => { clear(); timer.current = setTimeout(() => setOpen(true), delay); }}
    onMouseLeave={() => { clear(); timer.current = setTimeout(() => setOpen(false), 100); }} onFocus={() => { clear(); setOpen(true); }} onBlur={hide}>
    <span ref={anchor} className="inline-flex">{cloneElement(children, {
      'aria-describedby': [children.props['aria-describedby'], open ? id : null].filter(Boolean).join(' ') || undefined,
    })}</span>
    {host ? createPortal(tooltip, host) : tooltip}
  </span>;
});
