import { atomWithStorage } from 'jotai/utils';
import type { AppId } from '../types/apps';
import type { Point, Rect } from '../wm/types';
import type { OsStore } from './store';
import { modeAtom, resolvedThemeAtom } from './atoms';
import { isBoolean, isNonnegative, isPoint, isRecordOf, oneOf, preferenceStorage, stringList, type Validator } from './storage';

export const WALLPAPERS = ['galle-face', 'island', 'contours', 'monsoon', 'paper', 'island-live'] as const;
export type WallpaperId = typeof WALLPAPERS[number];
export interface MochiPrefs { visible: boolean; naps: boolean; pos: Point | null; pets: number }
function pref<T>(key: string, initial: T, valid: Validator<T>) {
  return atomWithStorage(`serendib:${key}`, initial, preferenceStorage(valid), { getOnInit: false });
}
export const themePrefAtom = pref('theme', 'auto' as 'auto' | 'light' | 'dark', oneOf(['auto', 'light', 'dark']));
export const wallpaperAtom = pref<WallpaperId>('wallpaper', 'galle-face', oneOf(WALLPAPERS));
export const accentAtom = pref('accent', 'thambili' as 'thambili' | 'lagoon' | 'lotus' | 'tea', oneOf(['thambili', 'lagoon', 'lotus', 'tea']));
export const motionPrefAtom = pref('motion', 'system' as 'system' | 'reduce' | 'full', oneOf(['system', 'reduce', 'full']));
export const transparencyPrefAtom = pref('transparency', 'system' as 'system' | 'reduce', oneOf(['system', 'reduce']));
export const viewAtom = pref('view', 'desktop' as 'desktop' | 'simple', oneOf(['desktop', 'simple']));
export const soundAtom = pref('sound', false, isBoolean);
export const volumeAtom = pref('volume', 0.6, (value): value is number => isNonnegative(value) && value <= 1);
export const showWidgetsAtom = pref('widgets', true, isBoolean);
export const mochiPrefsAtom = pref<MochiPrefs>('mochi', { visible: true, naps: true, pos: null, pets: 0 },
  (value): value is MochiPrefs => !!value && typeof value === 'object' && 'visible' in value && isBoolean(value.visible)
    && 'naps' in value && isBoolean(value.naps) && 'pos' in value && (value.pos === null || isPoint(value.pos))
    && 'pets' in value && isNonnegative(value.pets) && Number.isInteger(value.pets));
export const iconPositionsAtom = pref<Partial<Record<string, Point>>>('icons:v1', {}, isRecordOf(isPoint));
export const geometryAtom = pref<Partial<Record<AppId, Rect>>>('geometry:v1', {}, isRecordOf(
  (value): value is Rect => isPoint(value) && 'w' in value && 'h' in value
    && isNonnegative(value.w) && value.w > 0 && isNonnegative(value.h) && value.h > 0));
export const terminalHistoryAtom = pref<string[]>('terminal:history', [], stringList(100));
export const pinBestAtom = pref('pin:best', 0, isNonnegative);
export const recentAtom = pref<string[]>('recent', [], stringList(5));
export const devModeAtom = pref('dev', false, isBoolean);
export const bootedAtom = pref('booted', false, isBoolean);

export const preferenceAtoms = [themePrefAtom, wallpaperAtom, accentAtom, motionPrefAtom, transparencyPrefAtom,
  viewAtom, soundAtom, volumeAtom, showWidgetsAtom, mochiPrefsAtom, iconPositionsAtom, geometryAtom,
  terminalHistoryAtom, pinBestAtom, recentAtom, devModeAtom, bootedAtom] as const;

/** Mount storage subscriptions after hydration, before mirroring; never read storage during SSR. */
export function subscribePreferences(store: OsStore, html: HTMLElement): () => void {
  const storageCleanups = preferenceAtoms.map(preference => store.sub(preference, () => {}));
  let theme = html.dataset.theme;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mirror = () => {
    const next = store.get(resolvedThemeAtom);
    if (theme !== next) {
      html.classList.add('theme-changing');
      clearTimeout(timer);
      timer = setTimeout(() => html.classList.remove('theme-changing'), 240);
    }
    theme = next;
    Object.assign(html.dataset, { theme: next, wallpaper: store.get(wallpaperAtom), accent: store.get(accentAtom),
      motion: store.get(motionPrefAtom), transparency: store.get(transparencyPrefAtom),
      view: store.get(viewAtom), mode: store.get(modeAtom) });
  };
  const cleanups = [resolvedThemeAtom, wallpaperAtom, accentAtom, motionPrefAtom, transparencyPrefAtom, viewAtom, modeAtom]
    .map(preference => store.sub(preference, mirror));
  mirror();
  return () => { [...cleanups, ...storageCleanups].forEach(cleanup => cleanup()); clearTimeout(timer); html.classList.remove('theme-changing'); };
}
