import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject, type ReactNode } from 'react';
import { useAtomValue, useStore } from 'jotai';
import { announceAtom, appLoadAtom, desktopAtom, focusedIdAtom, geometryAtom, reducedMotionAtom, releaseWindowAtom, updateAvailableAtom, windowAtom } from '../state/atoms';
import { APP_META } from '../registry/meta';
import { loadApp } from '../registry/loader';
import type { AppModule, AppProps } from '../registry/apps';
import { readInitialData } from '../lib/initial-data';
import { focusableWithin, nextFocusIndex, trapTab } from '../lib/focus';
import { closeWindow, focusWindow, navigateWindow } from '../wm/commands';
import { clampMove, clampSize } from '../wm/geometry';
import type { Rect, WindowId, WindowState } from '../wm/types';
import { pathFor } from '../url/routes';
import { ErrorState } from '../ui/ErrorState';
import { Button } from '../ui/Button';
import { completeAdoption } from './Adoption';
import { TitleBar } from './TitleBar';
import { AppErrorBoundary } from './AppErrorBoundary';
import { ResizeHandles } from './ResizeHandles';
import { skeletons } from './skeletons';
import { createFrameController, sameRect, type FrameController } from './frame-controller';
import { useWindowDrag } from './useWindowDrag';
import { useWindowResize } from './useWindowResize';
import { getDockAnchor } from './dock-anchors';

import { launchers } from './window-launchers';

function phoneRect(): Rect {
  const viewport=window.visualViewport;
  return {x:viewport?.offsetLeft??0,y:viewport?.offsetTop??0,w:viewport?.width??innerWidth,h:viewport?.height??innerHeight};
}

function focusContent(el: HTMLElement) {
  const heading = el.querySelector<HTMLElement>('.window-content h1, .window-content h2');
  if (heading) heading.tabIndex = -1;
  const controls = focusableWithin(el);
  const target = controls.find(item => item.matches('[data-autofocus]'))
    ?? (el.hasAttribute('data-sheet') ? controls.find(item => item.closest('.window-content')) : undefined)
    ?? controls.find(item => !item.closest('.k-winbtns')) ?? heading ?? el;
  target.focus({ preventScroll: true });
}

export function Window({ windowId, mode = 'desktop', zIndex = 2, elementRef, frameRef, controllerFactory = createFrameController, header }: { windowId: WindowId; mode?: 'desktop' | 'mobile'; zIndex?: number; elementRef?: RefObject<HTMLElement | null>; frameRef?: RefObject<FrameController | null>; controllerFactory?: typeof createFrameController; header?: (win: WindowState, loading: boolean) => ReactNode }) {
  const store = useStore(); const win = useAtomValue(windowAtom(windowId)); const focusedId = useAtomValue(focusedIdAtom);
  const updated = useAtomValue(updateAvailableAtom);
  const [module, setModule] = useState<AppModule | null>(null); const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0); const [contentReady, setContentReady] = useState(false);
  const [stillLoading, setStillLoading] = useState(false); const [keyboardMove, setKeyboardMove] = useState(false);
  const scrollRootRef = useRef<HTMLElement | null>(null); const internalElement = useRef<HTMLElement | null>(null); const element = elementRef ?? internalElement;
  const internalFrame = useRef<FrameController | null>(null); const frame = frameRef ?? internalFrame; const transitionSeq = useRef<number | null>(null);
  const readyCalled = useRef(false); const previousFocus = useRef(false); const previousReady = useRef(false);
  const launcher = useRef<WeakRef<HTMLElement> | null>(null);
  const keyboard = useRef<{ original: Rect; resized: boolean; returnFocus: HTMLElement | null } | null>(null);
  const appId = win?.appId; const focused = focusedId === windowId;
  useEffect(() => () => releaseWindowAtom(windowId), [windowId]);
  useEffect(() => {
    if (!appId) return;
    let active = true; setError(false); setStillLoading(false);
    const timer = setTimeout(() => { if (active) setStillLoading(true); }, 3000);
    void loadApp(appId, store).then(value => {
      clearTimeout(timer); if (active) {
        // Vite resolves a prevented preloadError without a module. It is still a load failure.
        if (value?.default) setModule(value);
        else { setError(true); store.set(appLoadAtom, prev => ({ ...prev, [appId]: 'error' })); }
        setStillLoading(false);
      }
    }, () => {
      clearTimeout(timer); if (active) { setError(true); setStillLoading(false); }
    });
    return () => { active = false; clearTimeout(timer); };
  }, [appId, store, attempt]);
  const ready = useCallback(() => {
    if (readyCalled.current) return;
    readyCalled.current = true;
    if (scrollRootRef.current) scrollRootRef.current.tabIndex = -1;
    const current = store.get(desktopAtom).windows[windowId];
    if (element.current) element.current.inert = !!(current?.minimized || current?.closing);
    completeAdoption(store, windowId, scrollRootRef.current);
    setContentReady(true);
  }, [store, windowId]);
  const retry = useCallback(() => {
    readyCalled.current = false; previousReady.current = false;
    if (!store.get(desktopAtom).windows[windowId]?.adopted) setContentReady(false);
    setAttempt(value => value + 1);
  }, [store, windowId]);
  const announce = useCallback((text: string) => store.set(announceAtom, prev => ({ text, politeness: 'polite', seq: prev.seq + 1 })), [store]);
  const returnToDesktop = useCallback(() => {
    if (store.get(desktopAtom).focusedId) return;
    const source = launcher.current?.deref();
    const fallback = element.current?.ownerDocument.querySelector<HTMLElement>('[data-shell="desktop"] [aria-label="Desktop"] a, [data-shell] [aria-label="Dock"] a, [data-shell="mobile"] [data-phone-icon]');
    if (source?.isConnected && !source.closest('[hidden], [inert]')) source.focus({ preventScroll: true });
    else fallback?.focus({ preventScroll: true });
  }, [store]);

  useLayoutEffect(() => {
    const el = element.current; const current = store.get(desktopAtom).windows[windowId];
    if (!el || !current) return;
    const active = el.ownerDocument.activeElement;
    launcher.current = launchers.get(el.ownerDocument)?.get(current.appId) ?? null;
    if (!launcher.current && active instanceof HTMLElement && active !== el.ownerDocument.body && !active.closest('[data-window-id]')) launcher.current = new WeakRef(active);
    const rect = mode === 'mobile' ? phoneRect() : current.rect;
    frame.current = controllerFactory(el, rect, () => store.get(reducedMotionAtom));
    transitionSeq.current = null;
    return () => { frame.current?.destroy(); frame.current = null; };
  }, [controllerFactory, mode, store, windowId]);

  useLayoutEffect(() => {
    const controller = frame.current;
    if (!win || !controller) return;
    const el = controller.el;
    if (keyboard.current && (!focused || win.minimized || win.closing)) {
      const original = keyboard.current.original;
      keyboard.current = null; delete el.dataset.keyboardMove; setKeyboardMove(false);
      controller.set(original);
    }
    const rect = mode === 'mobile' ? phoneRect() : win.rect;
    if (transitionSeq.current === win.transition.seq) {
      if (!el.hasAttribute('data-dragging') && !el.hasAttribute('data-resizing') && !keyboard.current && !sameRect(rect, controller.rect)) controller.set(rect);
      return;
    }
    transitionSeq.current = win.transition.seq;
    el.hidden = false;
    el.dataset.transition = win.transition.kind;
    const seq = win.transition.seq; const kind = win.transition.kind;
    if (kind !== 'none') {
      const suffix = kind === 'open' ? 'opened' : kind === 'close' ? 'closed' : kind === 'minimize' ? 'minimised'
        : kind === 'restore' || kind === 'unsnap' || (kind === 'zoom' && win.mode === 'normal') ? 'restored'
          : win.mode === 'maximized' ? 'maximised' : `snapped ${win.snap?.replace('-', ' ') ?? ''}`;
      announce(`${win.title} ${suffix}`);
    }
    void controller.animate(kind, rect, { origin: win.transition.origin, dockTarget: getDockAnchor(win.appId) }).then(() => {
      const current = store.get(desktopAtom).windows[windowId];
      if (frame.current !== controller || !current || current.transition.seq !== seq) return;
      delete el.dataset.transition;
      if (current.minimized) { el.hidden = true; returnToDesktop(); }
      if (kind === 'close' && current.closing) {
        returnToDesktop(); store.set(desktopAtom, { type: 'FINISH_CLOSE', id: windowId });
      }
    });
  }, [announce, focused, mode, returnToDesktop, store, win, windowId]);

  useEffect(() => {
    const el = element.current;
    if (!el || mode !== 'desktop') return;
    const visibility = () => { el.toggleAttribute('data-document-hidden', el.ownerDocument.hidden); };
    visibility();
    el.ownerDocument.addEventListener('visibilitychange', visibility);
    return () => { el.ownerDocument.removeEventListener('visibilitychange', visibility); };
  }, [mode]);

  useWindowDrag(windowId, frame, mode === 'desktop');
  useWindowResize(windowId, frame, mode === 'desktop');

  useLayoutEffect(() => {
    const el = element.current;
    if (focused && store.get(desktopAtom).focusedId === windowId && win && !win.closing && !win.minimized && el
      && (!previousFocus.current || !previousReady.current) && !(win.adopted && !previousReady.current)) {
      // A loading frame must own focus too. Otherwise the old app's active input
      // cannot emit a new focus event when the user returns to it before ready.
      if (contentReady || error) focusContent(el);
      else if (!previousFocus.current) el.focus({ preventScroll: true });
    }
    previousFocus.current = focused; previousReady.current = contentReady || error;
  }, [attempt, contentReady, error, focused, store, win, windowId]);

  const finishKeyboard = useCallback((commit: boolean) => {
    const interaction = keyboard.current; const controller = frame.current;
    if (!interaction || !controller) return;
    keyboard.current = null; delete controller.el.dataset.keyboardMove; setKeyboardMove(false);
    if (commit) {
      const current = store.get(desktopAtom).windows[windowId]; const rect = controller.rect;
      if (interaction.resized || current?.mode !== 'normal') store.set(desktopAtom, { type: 'RESIZE', id: windowId, rect });
      else store.set(desktopAtom, { type: 'MOVE', id: windowId, x: rect.x, y: rect.y });
      const win = store.get(desktopAtom).windows[windowId];
      if (win) store.set(geometryAtom, prev => ({ ...prev, [win.appId]: win.restoreRect }));
    } else controller.set(interaction.original);
    if (interaction.returnFocus?.isConnected && controller.el.contains(interaction.returnFocus)) interaction.returnFocus.focus({ preventScroll: true });
    else focusContent(controller.el);
  }, [store, windowId]);
  useEffect(() => {
    if (mode !== 'desktop') return;
    const start = (event: Event) => {
      if ((event as CustomEvent<{ windowId: WindowId }>).detail?.windowId !== windowId || keyboard.current) return;
      const current = store.get(desktopAtom).windows[windowId]; const controller = frame.current;
      if (!current || current.minimized || current.closing || !controller || controller.el.hasAttribute('data-dragging') || controller.el.hasAttribute('data-resizing')) return;
      controller.stop(); controller.set(current.rect);
      keyboard.current = { original: { ...controller.rect }, resized: false, returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null };
      controller.el.dataset.keyboardMove = ''; setKeyboardMove(true);
      controller.el.querySelector<HTMLElement>('[data-window-titlebar]')?.focus({ preventScroll: true });
      announce('Arrows move. Shift moves eight times further. Option or Alt plus arrows resize. Return to finish. Escape to cancel.');
    };
    document.addEventListener('window:keyboardMove', start);
    return () => { document.removeEventListener('window:keyboardMove', start); keyboard.current = null; };
  }, [announce, mode, store, windowId]);

  if (!win) return null;
  const meta = APP_META[win.appId]; const App = module?.default; const Skeleton = skeletons[meta.skeleton];
  const adopting = win.adopted && !contentReady;
  const simpleHref = `${pathFor(win.appId, win.route)}#simple`;
  const props: AppProps = { windowId, appId: win.appId, route: win.route, query: win.query, mode, focused,
    initialData: win.adopted ? readInitialData(`${win.appId}:${win.route || 'index'}`)
      ?? (win.route === '' ? readInitialData(win.appId) : null) : null,
    navigate: (route, opts) => navigateWindow(windowId, route, opts),
    setQuery: (query, opts) => store.set(desktopAtom, { type: 'SET_QUERY', id: windowId, query, history: opts?.replace === false ? 'push' : 'replace' }),
    setTitle: title => store.set(desktopAtom, { type: 'SET_TITLE', id: windowId, title }), ready,
    close: () => { void closeWindow(windowId); }, scrollRootRef };
  return <section ref={element} className="managed-window" role="dialog" aria-modal={mode === 'mobile'} aria-labelledby={`window-title-${windowId}`}
    aria-describedby={`window-hint-${windowId}`} data-window-id={windowId} data-app={win.appId} data-focused={focused}
    data-sheet={mode === 'mobile' ? '' : undefined} data-mode={win.mode} data-shell-mode={mode} data-theme={win.appId === 'terminal' ? 'dark' : undefined}
    data-adopting={adopting ? '' : undefined} inert={win.minimized || win.closing || adopting} tabIndex={-1}
    onPointerDownCapture={() => { if (!win.closing && !win.minimized) focusWindow(windowId); }}
    onFocusCapture={() => { if (store.get(desktopAtom).focusedId !== windowId && !adopting) focusWindow(windowId); }}
    onKeyDownCapture={event => {
      const interaction = keyboard.current; const controller = frame.current;
      if (interaction && controller) {
        if (event.code === 'Enter' || event.code === 'Escape') {
          event.preventDefault(); event.stopPropagation(); finishKeyboard(event.code === 'Enter'); return;
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
          event.preventDefault(); event.stopPropagation();
          const step = event.shiftKey ? 64 : 8;
          const dx = event.code === 'ArrowLeft' ? -step : event.code === 'ArrowRight' ? step : 0;
          const dy = event.code === 'ArrowUp' ? -step : event.code === 'ArrowDown' ? step : 0;
          const rect = controller.rect; const viewport = store.get(desktopAtom).viewport;
          if (event.altKey) {
            if (meta.window.resizable) { controller.set(clampSize({ ...rect, w: rect.w + dx, h: rect.h + dy }, meta.window, viewport)); interaction.resized = true; }
          } else controller.set(clampMove({ ...rect, x: rect.x + dx, y: rect.y + dy }, viewport));
          return;
        }
      }
    }} onKeyDown={event => {
      // App widgets and portalled overlays own their keyboard interaction first.
      if (event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
      if (mode === 'desktop' && event.key === 'Tab') {
        // App-owned unified toolbars overlay the bar from the content slot.
        // Follow their visual order before the bar's right-side buttons.
        const controls = focusableWithin(event.currentTarget);
        const toolbar = '.window-navigation, .window-toolbar, .projects-toolbar, .writing-toolbar';
        const ordered = [
          ...controls.filter(item => item.closest(toolbar)),
          ...controls.filter(item => item.closest('.k-winbtns')),
          ...controls.filter(item => !item.closest(`${toolbar}, .k-winbtns`)),
        ];
        event.preventDefault();
        const index = ordered.indexOf(event.currentTarget.ownerDocument.activeElement as HTMLElement);
        if (ordered.length) ordered[nextFocusIndex(index, event.shiftKey ? -1 : 1, ordered.length)]?.focus();
        else event.currentTarget.focus();
      } else trapTab(event, event.currentTarget);
    }} style={{ zIndex }}>
    {mode === 'desktop' && <span className="k-ring" aria-hidden="true"><i /></span>}
    <span id={`window-hint-${windowId}`} className="sr-only">Window. Tab moves within it. Option or Alt plus backtick switches windows.</span>
    {header ? header(win, stillLoading && !App && !error) : <TitleBar windowId={windowId} title={win.title} kind={meta.window.titleBar} zoomable={meta.window.zoomable}
      maximized={win.mode === 'maximized'} keyboardMove={keyboardMove} stillLoading={stillLoading && !App && !error} />}
    <div className="window-content" data-titlebar={meta.window.titleBar}>
      {error ? <ErrorState className="window-error" role="alert" simpleHref={simpleHref}
        title={updated ? 'Kottu OS was updated while you were here.' : undefined}
        body={updated ? 'Reload to get the new version. Your windows will reopen.' : undefined}
        onRetry={updated ? undefined : retry}
        action={updated ? <div className="flex items-center gap-3"><Button variant="primary" onClick={() => location.reload()}>Reload</Button><a href={simpleHref}>Open simple view</a></div> : undefined} />
        : App ? <AppErrorBoundary key={attempt} simpleHref={simpleHref} onRetry={retry}
          onError={() => { if (!win.adopted) setContentReady(true); }}><App {...props} /></AppErrorBoundary>
          : <Skeleton />}
    </div>
    {mode === 'desktop' && meta.window.resizable && <ResizeHandles />}
  </section>;
}
