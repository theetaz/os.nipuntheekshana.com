import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const assets = join(root, 'src/assets/wallpapers');

describe('wallpaper assets', () => {

  it.each([
    ['skyline.svg', 2 * 1024], ['island-mask.svg', 1024],
    ['island-outline.svg', 1024],
  ] as const)('%s respects its raw byte budget and remains vector-only', (name, bytes) => {
    const svg = readFileSync(join(assets, name), 'utf8');
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(bytes);
    expect(svg).not.toMatch(/<(?:image|script|foreignObject)\b|(?:href|src)="https?:/i);
  });
});

describe('Kottu wallpaper contract', () => {
  it('shares four wallpaper classes with Settings and retires the contour import', () => {
    const css = readFileSync(join(root, 'src/styles/wallpapers.css'), 'utf8');
    for (const id of ['kottu', 'galle-face', 'pettah', 'paper']) expect(css).toContain(`data-preview="${id}"`);
    expect(css).not.toMatch(/contours|monsoon|island-live|position: fixed/);
    expect(readFileSync(join(root, 'src/components/static/Wallpaper.astro'), 'utf8')).not.toMatch(/island-mask|contours|rain/);
  });
});
