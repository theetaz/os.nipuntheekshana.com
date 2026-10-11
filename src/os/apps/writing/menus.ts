import type { AppMenus } from '../../types/apps';
export const menus: AppMenus = {
  view: [
    { kind: 'item', label: 'Bigger text', command: 'writing.bigger', shortcut: { code: 'Equal', alt: true } },
    { kind: 'item', label: 'Smaller text', command: 'writing.smaller', shortcut: { code: 'Minus', alt: true } },
    { kind: 'separator' },
    { kind: 'item', label: 'Show folders', command: 'writing.folders', role: 'checkbox' },
  ],
  file: [
    { kind: 'item', label: 'Copy link', command: 'writing.copyLink' },
    { kind: 'item', label: 'Open on nipuntheekshana.com ↗', command: 'writing.openSite' },
  ],
};
