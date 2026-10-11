import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const assets = join(root, 'src/assets/wallpapers');

describe('wallpaper assets', () => {
  it('reproduces the committed geography and all fourteen contour levels byte for byte', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'serendib-contours-'));
    try {
      for (const directory of ['first', 'second']) {
        execFileSync(process.execPath, ['scripts/build-contours.mjs', '--out-dir', join(temporary, directory)], { cwd: root });
      }
      for (const name of ['island-mask.svg', 'island-outline.svg', 'contours.svg']) {
        const first = readFileSync(join(temporary, 'first', name));
        expect(first.equals(readFileSync(join(temporary, 'second', name))), name).toBe(true);
        expect(first.equals(readFileSync(join(assets, name))), `${name} must be regenerated`).toBe(true);
      }
      const contours = readFileSync(join(temporary, 'first/contours.svg'), 'utf8');
      expect([...contours.matchAll(/data-level="(\d+)"/g)].map((match) => Number(match[1])))
        .toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
      expect(contours).not.toMatch(/\b(?:NaN|Infinity)\b|\sd=""/);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it.each([
    ['skyline.svg', 2 * 1024], ['island-mask.svg', 1024],
    ['island-outline.svg', 1024], ['contours.svg', 40 * 1024],
  ] as const)('%s respects its raw byte budget and remains vector-only', (name, bytes) => {
    const svg = readFileSync(join(assets, name), 'utf8');
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(bytes);
    expect(svg).not.toMatch(/<(?:image|script|foreignObject)\b|(?:href|src)="https?:/i);
  });
});
