import { WALLPAPERS, WALLPAPER_NAMES } from '../../../state/prefs';
import { useId } from 'react';
import { Segmented } from '../../../ui/Segmented';
import type { SectionProps } from '../settings';
import skyline from '../../../../assets/wallpapers/skyline.svg?raw';
import islandMask from '../../../../assets/wallpapers/island-mask.svg?raw';
import islandOutline from '../../../../assets/wallpapers/island-outline.svg?raw';

const wallpapers = WALLPAPERS.map(value => ({ value, label: WALLPAPER_NAMES[value] }));
const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}")`;
function WallpaperPreview({ id }: { id: string }) {
  const prefix = useId().replace(/:/g, '');
  // The trusted build-time SVG needs unique definitions beside the desktop SVG.
  const uniqueSkyline = skyline.replace(/id="(wp-[^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/#(wp-[\w-]+)/g, `#${prefix}-$1`);
  return <span className="settings-wallpaper-frame" aria-hidden="true">
    <span className="wallpaper settings-wallpaper" data-preview={id} style={{
      '--wp-island-mask': svgUrl(islandMask), '--wp-island-outline': svgUrl(islandOutline),
    } as React.CSSProperties}>
      <span className="wp-layer wp-sky" /><span className="wp-layer wp-stars" /><span className="wp-layer wp-sun" />
      <span className="wp-layer wp-sea" /><span className="wp-layer wp-skyline" dangerouslySetInnerHTML={{ __html: uniqueSkyline }} />
      <span className="wp-layer wp-rain" /><span className="wp-layer wp-contours" /><span className="wp-layer wp-island" />
      <span className="wp-layer wp-grain" />
    </span>
  </span>;
}
export function Wallpaper({ preferences, actions }: SectionProps & { liveUnavailable: string | null }) {
  return <>
    <h2>Wallpaper</h2><p className="settings-description">A little piece of the island.</p>
    <Segmented label="Wallpaper" className="settings-wallpapers" value={preferences.wallpaper}
      options={wallpapers.map(wallpaper => ({ value: wallpaper.value,
        disabled: !actions,
        label: <><WallpaperPreview id={wallpaper.value} /><span>{wallpaper.label}</span></>,
      }))} onChange={value => { const wallpaper = wallpapers.find(item => item.value === value); if (wallpaper) actions?.wallpaper(wallpaper.value); }} />
    <p className="settings-hint">Each wallpaper follows the light or dark theme.</p>
  </>;
}
