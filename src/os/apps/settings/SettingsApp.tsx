import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { RESET } from 'jotai/utils';
import type { AppProps } from '../../registry/apps';
import { accentAtom, devModeAtom, geometryAtom, iconPositionsAtom, mochiPrefsAtom, motionPrefAtom,
  showWidgetsAtom, soundAtom, themePrefAtom, transparencyPrefAtom, viewAtom, volumeAtom, wallpaperAtom } from '../../state/atoms';
import { alert, announce, openApp, toast, useAppCommands, useAppMenuState } from '../../wm/commands';
import { readInitialData } from '../../lib/initial-data';
import { DEFAULT_DATA, SECTIONS, sectionFor, type SettingsActions, type SettingsData, type SettingsPreferences } from './settings';
import { SettingsView } from './views/SettingsView';
export { menus } from './menus';

export default function SettingsApp({ windowId, query, setQuery, setTitle, ready, scrollRootRef, focused, initialData }: AppProps) {
  const [theme, setTheme] = useAtom(themePrefAtom); const [accent, setAccent] = useAtom(accentAtom);
  const [wallpaper, setWallpaper] = useAtom(wallpaperAtom); const [motion, setMotion] = useAtom(motionPrefAtom);
  const [transparency, setTransparency] = useAtom(transparencyPrefAtom); const [sound, setSound] = useAtom(soundAtom);
  const [volume, setVolume] = useAtom(volumeAtom); const [widgets, setWidgets] = useAtom(showWidgetsAtom);
  const [mochi, setMochi] = useAtom(mochiPrefsAtom); const developer = useAtomValue(devModeAtom);
  const setIcons = useSetAtom(iconPositionsAtom); const setGeometry = useSetAtom(geometryAtom); const setView = useSetAtom(viewAtom);
  const section = sectionFor(query.section, developer);
  const title = SECTIONS.find(item => item.id === section)!.label;
  const titleCallback = useRef(setTitle); titleCallback.current = setTitle;
  const readyCalled = useRef(false);
  useLayoutEffect(() => { titleCallback.current(title); }, [title]);
  useLayoutEffect(() => { if (!readyCalled.current) { readyCalled.current = true; ready(); } }, [ready]);
  const [liveUnavailable, setLiveUnavailable] = useState<string | null>('Checking WebGL availability.');
  useEffect(() => {
    if (section !== 'wallpaper') return;
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const check = () => {
      if (connection?.saveData) { setLiveUnavailable('Unavailable while Data Saver is on.'); return; }
      try {
        const context = document.createElement('canvas').getContext('webgl2');
        setLiveUnavailable(context ? null : 'WebGL 2 is unavailable on this device.');
        context?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch { setLiveUnavailable('WebGL 2 is unavailable on this device.'); }
    };
    check(); connection?.addEventListener('change', check);
    return () => connection?.removeEventListener('change', check);
  }, [section]);
  const selectSection = (next: typeof section) => {
    setQuery({ ...query, section: next });
    if (scrollRootRef.current) scrollRootRef.current.scrollTop = 0;
  };
  const actions: SettingsActions = {
    theme: setTheme, accent: setAccent, wallpaper: value => {
      if (value !== 'island-live' || liveUnavailable === null) setWallpaper(value);
    }, motion: setMotion, transparency: setTransparency, sound: setSound, volume: setVolume, widgets: setWidgets,
    mochi: value => setMochi(previous => ({ ...previous, ...value })),
    resetPets: () => { void alert({ windowId, title: 'Reset Mochi’s pet count?', body: 'Mochi will still remember you. The counter will start at zero.',
      primary: 'Reset', cancel: 'Cancel' }).then(result => { if (result === 'primary') { setMochi(previous => ({ ...previous, pets: 0 })); announce('Mochi’s pet count reset.'); } }); },
    resetIcons: () => { setIcons(RESET); toast({ title: 'Icon positions reset' }); },
    resetGeometry: () => { setGeometry(RESET); toast({ title: 'Window sizes and positions reset' }); },
    simple: () => setView('simple'),
    sample: () => { void import('../../lib/sound').then(module => module.playSound('pop')).catch(() => {}); },
    shortcuts: () => openApp('readme', { query: { section: 'shortcuts' } }),
  };
  useAppCommands(windowId, command => {
    const next = command.startsWith('settings.section.') ? command.slice('settings.section.'.length) : '';
    if (SECTIONS.some(item => item.id === next) && (next !== 'developer' || developer)) { selectSection(sectionFor(next, developer)); return true; }
    return false;
  });
  const menuState = useMemo(() => Object.fromEntries(SECTIONS.map(item => [`settings.section.${item.id}`, {
    checked: item.id === section, disabled: item.id === 'developer' && !developer,
  }])), [section, developer]);
  useAppMenuState(windowId, menuState);
  const preferences: SettingsPreferences = { theme, accent, wallpaper, motion, transparency, sound, volume, widgets, mochi };
  const data = (initialData as SettingsData | null) ?? readInitialData<SettingsData>('settings:index') ?? DEFAULT_DATA;
  return <SettingsView preferences={preferences} actions={actions} section={section} developer={developer} focused={focused}
    data={data} liveUnavailable={liveUnavailable} onSection={selectSection} scrollRootRef={scrollRootRef} />;
}
