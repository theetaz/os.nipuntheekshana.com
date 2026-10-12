import { links, site } from '../data/profile';
import { CANONICAL_MODE, canonicalFor, isIndexable } from './seo-routes.mjs';

const OS_ORIGIN = 'https://os.nipuntheekshana.com';
const PERSON_ID = `${site.url}/#person`;
export const HOME_DESCRIPTION = 'The desktop of Nipun Theekshana, an engineer from Colombo building open data, tiny-screen hardware and the odd browser game. Drag the tuk-tuk, open the projects, leave a note on the board.';
// The P0 placeholder has no parameters; the final helper accepts a path.
const routeIsIndexable: (path: string) => boolean = isIndexable;

export interface Seo {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
  jsonLd?: object[];
  ogImage?: string;
}

interface ProjectSeo {
  title: string;
  description: string;
  stack: readonly string[];
  repo?: string;
}

interface PostSeo {
  title: string;
  date: string | Date;
  updated?: string | Date;
}

interface SeoOptions {
  path: string;
  title: string;
  description: string;
  kind: 'home' | 'page' | 'app' | 'project' | 'post';
  project?: ProjectSeo;
  post?: PostSeo;
}

function canonicalPath(path: string): string {
  return new URL(path, OS_ORIGIN).pathname.replace(/\/+$/, '') || '/';
}

function pageCanonical(path: string): string {
  // P0's route helper is a placeholder until P5-3 finalises sitemap policy.
  // Keep duplicate-content canonicals correct in the meantime.
  if (CANONICAL_MODE === 'main-site') {
    if (path === '/projects' || path.startsWith('/projects/')) {
      return `${site.url}${path.replace(/^\/projects/, '/work')}`;
    }
    if (path === '/writing' || path.startsWith('/writing/') || ['/about', '/cv', '/now'].includes(path)) {
      return `${site.url}${path}`;
    }
  }
  return canonicalFor(path);
}

function person(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: site.name,
    alternateName: site.nameSinhala,
    url: site.url,
    image: `${site.url}/avatar.png`,
    jobTitle: 'Co-founder & Chief Technology Officer',
    worksFor: { '@type': 'Organization', name: 'PerfectUs Technologies' },
    email: `mailto:${site.email}`,
    address: { '@type': 'PostalAddress', addressLocality: 'Colombo', addressCountry: 'LK' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'University of Ruhuna' },
    founder: [
      { '@type': 'Organization', name: 'PerfectUs Technologies' },
      { '@type': 'Organization', name: 'Prabhava Labs', url: links.prabhava },
    ],
    sameAs: [links.github, links.linkedin, links.prabhava],
  };
}

function dateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function seoFor({ path, title, description, kind, project, post }: SeoOptions): Seo {
  const route = canonicalPath(path);
  const canonical = pageCanonical(route);
  const jsonLd: object[] = [];
  const author = { '@id': PERSON_ID };

  if (kind === 'home') {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Kottu OS',
      url: canonical,
      inLanguage: 'en',
      author,
    }, person());
  } else if (kind === 'project') {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: project?.title ?? title,
      description: project?.description ?? description,
      ...(project?.repo ? { codeRepository: project.repo } : {}),
      programmingLanguage: project?.stack ?? [],
      url: canonical,
      author,
    });
  } else if (kind === 'post') {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post?.title ?? title,
      description,
      ...(post ? {
        datePublished: dateString(post.date),
        dateModified: dateString(post.updated ?? post.date),
      } : {}),
      mainEntityOfPage: canonical,
      author,
    });
  }

  return {
    title: kind === 'home' ? `${site.name} — Kottu OS` : `${title} — ${site.name}`,
    description: kind === 'home' ? HOME_DESCRIPTION : description,
    canonical,
    noindex: !routeIsIndexable(route) || ['/settings', '/kooda', '/404', '/404.html', '/og'].includes(route),
    jsonLd,
    ogImage: `${OS_ORIGIN}/og.png`,
  };
}
