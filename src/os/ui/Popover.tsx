import { forwardRef, useEffect, useImperativeHandle, useRef, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { focusableWithin, trapTab } from '../lib/focus';
import { panelMaterial, useFloatingPanel, useOverlayHost, useOverlayPresence, type Anchor, type Placement } from './Overlay';
export interface PopoverProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean; onClose: () => void; anchorRef?: Anchor; placement?: Placement;
  label: string; modal?: boolean;
}
export const Popover = forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  { open, onClose, anchorRef, placement, label, modal = false, children, className = '', style, onKeyDown, ...props }, ref,
) {
  const panel = useRef<HTMLDivElement>(null); const host = useOverlayHost();
  const present = useOverlayPresence(open, panel, 0.12, host);
  useImperativeHandle(ref, () => panel.current!, [present, host]);
  const position = useFloatingPanel(panel, present, anchorRef, placement, undefined, 4, host);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open || !panel.current) return;
    // Safari pointer activation does not necessarily focus a button.
    const previous = anchorRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const node = panel.current;
    (node.querySelector<HTMLElement>('[data-autofocus]') ?? focusableWithin(node)[0] ?? node).focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !node.contains(event.target) && !anchorRef?.current?.contains(event.target)) close.current();
    };
    const blur = () => close.current();
    document.addEventListener('pointerdown', outside); window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('pointerdown', outside); window.removeEventListener('blur', blur);
      if (node.contains(document.activeElement) && previous?.isConnected) previous.focus();
    };
  }, [open, present, anchorRef, host]);
  if (!present) return null;
  const content = <div {...props} ref={panel} role="dialog" aria-label={label} aria-modal={modal || undefined} tabIndex={-1}
    inert={!open} className={`${panelMaterial} p-3 ${className}`} style={{ ...position, zIndex: modal ? 'var(--z-overlay)' : 'var(--z-menus)', maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)', overflow: 'auto', ...style }}
    onKeyDown={event => {
      onKeyDown?.(event); if (event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      else if (modal) trapTab(event, event.currentTarget);
    }}>{children}</div>;
  return host ? createPortal(content, host) : content;
});
