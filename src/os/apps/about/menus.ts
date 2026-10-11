import type { AppMenus } from '../../types/apps';
import { ABOUT_SECTIONS } from './data';

export const menus: AppMenus = {
  view: ABOUT_SECTIONS.map(section => ({ kind: 'item', label: section, command: `about.section.${section.toLowerCase()}`, role: 'radio' })),
  file: [
    { kind: 'item', label: 'Read the CV', command: 'about.cv' },
    { kind: 'item', label: 'Email', command: 'about.email' },
  ],
};
