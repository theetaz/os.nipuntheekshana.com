import { GLOBAL_SHORTCUTS, formatShortcut, type ShortcutPlatform } from '../../lib/hotkeys-match';

const actions: Readonly<Record<string, string>> = {
  'os.spotlight': 'Open Search', 'window.close': 'Close window', 'window.minimize': 'Minimise window',
  'window.zoom': 'Maximise or restore', 'window.snapLeft': 'Snap left', 'window.snapRight': 'Snap right',
  'window.next': 'Next window', 'window.prev': 'Previous window', 'app.quit': 'Quit app (close all its windows)',
  'desktop.show': 'Show desktop or restore windows', 'window.new': 'New window (Terminal)', 'os.settings': 'Open Settings',
  'focus.menuBar': 'Focus menu bar', 'focus.desktop': 'Focus desktop props', 'focus.dock': 'Focus launcher',
  'focus.window': 'Focus top window', 'focus.next': 'Next control (wraps within the window)',
  'focus.prev': 'Previous control (wraps within the window)',
  'os.escape': 'Close an overlay or end keyboard move mode', 'os.contextMenu': 'Context menu for the focused item',
};

export function shortcutRows(platform: ShortcutPlatform) {
  return GLOBAL_SHORTCUTS.map(entry => ({
    ...entry, keys: formatShortcut(entry.shortcut, platform), action: actions[entry.command] ?? entry.command,
  }));
}
