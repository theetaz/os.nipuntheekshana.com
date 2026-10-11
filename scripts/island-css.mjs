import { normalizePath } from 'vite';

/**
 * The island's dynamic imports are browser features, never prerender content.
 * Astro follows dynamic importers when collecting page CSS. Keep those edges
 * out of its server graph; static imports in pages/views still collect CSS.
 * The client graph is untouched, including Vite's await-before-render CSS preload.
 *
 * @returns {import('vite').Plugin}
 */
export function islandCss() {
  const boundary = '\0serendib:browser-feature';
  let islandRoot = '';
  return {
    name: 'serendib:island-css',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) { islandRoot = `${normalizePath(config.root)}/src/os/`; },
    resolveDynamicImport(_source, importer) {
      if (this.environment.config.consumer === 'server' && importer && normalizePath(importer).startsWith(islandRoot)) {
        return boundary;
      }
    },
    load(id) {
      if (id === boundary) return 'throw new Error("Browser-only island feature executed during prerender. Use a static view for SSR.");';
    },
    // Record the emitted client graph for build regressions. No absolute paths
    // or dependency sources are exposed; this has no effect on chunk loading.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        if (this.environment.config.consumer !== 'client') return;
        const chunks = Object.fromEntries(Object.values(bundle).filter(item => item.type === 'chunk').map(chunk => [chunk.fileName, {
          modules: Object.keys(chunk.modules).filter(id => normalizePath(id).startsWith(islandRoot))
            .map(id => `src/os/${normalizePath(id).slice(islandRoot.length)}`),
          imports: chunk.imports,
          css: [...(chunk.viteMetadata?.importedCss ?? [])],
        }]));
        this.emitFile({ type: 'asset', fileName: '.css-scope.json', source: JSON.stringify({ chunks }) });
      },
    },
  };
}
