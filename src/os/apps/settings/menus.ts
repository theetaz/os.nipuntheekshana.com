import type { AppMenus } from '../../types/apps';
import { SECTIONS } from './settings';
export const menus: AppMenus = {
  view: SECTIONS.filter(section => section.id !== 'developer').map(section => ({
    kind: 'item', label: section.label, command: `settings.section.${section.id}`, role: 'radio',
  })),
};
