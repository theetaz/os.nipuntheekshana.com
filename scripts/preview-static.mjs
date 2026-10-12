import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preview } from 'vite';
// Serve the adapter's prerendered output without invoking remote bindings.
// The local Worker remains the API server, including real Siteverify checks.
const server = await preview({
  configFile: false, appType: 'mpa', root: process.cwd(), build: { outDir: resolve('dist/client') },
  // Keep the browser's Host so the Worker's same-origin POST check remains valid.
  preview: { host: 'localhost', port: 4357, strictPort: true, proxy: { '/api': { target: 'http://localhost:8788', changeOrigin: false } } },
  plugins: [{ name: 'postcards-static-404', configurePreviewServer(server) {
    // Replace only Vite's final 404 handler, after its HTML rewrite middleware.
    server.middlewares.use((_request, _response, next) => {
      const fallback = server.middlewares.stack.find(middleware => middleware.handle.name === 'vite404Middleware');
      if (fallback) fallback.handle = async (_request, response) => {
        response.statusCode = 404; response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(await readFile('dist/client/404.html'));
      };
      next();
    });
  } }],
});
server.printUrls();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { void server.close(); });
