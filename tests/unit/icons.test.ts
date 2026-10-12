import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { APP_ICON_SYMBOLS, AppIcon, AppIconSymbols } from '../../src/os/icons/app-icons';
import { ISLAND_PATH, ISLAND_VIEWBOX } from '../../src/os/icons/island-glyph';

const expectedIds = [
  'app-projects', 'app-about', 'app-writing', 'app-messages', 'app-terminal', 'app-maps',
  'app-activity', 'app-cv', 'app-settings', 'app-now', 'app-readme', 'app-trash', 'app-trash-full',
  'app-pin', 'app-guestbook', 'folder-projects', 'folder-writing', 'doc-cv',
  'link-github', 'link-linkedin', 'link-prabhava',
];

const renderSprite = (avatarUrl?: string) => renderToStaticMarkup(createElement('svg', {
  xmlns: 'http://www.w3.org/2000/svg', width: 0, height: 0,
  style: { position: 'absolute' }, 'aria-hidden': true, focusable: false,
}, createElement(AppIconSymbols, { avatarUrl })));

describe('app icon sprite contract', () => {
  it('covers every public identifier with a 64-unit symbol', () => {
    expect(Object.keys(APP_ICON_SYMBOLS).sort()).toEqual(expectedIds.toSorted());
    for (const [id, symbol] of Object.entries(APP_ICON_SYMBOLS)) {
      expect(symbol.type, id).toBe('symbol');
      expect(symbol.props).toMatchObject({ id, viewBox: '0 0 64 64' });
    }
  });

  it('has unique ids, resolves every internal reference and fits the HTML budget', () => {
    const sprite = renderSprite('/_astro/avatar.128.avif');
    const ids = [...sprite.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...sprite.matchAll(/<symbol\b/g)]).toHaveLength(expectedIds.length);
    for (const reference of sprite.matchAll(/(?:url\(#|href="#)([^)"\s]+)/g)) {
      expect(ids, `Unresolved reference ${reference[1]}`).toContain(reference[1]);
    }
    expect(Buffer.byteLength(sprite)).toBeLessThanOrEqual(18_000);
  });

  it('uses flat Kottu fills and a 3px ink outline on every symbol', () => {
    const sprite = renderSprite();
    expect(sprite).not.toMatch(/<(?:linearGradient|radialGradient|stop)\b/);
    for (const id of expectedIds) {
      const symbol = renderToStaticMarkup(APP_ICON_SYMBOLS[id as keyof typeof APP_ICON_SYMBOLS]);
      expect(symbol, id).toContain('stroke="#1B1530" stroke-width="3"');
    }
    const fills = {
      'app-projects': '#FF8A3D', 'app-about': '#0FA3A3', 'app-writing': '#FFFDF8',
      'app-messages': '#FF7EB6', 'app-terminal': '#1B1530', 'app-maps': '#3DBE6B',
      'app-activity': '#FFC93C', 'app-cv': '#FFFDF8', 'app-settings': '#E8453C',
      'app-now': '#FFE27A', 'app-guestbook': '#FFE27A', 'link-github': '#1B1530',
      'link-linkedin': '#0A66C2', 'link-prabhava': '#FFF7E8',
    };
    for (const [id, fill] of Object.entries(fills)) {
      expect(renderToStaticMarkup(APP_ICON_SYMBOLS[id as keyof typeof APP_ICON_SYMBOLS]), id).toContain(`fill="${fill}"`);
    }
  });

  it('preserves the original glyph geometry while recolouring object icons', () => {
    const symbols = renderSprite();
    expect(symbols).toContain('x="21" y="12" width="27" height="33" rx="5"');
    expect(symbols).toContain(`d="${ISLAND_PATH}" transform="translate(19.9 10) scale(.44)"`);
    expect(symbols).toContain('M12 25h40l-5 29a4 4 0 0 1-4 3H21a4 4 0 0 1-4-3Z');
    expect(symbols).toContain('fill="#E9C98A"'); expect(symbols).toContain('stroke="#A8834A"'); expect(symbols).toContain('fill="#7A4F00"');
    expect(symbols).toContain('font-family="var(--font-display, Shrikhand), Georgia, serif"');
    expect(symbols).toContain('fill="#FF7EB6"'); expect(symbols).toContain('fill="#E8453C"');
  });

  it('accepts an escaped avatar URL with a circle crop, and keeps the NT fallback', () => {
    const symbols = renderSprite('/avatar.avif?a=1&b=2');
    expect(symbols).toContain('href="/avatar.avif?a=1&amp;b=2"');
    expect(symbols).toContain('clip-path="url(#c-about-avatar)"');
    expect(symbols).toContain('width="40" height="40"');
    expect(symbols).toContain('>NT</text>');
    expect(renderSprite()).not.toContain('<image');
  });

  it('renders same-document use references with decorative or named accessibility', () => {
    const decorative = renderToStaticMarkup(createElement(AppIcon, { id: 'app-projects', width: 48, height: 48 }));
    expect(decorative).toContain('href="#app-projects"');
    expect(decorative).toContain('aria-hidden="true"');
    const named = renderToStaticMarkup(createElement(AppIcon, { id: 'app-maps', 'aria-label': 'Island' }));
    expect(named).toContain('aria-label="Island"');
    expect(named).not.toContain('aria-hidden');
  });
});

describe('favicon and install assets', () => {
  it('uses the shared outline and both colour-scheme accents on a transparent SVG', () => {
    const svg = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8');
    expect(svg).toContain(`d="${ISLAND_PATH}"`);
    expect(svg).toContain(`viewBox="${ISLAND_VIEWBOX}"`);
    expect(svg).toContain('#E8722A');
    expect(svg).toContain('@media(prefers-color-scheme:dark)');
    expect(svg).toContain('#FF9A4D');
    expect(svg).not.toContain('<rect');
  });

  it.each([
    ['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512],
  ] as const)('ships %s at %i pixels with an alpha channel', async (filename, size) => {
    const metadata = await sharp(readFileSync(new URL(`../../public/${filename}`, import.meta.url))).metadata();
    expect(metadata).toMatchObject({ format: 'png', width: size, height: size, hasAlpha: true });
  });

  it('declares the specified standalone app and existing 192/512 icons', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../public/site.webmanifest', import.meta.url), 'utf8'));
    expect(manifest).toMatchObject({
      name: 'Serendib OS — Nipun Theekshana', short_name: 'Serendib', display: 'standalone',
      background_color: '#F4E3CC', theme_color: '#E8722A', start_url: '/',
    });
    expect(manifest.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ]);
  });
});
