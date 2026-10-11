import type { ComponentType, RefObject } from 'react';
import type { AppId, AppMenus, AppMeta } from '../types/apps';
import type { WindowId } from '../wm/types';
import { APP_META } from './meta';

export interface AppProps {
  windowId: WindowId; appId: AppId; route: string; query: Readonly<Record<string, string>>;
  mode: 'desktop' | 'mobile'; focused: boolean; initialData: unknown | null;
  navigate(route: string, opts?: { query?: Record<string, string>; title?: string; replace?: boolean }): void;
  setQuery(query: Record<string, string>, opts?: { replace?: boolean }): void;
  setTitle(title: string): void; ready(): void; close(): void;
  scrollRootRef: RefObject<HTMLElement | null>;
}
export interface AppModule { default: ComponentType<AppProps>; menus?: AppMenus }
export interface AppDefinition extends AppMeta { load(): Promise<AppModule> }
export const APPS: Readonly<Record<AppId, AppDefinition>> = {
  projects: { ...APP_META.projects, load: () => import('../apps/projects/ProjectsApp') },
  writing: { ...APP_META.writing, load: () => import('../apps/writing/WritingApp') },
  about: { ...APP_META.about, load: () => import('../apps/about/AboutApp') },
  cv: { ...APP_META.cv, load: () => import('../apps/cv/CvApp') },
  terminal: { ...APP_META.terminal, load: () => import('../apps/terminal/TerminalApp') },
  maps: { ...APP_META.maps, load: () => import('../apps/maps/MapsApp') },
  activity: { ...APP_META.activity, load: () => import('../apps/activity/ActivityApp') },
  messages: { ...APP_META.messages, load: () => import('../apps/messages/MessagesApp') },
  now: { ...APP_META.now, load: () => import('../apps/now/NowApp') },
  settings: { ...APP_META.settings, load: () => import('../apps/settings/SettingsApp') },
  trash: { ...APP_META.trash, load: () => import('../apps/trash/TrashApp') },
  readme: { ...APP_META.readme, load: () => import('../apps/readme/ReadmeApp') },
  guestbook: { ...APP_META.guestbook, load: () => import('../apps/guestbook/GuestbookApp') },
};
