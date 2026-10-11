import type { AppMenus } from '../../types/apps';
export const menus: AppMenus = {
  file: [{ kind: 'item', label: 'Send message', command: 'messages.send' }],
  view: [
    { kind: 'item', label: 'Nipun conversation', command: 'messages.nipun', role: 'radio' },
    { kind: 'item', label: 'Mochi conversation', command: 'messages.mochi', role: 'radio' },
    { kind: 'separator' },
    { kind: 'item', label: 'Focus composer', command: 'messages.compose' },
  ],
};
