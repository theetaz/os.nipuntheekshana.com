// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { sitemapFilter } from './src/lib/seo-routes.mjs';
import { islandCss } from './scripts/island-css.mjs';

/** @param {string} pkg @param {string} file */
const fontFile = (pkg, file) => `@fontsource-variable/${pkg}/files/${file}`;

export default defineConfig({
  site: 'https://os.nipuntheekshana.com',
  output: 'static',
  adapter: cloudflare({ imageService: 'compile', prerenderEnvironment: 'node' }),
  trailingSlash: 'never',
  // A shared static/lazy view must retain its CSS asset for Vite's lazy preload.
  build: { format: 'file', inlineStylesheets: 'never' },
  prefetch: false, // the island prefetches app chunks itself (§8)
  devToolbar: { enabled: false },
  integrations: [react(), sitemap({ filter: sitemapFilter })],
  vite: {
    plugins: [islandCss(), tailwindcss()],
    build: { cssCodeSplit: true, rolldownOptions: { output: { codeSplitting: { groups: [{
      // Pack the shell's static dependencies together: fewer request hops and
      // gzip dictionaries. Dynamic app and feature imports keep their own chunks.
      name: 'shell-runtime', test: /src\/os\/(?:Desktop\.tsx|state\/features\.ts)$|node_modules\/@astrojs\/react\/dist\/client\.js$|node_modules\/(?:(?:react|react-dom|scheduler)\/|jotai\/dist\/(?:react\/[^/]+|vanilla\/(?:atom|store|internals))\.js$)/,
    }] } } } },
    // three is only reached through a lazy import; pre-bundle it so dev does not reload mid-session.
    optimizeDeps: { include: ['three', 'jotai', 'jotai/utils', 'motion/react', 'motion/mini'] },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Instrument Sans',
      cssVariable: '--font-instrument',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      options: {
        variants: [
          { src: [fontFile('instrument-sans', 'instrument-sans-latin-wght-normal.woff2')], weight: '400 700', style: 'normal' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      fallbacks: ['ui-serif', 'Georgia', 'serif'],
      options: {
        variants: [
          { src: [fontFile('fraunces', 'fraunces-latin-wght-normal.woff2')], weight: '100 900', style: 'normal' },
          { src: [fontFile('fraunces', 'fraunces-latin-wght-italic.woff2')], weight: '100 900', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Martian Mono',
      cssVariable: '--font-martian',
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      options: {
        variants: [
          { src: [fontFile('martian-mono', 'martian-mono-latin-wdth-normal.woff2')], weight: '100 800', style: 'normal', stretch: '75% 112.5%' },
        ],
      },
    },
  ],
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'vesper' }, wrap: false },
  },
  // security: { csp: … }  ← added by P5-4 (§12.6)
});
