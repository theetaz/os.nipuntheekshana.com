import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import type { ImageSet } from '../os/types/content';

type ImageKind = 'cover' | 'screen' | 'icon' | 'avatar';
const widths: Record<ImageKind, { avif: number[]; webp: number[] }> = {
  cover: { avif: [320, 640], webp: [640] },
  screen: { avif: [320, 800, 1600], webp: [1200] },
  icon: { avif: [64, 128], webp: [128] },
  avatar: { avif: [128, 256], webp: [256] },
};
const cache = new Map<string, Promise<Omit<ImageSet, 'alt'>>>();

export async function toImageSet(src: ImageMetadata, alt: string, kind: ImageKind): Promise<ImageSet> {
  const key = `${src.src}:${src.width}:${src.height}:${kind}`;
  let result = cache.get(key);
  if (!result) {
    result = (async () => {
      if (src.format === 'svg') {
        return { src: src.src, width: src.width, height: src.height, avif: '', webp: '' };
      }
      async function variants(format: 'avif' | 'webp') {
        const eligible = widths[kind][format].filter((width) => width <= src.width);
        // Tiny originals still get both formats, at their intrinsic width; never upscale.
        if (!eligible.length) eligible.push(src.width);
        return Promise.all(eligible.map(async (width) => ({
          width,
          src: (await getImage({ src, width, format, quality: format === 'avif' ? 55 : 72 })).src,
        })));
      }
      const [avif, webp] = await Promise.all([variants('avif'), variants('webp')]);
      return {
        src: webp[webp.length - 1]!.src,
        width: src.width, height: src.height,
        avif: avif.map((image) => `${image.src} ${image.width}w`).join(', '),
        webp: webp.map((image) => `${image.src} ${image.width}w`).join(', '),
      };
    })();
    cache.set(key, result);
  }
  return { ...await result, alt };
}
