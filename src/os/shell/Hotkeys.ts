import { matchGlobalShortcut, type ShortcutPlatform } from '../lib/hotkeys-match';
import { trapTab } from '../lib/focus';
import { getStore } from '../state/store';
import { alertsAtom, contextMenuAtom, desktopAtom, openMenuAtom, overlayAtom, spotlightOpenAtom, viewAtom } from '../state/atoms';
import { runCommand } from '../wm/commands';

export function subscribeHotkeys(document: Document, platform: ShortcutPlatform): () => void {
  const keydown = (event: KeyboardEvent) => {
    const entry = matchGlobalShortcut(event, { platform });
    if (!entry) return;
    const store = getStore();
    if (store.get(viewAtom) === 'simple') return;
    if (entry.command === 'focus.next' || entry.command === 'focus.prev') {
      const win = (event.target as Element | null)?.closest?.<HTMLElement>('[data-window-id]');
      if (win) trapTab(event, win); return;
    }
    // Escape remains available to the app when no shell overlay owns it.
    if (entry.command === 'os.escape') {
      const desktop = store.get(desktopAtom); const win = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
      if (!store.get(openMenuAtom) && !store.get(contextMenuAtom) && !store.get(spotlightOpenAtom)
        && !store.get(alertsAtom).length && store.get(overlayAtom) === 'none' && !(win?.appId === 'projects' && win.query.shot !== undefined)) return;
    }
    event.preventDefault(); runCommand(entry.command, 'shortcut');
  };
  document.addEventListener('keydown', keydown);
  return () => document.removeEventListener('keydown', keydown);
}
