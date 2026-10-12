export const CANONICAL_MODE = 'main-site';
export const sitemapFilter = (url) => new URL(url).pathname.replace(/\/+$/, '') !== '/og';
export const canonicalFor = (path) => 'https://os.nipuntheekshana.com' + (path === '/' ? '' : path);
export const isIndexable = () => true;
