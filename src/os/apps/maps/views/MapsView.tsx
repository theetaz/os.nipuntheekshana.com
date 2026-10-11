import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPinGame, IDLE_STATE, type PinGame, type PinState } from '../../../scenes/pin-game';
import { useAppData } from '../../../lib/fetch-json';
import { createSVGSurface } from '../svg-surface';
import { savesData, supportsWebGL, type IslandData, type MapLayers, type MapSurface, type ScreenPoint } from '../surface';
import { IslandPoster } from './MapsStatic';
import { GameCard } from './GameCard';
import { InfoCard } from './InfoCard';
import { Legend } from './Legend';
import { Readout, readoutFor } from './Readout';

export interface MapsViewProps {
  play: boolean; active: boolean; reduced: boolean; initialData: IslandData | null; best: number;
  onBest(score: number, perfect: boolean): void; onMode(play: boolean): void;
  scrollRootRef: RefObject<HTMLElement | null>;
  layers: MapLayers; setLayers(layers: MapLayers): void;
  surfaceRef: RefObject<MapSurface | null>;
}
export function MapsView({ play, active, reduced, initialData, best, onBest, onMode, scrollRootRef, layers, setLayers, surfaceRef }: MapsViewProps) {
  const { data: island, error, retry } = useAppData<IslandData>('maps:index', '/data/island.json', initialData);
  const stage = useRef<HTMLDivElement>(null); const labels = useRef<HTMLDivElement>(null);
  const game = useRef<PinGame | null>(null); const [state, setState] = useState<PinState>(IDLE_STATE);
  const [kind, setKind] = useState<'poster' | 'webgl' | 'svg'>('poster'); const [count, setCount] = useState(0);
  const [slow, setSlow] = useState(false); const [load, setLoad] = useState(0); const [loading, setLoading] = useState(false);
  const layerButton = useRef<HTMLButtonElement>(null);
  const previousPhase = useRef<PinState['phase']>('idle');
  const [menu, setMenu] = useState(false); const [readout, setReadout] = useState('Indian Ocean');
  const [crosshair, setCrosshair] = useState<ScreenPoint | null>(null); const overlay = useRef<SVGGElement>(null);
  const guessDot = useRef<SVGCircleElement>(null); const truthDot = useRef<SVGCircleElement>(null);
  const truthText = useRef<SVGTextElement>(null); const line = useRef<SVGLineElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null); const moved = useRef(false);
  const latest = useRef({ active, reduced, play, layers, state }); latest.current = { active, reduced, play, layers, state };
  const finished = useRef<PinState | null>(null);
  const upgradeRef = useRef<((forced: boolean) => Promise<void>) | null>(null);
  useEffect(() => { setSlow(savesData()); }, []);

  useEffect(() => {
    const el = stage.current; const labelRoot = labels.current;
    if (!island || !el || !labelRoot) return;
    let cancelled = false; let upgrading = false;
    let current: MapSurface;
    const configure = (surface: MapSurface) => {
      const value = latest.current;
      surface.setReducedMotion(value.reduced); surface.setLayers(value.layers); surface.setLabels(!value.play && value.layers.labels);
      surface.setFocus(value.play); surface.setActive(value.active);
      surfaceRef.current = surface;
      surface.onFrame(() => {
        const state = latest.current.state;
        if (!state.guess || !state.place || !overlay.current) return;
        const g = surface.project(state.guess.lon, state.guess.lat); const t = surface.project(state.place.lon, state.place.lat);
        guessDot.current?.setAttribute('cx', String(g.x)); guessDot.current?.setAttribute('cy', String(g.y));
        truthDot.current?.setAttribute('cx', String(t.x)); truthDot.current?.setAttribute('cy', String(t.y));
        truthText.current?.setAttribute('x', String(t.x + 12)); truthText.current?.setAttribute('y', String(t.y - 12));
        line.current?.setAttribute('x1', String(g.x)); line.current?.setAttribute('y1', String(g.y));
        line.current?.setAttribute('x2', String(t.x)); line.current?.setAttribute('y2', String(t.y));
      });
    };
    const fallback = () => {
      current?.destroy();
      current = createSVGSurface({ stage: el, labels: labelRoot, island, reducedMotion: latest.current.reduced });
      configure(current); setKind('svg'); setLoading(false);
    };
    fallback();
    const proxy = new Proxy({} as MapSurface, { get(_target, key) {
      const value = surfaceRef.current?.[key as keyof MapSurface];
      return typeof value === 'function' ? value.bind(surfaceRef.current) : value;
    } });
    game.current = createPinGame({ surface: proxy, onState: setState });
    if (latest.current.play) game.current.start();
    const upgrade = async (forced: boolean) => {
      if (cancelled || upgrading || current.kind === 'webgl' || !latest.current.active || document.hidden || (!forced && savesData())) return;
      if (!supportsWebGL()) return;
      upgrading = true; setLoading(true);
      try {
        const { createWebGLSurface } = await import('../webgl-surface');
        // The app can be minimised while the scene chunk is in flight.
        if (cancelled || !latest.current.active || document.hidden) { if (!cancelled) setLoading(false); return; }
        const next = await createWebGLSurface({ stage: el, labels: labelRoot, island,
          reducedMotion: latest.current.reduced, canMount: () => !cancelled && latest.current.active && !document.hidden, onContextLost: () => { if (!cancelled) fallback(); } });
        if (cancelled) { next.destroy(); return; }
        current.destroy(); current = next; configure(current); setCount(next.count); setKind('webgl'); setLoading(false);
      } catch { if (!cancelled) fallback(); }
      finally { upgrading = false; }
    };
    upgradeRef.current = upgrade;
    return () => {
      cancelled = true; upgradeRef.current = null;
      game.current?.destroy(); game.current = null; current.destroy(); surfaceRef.current = null;
    };
    // Game state survives renderer upgrades, context loss and mode changes.
  }, [island, surfaceRef]);
  useEffect(() => {
    surfaceRef.current?.setActive(active); surfaceRef.current?.setReducedMotion(reduced);
  }, [active, reduced]);
  useEffect(() => {
    if (!active || !island || (!load && savesData())) return;
    let idle = 0; let frame = 0; let cancelled = false; let painted = !!load; let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => { void upgradeRef.current?.(load > 0); };
    const schedule = () => {
      if (cancelled || !painted) return;
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(run, { timeout: 300 });
      else timer = setTimeout(run, 0);
    };
    // The flat island is already usable. Keep automatic shader/scene work after
    // the text's first complete paint; an explicit Load 3D remains immediate.
    if (load) run();
    else void document.fonts.ready.then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { painted = true; schedule(); }); });
    });
    const visible = () => { if (!document.hidden) schedule(); };
    document.addEventListener('visibilitychange', visible);
    return () => { cancelled = true; cancelAnimationFrame(frame); if (idle) window.cancelIdleCallback(idle); clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [island, load, active]);
  useEffect(() => { surfaceRef.current?.setLayers(layers); surfaceRef.current?.setLabels(!play && layers.labels); }, [layers, play, surfaceRef]);
  useEffect(() => {
    if (play) { if (game.current?.getState().phase === 'idle') game.current.start(); }
    else game.current?.end();
    setCrosshair(null);
  }, [play]);
  useEffect(() => {
    if (state.phase === 'guess' && (previousPhase.current === 'reveal' || previousPhase.current === 'done')) stage.current?.focus({ preventScroll: true });
    previousPhase.current = state.phase;
    if (state.phase === 'done' && finished.current !== state) { finished.current = state; onBest(state.score, state.perfect); }
    // Explicit one-frame redraw also tracks markers in a motion-free SVG/WebGL view.
    surfaceRef.current?.setActive(active);
  }, [state, active, onBest, surfaceRef]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!(event.target as Element).closest('[data-maps-layers]')) setMenu(false); };
    if (menu) document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  function guessAt(x: number, y: number) {
    const at = surfaceRef.current?.pick(x, y); if (at) game.current?.guess(at);
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      event.preventDefault();
      if (play && state.phase === 'guess') {
        const rect = event.currentTarget.getBoundingClientRect(); const point = crosshair ?? { x: rect.width / 2, y: rect.height / 2 }; const step = event.shiftKey ? 80 : 20;
        setCrosshair({ x: Math.max(0, Math.min(rect.width, point.x + (event.code === 'ArrowLeft' ? -step : event.code === 'ArrowRight' ? step : 0))),
          y: Math.max(0, Math.min(rect.height, point.y + (event.code === 'ArrowUp' ? -step : event.code === 'ArrowDown' ? step : 0))) });
      } else if (!play) surfaceRef.current?.orbit(event.code === 'ArrowLeft' ? -.08 : event.code === 'ArrowRight' ? .08 : 0, event.code === 'ArrowUp' ? -.08 : event.code === 'ArrowDown' ? .08 : 0);
    } else if (event.code === 'Enter' && play && state.phase === 'guess') {
      event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); const point = crosshair ?? { x: rect.width / 2, y: rect.height / 2 };
      guessAt(rect.left + point.x, rect.top + point.y);
    } else if (!play && ['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract', 'Digit0'].includes(event.code)) {
      event.preventDefault(); if (event.code === 'Digit0') surfaceRef.current?.recentre(); else surfaceRef.current?.zoom(['Equal', 'NumpadAdd'].includes(event.code) ? 1.1 : 1 / 1.1);
    }
  }
  return <div ref={scrollRootRef as RefObject<HTMLDivElement>} data-scroll-root className="maps-view" data-surface={kind} data-playing={play} onKeyDown={event => { if (event.code === 'Escape' && menu) { event.preventDefault(); setMenu(false); layerButton.current?.focus({ preventScroll: true }); } }}>
    <div className="maps-toolbar"><nav className="maps-modes maps-glass" aria-label="Map mode"><button type="button" aria-pressed={!play} onClick={() => onMode(false)}>Explore</button><button type="button" aria-pressed={play} onClick={() => onMode(true)}>Play</button></nav>
      <div className="maps-tools"><div data-maps-layers><button ref={layerButton} className="maps-glass" type="button" aria-expanded={menu} onClick={() => setMenu(value => !value)}>Layers ▾</button>
        {menu && <fieldset className="maps-layers maps-glass"><legend className="sr-only">Map layers</legend>{(['labels', 'graticule', 'coastline'] as const).map(key => <label key={key}><input type="checkbox" checked={layers[key]} disabled={key === 'labels' && play} onChange={event => setLayers({ ...layers, [key]: event.target.checked })} />{key === 'labels' ? 'Town labels' : key === 'graticule' ? 'Graticule' : 'Coastline'}</label>)}</fieldset>}</div>
        <button className="maps-glass" type="button" onClick={() => surfaceRef.current?.recentre()}>Recentre</button></div>
    </div>
    <div ref={stage} className="maps-stage" role="group" tabIndex={0} aria-label={play ? 'Pin the city map' : 'Explore Sri Lanka map'} aria-describedby="maps-keyboard-help" onKeyDown={keyboard}
      onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY }; moved.current = false; }}
      onPointerMove={event => {
        if (drag.current && Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 5) moved.current = true;
        if (!play) setReadout(readoutFor(island, surfaceRef.current?.pick(event.clientX, event.clientY) ?? null));
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; moved.current = true; }}
      onPointerLeave={() => setReadout('Indian Ocean')}
      onClick={event => { if (play && !moved.current) guessAt(event.clientX, event.clientY); }}
      onDoubleClick={event => { if (!play) { const at = surfaceRef.current?.pick(event.clientX, event.clientY); if (at) surfaceRef.current?.flyTo(at.lon, at.lat); } }}>
      <IslandPoster island={island} /><div ref={labels} className="island-labels" aria-hidden="true" />
      <svg className="maps-game-overlay" aria-hidden="true"><g ref={overlay} visibility={state.guess ? 'visible' : 'hidden'}><line ref={line} className="maps-guess-line" /><circle ref={guessDot} r="6" className="maps-guess-dot" /><circle ref={truthDot} r="6" className="maps-truth-dot" /><text ref={truthText}>{state.place?.name} · {state.km < 1 ? '<1' : Math.round(state.km)} km</text></g></svg>
      {play && state.phase === 'guess' && <span className="maps-crosshair" style={{ left: crosshair?.x ?? '50%', top: crosshair?.y ?? '50%' }} aria-hidden="true">+</span>}
    </div>
    <p id="maps-keyboard-help" className="sr-only">{play ? 'Arrow keys move a crosshair. Shift moves 80 pixels. Return places the guess.' : 'Drag to orbit. Scroll or pinch to zoom. Arrow keys orbit. Plus and minus zoom. Zero recentres. Double-click to fly to a place.'}</p>
    {!play && <InfoCard count={count} onHome={() => { surfaceRef.current?.pulseAt(79.8612, 6.9271); surfaceRef.current?.flyTo(79.8612, 6.9271); }} />}
    {play && <GameCard state={state} best={best} onNext={() => { game.current?.next(); setCrosshair(null); }} onAgain={() => { game.current?.start(); setCrosshair(null); }} onClose={() => onMode(false)} />}
    {!play && <Readout text={readout} />}<Legend />
    {error ? <div className="maps-fallback maps-glass" role="alert">Couldn’t load the island. <button type="button" onClick={retry}>Retry</button></div> : kind !== 'webgl' && island && <div className="maps-fallback maps-glass"><p>{slow ? 'The flat version saves data. The game still works.' : 'Your browser skipped WebGL, so this is the flat version. The game still works.'}</p>{slow && <button type="button" disabled={loading} onClick={() => setLoad(value => value + 1)}>{loading ? 'Loading 3D…' : 'Load 3D (≈135 KB)'}</button>}</div>}
  </div>;
}
