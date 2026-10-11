import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { Shortcut } from '../types/apps';
export interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: 'item' | 'checkbox' | 'radio'; checked?: boolean; highlighted?: boolean;
  shortcut?: string; submenu?: boolean;
}
export function shortcutLabel(shortcut: Shortcut, mac = false): string {
  const key = shortcut.code.replace(/^(Key|Digit|Arrow)/, '').replace('Comma', ',').replace('Backquote', '`').replace('Space', 'Space');
  return [shortcut.mod ? (mac ? '⌘' : 'Ctrl+') : '', shortcut.alt ? (mac ? '⌥' : 'Alt+') : '', shortcut.shift ? (mac ? '⇧' : 'Shift+') : '', key].join('');
}
export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { kind = 'item', checked, highlighted, shortcut, submenu, className = '', children, ...props }, ref,
) {
  return <button {...props} ref={ref} type="button" role={kind === 'item' ? 'menuitem' : `menuitem${kind}`}
    aria-checked={kind !== 'item' ? !!checked : undefined} aria-haspopup={submenu ? 'menu' : undefined}
    aria-disabled={props.disabled || undefined} data-accent-filled={highlighted || undefined}
    className={`relative flex min-h-6 w-full items-center gap-3 rounded-menu-item py-0 pl-6 pr-2.5 text-left text-ui disabled:opacity-50 ${highlighted ? 'bg-accent text-on-accent' : 'text-ink'} ${className}`}>
    {checked && <span aria-hidden="true" className="absolute left-2">{kind === 'radio' ? '•' : '✓'}</span>}
    <span className="flex-1">{children}</span>
    {shortcut && <span aria-hidden="true" className={`text-caption-2 ${highlighted ? 'text-on-accent' : 'text-ink-3'}`}>{shortcut}</span>}
    {submenu && <span aria-hidden="true">›</span>}
  </button>;
});
