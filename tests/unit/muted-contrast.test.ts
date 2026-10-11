import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
const colours = (token: string) => [...new Set([...css.matchAll(new RegExp(`${token}: (#[\\da-f]{6})`, 'gi'))].map(match => match[1]!.toUpperCase()))];
function luminance(hex: string) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0);
}
it('keeps secondary and tertiary text above 4.5:1 on every opaque OS surface in both themes', () => {
  for (const token of ['--os-ink-2', '--os-ink-3']) for (const [theme, ink] of colours(token).entries()) {
    for (const surface of ['--os-window', '--os-titlebar', '--os-sidebar', '--os-raised', '--os-sunken']) {
      const background = colours(surface)[theme]!;
      const values = [luminance(ink), luminance(background)].sort((a, b) => a - b);
      expect((values[1]! + .05) / (values[0]! + .05), `${token} on ${surface}, theme ${theme}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
