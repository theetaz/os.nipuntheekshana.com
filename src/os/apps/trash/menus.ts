import type { AppMenus } from '../../types/apps';
export const EMPTY_COMMAND = 'trash.empty';
export const menus: AppMenus = {
  file: [{ kind: 'item', label: 'Empty Kooda…', command: EMPTY_COMMAND }],
};
