import { describe, expect, it } from 'vitest';
import { allowsShortcuts, formatShortcut, GLOBAL_SHORTCUTS, isEditable, matchGlobalShortcut, matchShortcut } from '../../src/os/lib/hotkeys-match';
import type { ShortcutEvent, ShortcutPlatform } from '../../src/os/lib/hotkeys-match';
import type { Shortcut } from '../../src/os/types/apps';

function el(tagName: string, attributes: Record<string, string> = {}, parentElement?: ReturnType<typeof element>) {
  return element(tagName, attributes, parentElement);
}
function element(tagName: string, attributes: Record<string, string>, parentElement?: unknown): {
  tagName: string; getAttribute(name: string): string | null; parentElement: unknown;
} {
  return { tagName, getAttribute: (name: string) => attributes[name] ?? null, parentElement: parentElement ?? null };
}
const altW = { code: 'KeyW', alt: true };
const platform = { platform: 'mac' as const };

describe('editable targets and shortcut opt-in', () => {
  it.each(['INPUT', 'TEXTAREA', 'SELECT', 'input'])('%s is editable', (tag) => { expect(isEditable(el(tag))).toBe(true); });
  it.each(['DIV', 'BUTTON', 'A', 'SPAN'])('%s is not editable', (tag) => { expect(isEditable(el(tag))).toBe(false); });
  it.each([null, undefined, 'text', 123, {}, { tagName: 'SVG' }])('handles a non-element target %j', (target) => {
    expect(isEditable(target)).toBe(false);
  });
  it.each(['', 'true', 'plaintext-only'])('recognizes contenteditable=%j and nested children', (value) => {
    const parent = el('DIV', { contenteditable: value });
    expect(isEditable(parent)).toBe(true);
    expect(isEditable(el('SPAN', {}, parent))).toBe(true);
  });
  it('supports native inherited contenteditable and explicit false islands', () => {
    expect(isEditable({ tagName: 'SPAN', isContentEditable: true })).toBe(true);
    const parent = el('DIV', { contenteditable: 'true' });
    expect(isEditable(el('SPAN', { contenteditable: 'false' }, parent))).toBe(false);
  });
  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('blocks Option W in %s', (tag) => {
    expect(matchShortcut({ code: 'KeyW', altKey: true, target: el(tag) }, altW, platform)).toBe(false);
  });
  it('allows opted-in fields and descendants, while / still requires no typing', () => {
    const input = el('INPUT', { 'data-os-shortcuts': 'allow' });
    expect(isEditable(input)).toBe(true);
    expect(matchShortcut({ code: 'KeyW', altKey: true, target: input }, altW, platform)).toBe(true);
    const parent = el('DIV', { contenteditable: 'true', 'data-os-shortcuts': 'allow' });
    expect(matchShortcut({ code: 'KeyW', altKey: true, target: el('SPAN', {}, parent) }, altW, platform)).toBe(true);
    expect(matchShortcut({ code: 'Slash', target: input }, { code: 'Slash' }, platform)).toBe(false);
  });
  it.each([false, true])('window cycling with Shift=%s works inside text inputs', (shift) => {
    expect(matchShortcut({ code: 'Backquote', altKey: true, shiftKey: shift, target: el('INPUT') },
      { code: 'Backquote', alt: true, shift }, platform)).toBe(true);
  });
  it('allows Spotlight mod+K while editing, but / only on non-editable targets', () => {
    expect(matchShortcut({ code: 'KeyK', metaKey: true, target: el('INPUT') }, { code: 'KeyK', mod: true }, platform)).toBe(true);
    expect(matchShortcut({ code: 'Slash', target: el('BUTTON') }, { code: 'Slash' }, platform)).toBe(true);
    expect(matchShortcut({ code: 'Slash', target: el('TEXTAREA') }, { code: 'Slash' }, platform)).toBe(false);
  });
});

describe('physical key and exact modifier matching', () => {
  const platforms: ShortcutPlatform[] = ['mac', 'windows', 'linux', 'other'];
  it.each(platforms)('matches all modifier combinations exactly on %s', (platform) => {
    for (let bits = 0; bits < 16; bits++) {
      const event: ShortcutEvent = { code: 'KeyW', altKey: !!(bits & 1), shiftKey: !!(bits & 2),
        metaKey: !!(bits & 4), ctrlKey: !!(bits & 8) };
      expect(matchShortcut(event, altW, { platform }), `modifier bits ${bits}`).toBe(bits === 1);
      const expectedMod = platform === 'mac' ? 4 : 8;
      expect(matchShortcut({ ...event, code: 'KeyK' }, { code: 'KeyK', mod: true }, { platform })).toBe(bits === expectedMod);
    }
  });
  it('uses code even when the key is an Option dead key or a different layout', () => {
    const event = { code: 'KeyW', key: '∑', altKey: true };
    expect(matchShortcut(event, altW, platform)).toBe(true);
    const otherLayout = { ...event, code: 'KeyZ', key: 'w' };
    expect(matchShortcut(otherLayout, altW, platform)).toBe(false);
  });
  it('distinguishes forward and reverse cycling', () => {
    const event = { code: 'Backquote', altKey: true, shiftKey: true };
    expect(matchShortcut(event, { code: 'Backquote', alt: true }, platform)).toBe(false);
    expect(matchShortcut(event, { code: 'Backquote', alt: true, shift: true }, platform)).toBe(true);
  });
  it.each(['defaultPrevented', 'isComposing'] as const)('ignores %s events', (flag) => {
    expect(matchShortcut({ code: 'KeyW', altKey: true, [flag]: true }, altW, platform)).toBe(false);
  });
  it('supports absent modifier fields as false', () => {
    expect(matchShortcut({ code: 'Escape' }, { code: 'Escape' }, platform)).toBe(true);
  });
});

describe('readable shortcut formatting', () => {
  const cases: [Shortcut, string, string][] = [
    [altW, '⌥W', 'Alt+W'], [{ code: 'KeyK', mod: true }, '⌘K', 'Ctrl+K'],
    [{ code: 'Backquote', alt: true }, '⌥`', 'Alt+`'], [{ code: 'Backquote', alt: true, shift: true }, '⌥⇧`', 'Alt+Shift+`'],
    [{ code: 'BracketLeft', alt: true }, '⌥[', 'Alt+['], [{ code: 'BracketRight', alt: true }, '⌥]', 'Alt+]'],
    [{ code: 'Comma', alt: true }, '⌥,', 'Alt+,'], [{ code: 'Digit1', alt: true }, '⌥1', 'Alt+1'],
    [{ code: 'Tab', shift: true }, '⇧⇥', 'Shift+Tab'], [{ code: 'Slash' }, '/', '/'],
    [{ code: 'F10', shift: true }, '⇧F10', 'Shift+F10'], [{ code: 'ContextMenu' }, 'Menu', 'Menu'],
    [{ code: 'Escape' }, 'Esc', 'Esc'], [{ code: 'ArrowLeft' }, '←', '←'],
    [{ code: 'Enter' }, '↩', 'Enter'], [{ code: 'Space' }, 'Space', 'Space'],
  ];
  it.each(cases)('formats $code for Mac and other platforms', (shortcut, mac, other) => {
    expect(formatShortcut(shortcut, 'mac')).toBe(mac);
    for (const platform of ['windows', 'linux', 'other'] as const) expect(formatShortcut(shortcut, platform)).toBe(other);
  });
});

describe('global shortcut data', () => {
  it('global dispatch honors ordinary editing, cycling and opted-in fields', () => {
    const target = el('INPUT');
    expect(matchGlobalShortcut({ code: 'KeyW', altKey: true, target }, platform)).toBeNull();
    expect(matchGlobalShortcut({ code: 'Backquote', altKey: true, target }, platform)?.command).toBe('window.next');
    expect(matchGlobalShortcut({ code: 'KeyK', metaKey: true, target }, platform)?.command).toBe('os.spotlight');
    expect(matchGlobalShortcut({ code: 'KeyW', altKey: true, target: el('INPUT', { 'data-os-shortcuts': 'allow' }) }, platform)?.command).toBe('window.close');
    expect(matchGlobalShortcut({ code: 'Slash', target: el('INPUT', { 'data-os-shortcuts': 'allow' }) }, platform)).toBeNull();
    expect(matchGlobalShortcut({ code: 'KeyX' }, platform)).toBeNull();
    expect(allowsShortcuts(target)).toBe(false);
    expect(allowsShortcuts(el('SPAN', {}, el('DIV', { 'data-os-shortcuts': 'allow' })))).toBe(true);
  });
  it('contains every global command in the keyboard map with no duplicate chord', () => {
    expect(GLOBAL_SHORTCUTS.map(({ command }) => command)).toEqual([
      'os.spotlight', 'os.spotlight', 'os.spotlight', 'window.close', 'window.minimize', 'window.zoom', 'window.snapLeft', 'window.snapRight',
      'window.next', 'window.prev', 'app.quit', 'desktop.show', 'window.new', 'os.settings',
      'focus.menuBar', 'focus.desktop', 'focus.dock', 'focus.window', 'focus.next', 'focus.prev',
      'os.escape', 'os.contextMenu', 'os.contextMenu',
    ]);
    const chords = GLOBAL_SHORTCUTS.map(({ shortcut }) => formatShortcut(shortcut, 'mac'));
    expect(new Set(chords).size).toBe(GLOBAL_SHORTCUTS.length);
  });
  it.each(GLOBAL_SHORTCUTS)('matches the physical chord for $command', ({ shortcut }) => {
    for (const platform of ['mac', 'windows'] as const) {
      const event = { code: shortcut.code, altKey: shortcut.alt, shiftKey: shortcut.shift,
        metaKey: platform === 'mac' && shortcut.mod, ctrlKey: platform !== 'mac' && shortcut.mod };
      expect(matchShortcut(event, shortcut, { platform })).toBe(true);
    }
  });
  it('only permits cycling among Option shortcuts in ordinary editable fields', () => {
    expect(GLOBAL_SHORTCUTS.filter(({ shortcut, allowInEditable }) => shortcut.alt && allowInEditable)
      .map(({ command }) => command)).toEqual(['window.next', 'window.prev']);
    expect(GLOBAL_SHORTCUTS.find(({ shortcut }) => shortcut.code === 'Slash')?.allowInEditable).toBe(false);
    expect(GLOBAL_SHORTCUTS.filter(({ shortcut }) => shortcut.code === 'Escape').every(({ command }) => command !== 'window.close')).toBe(true);
    expect(GLOBAL_SHORTCUTS.filter(({ shortcut }) => /^Digit/.test(shortcut.code)).map(({ shortcut }) => shortcut.code))
      .toEqual(['Digit1', 'Digit2', 'Digit3', 'Digit4']);
  });
});
