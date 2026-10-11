import base from '../../astro.config.mjs';
import { fileURLToPath } from 'node:url';

export default {
  ...base,
  integrations: [...base.integrations, {
    name: 'wallpaper-fixture',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => injectRoute({
        pattern: '/_wallpaper',
        entrypoint: fileURLToPath(new URL('./wallpaper.astro', import.meta.url)),
      }),
    },
  }],
};
