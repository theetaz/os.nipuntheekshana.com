import type { APIRoute } from 'astro';
import { fontData, getImage } from 'astro:assets';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import avatar from '../assets/me/avatar.png';
import { AppIconSymbols } from '../os/icons/app-icons';

export const prerender = true;
export const GET: APIRoute = async () => {
  const avatarUrl = (await getImage({ src: avatar, width: 128, format: 'avif', quality: 55 })).src;
  const fonts = [['--font-shrikhand', 'display'], ['--font-fraunces', 'fraunces'], ['--font-martian', 'mono']] as const;
  const faces = fonts.map(([variable, name]) => fontData[variable]!.map(face =>
    `@font-face{font-family:KottuIcon-${name};src:url('${face.src[0]!.url}');font-weight:${face.weight};font-style:${face.style};${name === 'mono' ? 'font-stretch:75% 112.5%;' : ''}font-display:swap}`
  ).join('')).join('');
  const styles = `${faces}svg{--font-display:KottuIcon-display;--font-fraunces:KottuIcon-fraunces;--font-martian:KottuIcon-mono}`;
  const sprite = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg' },
    createElement('style', null, styles), createElement(AppIconSymbols, { avatarUrl })));
  return new Response(sprite, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } });
};
