import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing ${selector} token block`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(match => [match[1]!, match[2]!]));
}
const light = tokens(':root'); const dark = { ...light, ...tokens('[data-theme="dark"]') };
function luminance(hex: string) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0);
}
function contrast(ink: string, background: string) {
  expect(ink).toMatch(/^#[\da-f]{6}$/i); expect(background).toMatch(/^#[\da-f]{6}$/i);
  const values = [luminance(ink), luminance(background)].sort((a, b) => a - b);
  return (values[1]! + .05) / (values[0]! + .05);
}
describe('Kottu contrast by semantic token name', () => {
  for (const [theme, values] of Object.entries({ light, dark })) for (const ink of ['--os-ink-2', '--os-ink-3']) {
    it.each(['--os-window', '--os-titlebar', '--os-sidebar', '--os-raised', '--os-sunken'])(`${theme} ${ink} on %s is normal-text safe`, surface => {
      expect(contrast(values[ink]!, values[surface]!)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it.each(['yellow', 'orange', 'pink', 'green', 'teal', 'red-surface'])('ink on %s is safe', hue => {
    expect(contrast(light['--k-ink']!, light[`--k-${hue}`]!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['--k-cream', '--k-paper', '--k-sunken'])('all neutral text on %s is safe', surface => {
    for (const ink of ['--os-ink', '--os-ink-2', '--os-ink-3']) expect(contrast(light[ink]!, light[surface]!)).toBeGreaterThanOrEqual(4.5);
  });
  it('cream, yellow and dark tertiary ink are safe on the ink sections', () => {
    for (const ink of [dark['--os-ink']!, light['--k-yellow']!, dark['--os-ink-3']!]) expect(contrast(ink, light['--k-ink']!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['ink', 'dim', 'user', 'host', 'path', 'err', 'ok', 'link', 'caret'])('terminal %s stays legible', name => {
    expect(contrast(light[`--term-${name}`]!, light['--term-bg']!)).toBeGreaterThanOrEqual(4.5);
  });
  it('dark window text and every accent ink are safe', () => {
    for (const ink of ['--os-ink', '--os-ink-3', ...['yellow', 'red', 'teal', 'pink', 'orange', 'green'].map(hue => `--k-${hue}-ink`)]) {
      expect(contrast(dark[ink]!, dark['--os-window']!)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('dark raised surface supports both muted inks and danger', () => {
    for (const ink of ['--os-ink-2', '--os-ink-3', '--os-danger']) expect(contrast(dark[ink]!, dark['--os-raised']!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FF6B5F', dark['--os-raised']!)).toBeLessThan(4.5);
  });
  it.each(['#FFE27A', '#FFB27A', '#8ADBD8', '#FFB3D4', '#9BE3B4'])('note %s keeps body and metadata legible', paper => {
    for (const ink of ['--os-ink', '--os-ink-2']) expect(contrast(light[ink]!, paper)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['orange', 'teal', 'pink', 'green', 'yellow'])('light %s accent ink on paper is safe', hue => {
    expect(contrast(light[`--k-${hue}-ink`]!, light[hue === 'yellow' ? '--k-cream' : '--k-paper']!)).toBeGreaterThanOrEqual(4.5);
  });
  it('focus and window-button glyphs meet the non-text boundary threshold', () => {
    for (const fill of ['--k-yellow', '--k-teal', '--k-red']) expect(contrast(light['--k-wb-glyph']!, light[fill]!)).toBeGreaterThanOrEqual(3);
    expect(contrast(light['--os-focus']!, light['--k-yellow']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(dark['--os-focus']!, dark['--os-window']!)).toBeGreaterThanOrEqual(3);
    expect(contrast(light['--k-ink']!, light['--k-red']!)).toBeLessThan(4.5);
  });
});
