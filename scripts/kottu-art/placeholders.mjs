import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { catalogue, masterBox, masterPath, loadProvenance, provenancePath, writeJson, sha256, idsSource, root } from './lib.mjs';

const provenance = loadProvenance();
for (const asset of catalogue.assets) {
  if (provenance.some((entry) => entry.id === asset.id && !entry.placeholder)) continue;
  const [width, height] = masterBox(asset);
  const long = Math.max(width, height), short = Math.min(width, height);
  const inset = short * 0.12;
  const shape = asset.family === 'prop'
    ? `<rect x="${inset}" y="${inset}" width="${width - 2 * inset}" height="${height - 2 * inset}" rx="${short * 0.15}" />`
    : `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.35}" ry="${height * 0.35}" />`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="${asset.colours[0]}" stroke="#1B1530" stroke-width="${short * 0.12}">${shape}</g><g fill="${asset.colours[0]}" stroke="#FFFFFF" stroke-width="${short * 0.10}">${shape}</g><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1B1530" font-family="sans-serif" font-weight="600" font-size="${Math.min(long * 0.08, width / asset.id.length * 1.5)}">${asset.id}</text></svg>`;
  const data = await sharp(Buffer.from(svg)).ensureAlpha().png({ compressionLevel: 9, effort: 10, palette: false }).toBuffer();
  const target = masterPath(asset);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  const entry = { id: asset.id, family: asset.family, sha256OfMaster: sha256(data), sourceFile: null,
    model: null, batch: null, generatedAt: null, prompt: `${catalogue.families[asset.family].lockName}: ${asset.subject}`,
    quality: { avif: 50, webp: 78 }, approved: false, placeholder: true };
  const index = provenance.findIndex((entry) => entry.id === asset.id);
  if (index < 0) provenance.push(entry); else provenance[index] = entry;
}
writeJson(provenancePath, catalogue.assets.map((asset) => provenance.find((entry) => entry.id === asset.id)));
writeFileSync(resolve(root, 'src/assets/kottu/ids.ts'), idsSource());
console.log(`36 master paths ready; ${provenance.filter((entry) => entry.placeholder).length} placeholders`);
