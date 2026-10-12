import { describe, expect, it } from 'vitest';
import { APP_META, DOCK_LINKS, titleFor } from '../../src/os/registry/meta';
import type { AppId, TitleBarKind } from '../../src/os/types/apps';
import { matchRoute, pathFor, ROUTES } from '../../src/os/url/routes';

const paths: [string, AppId, string][] = [
  ['/projects', 'projects', ''],
  ['/projects/salli', 'projects', 'salli'],
  ['/writing', 'writing', ''],
  ['/writing/hello-world', 'writing', 'hello-world'],
  ['/about', 'about', ''],
  ['/cv', 'cv', ''],
  ['/now', 'now', ''],
  ['/activity', 'activity', ''],
  ['/maps', 'maps', ''],
  ['/maps/play', 'maps', 'play'],
  ['/terminal', 'terminal', ''],
  ['/messages', 'messages', ''],
  ['/readme', 'readme', ''],
  ['/settings', 'settings', ''],
  ['/kooda', 'trash', ''],
  ['/postcards', 'guestbook', ''],
];

describe('route table', () => {
  it.each(paths)('round-trips %s', (pathname, appId, route) => {
    expect(matchRoute(pathname)).toEqual({ appId, route });
    expect(pathFor(appId, route)).toBe(pathname);
  });

  it('leaves home to the desktop', () => {
    expect(matchRoute('/')).toBeNull();
  });

  it('describes every app once, including Postcards', () => {
    expect(ROUTES).toHaveLength(13);
    expect(new Set(ROUTES.map(({ appId }) => appId)).size).toBe(13);
    expect(ROUTES.map(({ basePath }) => basePath).sort()).toEqual([
      '/projects', '/writing', '/about', '/cv', '/now', '/activity', '/maps',
      '/terminal', '/messages', '/readme', '/settings', '/kooda', '/postcards',
    ].sort());
    expect(ROUTES.filter(({ subRoutes }) => subRoutes === 'slug').map(({ appId }) => appId))
      .toEqual(['projects', 'writing']);
    expect(ROUTES.find(({ appId }) => appId === 'maps')?.subRoutes).toEqual(['play']);
  });

  it.each(['projects', 'writing'] as const)('matches %s slugs syntactically without a content list', (appId) => {
    for (const route of ['not-in-the-content', 'a', '0', 'app-2026', '-', 'a--b']) {
      const pathname = `/${appId}/${route}`;
      expect(matchRoute(pathname)).toEqual({ appId, route });
      expect(pathFor(appId, route)).toBe(pathname);
    }
  });

  it.each([
    '', 'projects', '//projects', '/nope', '/Projects', '/projects-other',
    '/projects/Salli', '/projects/a/b', '/projects/', '/projects//salli',
    '/projects/a_b', '/projects/a.b', '/projects/café', '/projects/a%2Fb',
    '/projects/a%20b', '/projects/a b', '/projects/a?shot=2', '/projects/a#simple',
    '/projects/a\n', '/projects/a\r', '/writing/Hello-world', '/writing/a/b',
    '/writing/', '/writing/a_b', '/maps/Play', '/maps/unknown', '/maps/play/extra',
    '/maps/play/', '/maps/', '/about/story', '/cv/pdf', '/terminal/2',
    '/settings/appearance', '/trash', '/guestbook', '/postcards/message',
    'https://os.nipuntheekshana.com/projects',
  ])('rejects an unknown or malformed pathname: %j', (pathname) => {
    expect(matchRoute(pathname)).toBeNull();
  });

  it.each(['projects', 'writing'] as const)('rejects malformed %s routes when constructing paths', (appId) => {
    for (const route of ['Salli', 'a/b', '/a', 'a/', 'a_b', 'a b', 'a?b', 'a#b', 'a\n', 'a\r', 'a%2Fb']) {
      expect(() => pathFor(appId, route)).toThrow(RangeError);
    }
  });

  it('rejects unsupported sub-routes for fixed and root-only apps', () => {
    for (const { appId } of ROUTES.filter(({ subRoutes }) => subRoutes === 'none')) {
      expect(() => pathFor(appId, 'extra')).toThrow(RangeError);
    }
    for (const route of ['unknown', 'Play', 'play/extra']) {
      expect(() => pathFor('maps', route)).toThrow(RangeError);
    }
  });
});

const windows: [AppId, number, number, number, number, boolean, boolean, TitleBarKind][] = [
  ['projects', 960, 640, 560, 400, true, true, 'unified'],
  ['writing', 1000, 680, 600, 420, true, true, 'unified'],
  ['about', 760, 560, 520, 420, true, true, 'transparent'],
  ['cv', 820, 760, 520, 480, true, true, 'standard'],
  ['terminal', 720, 440, 420, 260, true, true, 'terminal'],
  ['maps', 1040, 700, 600, 440, true, true, 'transparent'],
  ['activity', 920, 600, 560, 420, true, true, 'standard'],
  ['messages', 780, 560, 480, 400, true, true, 'unified'],
  ['now', 360, 440, 300, 320, true, false, 'paper'],
  ['settings', 680, 520, 680, 520, false, false, 'unified'],
  ['trash', 640, 420, 420, 300, true, true, 'unified'],
  ['readme', 520, 600, 400, 360, true, true, 'standard'],
  ['guestbook', 960, 680, 600, 460, true, true, 'unified'],
];

describe('app metadata', () => {
  it.each(windows)('matches the specified window for %s', (
    appId, width, height, minWidth, minHeight, resizable, zoomable, titleBar,
  ) => {
    expect(APP_META[appId].window).toEqual({ width, height, minWidth, minHeight, resizable, zoomable, titleBar });
  });

  it('contains all 13 apps with useful search metadata and default titles', () => {
    expect(Object.keys(APP_META).sort()).toEqual(windows.map(([appId]) => appId).sort());
    for (const [appId] of windows) {
      const meta = APP_META[appId];
      expect(meta.id).toBe(appId);
      expect(meta.icon).toBe(`app-${appId}`);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.keywords.length).toBeGreaterThan(0);
      expect(titleFor(meta, '')).toBe(meta.name);
    }
    expect(titleFor(APP_META.projects, 'salli')).toBe('Projects');
    expect(titleFor(APP_META.writing, 'hello-world')).toBe('Writing');
    expect(titleFor(APP_META.maps, 'play')).toBe('Island');
    expect(titleFor(APP_META.terminal, '')).toBe('Terminal');
    expect(APP_META.trash.name).toBe('Kooda');
    expect(APP_META.readme.name).toBe('Read me');
    expect(APP_META.guestbook.name).toBe('Postcards');
  });

  it('keeps only Terminal multi-instance, Postcards enabled, and Settings/Kooda noindex', () => {
    const apps = Object.values(APP_META);
    expect(apps.filter(({ multiInstance }) => multiInstance).map(({ id }) => id)).toEqual(['terminal']);
    expect(apps.filter(({ phase }) => phase === 'later').map(({ id }) => id)).toEqual([]);
    expect(apps.filter(({ phase }) => phase === 'v1')).toHaveLength(13);
    expect(apps.filter(({ indexable }) => !indexable).map(({ id }) => id).sort()).toEqual(['settings', 'trash']);
    expect(APP_META.guestbook).toMatchObject({
      dockOrder: 4.5, desktopIcon: { order: 6, label: 'Postcards', icon: 'app-guestbook' }, mobile: { gridOrder: null, dockOrder: null },
    });
  });

  it('orders the desktop dock and reserves Kooda for after the external links', () => {
    const apps = Object.values(APP_META)
      .filter((meta) => meta.dockOrder !== null)
      .sort((a, b) => a.dockOrder! - b.dockOrder!);
    expect(apps.map(({ id, dockOrder }) => [id, dockOrder])).toEqual([
      ['projects', 1], ['about', 2], ['writing', 3], ['messages', 4], ['guestbook', 4.5], ['terminal', 5],
      ['maps', 6], ['activity', 7], ['cv', 8], ['settings', 9], ['trash', 99],
    ]);
    expect(DOCK_LINKS).toEqual([
      { id: 'github', label: 'GitHub', href: 'https://github.com/theetaz', icon: 'link-github' },
      { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/nipun-theekshana/', icon: 'link-linkedin' },
      { id: 'prabhava', label: 'Prabhava Labs', href: 'https://prabhavalabs.com', icon: 'link-prabhava' },
    ]);
  });

  it('orders all desktop icons and routes the Pin the city alias to play', () => {
    const icons = Object.values(APP_META).flatMap(({ desktopIcon }) => desktopIcon ? [desktopIcon] : [])
      .sort((a, b) => a.order - b.order);
    expect(icons).toEqual([
      { order: 1, label: 'Read me.txt', icon: 'app-readme' },
      { order: 2, label: 'Projects', icon: 'folder-projects' },
      { order: 3, label: 'Writing', icon: 'folder-writing' },
      { order: 4, label: 'CV.pdf', icon: 'doc-cv' },
      { order: 5, label: 'Pin the city', icon: 'app-pin', route: 'play' },
      { order: 6, label: 'Postcards', icon: 'app-guestbook' },
    ]);
    expect(pathFor('maps', APP_META.maps.desktopIcon!.route!)).toBe('/maps/play');
  });

  it('orders the eight mobile app icons and the four mobile dock apps', () => {
    const apps = Object.values(APP_META);
    expect(apps.filter(({ mobile }) => mobile.gridOrder !== null)
      .sort((a, b) => a.mobile.gridOrder! - b.mobile.gridOrder!)
      .map(({ id, mobile }) => [id, mobile.gridOrder])).toEqual([
      ['about', 1], ['cv', 2], ['maps', 3], ['activity', 4],
      ['now', 5], ['settings', 6], ['trash', 7], ['readme', 8],
    ]);
    expect(apps.filter(({ mobile }) => mobile.dockOrder !== null)
      .sort((a, b) => a.mobile.dockOrder! - b.mobile.dockOrder!)
      .map(({ id, mobile }) => [id, mobile.dockOrder])).toEqual([
      ['projects', 1], ['writing', 2], ['messages', 3], ['terminal', 4],
    ]);
  });

  it('uses the specified skeletons for every app', () => {
    expect(Object.fromEntries(Object.values(APP_META).map(({ id, skeleton }) => [id, skeleton])))
      .toEqual({
        projects: 'sidebar-grid', about: 'document', writing: 'three-pane', messages: 'three-pane',
        terminal: 'terminal', maps: 'canvas', activity: 'canvas', cv: 'document', settings: 'form',
        now: 'note', trash: 'sidebar-grid', readme: 'document', guestbook: 'sidebar-grid',
      });
  });
});
