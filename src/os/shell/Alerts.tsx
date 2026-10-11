import { useLayoutEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useStore } from 'jotai';
import { AnimatePresence, m, useIsPresent } from 'motion/react';
import { alertsAtom, desktopAtom, reducedMotionAtom, type AlertSpec } from '../state/atoms';
import { resolveAlert } from '../wm/commands';
import { isolateModal } from '../lib/modal-focus';
import { focusableWithin, trapTab } from '../lib/focus';
import { springs } from '../lib/springs';
import { Button } from '../ui/Button';
import { AppIcon } from '../ui/AppIcon';
import { useOverlayHost } from '../ui/Overlay';
import { APP_META } from '../registry/meta';
import './p2-8-overlays.css';

/** Portals remain outside the inert desktop; nested modals restore the earlier state. */
export function useModalFocus(panel: RefObject<HTMLElement | null>, active: boolean, host: HTMLElement | null) {
  useLayoutEffect(() => {
    if (!active || !host || !panel.current) return;
    const node = panel.current;
    const focus = () => (node.querySelector<HTMLElement>('[data-autofocus]') ?? focusableWithin(node)[0] ?? node).focus({ preventScroll: true });
    return isolateModal(node, focus);
  }, [active, host, panel]);
}

function AlertDialog({ spec }: { spec: AlertSpec }) {
  const store = useStore();
  const desktop = useAtomValue(desktopAtom); const reduce = useAtomValue(reducedMotionAtom);
  const host = useOverlayHost(); const panel = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  const win = spec.windowId ? desktop.windows[spec.windowId] : undefined;
  const sheet = win && !win.minimized && !win.closing;
  useModalFocus(panel, present, host);
  const finish = (result: 'primary' | 'cancel') => {
    if (spec.id) resolveAlert(spec.id, result);
    else { store.set(alertsAtom, values => values.filter(value => value !== spec)); spec.resolve?.(result); }
  };
  useLayoutEffect(() => { if (spec.windowId && !win) finish('cancel'); }, [spec.windowId, win]);
  const titleId = `alert-${spec.id ?? 'system'}-title`; const bodyId = `${titleId}-body`;
  const content = <m.div className={`os-modal-layer os-alert-layer ${sheet ? 'os-sheet-layer' : ''}`}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
    style={sheet ? { left: win.rect.x, top: win.rect.y, width: win.rect.w, height: win.rect.h } : undefined}>
    <m.div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={spec.body ? bodyId : undefined}
      tabIndex={-1} inert={!present} className={`os-alert ${sheet ? 'os-alert-sheet' : ''}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: sheet ? -24 : 0, scale: sheet ? 1 : 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={reduce ? { duration: 0.1 } : springs.popover}
      onKeyDown={event => {
        event.stopPropagation(); trapTab(event, event.currentTarget);
        if (event.key === 'Escape') { event.preventDefault(); finish('cancel'); }
        else if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.target === event.currentTarget) { event.preventDefault(); finish('primary'); }
      }}>
      {!sheet && <AppIcon icon={win ? APP_META[win.appId].icon : 'app-settings'} size={48} />}
      <h2 id={titleId} className={sheet ? 'text-ui-strong' : 'text-title-3'}>{spec.title}</h2>
      {spec.body && <p id={bodyId} className="text-ui text-ink-2">{spec.body}</p>}
      <div className="os-alert-buttons">
        <Button variant={spec.danger ? 'danger' : 'primary'} size={36} data-autofocus onClick={() => finish('primary')}>{spec.primary ?? 'OK'}</Button>
        <Button variant="ghost" size={36} onClick={() => finish('cancel')}>{spec.cancel ?? 'Cancel'}</Button>
      </div>
    </m.div>
  </m.div>;
  return host ? createPortal(content, host) : null;
}

export function Alerts() {
  const alerts = useAtomValue(alertsAtom); const spec = alerts.at(-1);
  return <AnimatePresence>{spec && <AlertDialog key={spec.id ?? alerts.length} spec={spec} />}</AnimatePresence>;
}
