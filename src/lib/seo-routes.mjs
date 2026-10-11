export const CANONICAL_MODE = 'main-site';
export const sitemapFilter = () => true;
export const canonicalFor = (path) => 'https://os.nipuntheekshana.com' + (path === '/' ? '' : path);
export const isIndexable = () => true;
