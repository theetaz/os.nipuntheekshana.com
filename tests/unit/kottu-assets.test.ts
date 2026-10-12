import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import catalogue from '../../scripts/kottu-art/assets.json';
import { root, idsSource, batchPrompt, borderFraction } from '../../scripts/kottu-art/lib.mjs';
import { keyBackground, processImage } from '../../scripts/kottu-art/process.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const expected = {
  prop: ['tuktuk', 'thinkpad', 'lotus-tower', 'cricket-bat', 'thambili', 'tea', 'radio', 'lantern', 'ola', 'crbook', 'postbox'],
  sticker: ['lanka-data-layer', 'lanka-price-lens', 'salli', 'agentmeter', 'colombo-atlas', 'geopop', 'vidura', 'mochi', 'gridpulse', 'opentreasury', 'colombo-delivery', 'attendly', 'terrarun', 'goyama', 'mansariya', 'ceylon-hub', 'mendlog', 'open-pay', 'pin-the-city', 'kottu'],
  badge: ['lotus-tower', 'pin', 'chip', 'gamepad', 'tea'],
};

describe('Kottu art catalogue and masters', () => {
  it('contains exactly the 36 specified ids and complete family metadata', () => {
    expect(catalogue.assets.map((asset) => asset.id).sort()).toEqual(Object.entries(expected).flatMap(([family, ids]) => ids.map((id) => `${family}-${id}`)).sort());
    for (const asset of catalogue.assets) {
      expect(asset.subject.length).toBeGreaterThan(20);
      expect(asset.colours[0]).toMatch(/^#[0-9A-F]{6}$/);
      expect(asset.W).toBeGreaterThan(0);
      expect(asset.maxH).toBeGreaterThan(0);
    }
  });
  it('keeps generated id unions in sync', () => {
    expect(readFileSync(resolve(root, 'src/assets/kottu/ids.ts'), 'utf8')).toBe(idsSource());
  });
  it('has valid master dimensions, alpha, provenance, borders and caps', () => {
    expect(execFileSync(process.execPath, ['scripts/kottu-art/process.mjs', '--check'], { cwd: root, encoding: 'utf8', timeout: 120000 })).toContain('36/36 masters pass');
  }, 120000);
  it('retains the full style lock and seven numbered sticker items in dry runs', () => {
    const assets = catalogue.assets.filter((asset) => asset.family === 'sticker').slice(0, 7);
    const prompt = batchPrompt(assets);
    expect(prompt).toContain(catalogue.families.sticker.lock);
    expect(prompt.match(/^\d+\. File/gm)).toHaveLength(7);
    expect(prompt).toContain('Match the style of the earlier images in this batch.');
  });
  it('preserves disconnected magenta inside the die-cut silhouette and defringes the edge', () => {
    const size = 9, data = Buffer.alloc(size * size * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 2] = 255; data[i + 3] = 255; }
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) {
      const i = (y * size + x) * 4; data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
    }
    const centre = (4 * size + 4) * 4;
    data[centre + 1] = 0;
    const edge = (1 * size + 4) * 4; data[edge + 1] = 72;
    keyBackground(data, size, size);
    expect(data[3]).toBe(0);
    expect(data[centre + 3]).toBe(255);
    expect(data[edge + 3]).toBeGreaterThan(0);
    expect(data[edge + 3]).toBeLessThan(255);
    expect(data[edge + 1]).toBeGreaterThan(72);
  });
  it('rejects a coloured outline and accepts white or ink-dark edges', () => {
    const data = Buffer.from([0,0,0,0, 255,255,255,255, 0,0,0,0]);
    expect(borderFraction(data, 3, 1)).toBe(1);
    data[4] = 255; data[5] = 0; data[6] = 0;
    expect(borderFraction(data, 3, 1)).toBe(0);
  });
  it('processes an opaque keyed source without enlarging or leaving magenta fringes', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'kottu-key-test-'));
    try {
      const path = resolve(directory, 'key.png');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#FF00FF"/><rect x="24" y="24" width="112" height="112" fill="#1B1530"/><rect x="26" y="26" width="108" height="108" fill="#FFF"/><rect x="38" y="38" width="84" height="84" fill="#FFC93C"/></svg>';
      await sharp(Buffer.from(svg)).flatten({ background: '#FF00FF' }).png().toFile(path);
      const result = await processImage(path, catalogue.assets.find((asset) => asset.id === 'badge-pin'));
      expect(result.keyed).toBe(true);
      expect(result.width).toBeLessThanOrEqual(112);
      expect(result.finalBorder).toBeGreaterThanOrEqual(0.85);
      const meta = await sharp(result.master).metadata();
      expect(meta.hasAlpha).toBe(true);
      expect(result.variants.every((v: { bytes: number; cap: number }) => v.bytes <= v.cap)).toBe(true);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
