import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useStore } from 'jotai';
import { desktopAtom, focusedIdAtom, releaseWindowAtom, updateAvailableAtom, windowAtom } from '../state/atoms';
import { loadApp } from '../registry/loader';
import type { AppModule, AppProps } from '../registry/apps';
import { readInitialData } from '../lib/initial-data';
import { closeWindow, focusWindow, navigateWindow } from '../wm/commands';
import type { WindowId } from '../wm/types';
import { completeAdoption } from './Adoption';
import { TitleBar } from './TitleBar';
import { AppErrorBoundary } from './AppErrorBoundary';

export function Window({ windowId, mode = 'desktop', zIndex = 30 }: { windowId: WindowId; mode?: 'desktop' | 'mobile'; zIndex?: number }) {
  const store = useStore(); const win = useAtomValue(windowAtom(windowId)); const focusedId = useAtomValue(focusedIdAtom);
  const updated = useAtomValue(updateAvailableAtom);
  const [module, setModule] = useState<AppModule | null>(null); const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0); const [contentReady, setContentReady] = useState(false);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const appId = win?.appId;
  useEffect(() => () => releaseWindowAtom(windowId), [windowId]);
  useEffect(() => {
    if (!appId) return;
    let active = true; setError(false);
    void loadApp(appId, store).then(value => { if (active) setModule(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [appId, store, attempt]);
  useEffect(() => { if (win?.closing) store.set(desktopAtom, { type: 'FINISH_CLOSE', id: windowId }); }, [store, windowId, win?.closing]);
  const ready = useCallback(() => { completeAdoption(store, windowId, scrollRootRef.current); setContentReady(true); }, [store, windowId]);
  if (!win) return null;
  const App = module?.default;
  const props: AppProps = { windowId, appId: win.appId, route: win.route, query: win.query, mode, focused: focusedId === windowId,
    initialData: win.adopted ? readInitialData(`${win.appId}:${win.route || 'index'}`)
      ?? (win.route === '' ? readInitialData(win.appId) : null) : null,
    navigate: (route, opts) => navigateWindow(windowId, route, opts),
    setQuery: (query, opts) => store.set(desktopAtom, { type: 'SET_QUERY', id: windowId, query, history: opts?.replace === false ? 'push' : 'replace' }),
    setTitle: title => store.set(desktopAtom, { type: 'SET_TITLE', id: windowId, title }), ready,
    close: () => { void closeWindow(windowId); }, scrollRootRef };
  const rect = win.rect;
  return <section className="managed-window static-window" role="dialog" aria-modal="false" aria-labelledby={`window-title-${windowId}`}
    data-window-id={windowId} data-app={win.appId} data-adopting={win.adopted && !contentReady ? '' : undefined}
    hidden={win.minimized || win.closing} tabIndex={-1} onPointerDownCapture={() => focusWindow(windowId)}
    style={{ position: mode === 'mobile' ? 'fixed' : 'absolute', zIndex, ...(mode === 'mobile' ? { inset: 0, width: '100%', height: '100dvh' }
      : { left: rect.x, top: rect.y, width: rect.w, height: rect.h }),
      ...(win.adopted && !contentReady ? { opacity: 0, pointerEvents: 'none' } : {}) }}>
    <TitleBar windowId={windowId} title={win.title} />
    {error ? <div className="static-document"><h1>{updated ? 'Serendib was updated while you were here.' : "This app didn't load."}</h1>
      <p>{updated ? 'Reload to get the new version. Your windows will reopen.' : 'Check your connection and try again.'}</p>
      <button onClick={() => updated ? location.reload() : setAttempt(value => value + 1)}>{updated ? 'Reload' : 'Try again'}</button>
      <a href={`${location.pathname}#simple`}>Open simple view</a></div>
      : App ? <AppErrorBoundary key={attempt} onRetry={() => setAttempt(value => value + 1)}><App {...props} /></AppErrorBoundary>
      : <div className="static-document" role="status">Loading…</div>}
  </section>;
}
