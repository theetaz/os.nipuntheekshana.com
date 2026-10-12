import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import catalogue from '../../scripts/kottu-art/assets.json';
import provenance from '../assets/kottu/provenance.json';
import type { PropId, StickerId, BadgeId } from '../assets/kottu/ids';
export type { PropId, StickerId, BadgeId } from '../assets/kottu/ids';

export interface ArtImage {
  avif: string;
  webp: string;
  src: string;
  width: number;
  height: number;
}

const masters = import.meta.glob<{ default: ImageMetadata }>('../assets/kottu/**/*.png', { eager: true });
const cache = new Map<string, Promise<ArtImage>>();

function art(id: PropId | StickerId | BadgeId, width: number): Promise<ArtImage> {
  const key = `${id}:${width}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const task = (async () => {
    const asset = catalogue.assets.find((asset) => asset.id === id);
    const entry = provenance.find((entry) => entry.id === id);
    if (!asset || !entry) throw new Error(`Unknown Kottu art: ${id}`);
    const directory = catalogue.families[asset.family as keyof typeof catalogue.families].dir;
    const src = masters[`../assets/kottu/${directory}/${id}.png`]?.default;
    if (!src) throw new Error(`Missing Kottu master: ${id}`);
    const widths = [...new Set([Math.min(width, src.width), Math.min(2 * width, src.width)])];
    const formats = await Promise.all((['avif', 'webp'] as const).map(async (format) => {
      const variants = await Promise.all(widths.map((width) => getImage({ src, width, format, quality: entry.quality[format] })));
      return { src: variants[0]!.src, srcset: variants.map((image, i) => `${image.src} ${widths[i]}w`).join(', ') };
    }));
    return { avif: formats[0]!.srcset, webp: formats[1]!.srcset, src: formats[1]!.src,
      width: widths[0]!, height: Math.round(src.height * widths[0]! / src.width) };
  })();
  cache.set(key, task);
  task.catch(() => cache.delete(key));
  return task;
}

export function propArt(id: PropId): Promise<ArtImage> {
  const asset = catalogue.assets.find((asset) => asset.id === id && asset.family === 'prop');
  if (!asset) throw new Error(`Unknown prop: ${id}`);
  return art(id, asset.W);
}

export function stickerArt(id: StickerId, size: 88 | 140 | 200): Promise<ArtImage> {
  if (![88, 140, 200].includes(size)) throw new Error(`Unsupported sticker size: ${size}`);
  if (!catalogue.assets.some((asset) => asset.id === id && asset.family === 'sticker')) throw new Error(`Unknown sticker: ${id}`);
  return art(id, size);
}

export function badgeArt(id: BadgeId): Promise<ArtImage> {
  if (!catalogue.assets.some((asset) => asset.id === id && asset.family === 'badge')) throw new Error(`Unknown badge: ${id}`);
  return art(id, 56);
}
