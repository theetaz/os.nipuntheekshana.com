import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import type { AppProps } from '../../registry/apps';
import { pinBestAtom, reducedMotionAtom, windowAtom } from '../../state/atoms';
import { useAppCommands, useAppMenuState } from '../../wm/commands';
import { DEFAULT_LAYERS, type IslandData, type MapSurface } from './surface';
import { MapsView } from './views/MapsView';
export { menus } from './menus';
export default function MapsApp({ ready, route, navigate, scrollRootRef, windowId, initialData }: AppProps) {
  const win = useAtomValue(windowAtom(windowId)); const reduced = useAtomValue(reducedMotionAtom);
  const [best, setBest] = useAtom(pinBestAtom); const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const surface = useRef<MapSurface | null>(null); const readyCalled = useRef(false);
  const onMode = useCallback((play: boolean) => navigate(play ? 'play' : '', { title: 'Island' }), [navigate]);
  const onBest = useCallback((score: number, perfect: boolean) => {
    setBest(previous => Math.max(previous, score));
    if (perfect) document.dispatchEvent(new CustomEvent('serendib:pin-perfect', { detail: { score, windowId } }));
  }, [setBest, windowId]);
  useLayoutEffect(() => { if (!readyCalled.current) { readyCalled.current = true; ready(); } }, [ready]);
  useAppCommands(windowId, command => {
    if (command === 'maps.explore' || command === 'maps.play') onMode(command === 'maps.play');
    else if (command === 'maps.recentre') surface.current?.recentre();
    else if (command === 'maps.zoom-in' || command === 'maps.zoom-out') surface.current?.zoom(command === 'maps.zoom-in' ? 1.1 : 1 / 1.1);
    else if (command === 'maps.labels' || command === 'maps.graticule' || command === 'maps.coastline') {
      const key = command.slice(5) as keyof typeof layers; setLayers(previous => ({ ...previous, [key]: !previous[key] }));
    } else return false;
    return true;
  });
  useAppMenuState(windowId, { 'maps.explore': { checked: route !== 'play' }, 'maps.play': { checked: route === 'play' },
    'maps.labels': { checked: layers.labels && route !== 'play', disabled: route === 'play' }, 'maps.graticule': { checked: layers.graticule }, 'maps.coastline': { checked: layers.coastline } });
  return <MapsView play={route === 'play'} active={!win?.minimized && !win?.closing} reduced={reduced} initialData={initialData as IslandData | null} best={best} onBest={onBest} onMode={onMode} scrollRootRef={scrollRootRef} layers={layers} setLayers={setLayers} surfaceRef={surface} />;
}
