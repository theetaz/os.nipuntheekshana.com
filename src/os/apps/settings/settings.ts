import type { MochiPrefs, WallpaperId } from '../../state/prefs';
import { CODENAME, VERSION } from '../../config';

export const SECTIONS = [
  { id: 'appearance', label: 'Appearance' }, { id: 'wallpaper', label: 'Wallpaper' },
  { id: 'accessibility', label: 'Accessibility' }, { id: 'sound', label: 'Sound' },
  { id: 'mochi', label: 'Mochi' }, { id: 'desktop', label: 'Desktop' },
  { id: 'about', label: 'About' }, { id: 'developer', label: 'Developer' },
] as const;
export type SectionId = typeof SECTIONS[number]['id'];
export function sectionFor(value: string | undefined, developer: boolean): SectionId {
  return SECTIONS.find(section => section.id === value && (developer || section.id !== 'developer'))?.id ?? 'appearance';
}
export interface SettingsData {
  build: { version: string; codename: string; sha: string; date: string | null };
  source: string;
}
export const DEFAULT_DATA: SettingsData = {
  build: { version: VERSION, codename: CODENAME, sha: import.meta.env.PUBLIC_BUILD_SHA ?? 'local', date: import.meta.env.PUBLIC_BUILD_DATE ?? null },
  source: 'https://github.com/theetaz/nipuntheekshana.com',
};
export interface SettingsPreferences {
  theme: 'auto' | 'light' | 'dark'; accent: 'thambili' | 'lagoon' | 'lotus' | 'tea';
  wallpaper: WallpaperId; motion: 'system' | 'reduce' | 'full'; transparency: 'system' | 'reduce';
  sound: boolean; volume: number; mochi: MochiPrefs;
}
export const DEFAULT_PREFERENCES: SettingsPreferences = {
  theme: 'auto', accent: 'thambili', wallpaper: 'kottu', motion: 'system', transparency: 'system',
  sound: false, volume: 0.6, mochi: { visible: true, naps: true, pos: null, pets: 0 },
};
export interface SettingsActions {
  theme(value: SettingsPreferences['theme']): void; accent(value: SettingsPreferences['accent']): void;
  wallpaper(value: WallpaperId): void; motion(value: SettingsPreferences['motion']): void;
  transparency(value: SettingsPreferences['transparency']): void;
  sound(value: boolean): void; volume(value: number): void;
  mochi(value: Partial<MochiPrefs>): void; resetPets(): void; resetGeometry(): void;
  simple(): void; sample(): void; shortcuts(): void;
}
export interface SectionProps { preferences: SettingsPreferences; actions?: SettingsActions }
