import { type MouseEvent, type KeyboardEvent } from 'react';
import { useStore } from 'jotai';
import { desktopAtom } from '../state/atoms';

let runtime: Promise<typeof import('./props-runtime')> | undefined;

export function DesktopSurface() {
  const store = useStore();
  const focusDesktop = () => store.set(desktopAtom, { type: 'FOCUS_DESKTOP' });
  const context = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); focusDesktop(); event.currentTarget.focus({ preventScroll: true });
    void (runtime ??= import('./props-runtime')).then(module => module.surfaceMenu(event.nativeEvent));
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => { void (runtime ??= import('./props-runtime')).then(module => module.surfaceKey(event.nativeEvent)); };
  return <div className="desktop-surface os-chrome" role="region" aria-label="Desktop surface" tabIndex={-1}
    style={{ position: 'absolute', inset: '0 0 auto', height: 'var(--k-hero-h)', zIndex: 9 }}
    onPointerDown={event => { if (event.button === 0) { focusDesktop(); event.currentTarget.focus({ preventScroll: true }); } }}
    onContextMenu={context} onKeyDown={key} />;
}
