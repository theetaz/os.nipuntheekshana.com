import { WALLPAPERS, WALLPAPER_NAMES } from '../../../state/prefs';
import { useId } from 'react';
import { Segmented } from '../../../ui/Segmented';
import type { SectionProps } from '../settings';
import skyline from '../../../../assets/wallpapers/skyline.svg?raw';

function WallpaperPreview({ id }: { id: string }) {
  const prefix = useId().replace(/:/g, '');
  const uniqueSkyline = skyline.replace(/id="(wp-[^"]+)"/g, `id="${prefix}-$1"`).replace(/#(wp-[\w-]+)/g, `#${prefix}-$1`);
  return <span className="settings-wallpaper-frame" aria-hidden="true"><span className="wallpaper settings-wallpaper" data-preview={id}>
    <span className="wp-layer wp-sky" /><span className="wp-layer wp-rays" /><span className="wp-layer wp-dots" />
    <span className="wp-layer wp-sun" /><span className="wp-layer wp-sea" /><span className="wp-layer wp-skyline" dangerouslySetInnerHTML={{ __html: uniqueSkyline }} />
  </span></span>;
}
export function Wallpaper({ preferences, actions }: SectionProps & { liveUnavailable: string | null }) {
  return <><h2>Wallpaper</h2><p className="settings-description">A little piece of the island.</p>
    <Segmented label="Wallpaper" className="settings-wallpapers" value={preferences.wallpaper}
      options={WALLPAPERS.map(value => ({ value, disabled: !actions, label: <><WallpaperPreview id={value} /><span>{WALLPAPER_NAMES[value]}</span></> }))}
      onChange={value => { if (WALLPAPERS.includes(value as typeof WALLPAPERS[number])) actions?.wallpaper(value as typeof WALLPAPERS[number]); }} />
    <p className="settings-hint">Each wallpaper follows the light or dark theme.</p></>;
}
