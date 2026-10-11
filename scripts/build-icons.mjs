import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDirectory = new URL('../public/', import.meta.url);
// Read the pure geometry constants without requiring a TypeScript runtime.
const geometry = await readFile(new URL('../src/os/icons/island-glyph.ts', import.meta.url), 'utf8');
const path = geometry.match(/export const ISLAND_PATH = '([^']+)';/)?.[1];
const viewBox = geometry.match(/export const ISLAND_VIEWBOX = '([^']+)';/)?.[1];
if (!path || !viewBox) throw new Error('Missing island geometry constants.');

const glyph = `<svg x="17.18" y="6" width="29.64" height="52" viewBox="${viewBox}"><path d="${path}"/></svg>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>:root{fill:#E8722A}@media(prefers-color-scheme:dark){:root{fill:#FF9A4D}}</style>${glyph}</svg>\n`;
await writeFile(new URL('favicon.svg', publicDirectory), favicon);

const transparent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="#E8722A">${glyph}</svg>`;
const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="#F3EFE8"><rect width="64" height="64" rx="14.4" fill="#1C1A17"/>${glyph}</svg>`;
for (const [filename, size, svg] of [
  ['favicon-32.png', 32, transparent],
  ['apple-touch-icon.png', 180, touch],
  ['icon-192.png', 192, touch],
  ['icon-512.png', 512, touch],
]) {
  // Rasterise at twice the output resolution before downsampling; this also
  // avoids upscaling the 512 px icon. The encoder adds no timestamp metadata.
  await sharp(Buffer.from(svg), { density: size * 72 / 32 }).resize(size, size)
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toFile(fileURLToPath(new URL(filename, publicDirectory)));
  console.log(`${filename}: ${size} × ${size}`);
}
console.log('favicon.svg: light/dark island glyph');
