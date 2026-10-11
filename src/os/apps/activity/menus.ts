import type { AppMenus } from '../../types/apps';
export const menus: AppMenus = { view: [
  { kind: 'item', label: '3D', command: 'activity.3d', role: 'radio' },
  { kind: 'item', label: 'Calendar', command: 'activity.calendar', role: 'radio' },
  { kind: 'separator' },
  { kind: 'item', label: 'Reset camera', command: 'activity.reset' },
] };
