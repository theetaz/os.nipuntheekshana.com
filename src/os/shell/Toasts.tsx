import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue } from 'jotai';
import { AnimatePresence, m, useIsPresent } from 'motion/react';
import { reducedMotionAtom, toastsAtom, type Toast } from '../state/atoms';
import { useOverlayHost } from '../ui/Overlay';
import './p2-8-overlays.css';

function ToastCard({ toast, dismiss }: { toast: Toast; dismiss(): void }) {
  const reduce = useAtomValue(reducedMotionAtom);
  const present = useIsPresent();
  const remaining = useRef(toast.duration ?? (toast.action ? 8000 : 4000));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const started = useRef(0); const hover = useRef(false); const focus = useRef(false);
  const callback = useRef(dismiss); callback.current = dismiss;
  const pause = () => { if (timer.current !== undefined) { clearTimeout(timer.current); timer.current = undefined; remaining.current -= performance.now() - started.current; } };
  const resume = () => {
    if (!present || hover.current || focus.current || timer.current !== undefined) return;
    started.current = performance.now(); timer.current = setTimeout(() => callback.current(), Math.max(0, remaining.current));
  };
  useEffect(() => { resume(); return () => clearTimeout(timer.current); }, []);
  return <m.article className="os-toast" inert={!present} aria-hidden={!present} initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, ...(reduce ? {} : { x: 12 }), transition: { duration: reduce ? 0.1 : 0.16 } }} transition={{ duration: reduce ? 0.1 : 0.22 }}
    onPointerEnter={() => { hover.current = true; pause(); }} onPointerLeave={() => { hover.current = false; resume(); }}
    onFocus={() => { focus.current = true; pause(); }} onBlur={event => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) { focus.current = false; resume(); }
    }}>
    <span className="os-toast-icon" aria-hidden="true">✓</span>
    <div className="os-toast-copy"><h2 className="text-ui-strong">{toast.title}</h2>{toast.body && <p className="text-ui text-ink-2">{toast.body}</p>}
      {toast.action && <button type="button" className="text-ui-strong text-accent-ink" onClick={() => { toast.action?.run(); dismiss(); }}>{toast.action.label}</button>}
    </div>
    <button type="button" aria-label={`Dismiss ${toast.title}`} className="os-toast-dismiss" onClick={dismiss}>×</button>
  </m.article>;
}

export function Toasts() {
  const [toasts, setToasts] = useAtom(toastsAtom); const host = useOverlayHost();
  const content = <div className="os-toasts" role="status" aria-live="polite" aria-relevant="additions text">
    <AnimatePresence>{toasts.slice(-3).map((toast, index) => <ToastCard key={toast.id ?? index} toast={toast}
      dismiss={() => setToasts(values => values.filter(value => value !== toast))} />)}</AnimatePresence>
  </div>;
  return host ? createPortal(content, host) : null;
}
