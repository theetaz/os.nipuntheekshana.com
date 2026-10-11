import type { AppMenus } from '../../types/apps';
export const menus: AppMenus = {
  file: [
    { kind: 'item', label: 'Open project', command: 'projects.open' },
    { kind: 'item', label: 'Quick Look', command: 'projects.preview' },
  ],
  view: [
    { kind: 'item', label: 'as Icons', command: 'projects.view.icons', role: 'radio', shortcut: { code: 'Digit1', alt: true, shift: true } },
    { kind: 'item', label: 'as List', command: 'projects.view.list', role: 'radio', shortcut: { code: 'Digit2', alt: true, shift: true } },
    { kind: 'item', label: 'as Gallery', command: 'projects.view.gallery', role: 'radio', shortcut: { code: 'Digit3', alt: true, shift: true } },
    { kind: 'separator' },
    { kind: 'submenu', label: 'Sort by', items: [
      { kind: 'item', label: 'Featured', command: 'projects.sort.featured', role: 'radio' },
      { kind: 'item', label: 'Name', command: 'projects.sort.name', role: 'radio' },
      { kind: 'item', label: 'Year', command: 'projects.sort.year', role: 'radio' },
      { kind: 'item', label: 'Category', command: 'projects.sort.category', role: 'radio' },
    ] },
    { kind: 'item', label: 'Show status bar', command: 'projects.statusbar', role: 'checkbox' },
  ],
};
