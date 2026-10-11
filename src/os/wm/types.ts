import type { AppId } from '../types/apps';
import type { ParsedLocation } from '../url/url';

export type WindowId = string;
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Viewport { w: number; h: number }
export type SnapZone = 'max' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type WindowMode = 'normal' | 'snapped' | 'maximized';
export type HistoryMode = 'push' | 'replace' | 'none';
/** Explicit opt-in from the later health endpoint; v1 enables no backend apps. */
export interface WMFeatures { readonly postcards?: boolean }
export type TransitionKind = 'none' | 'open' | 'snap' | 'zoom' | 'unsnap' | 'minimize' | 'restore' | 'close';
export interface Transition { kind: TransitionKind; seq: number; origin: Point | null }

export interface WindowState {
  id: WindowId;
  appId: AppId;
  instance: number;
  route: string;
  query: Readonly<Record<string, string>>;
  title: string;
  rect: Rect;
  restoreRect: Rect;
  mode: WindowMode;
  snap: SnapZone | null;
  minimized: boolean;
  closing: boolean;
  adopted: boolean;
  createdSeq: number;
  transition: Transition;
}

export interface DesktopState {
  windows: Readonly<Record<WindowId, WindowState>>;
  order: readonly WindowId[];
  focusedId: WindowId | null;
  viewport: Viewport;
  seq: number;
  showDesktopStash: readonly WindowId[] | null;
  history: HistoryMode;
}

export type WMAction =
  | { type: 'OPEN'; appId: AppId; route?: string; query?: Record<string, string>; origin?: Point | null;
      newInstance?: boolean; rect?: Rect; adopted?: boolean; history?: HistoryMode }
  | { type: 'CLOSE'; id: WindowId }
  | { type: 'FINISH_CLOSE'; id: WindowId }
  | { type: 'QUIT_APP'; appId: AppId }
  | { type: 'CLOSE_ALL' }
  | { type: 'FOCUS'; id: WindowId }
  | { type: 'FOCUS_DESKTOP' }
  | { type: 'CYCLE'; direction: 1 | -1 }
  | { type: 'MOVE'; id: WindowId; x: number; y: number }
  | { type: 'RESIZE'; id: WindowId; rect: Rect }
  | { type: 'MINIMIZE'; id: WindowId }
  | { type: 'RESTORE'; id: WindowId }
  | { type: 'TOGGLE_MAXIMIZE'; id: WindowId }
  | { type: 'SNAP'; id: WindowId; zone: SnapZone }
  | { type: 'UNSNAP'; id: WindowId; pointer: Point }
  | { type: 'NAVIGATE'; id: WindowId; route: string; query?: Record<string, string>; title?: string; history?: 'push' | 'replace' }
  | { type: 'SET_QUERY'; id: WindowId; query: Record<string, string>; history?: 'push' | 'replace' }
  | { type: 'SET_TITLE'; id: WindowId; title: string }
  | { type: 'SHOW_DESKTOP' }
  | { type: 'VIEWPORT'; viewport: Viewport }
  | { type: 'SYNC_FROM_URL'; target: ParsedLocation };

export function createDesktopState(viewport: Viewport = { w: 1440, h: 900 }): DesktopState {
  return { windows: {}, order: [], focusedId: null, viewport: { ...viewport }, seq: 0,
    showDesktopStash: null, history: 'none' };
}
