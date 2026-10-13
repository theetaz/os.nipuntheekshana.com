import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDirectory = new URL('../public/', import.meta.url);
// Read the pure geometry constants without requiring a TypeScript runtime.
const geometry = await readFile(new URL('../src/os/icons/brand-glyph.ts', import.meta.url), 'utf8');
const path = geometry.match(/export const BRAND_BLADE_PATH = '([^']+)';/)?.[1];
const viewBox = geometry.match(/export const BRAND_VIEWBOX = '([^']+)';/)?.[1];
if (!path || !viewBox) throw new Error('Missing brand geometry constants.');

const glyph = `<rect x="1" y="1" width="62" height="62" rx="14" fill="#FFC93C" stroke="#1B1530" stroke-width="2"/><g stroke="#1B1530" stroke-width="2"><path d="${path}" transform="rotate(45 32 32)" fill="#FFFDF8"/><path d="${path}" transform="rotate(-45 32 32)" fill="#E8453C"/></g>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${glyph}</svg>\n`;
await writeFile(new URL('favicon.svg', publicDirectory), favicon);

for (const [filename, size, svg] of [
  ['favicon-32.png', 32, favicon],
  ['apple-touch-icon.png', 180, favicon],
  ['icon-192.png', 192, favicon],
  ['icon-512.png', 512, favicon],
]) {
  // Rasterise at twice the output resolution before downsampling; this also
  // avoids upscaling the 512 px icon. The encoder adds no timestamp metadata.
  await sharp(Buffer.from(svg), { density: size * 72 / 32 }).resize(size, size)
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toFile(fileURLToPath(new URL(filename, publicDirectory)));
  console.log(`${filename}: ${size} × ${size}`);
}
console.log('favicon.svg: crossed kottu blades');
