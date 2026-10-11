import type { CollectionEntry } from 'astro:content';
import type {
  ClientActivity, ClientArchiveItem, ClientBrand, ClientPost, ClientPostSummary,
  ClientProfile, ClientProject, ClientWork, ScreenKind,
} from '../os/types/content';
import { activityStats } from './activity-stats';
import { getContributions, getTotalStars } from './github';

// Server dependencies are loaded only by the builders, so the pure helpers can run in Node tests.
export function screenKind(image: { width: number; height: number }, bare = false): ScreenKind {
  return bare ? 'bare' : image.height / image.width > 1.3 ? 'phone' : 'browser';
}

export function monogram(title: string, preferred?: string): string {
  return preferred ?? Array.from(title)[0] ?? '';
}

export function compareProjects(
  a: { featured?: boolean; year: number; title: string; slug: string },
  b: { featured?: boolean; year: number; title: string; slug: string },
): number {
  return Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    || b.year - a.year || a.title.localeCompare(b.title, 'en') || a.slug.localeCompare(b.slug, 'en');
}

/** Fenced code is excluded, as in the source site's helper; P1-6 specifies ceil at 220 wpm. */
export function readingTime(markdown: string): number {
  const words = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 220);
}

let projectsCache: Promise<ClientProject[]> | undefined;
export function getClientProjects(): Promise<ClientProject[]> {
  return projectsCache ??= (async () => {
    const [{ projects, categories }, { toImageSet }] = await Promise.all([import('../data/projects'), import('./images')]);
    return Promise.all([...projects].sort(compareProjects).map(async (project, order) => {
      const { image, imageAlt, screens = [], brand, ...metadata } = project;
      let clientBrand: ClientBrand | null = null;
      if (brand) {
        const { color, ink, shade, backdrop, platform, platformNote, chips, cta, domain, address, cards = [], api } = brand;
        clientBrand = { color, ink, shade, backdrop, platform, platformNote, chips, cta, domain, address, cards, api };
      }
      const [cover, icon, clientScreens] = await Promise.all([
        toImageSet(image, imageAlt ?? project.title, 'cover'),
        brand?.icon ? toImageSet(brand.icon, `${project.title} icon`, 'icon') : null,
        Promise.all(screens.map(async ({ image, alt, label, bare, trimBottom, bar }) => ({
          ...await toImageSet(image, alt, 'screen'), label, kind: screenKind(image, bare), trimBottom, bar,
        }))),
      ]);
      return {
        ...metadata, categoryLabel: categories[project.category], featured: Boolean(project.featured),
        icon, monogram: monogram(project.title, brand?.monogram), cover, screens: clientScreens, brand: clientBrand, order,
      };
    }));
  })();
}

export async function getClientProject(slug: string): Promise<ClientProject | null> {
  return (await getClientProjects()).find((project) => project.slug === slug) ?? null;
}

let archiveCache: Promise<ClientArchiveItem[]> | undefined;
export function getArchive(): Promise<ClientArchiveItem[]> {
  return archiveCache ??= import('../data/projects').then(({ archive }) => archive);
}

let workCache: Promise<Map<string, ClientWork>> | undefined;
export async function getClientWork(slug: string): Promise<ClientWork | null> {
  workCache ??= (async () => {
    const { getCollection } = await import('astro:content');
    const entries = await getCollection('work');
    return new Map(entries.map((entry) => [entry.id, { slug: entry.id, ...entry.data, ...rendered(entry) }]));
  })();
  return (await workCache).get(slug) ?? null;
}

function rendered(entry: CollectionEntry<'work'> | CollectionEntry<'writing'>): Pick<ClientWork, 'html' | 'headings'> {
  if (!entry.rendered) throw new Error(`Content ${entry.collection}/${entry.id} has not been rendered`);
  // Astro's generated collection type exposes rendered metadata as Record<string, unknown>.
  const headings = entry.rendered.metadata?.headings ?? [];
  if (!Array.isArray(headings)) throw new Error(`Invalid headings for ${entry.collection}/${entry.id}`);
  return { html: entry.rendered.html, headings: headings as ClientWork['headings'] };
}

let postsCache: Promise<ClientPost[]> | undefined;
function allPosts(): Promise<ClientPost[]> {
  return postsCache ??= (async () => {
    const { getCollection } = await import('astro:content');
    const entries = await getCollection('writing', ({ data }) => !data.draft);
    return entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id, 'en'))
      .map((entry) => {
        const { title, description, date, updated, kind, tags } = entry.data;
        return {
          slug: entry.id, title, description, date: date.toISOString(), updated: updated?.toISOString(), kind, tags,
          minutes: readingTime(entry.body ?? ''), ...rendered(entry),
        };
      });
  })();
}

let summariesCache: Promise<ClientPostSummary[]> | undefined;
export function getClientPosts(): Promise<ClientPostSummary[]> {
  return summariesCache ??= allPosts().then((posts) => posts.map(({ html: _html, headings: _headings, ...summary }) => summary));
}

export async function getClientPost(slug: string): Promise<ClientPost | null> {
  return (await allPosts()).find((post) => post.slug === slug) ?? null;
}

let profileCache: Promise<ClientProfile> | undefined;
export function getClientProfile(): Promise<ClientProfile> {
  return profileCache ??= (async () => {
    const [profile, { chapters }, { default: avatar }, { toImageSet }, { statSync }, { resolve }] = await Promise.all([
      import('../data/profile'), import('../data/about'), import('../assets/me/avatar.png'), import('./images'), import('node:fs'), import('node:path'),
    ]);
    const { site, cv, links, socials, currently, highlights, summary, competencies, experience, education, skills, principles, hobbies, now } = profile;
    const size = statSync(resolve('public', cv.filename)).size;
    return {
      site, cv: { ...cv, sizeLabel: `PDF · ${Math.round(size / 1024)} KB` }, links, socials, currently,
      highlights, summary, competencies, experience, education, skills, principles, hobbies: [...hobbies], now, chapters,
      avatar: await toImageSet(avatar, site.name, 'avatar'),
    };
  })();
}

let activityCache: Promise<ClientActivity> | undefined;
export function getClientActivity(): Promise<ClientActivity> {
  return activityCache ??= (async () => {
    const [contributions, stars] = await Promise.all([getContributions('theetaz'), getTotalStars()]);
    const fetchedAt = new Date().toISOString();
    if (!contributions) return { available: false, fetchedAt };
    return { available: true, ...contributions, ...activityStats(contributions), stars, fetchedAt };
  })();
}
