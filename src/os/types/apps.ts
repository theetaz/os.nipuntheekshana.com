export type AppId =
  | 'projects' | 'writing' | 'about' | 'cv' | 'terminal' | 'maps' | 'activity'
  | 'messages' | 'now' | 'settings' | 'trash' | 'readme' | 'guestbook';

export type TitleBarKind = 'standard' | 'unified' | 'transparent' | 'paper' | 'terminal';
export type SkeletonKind = 'sidebar-grid' | 'three-pane' | 'document' | 'terminal' | 'canvas' | 'form' | 'note';

export interface WindowSpec {
  width: number; height: number;
  minWidth: number; minHeight: number;
  resizable: boolean; zoomable: boolean;
  titleBar: TitleBarKind;
}

export interface AppMeta {
  id: AppId;
  name: string;
  description: string;
  keywords: readonly string[];
  icon: AppIconId;
  basePath: `/${string}`;
  subRoutes: 'none' | 'slug' | readonly string[];
  window: WindowSpec;
  skeleton: SkeletonKind;
  multiInstance: boolean;
  dockOrder: number | null;
  desktopIcon: { order: number; label: string; icon: AppIconId; route?: string } | null;
  mobile: { gridOrder: number | null; dockOrder: number | null };
  phase: 'v1' | 'later';
  indexable: boolean;
}

export type AppIconId =
  | 'app-projects' | 'app-about' | 'app-writing' | 'app-messages' | 'app-terminal' | 'app-maps'
  | 'app-activity' | 'app-cv' | 'app-settings' | 'app-now' | 'app-readme' | 'app-trash' | 'app-trash-full'
  | 'app-pin' | 'app-guestbook' | 'folder-projects' | 'folder-writing' | 'doc-cv'
  | 'link-github' | 'link-linkedin' | 'link-prabhava';

export interface Shortcut { code: string; alt?: boolean; shift?: boolean; mod?: boolean }
export type MenuItemSpec =
  | { kind: 'item'; label: string; command: string; shortcut?: Shortcut; role?: 'checkbox' | 'radio' }
  | { kind: 'separator' }
  | { kind: 'submenu'; label: string; items: readonly MenuItemSpec[] }
  | { kind: 'windows' };
export interface AppMenus {
  view?: readonly MenuItemSpec[];
  file?: readonly MenuItemSpec[];
  extra?: readonly { label: string; items: readonly MenuItemSpec[] }[];
}
