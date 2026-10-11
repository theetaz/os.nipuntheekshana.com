import { devModeAtom, modeAtom, viewAtom } from '../state/atoms';
import type { OsStore } from '../state/store';
import { isEditable } from '../lib/hotkeys-match';

const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

/** Only listeners live in the startup bundle; effects load after their trigger. */
export function subscribeEggs(store: OsStore): () => void {
  let active = true; let keys: string[] = []; let developerRequested = false;
  const effects = new Map<string, () => void>(); const requests = new Map<string, number>();
  const available = () => store.get(viewAtom) !== 'simple' && store.get(modeAtom) === 'desktop';
  const run = (id: string, load: () => Promise<() => () => void>) => {
    const request = (requests.get(id) ?? 0) + 1; requests.set(id, request);
    void load().then(start => {
      if (!active || requests.get(id) !== request || (id !== 'developer' && !available())) return;
      effects.get(id)?.(); effects.set(id, start());
    }).catch(() => {});
  };
  const keydown = (event: KeyboardEvent) => {
    if (!available() || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey
      || isEditable(event.target) || (event.target instanceof Element && event.target.closest('[role="textbox"]'))) { keys = []; return; }
    // Roving desktop arrows may already have prevented their native action.
    keys = [...keys, event.code].slice(-sequence.length);
    if (sequence.every((code, index) => keys[index] === code)) {
      keys = []; run('rain', () => import('./rain').then(module => () => module.monsoon(store)));
    }
  };
  const greeting = () => { if (available()) void import('./ayubowan').then(module => module.ayubowan(() => active && available())).catch(() => {}); };
  const perfect = (event: Event) => {
    const detail = (event as CustomEvent<{ score: number; windowId: string }>).detail;
    if (available() && detail && Number.isFinite(detail.score) && typeof detail.windowId === 'string')
      run('confetti', () => import('./confetti').then(module => () => module.confetti(store, detail.windowId)));
  };
  const avatar = () => { if (available()) void import('./devmode').then(module => { if (active && available()) module.enableDeveloper(store); }).catch(() => {}); };
  const developer = () => {
    if (!store.get(devModeAtom) || developerRequested) return;
    developerRequested = true; run('developer', () => import('./devmode').then(module => () => module.subscribeDeveloper(store)));
  };
  const suspend = () => {
    keys = [];
    if (!available()) for (const id of ['rain', 'confetti']) {
      requests.set(id, (requests.get(id) ?? 0) + 1); effects.get(id)?.(); effects.delete(id);
    }
  };
  document.addEventListener('keydown', keydown); document.addEventListener('ayubowan', greeting);
  document.addEventListener('about:avatar7', avatar); document.addEventListener('serendib:pin-perfect', perfect);
  const unsubscribers = [store.sub(devModeAtom, developer), store.sub(viewAtom, suspend), store.sub(modeAtom, suspend)];
  developer();
  return () => {
    active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); effects.forEach(cleanup => cleanup());
    document.removeEventListener('keydown', keydown); document.removeEventListener('ayubowan', greeting);
    document.removeEventListener('about:avatar7', avatar); document.removeEventListener('serendib:pin-perfect', perfect);
  };
}
