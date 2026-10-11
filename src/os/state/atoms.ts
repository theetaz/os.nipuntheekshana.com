import { atom, type Atom } from 'jotai';
import { atomWithReducer, selectAtom } from 'jotai/utils';
import { wmReducer } from '../wm/reducer';
import { createDesktopState, type Point, type Rect, type SnapZone, type WindowId, type WindowState } from '../wm/types';
import type { AppId, MenuItemSpec } from '../types/apps';
import { motionPrefAtom, themePrefAtom } from './prefs';
import { FEATURES } from '../config';

export * from './prefs';
export const desktopAtom = atomWithReducer(createDesktopState(), (state, action: import('../wm/types').WMAction) =>
  wmReducer(state, action, FEATURES.postcards ? { postcards: true } : {}));
const sameArray = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
export const orderAtom = selectAtom(desktopAtom, state => state.order, sameArray);
export const focusedIdAtom = selectAtom(desktopAtom, state => state.focusedId);
export const focusedAppAtom = selectAtom(desktopAtom, state => state.focusedId ? state.windows[state.focusedId]?.appId ?? null : null);
export type RunningApps = Partial<Record<AppId, { count: number; allMinimized: boolean }>>;
export const runningAtom = selectAtom(desktopAtom, state => {
  const running: RunningApps = {};
  for (const win of Object.values(state.windows)) {
    if (win.closing) continue;
    const prev = running[win.appId];
    running[win.appId] = { count: (prev?.count ?? 0) + 1, allMinimized: (prev?.allMinimized ?? true) && win.minimized };
  }
  return running;
}, (a, b) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([id, value]) => {
  const other = b[id as AppId]; return value.count === other?.count && value.allMinimized === other.allMinimized;
}));
const windowAtomCache = new Map<WindowId, Atom<WindowState | undefined>>();
export function windowAtom(id: WindowId): Atom<WindowState | undefined> {
  let selected = windowAtomCache.get(id);
  if (!selected) { selected = selectAtom(desktopAtom, state => state.windows[id]); windowAtomCache.set(id, selected); }
  return selected;
}
export function releaseWindowAtom(id: WindowId): void { windowAtomCache.delete(id); }
export const systemDarkAtom = atom(false);
export const systemReducedMotionAtom = atom(false);
export const systemReducedTransparencyAtom = atom(false);
export const onlineAtom = atom(true);
export const modeAtom = atom<'desktop' | 'mobile'>('desktop');
export const resolvedThemeAtom = atom(get => {
  const preference = get(themePrefAtom);
  return preference === 'auto' ? get(systemDarkAtom) ? 'dark' : 'light' : preference;
});
export const reducedMotionAtom = atom(get => get(motionPrefAtom) === 'system' ? get(systemReducedMotionAtom) : get(motionPrefAtom) === 'reduce');

export interface AlertSpec {
  id?: string; windowId?: WindowId; title: string; body?: string; primary?: string; cancel?: string; danger?: boolean;
  resolve?: (result: 'primary' | 'cancel') => void;
}
export interface Toast { id?: string; title: string; body?: string; action?: { label: string; run(): void }; duration?: number }
export type AppMenuState = Record<string, { checked?: boolean; disabled?: boolean }>;
export const openMenuAtom = atom<string | null>(null);
export const contextMenuAtom = atom<{ x: number; y: number; items: readonly MenuItemSpec[]; target: string } | null>(null);
export const spotlightOpenAtom = atom(false);
export const quickLookAtom = atom<{ from: Rect | null } | null>(null);
export const alertsAtom = atom<AlertSpec[]>([]);
export const toastsAtom = atom<Toast[]>([]);
export const announceAtom = atom<{ text: string; politeness: 'polite' | 'assertive'; seq: number }>({ text: '', politeness: 'polite', seq: 0 });
export const snapPreviewAtom = atom<{ zone: SnapZone; rect: Rect; valid: boolean } | null>(null);
export const appLoadAtom = atom<Partial<Record<AppId, 'loading' | 'ready' | 'error'>>>({});
export const menuStateAtom = atom<Record<WindowId, AppMenuState>>({});
export const bootPhaseAtom = atom<'off' | 'running' | 'exiting'>('off');
export const overlayAtom = atom<'none' | 'screensaver' | 'shutdown'>('none');
export const updateAvailableAtom = atom(false);
export const koodaEmptyAtom = atom(false);
export type { Point };
