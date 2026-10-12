import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { realpath, readdir, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const catalogue = JSON.parse(readFileSync(new URL('./assets.json', import.meta.url), 'utf8'));
export const provenancePath = resolve(root, 'src/assets/kottu/provenance.json');
export const artifactDir = resolve(root, '.astro/kottu-art');
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
export const masterPath = (asset) => resolve(root, 'src/assets/kottu', catalogue.families[asset.family].dir, `${asset.id}.png`);
export const masterBox = (asset) => catalogue.families[asset.family].masterBox ?? [2 * asset.W, 2 * asset.maxH];
export const loadProvenance = () => existsSync(provenancePath) ? JSON.parse(readFileSync(provenancePath, 'utf8')) : [];
export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
export function parseFlags(args, allowed) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !allowed.includes(name)) throw new Error(`Unknown argument: ${args[i]}`);
    if (['check', 'dry-run'].includes(name)) result[name] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for --${name}`);
      result[name] = args[++i];
    }
  }
  return result;
}
export function selectedAssets(flags) {
  if (flags.family && !catalogue.families[flags.family]) throw new Error(`Unknown family: ${flags.family}`);
  const only = flags.only ? new Set(flags.only.split(',').map((id) => id.trim()).filter(Boolean)) : null;
  for (const id of only ?? []) if (!catalogue.assets.some((asset) => asset.id === id)) throw new Error(`Unknown id: ${id}`);
  return catalogue.assets.filter((asset) => (!flags.family || flags.family === asset.family) && (!only || only.has(asset.id)));
}
export function positiveInteger(value, fallback, name, max = 100) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new Error(`${name} must be an integer from 1 to ${max}`);
  return number;
}
export async function externalWork(path) {
  const work = resolve(path);
  let ancestor = work;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const canonical = resolve(await realpath(ancestor), relative(ancestor, work));
  const repo = await realpath(root);
  const rel = relative(repo, canonical);
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('Work directory must be outside the repository');
  mkdirSync(canonical, { recursive: true });
  return canonical;
}
export async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
export async function candidatesUnder(work, assets) {
  const wanted = new Set(assets.map((asset) => `${asset.id}.png`));
  const files = (await filesUnder(work)).filter((file) => wanted.has(file.split('/').at(-1)));
  const dated = await Promise.all(files.map(async (file) => ({ file, time: (await stat(file)).mtimeMs })));
  return dated.sort((a, b) => b.time - a.time).map(({ file }) => file);
}
export function idsSource() {
  return ['prop', 'sticker', 'badge'].map((family) => {
    const type = `${family[0].toUpperCase()}${family.slice(1)}Id`;
    return `export type ${type} =\n${catalogue.assets.filter((a) => a.family === family).map((a) => `  | '${a.id}'`).join('\n')};`;
  }).join('\n\n') + '\n';
}
export function batchPrompt(assets) {
  const family = catalogue.families[assets[0].family];
  return `You are producing artwork for a personal website. Use your built-in image generation tool with the newest image\nmodel available (ChatGPT Image 2.5 or newer). For EACH item below, generate exactly one image and save it\nin the current working directory under the file name given, as a PNG with a transparent background (if\nyour tool cannot make a transparent background, use the flat magenta background the style lock describes).\nWork through the list in order, one image at a time; if one fails, retry it once and move on. Do not write\nany other files, do not read or change anything else, and do not ask questions. At the end, list the files\nyou wrote. Never use sleep.\n\n${family.lock}\n\nITEMS:\n${assets.map((asset, i) => `${i + 1}. File \`${asset.id}.png\`: ${asset.subject}${i ? ' Match the style of the earlier images in this batch.' : ''}`).join('\n')}\n`;
}
export function alphaFraction(data) {
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
  return transparent / (data.length / 4);
}
export function borderFraction(data, width, height) {
  let ring = 0, accepted = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] === 0) continue;
    const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
      || data[i - 1] === 0 || data[i + 7] === 0
      || data[i - width * 4 + 3] === 0 || data[i + width * 4 + 3] === 0;
    if (!edge) continue;
    ring++;
    if (Math.min(data[i], data[i + 1], data[i + 2]) >= 225 || Math.max(data[i], data[i + 1], data[i + 2]) <= 70) accepted++;
  }
  return ring ? accepted / ring : 0;
}
export async function variantSizes(master, asset, quality) {
  const meta = await sharp(master).metadata();
  const sizes = catalogue.families[asset.family].widths ?? [asset.W];
  const variants = [];
  for (const size of sizes) for (const density of [1, 2]) for (const format of ['avif', 'webp']) {
    const width = Math.min(size * density, meta.width);
    const options = format === 'avif' ? { quality: quality.avif, effort: 6 } : { quality: quality.webp, alphaQuality: 90, effort: 6 };
    const bytes = (await sharp(master).resize({ width, kernel: 'lanczos3', withoutEnlargement: true }).toFormat(format, options).toBuffer()).length;
    // Astro's unconfigured Sharp service uses its own encoder defaults. Check both
    // until the site configuration adopts the same encoder settings.
    const astroBytes = (await sharp(master).resize({ width, kernel: 'lanczos3', withoutEnlargement: true }).toFormat(format, { quality: quality[format] }).toBuffer()).length;
    const cap = catalogue.families[asset.family].caps[format][density - 1];
    variants.push({ size, density, width, format, bytes, astroBytes, cap, quality: quality[format] });
  }
  return variants;
}
export function familyTotals(rows) {
  return Object.fromEntries(['prop', 'sticker', 'badge'].map((family) => [family,
    rows.filter((row) => row.family === family && !row.placeholder).reduce((sum, row) => sum + Math.max(...row.variants.filter((v) => v.format === 'avif' && v.density === 1).map((v) => Math.max(v.bytes, v.astroBytes))), 0)]));
}
