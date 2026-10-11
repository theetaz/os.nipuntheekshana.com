import { APP_META } from '../os/registry/meta';
import type { SearchEntry } from '../os/types/content';
import { getClientPosts, getClientProfile, getClientProjects } from './client-data';

let cache: Promise<SearchEntry[]> | undefined;
export function buildSearchIndex(): Promise<SearchEntry[]> {
  return cache ??= (async () => {
    const [projects, posts, profile] = await Promise.all([getClientProjects(), getClientPosts(), getClientProfile()]);
    const apps: SearchEntry[] = Object.values(APP_META).filter((app) => app.phase === 'v1').map((app) => ({
      id: `app:${app.id}`, kind: 'app', title: app.name, subtitle: app.description,
      keywords: app.keywords.join(' '), icon: app.icon, target: { type: 'app', appId: app.id },
    }));
    const projectEntries: SearchEntry[] = projects.map((project) => ({
      id: `project:${project.slug}`, kind: 'project', title: project.title, subtitle: project.tagline,
      keywords: [project.tagline, ...project.stack, project.category, project.categoryLabel, project.native ?? ''].join(' '),
      icon: `project:${project.slug}`, featured: project.featured,
      target: { type: 'app', appId: 'projects', route: project.slug },
    }));
    const postEntries: SearchEntry[] = posts.map((post) => ({
      id: `post:${post.slug}`, kind: 'post', title: post.title, subtitle: post.description,
      keywords: [post.description, ...post.tags, post.kind].join(' '), icon: 'app-writing',
      target: { type: 'app', appId: 'writing', route: post.slug },
    }));
    const actions: SearchEntry[] = [
      { id: 'action:theme', kind: 'action', title: 'Toggle dark appearance', subtitle: 'Switch light and dark', keywords: 'theme appearance night light dark', icon: 'app-settings', target: { type: 'action', action: 'theme' } },
      { id: 'action:email', kind: 'action', title: 'Copy email address', subtitle: profile.site.email, keywords: 'contact clipboard mail', icon: 'app-messages', target: { type: 'action', action: 'email' } },
      { id: 'action:cv', kind: 'action', title: 'Download CV (PDF)', subtitle: profile.cv.sizeLabel, keywords: 'resume download experience pdf', icon: 'app-cv', target: { type: 'href', href: profile.cv.href } },
      { id: 'action:play', kind: 'action', title: 'Play Pin the city', subtitle: 'A Sri Lankan geography game', keywords: 'island maps game sri lanka geography', icon: 'app-pin', target: { type: 'app', appId: 'maps', route: 'play' } },
      { id: 'action:mochi', kind: 'action', title: 'Wake Mochi', subtitle: 'Say hello to the desktop companion', keywords: 'pet companion wake mochi', icon: 'app-about', target: { type: 'action', action: 'mochi' } },
      { id: 'action:wallpaper', kind: 'action', title: 'Change wallpaper…', subtitle: 'Desktop backgrounds', keywords: 'wallpaper background settings', icon: 'app-settings', target: { type: 'action', action: 'wallpaper' } },
      { id: 'action:simple', kind: 'action', title: 'Simple view', subtitle: 'Read the site without the desktop', keywords: 'simple accessibility reading', icon: 'app-readme', target: { type: 'action', action: 'simple' } },
      { id: 'action:trash', kind: 'action', title: 'Empty Kooda', subtitle: 'Clear the basket', keywords: 'trash basket empty kooda', icon: 'app-trash', target: { type: 'action', action: 'trash' } },
    ];
    return [...apps, ...projectEntries, ...postEntries, ...actions];
  })();
}
