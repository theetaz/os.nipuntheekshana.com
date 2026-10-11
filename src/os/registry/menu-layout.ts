import type { AppMenus, AppMeta } from '../types/apps';
import type { ShellMenu } from './menus';

/** The first paint needs menu labels and widths; dropdown commands load with MenuHost. */
export function menuOutline(meta?: AppMeta, menus: AppMenus = {}): readonly ShellMenu[] {
  return [{ id: 'app', label: meta?.name ?? 'Serendib', strong: true, items: [] },
    { id: 'file', label: 'File', items: [] }, { id: 'view', label: 'View', items: [] },
    ...(menus.extra ?? []).map((menu, index) => ({ ...menu, id: `extra-${index}` })),
    { id: 'go', label: 'Go', items: [] }, { id: 'window', label: 'Window', items: [] },
    { id: 'help', label: 'Help', items: [] }];
}

/** Keep the app menu visible; move trailing menus into submenus when space runs out. */
export function overflowMenus(menus: readonly ShellMenu[], widths: readonly number[], available: number, moreWidth: number): readonly ShellMenu[] {
  if (widths.reduce((total, width) => total + width, 0) <= available) return menus;
  let count = 1; let used = (widths[0] ?? 0) + moreWidth;
  while (count < menus.length && used + (widths[count] ?? 0) <= available) used += widths[count++] ?? 0;
  return [...menus.slice(0, count), { id: 'more', label: 'More', items: menus.slice(count).map(menu =>
    ({ kind: 'submenu' as const, label: menu.label, items: menu.items })) }];
}
