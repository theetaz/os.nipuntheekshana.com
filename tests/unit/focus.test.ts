import { describe, expect, it } from 'vitest';
import { nextFocusIndex } from '../../src/os/lib/focus';
import { isMac, modifierLabel } from '../../src/os/lib/platform';
describe('pure focus helpers', () => {
  it('wraps roving focus in both directions and handles empty lists', () => {
    expect(nextFocusIndex(2, 1, 3)).toBe(0);
    expect(nextFocusIndex(0, -1, 3)).toBe(2);
    expect(nextFocusIndex(-1, 1, 3)).toBe(0);
    expect(nextFocusIndex(-1, -1, 3)).toBe(2);
    expect(nextFocusIndex(1, 1, 3)).toBe(2);
    expect(nextFocusIndex(0, 1, 0)).toBe(-1);
  });
  it('formats platform modifiers without requiring a browser', () => {
    expect(isMac('MacIntel')).toBe(true); expect(isMac('iPad')).toBe(true);
    expect(isMac('Linux x86_64')).toBe(false);
    expect(modifierLabel('MacIntel')).toBe('⌘'); expect(modifierLabel('Win32')).toBe('Ctrl');
  });
});
