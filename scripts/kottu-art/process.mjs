import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { catalogue, parseFlags, selectedAssets, externalWork, candidatesUnder, loadProvenance, provenancePath,
  masterPath, masterBox, sha256, writeJson, artifactDir, alphaFraction, borderFraction, variantSizes, familyTotals } from './lib.mjs';

export function keyBackground(data, width, height) {
  const count = width * height, labels = new Int8Array(count).fill(-1), queue = new Int32Array(count);
  const corners = [0, width - 1, (height - 1) * width, count - 1];
  const keys = corners.map((p) => [...data.subarray(p * 4, p * 4 + 3)]);
  const distance = (p, key) => Math.hypot(...key.map((c, channel) => data[p * 4 + channel] - c));
  const neighbours = (p) => [p % width ? p - 1 : -1, p % width < width - 1 ? p + 1 : -1, p >= width ? p - width : -1, p < count - width ? p + width : -1];
  let head = 0, tail = 0;
  corners.forEach((p, k) => { if (labels[p] < 0) { labels[p] = k; queue[tail++] = p; } });
  while (head < tail) {
    const p = queue[head++], keyIndex = labels[p];
    for (const n of neighbours(p)) if (n >= 0 && labels[n] < 0 && distance(n, keys[keyIndex]) <= 48) {
      labels[n] = keyIndex; queue[tail++] = n;
    }
  }
  const feather = new Map();
  for (let p = 0; p < count; p++) if (labels[p] >= 0) {
    for (const n of neighbours(p)) if (n >= 0 && labels[n] < 0) {
      const key = keys[labels[p]], d = distance(n, key);
      if (d <= 96 && (!feather.has(n) || d < feather.get(n).d)) feather.set(n, { key, d });
    }
  }
  for (let p = 0; p < count; p++) if (labels[p] >= 0) data[p * 4 + 3] = 0;
  for (const [p, { key, d }] of feather) {
    const a = Math.max(0, Math.min(1, (d - 48) / 48));
    data[p * 4 + 3] = Math.round(a * 255);
    if (a > 0) for (let channel = 0; channel < 3; channel++) data[p * 4 + channel] = Math.round(Math.max(0, Math.min(255, (data[p * 4 + channel] - (1 - a) * key[channel]) / a)));
  }
  return data;
}
export function defringeAlpha(data, width, height) {
  const count = width * height, radius = 4;
  const distance = new Uint8Array(count).fill(255), nearest = new Int32Array(count), queue = new Int32Array(count);
  let head = 0, tail = 0, removed = 0, repaired = 0;
  // Nearly invisible RGB is unstable after unpremultiplication. Remove alpha noise,
  // then borrow only a nearby solid white/ink border colour, keeping edge coverage.
  for (let p = 0; p < count; p++) {
    const alpha = data[p * 4 + 3];
    if (alpha <= 8) { if (alpha) removed++; data[p * 4 + 3] = 0; }
    else if (alpha >= 224) { distance[p] = 0; nearest[p] = p; queue[tail++] = p; }
  }
  while (head < tail) {
    const p = queue[head++];
    if (distance[p] >= radius) continue;
    const neighbours = [p % width ? p - 1 : -1, p % width < width - 1 ? p + 1 : -1, p >= width ? p - width : -1, p < count - width ? p + width : -1];
    for (const n of neighbours) if (n >= 0 && data[n * 4 + 3] > 0 && distance[n] > distance[p] + 1) {
      distance[n] = distance[p] + 1; nearest[n] = nearest[p]; queue[tail++] = n;
    }
  }
  for (let p = 0; p < count; p++) if (data[p * 4 + 3] > 8 && data[p * 4 + 3] < 224 && distance[p] <= radius) {
    const i = nearest[p] * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.min(r, g, b) < 225 && Math.max(r, g, b) > 70) continue;
    data[p * 4] = r; data[p * 4 + 1] = g; data[p * 4 + 2] = b; repaired++;
  }
  return { radius, removed, repaired };
}
export async function processImage(source, asset) {
  const original = await sharp(source).metadata();
  const { data, info } = await sharp(source).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = !original.hasAlpha || alphaFraction(data) < 0.01;
  if (keyed) keyBackground(data, info.width, info.height);
  if (alphaFraction(data) < 0.01) throw new Error('Alpha check failed: less than 1% fully transparent pixels');
  const sourceDefringe = defringeAlpha(data, info.width, info.height);
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 8) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error('No visible artwork');
  // A silhouette touching the original canvas is clipped, even if other corners key out.
  if (!left || !top || right === info.width - 1 || bottom === info.height - 1) throw new Error('Artwork touches the canvas edge');
  const crop = await sharp(data, { raw: info }).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).raw().toBuffer({ resolveWithObject: true });
  const border = borderFraction(crop.data, crop.info.width, crop.info.height);
  if (border < 0.85) throw new Error(`Border check failed: ${(border * 100).toFixed(1)}% (needs 85%)`);
  const padding = Math.ceil(Math.max(crop.info.width, crop.info.height) * 0.04);
  const [width, height] = masterBox(asset);
  // Materialise padding before resizing: Sharp otherwise runs resize before extend.
  const padded = await sharp(crop.data, { raw: crop.info }).extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const final = await sharp(padded).resize({ width, height, fit: 'inside', kernel: 'lanczos3', withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Lanczos can introduce the same faint RGB fringe, so clean the stored master too.
  const masterDefringe = defringeAlpha(final.data, final.info.width, final.info.height);
  const finalBorder = borderFraction(final.data, final.info.width, final.info.height);
  if (finalBorder < 0.85) throw new Error(`Resized border check failed: ${(finalBorder * 100).toFixed(1)}%`);
  const master = await sharp(final.data, { raw: final.info }).png({ compressionLevel: 9, effort: 10, palette: false }).toBuffer();
  const quality = { avif: 50, webp: 78 };
  let variants;
  for (;;) {
    variants = await variantSizes(master, asset, quality);
    const failures = ['avif', 'webp'].filter((format) => variants.some((v) => v.format === format && Math.max(v.bytes, v.astroBytes) > v.cap));
    if (!failures.length) break;
    for (const format of failures) {
      const floor = format === 'avif' ? 40 : 68;
      if (quality[format] <= floor) throw new Error(`Variant cap failed at ${format} quality ${floor}`);
      quality[format] -= 5;
    }
  }
  return { master, quality, variants, keyed, border, finalBorder, sourceDefringe, masterDefringe, width: final.info.width, height: final.info.height };
}
export async function checkMasters(assets = catalogue.assets, provenance = loadProvenance()) {
  const rows = [], failures = [];
  if (provenance.length !== catalogue.assets.length || new Set(provenance.map((e) => e.id)).size !== catalogue.assets.length
    || provenance.some((entry) => !catalogue.assets.some((asset) => asset.id === entry.id))) failures.push({ id: 'provenance', error: 'Expected exactly one entry per catalogue id' });
  for (const asset of assets) try {
    const entry = provenance.find((entry) => entry.id === asset.id);
    if (!entry || entry.family !== asset.family) throw new Error('Missing or mismatched provenance');
    const file = masterPath(asset), master = readFileSync(file), meta = await sharp(master).metadata();
    const [width, height] = masterBox(asset);
    if (!meta.hasAlpha || meta.width > width || meta.height > height || meta.depth !== 'uchar') throw new Error('Master must be RGBA 8-bit inside its box');
    if (sha256(master) !== entry.sha256OfMaster) throw new Error('Master hash differs from provenance');
    const raw = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (alphaFraction(raw.data) < 0.01) throw new Error('Master lacks transparent background');
    const border = borderFraction(raw.data, raw.info.width, raw.info.height);
    if (border < 0.85) throw new Error(`Master border failed: ${(border * 100).toFixed(1)}%`);
    if (process.env.KOTTU_ART_FINAL === '1' && (entry.placeholder || !entry.approved)) throw new Error('Final artwork must be approved and not a placeholder');
    if (![40,45,50].includes(entry.quality?.avif) || ![68,73,78].includes(entry.quality?.webp)) throw new Error('Invalid encoder quality');
    const variants = entry.placeholder ? [] : await variantSizes(master, asset, entry.quality);
    if (variants.some((v) => Math.max(v.bytes, v.astroBytes) > v.cap)) throw new Error('Variant exceeds cap');
    rows.push({ id: asset.id, family: asset.family, placeholder: Boolean(entry.placeholder), approved: entry.approved,
      width: meta.width, height: meta.height, masterBytes: master.length, border, quality: entry.quality, variants });
  } catch (error) { failures.push({ id: asset.id, error: error.message }); }
  const totals = familyTotals(rows);
  if (assets.length === 36 && !rows.some((row) => row.placeholder)) {
    if (totals.prop > 170000) failures.push({ id: 'prop-total', error: `${totals.prop} B exceeds 170000 B` });
    if (totals.sticker > 160000) failures.push({ id: 'sticker-total', error: `${totals.sticker} B exceeds 160000 B` });
  }
  return { rows, failures, totals };
}
export async function processSources(work, assets) {
  const sources = await candidatesUnder(work, assets), provenance = loadProvenance(), failures = [], rows = [];
  for (const asset of assets) {
    if (provenance.some((entry) => entry.id === asset.id && entry.approved)) continue;
    const source = sources.find((file) => basename(file) === `${asset.id}.png`);
    if (!source) { failures.push({ id: asset.id, error: 'No generated PNG found' }); continue; }
    try {
      const result = await processImage(source, asset);
      const metadataPath = resolve(dirname(source), 'batch.json');
      const metadata = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, 'utf8')) : {};
      const entry = { id: asset.id, family: asset.family, sha256OfMaster: sha256(result.master), sourceFile: source,
        model: metadata.model ?? 'unknown', batch: basename(dirname(source)), generatedAt: metadata.startedAt ?? new Date().toISOString(),
        prompt: `${catalogue.families[asset.family].lockName}: ${asset.subject}${metadata.correction ? ` Correction for this re-roll: ${metadata.correction}` : ''}`, quality: result.quality,
        processing: { sourceDefringe: result.sourceDefringe, masterDefringe: result.masterDefringe }, approved: false, placeholder: false };
      const target = masterPath(asset);
      mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, result.master);
      const index = provenance.findIndex((entry) => entry.id === asset.id);
      if (index < 0) provenance.push(entry); else provenance[index] = entry;
      rows.push({ id: asset.id, family: asset.family, source, ...result, master: undefined });
      console.log(`${asset.id}: ${result.width}×${result.height}, border ${(result.finalBorder * 100).toFixed(1)}%, AVIF ${result.quality.avif}, WebP ${result.quality.webp}`);
    } catch (error) { failures.push({ id: asset.id, source, error: error.message }); console.error(`${asset.id}: ${error.message}`); }
  }
  writeJson(provenancePath, catalogue.assets.map((asset) => provenance.find((entry) => entry.id === asset.id)).filter(Boolean));
  writeJson(resolve(artifactDir, 'process-report.json'), { rows, failures });
  return { rows, failures };
}
async function main() {
  const flags = parseFlags(process.argv.slice(2), ['from', 'only', 'check']);
  const assets = selectedAssets(flags);
  if (flags.check) {
    const result = await checkMasters(assets);
    for (const failure of result.failures) console.error(`${failure.id}: ${failure.error}`);
    console.log(`${result.rows.length}/${assets.length} masters pass; AVIF totals ${JSON.stringify(result.totals)}`);
    if (result.failures.length) process.exitCode = 2;
  } else {
    if (!flags.from) throw new Error('--from <work root> is required');
    const result = await processSources(await externalWork(flags.from), assets);
    if (result.failures.length) process.exitCode = 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 2; });
}
