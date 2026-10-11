import type { Shortcut } from '../types/apps';

export type ShortcutPlatform = 'mac' | 'windows' | 'linux' | 'other';
export interface ShortcutEvent {
  code: string;
  altKey?: boolean; shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean;
  isComposing?: boolean; defaultPrevented?: boolean; target?: unknown;
}

interface EditableElement {
  tagName?: string;
  isContentEditable?: boolean;
  parentElement?: EditableElement | null;
  getAttribute?(name: string): string | null;
}
function element(target: unknown): EditableElement | null {
  return target !== null && typeof target === 'object' ? target as EditableElement : null;
}

export function isEditable(target: unknown): boolean {
  for (let el = element(target); el; el = el.parentElement ?? null) {
    if (/^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName ?? '') || el.isContentEditable) return true;
    const contentEditable = el.getAttribute?.('contenteditable');
    if (contentEditable === 'false') return false;
    if (contentEditable === '' || contentEditable === 'true' || contentEditable === 'plaintext-only') return true;
  }
  return false;
}

export function allowsShortcuts(target: unknown): boolean {
  for (let el = element(target); el; el = el.parentElement ?? null) {
    if (el.getAttribute?.('data-os-shortcuts') === 'allow') return true;
  }
  return false;
}

export function matchShortcut(event: ShortcutEvent, shortcut: Shortcut, { platform }: { platform: ShortcutPlatform }): boolean {
  if (event.defaultPrevented || event.isComposing || event.code !== shortcut.code) return false;
  if (!!event.altKey !== !!shortcut.alt || !!event.shiftKey !== !!shortcut.shift) return false;
  if (!!event.metaKey !== (platform === 'mac' && !!shortcut.mod)
    || !!event.ctrlKey !== (platform !== 'mac' && !!shortcut.mod)) return false;
  if (isEditable(event.target)) {
    if (shortcut.code === 'Slash' && !shortcut.mod) return false;
    if (shortcut.alt && shortcut.code !== 'Backquote' && !allowsShortcuts(event.target)) return false;
  }
  return true;
}

function keyLabel(code: string, mac: boolean): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  const labels: Record<string, string> = { Backquote: '`', BracketLeft: '[', BracketRight: ']', Comma: ',',
    Slash: '/', Escape: 'Esc', Space: 'Space', ContextMenu: 'Menu', Tab: mac ? '⇥' : 'Tab',
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: mac ? '↩' : 'Enter' };
  return labels[code] ?? code;
}

export function formatShortcut(shortcut: Shortcut, platform: ShortcutPlatform): string {
  const mac = platform === 'mac';
  const keys = [shortcut.mod ? (mac ? '⌘' : 'Ctrl') : '', shortcut.alt ? (mac ? '⌥' : 'Alt') : '',
    shortcut.shift ? (mac ? '⇧' : 'Shift') : '', keyLabel(shortcut.code, mac)].filter(Boolean);
  return keys.join(mac ? '' : '+');
}

export interface GlobalShortcut { command: string; shortcut: Shortcut; allowInEditable: boolean }
/** Roving arrows/type-ahead and Projects Space belong to the focused region/app, not the global dispatcher. */
export const GLOBAL_SHORTCUTS: readonly GlobalShortcut[] = [
  { command: 'os.spotlight', shortcut: { code: 'KeyK', mod: true }, allowInEditable: true },
  { command: 'os.spotlight', shortcut: { code: 'Space', alt: true }, allowInEditable: false },
  { command: 'os.spotlight', shortcut: { code: 'Slash' }, allowInEditable: false },
  { command: 'window.close', shortcut: { code: 'KeyW', alt: true }, allowInEditable: false },
  { command: 'window.minimize', shortcut: { code: 'KeyM', alt: true }, allowInEditable: false },
  { command: 'window.zoom', shortcut: { code: 'KeyZ', alt: true }, allowInEditable: false },
  { command: 'window.snapLeft', shortcut: { code: 'BracketLeft', alt: true }, allowInEditable: false },
  { command: 'window.snapRight', shortcut: { code: 'BracketRight', alt: true }, allowInEditable: false },
  { command: 'window.next', shortcut: { code: 'Backquote', alt: true }, allowInEditable: true },
  { command: 'window.prev', shortcut: { code: 'Backquote', alt: true, shift: true }, allowInEditable: true },
  { command: 'app.quit', shortcut: { code: 'KeyQ', alt: true }, allowInEditable: false },
  { command: 'desktop.show', shortcut: { code: 'KeyH', alt: true }, allowInEditable: false },
  { command: 'window.new', shortcut: { code: 'KeyN', alt: true }, allowInEditable: false },
  { command: 'os.settings', shortcut: { code: 'Comma', alt: true }, allowInEditable: false },
  { command: 'focus.menuBar', shortcut: { code: 'Digit1', alt: true }, allowInEditable: false },
  { command: 'focus.desktop', shortcut: { code: 'Digit2', alt: true }, allowInEditable: false },
  { command: 'focus.dock', shortcut: { code: 'Digit3', alt: true }, allowInEditable: false },
  { command: 'focus.window', shortcut: { code: 'Digit4', alt: true }, allowInEditable: false },
  { command: 'focus.next', shortcut: { code: 'Tab' }, allowInEditable: true },
  { command: 'focus.prev', shortcut: { code: 'Tab', shift: true }, allowInEditable: true },
  { command: 'os.escape', shortcut: { code: 'Escape' }, allowInEditable: true },
  { command: 'os.contextMenu', shortcut: { code: 'F10', shift: true }, allowInEditable: true },
  { command: 'os.contextMenu', shortcut: { code: 'ContextMenu' }, allowInEditable: true },
];

/** Apply the table's editing policy while retaining the Terminal/search opt-in exception. */
export function matchGlobalShortcut(event: ShortcutEvent, options: { platform: ShortcutPlatform }): GlobalShortcut | null {
  const editing = isEditable(event.target);
  const optIn = allowsShortcuts(event.target);
  return GLOBAL_SHORTCUTS.find((entry) => (!editing || entry.allowInEditable || optIn)
    && matchShortcut(event, entry.shortcut, options)) ?? null;
}
