import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { catalogue, artifactDir, masterPath, loadProvenance } from './lib.mjs';

const columns = 6, tileWidth = 300, tileHeight = 300;
const width = columns * tileWidth, height = Math.ceil(catalogue.assets.length / columns) * tileHeight;
const provenance = loadProvenance();
mkdirSync(artifactDir, { recursive: true });
for (const theme of ['light', 'dark']) {
  const layers = [];
  for (let index = 0; index < catalogue.assets.length; index++) {
    const asset = catalogue.assets[index], entry = provenance.find((entry) => entry.id === asset.id);
    const x = (index % columns) * tileWidth, y = Math.floor(index / columns) * tileHeight;
    const background = theme === 'dark' ? '#1B1530' : index % 2 ? '#FFF7E8' : '#0FA3A3';
    const colour = theme === 'dark' ? '#FFF7E8' : '#1B1530';
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}"><rect width="100%" height="100%" fill="${background}"/><text x="150" y="265" fill="${colour}" font-family="sans-serif" font-weight="600" font-size="16" text-anchor="middle">${asset.id}</text><text x="150" y="287" fill="${colour}" font-family="sans-serif" font-size="12" text-anchor="middle">${entry?.placeholder ? 'PLACEHOLDER' : entry?.approved ? 'APPROVED' : 'PENDING OWNER REVIEW'}</text></svg>`;
    layers.push({ input: Buffer.from(label), left: x, top: y });
    const image = await sharp(masterPath(asset)).resize({ width: 260, height: 230, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    layers.push({ input: image.data, left: x + Math.floor((tileWidth - image.info.width) / 2), top: y + 10 + Math.floor((230 - image.info.height) / 2) });
  }
  const path = resolve(artifactDir, `contact-${theme}.png`);
  await sharp({ create: { width, height, channels: 4, background: '#FFF7E8' } }).composite(layers).png().toFile(path);
  console.log(path);
}
