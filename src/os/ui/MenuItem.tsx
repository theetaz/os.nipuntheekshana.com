import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { Shortcut } from '../types/apps';
export interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: 'item' | 'checkbox' | 'radio'; checked?: boolean; highlighted?: boolean;
  shortcut?: string; submenu?: boolean;
}
export function shortcutLabel(shortcut: Shortcut, mac = false): string {
  const key = shortcut.code.replace(/^(Key|Digit|Arrow)/, '').replace('Comma', ',').replace('Backquote', '`')
    .replace('BracketLeft', '[').replace('BracketRight', ']');
  return [shortcut.mod ? (mac ? '⌘' : 'Ctrl+') : '', shortcut.alt ? (mac ? '⌥' : 'Alt+') : '', shortcut.shift ? (mac ? '⇧' : 'Shift+') : '', key].join('');
}
export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { kind = 'item', checked, highlighted, shortcut, submenu, disabled, className = '', children, ...props }, ref,
) {
  return <button {...props} ref={ref} type="button" role={kind === 'item' ? 'menuitem' : `menuitem${kind}`}
    aria-checked={kind !== 'item' ? !!checked : undefined} aria-haspopup={submenu ? 'menu' : undefined}
    aria-disabled={disabled || undefined} data-accent-filled={highlighted || undefined}
    onClick={event => { if (disabled) { event.preventDefault(); return; } props.onClick?.(event); }}
    className={`os-menu-item relative flex min-h-6 w-full items-center gap-3 rounded-menu-item py-0 pl-6 pr-2.5 text-left text-ui ${highlighted ? 'bg-accent text-on-accent' : disabled ? 'text-ink-3' : 'text-ink'} ${className}`}>
    {checked && <span aria-hidden="true" className="absolute left-2">{kind === 'radio' ? '•' : '✓'}</span>}
    <span className="flex-1">{children}</span>
    {shortcut && <span aria-hidden="true" className={`text-caption-2 ${highlighted ? 'text-on-accent' : 'text-ink-3'}`}>{shortcut}</span>}
    {submenu && <span aria-hidden="true">›</span>}
  </button>;
});
