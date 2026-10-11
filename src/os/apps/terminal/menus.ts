import type { AppMenus } from '../../types/apps';
export const menus: AppMenus = {
  view: [
    { kind: 'item', label: 'Bigger text', command: 'terminal.bigger', shortcut: { code: 'Equal', alt: true } },
    { kind: 'item', label: 'Smaller text', command: 'terminal.smaller', shortcut: { code: 'Minus', alt: true } },
    { kind: 'separator' },
    { kind: 'item', label: 'Clear scrollback', command: 'terminal.clear' },
  ],
};
