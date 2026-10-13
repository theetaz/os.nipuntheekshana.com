import { describe, expect, it } from 'vitest';
import { seoFor } from '../../src/lib/seo';

const options = { title: 'Example', description: 'Example description', kind: 'page' as const };

describe('SEO metadata', () => {
  it.each([
    ['/', 'https://os.nipuntheekshana.com'],
    ['/projects', 'https://nipuntheekshana.com/work'],
    ['/projects/salli/', 'https://nipuntheekshana.com/work/salli'],
    ['/writing', 'https://nipuntheekshana.com/writing'],
    ['/writing/hello-world?view=plain#intro', 'https://nipuntheekshana.com/writing/hello-world'],
    ['/about', 'https://nipuntheekshana.com/about'],
    ['/cv', 'https://nipuntheekshana.com/cv'],
    ['/now', 'https://nipuntheekshana.com/now'],
    ['/activity', 'https://os.nipuntheekshana.com/activity'],
    ['/maps/play', 'https://os.nipuntheekshana.com/maps/play'],
    ['/terminal', 'https://os.nipuntheekshana.com/terminal'],
    ['/messages', 'https://os.nipuntheekshana.com/messages'],
    ['/readme', 'https://os.nipuntheekshana.com/readme'],
    ['/projects-other', 'https://os.nipuntheekshana.com/projects-other'],
  ])('canonical for %s is %s', (path, canonical) => {
    expect(seoFor({ ...options, path }).canonical).toBe(canonical);
  });

  it.each(['/settings', '/kooda/', '/404', '/404.html', '/og'])('excludes %s from indexing', (path) => {
    expect(seoFor({ ...options, path }).noindex).toBe(true);
  });

  it('uses the home title and shares the existing Person identity', () => {
    const seo = seoFor({ ...options, path: '/', kind: 'home' });
    expect(seo.title).toBe('Nipun Theekshana — Kottu OS');
    expect(seo.description).toBe('The desktop of Nipun Theekshana, an engineer from Colombo building open data, tiny-screen hardware and the odd browser game. Drag the tuk-tuk, open the projects, leave a note on the board.');
    expect(seo.noindex).toBe(false);
    expect(seo.ogImage).toBe('https://os.nipuntheekshana.com/og.png');
    expect(seo.jsonLd).toEqual([
      expect.objectContaining({ '@type': 'WebSite', name: 'Kottu OS', inLanguage: 'en', author: { '@id': 'https://nipuntheekshana.com/#person' } }),
      expect.objectContaining({ '@type': 'Person', '@id': 'https://nipuntheekshana.com/#person', sameAs: [
        'https://github.com/theetaz', 'https://www.linkedin.com/in/nipun-theekshana/', 'https://prabhavalabs.com',
      ] }),
    ]);
  });

  it('builds project structured data using the canonical and supplied metadata', () => {
    const seo = seoFor({ ...options, path: '/projects/salli', title: 'Salli', kind: 'project', project: {
      title: 'Salli', description: 'Private money tracking', stack: ['Dart', 'Flutter'], repo: 'https://github.com/prabhavalabs/salli',
    } });
    expect(seo.title).toBe('Salli — Nipun Theekshana');
    expect(seo.jsonLd).toEqual([expect.objectContaining({
      '@type': 'SoftwareSourceCode', name: 'Salli', description: 'Private money tracking',
      programmingLanguage: ['Dart', 'Flutter'], codeRepository: 'https://github.com/prabhavalabs/salli',
      url: 'https://nipuntheekshana.com/work/salli', author: { '@id': 'https://nipuntheekshana.com/#person' },
    })]);
  });

  it('omits absent project repositories', () => {
    expect(seoFor({ ...options, path: '/projects/example', kind: 'project' }).jsonLd?.[0]).not.toHaveProperty('codeRepository');
  });

  it('builds post dates from Date values and falls back modified to published', () => {
    const date = new Date('2026-10-11T00:00:00Z');
    const seo = seoFor({ ...options, path: '/writing/example', kind: 'post', post: { title: 'Post', date } });
    expect(seo.jsonLd).toEqual([expect.objectContaining({
      '@type': 'BlogPosting', headline: 'Post', datePublished: date.toISOString(), dateModified: date.toISOString(),
      mainEntityOfPage: 'https://nipuntheekshana.com/writing/example',
    })]);
    expect(seoFor({ ...options, path: '/writing/example', kind: 'post', post: { title: 'Post', date: '2026-10-10', updated: '2026-10-11' } }).jsonLd?.[0])
      .toHaveProperty('dateModified', '2026-10-11');
  });
});
