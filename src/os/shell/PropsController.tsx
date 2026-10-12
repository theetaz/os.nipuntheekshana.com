import { useEffect } from 'react';
import { deferredPointer } from '../lib/deferred-pointer';

export function PropsController() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-k-props]')!;
    let runtime: Promise<typeof import('./props-runtime')> | undefined;
    let cancel: (() => void) | undefined; let managedClick = false;
    const load = () => runtime ??= import('./props-runtime');
    root.onpointerdown = event => {
      managedClick = false;
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      managedClick = true; cancel?.(); cancel = deferredPointer(root, event, () => load().then(module => () => module.pointer(root, event)));
    };
    const intent = (event: Event) => { void load().then(module => module.intent(root, event)); };
    root.onpointerover = intent; root.addEventListener('focusin', intent);
    root.onkeydown = root.oncontextmenu = (event: Event) => {
      if (event instanceof KeyboardEvent && (event.key === 'Tab' || event.key === ' ' || event.metaKey || event.ctrlKey || event.altKey)) return;
      event.preventDefault(); void load().then(module => module.intent(root, event)); };
    root.onclick = event => { if (event.isTrusted) { if (managedClick) event.preventDefault(); managedClick = false; } };
    window.addEventListener('scroll', intent, { once: true, passive: true });
    return () => { root.onpointerdown = root.onkeydown = root.oncontextmenu = root.onpointerover = root.onclick = null; root.removeEventListener('focusin', intent); window.removeEventListener('scroll', intent); cancel?.(); void runtime?.then(module => module.dispose(root)); };
  }, []);
  return null;
}
