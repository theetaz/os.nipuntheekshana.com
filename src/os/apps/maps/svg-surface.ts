import { LABELS, TOWNS, fromScene, toScene } from '../../scenes/island-model';
import type { MapSurface, SurfaceOptions } from './surface';
export const MAP_VIEWBOX = { x: -1.9, y: -2.5, width: 3.8, height: 5 };
/** The same cos-latitude projection is used for the poster, picks and game markers. */
export function createSVGSurface({ stage, labels, reducedMotion = false }: SurfaceOptions): MapSurface {
  let active = true; let destroyed = false; let reduced = reducedMotion; let zoom = 1; let dx = 0; let dy = 0;
  let labelsWanted = true; let showLabels = true;
  const callbacks = new Set<() => void>();
  const svg = stage.querySelector<SVGSVGElement>('[data-map-svg]');
  const world = svg?.querySelector<SVGGElement>('[data-map-world]');
  const pulse = svg?.querySelector<SVGCircleElement>('[data-map-pulse]');
  const anchors = TOWNS.filter(([name]) => LABELS.includes(name)).map(([name, lat, lon]) => {
    const el = document.createElement('span'); el.className = 'island-label'; el.textContent = name; labels?.appendChild(el);
    return { el, lat, lon };
  });
  function metrics() {
    const rect = stage.getBoundingClientRect(); const scale = Math.min(rect.width / MAP_VIEWBOX.width, rect.height / MAP_VIEWBOX.height);
    return { rect, scale, left: (rect.width - MAP_VIEWBOX.width * scale) / 2, top: (rect.height - MAP_VIEWBOX.height * scale) / 2 };
  }
  function project(lon: number, lat: number) {
    const { scale, left, top } = metrics(); const [x, y] = toScene(lon, lat);
    return { x: left + (x * zoom + dx - MAP_VIEWBOX.x) * scale, y: top + (y * zoom + dy - MAP_VIEWBOX.y) * scale };
  }
  function draw() {
    if (!active || destroyed || document.hidden) return;
    world?.setAttribute('transform', `translate(${dx} ${dy}) scale(${zoom})`);
    if (labels) labels.hidden = !(labelsWanted && showLabels);
    anchors.forEach(({ el, lat, lon }) => { const { x, y } = project(lon, lat); el.style.transform = `translate3d(${x}px, ${y}px, 0)`; });
    callbacks.forEach(callback => callback());
  }
  const observer = new ResizeObserver(draw); observer.observe(stage);
  const visibility = () => draw(); document.addEventListener('visibilitychange', visibility);
  draw();
  return {
    kind: 'svg', count: 0,
    pick(clientX, clientY) {
      const { rect, scale, left, top } = metrics(); if (!scale) return null;
      const x = clientX - rect.left; const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      const [lon, lat] = fromScene(((x - left) / scale + MAP_VIEWBOX.x - dx) / zoom, ((y - top) / scale + MAP_VIEWBOX.y - dy) / zoom);
      return { lon, lat };
    },
    project,
    pulseAt(lon, lat) {
      if (!pulse || !active || destroyed || document.hidden) return;
      const [x, y] = toScene(lon, lat); pulse.setAttribute('cx', String(x)); pulse.setAttribute('cy', String(y));
      pulse.classList.remove('maps-svg-pulse');
      if (!reduced) { void pulse.getBoundingClientRect(); pulse.classList.add('maps-svg-pulse'); }
    },
    setLabels(value) { labelsWanted = value; draw(); },
    onFrame(callback) { callbacks.add(callback); return () => { callbacks.delete(callback); }; },
    setActive(value) { active = value; if (!value) pulse?.classList.remove('maps-svg-pulse'); else draw(); },
    setFocus() { dx = 0; dy = 0; zoom = 1; draw(); },
    setLayers(value) { showLabels = value.labels; if (svg) { svg.dataset.coastline = String(value.coastline); svg.dataset.graticule = String(value.graticule); } draw(); },
    setReducedMotion(value) { reduced = value; if (value) pulse?.classList.remove('maps-svg-pulse'); draw(); },
    orbit(yaw, pitch) { dx = Math.max(-1, Math.min(1, dx + yaw)); dy = Math.max(-1, Math.min(1, dy + pitch)); draw(); },
    zoom(factor) { zoom = Math.max(0.7, Math.min(1.6, zoom * factor)); draw(); },
    recentre() { dx = 0; dy = 0; zoom = 1; draw(); },
    flyTo(lon, lat) { const [x, y] = toScene(lon, lat); zoom = 1.4; dx = -x * 0.5; dy = -y * 0.5; draw(); },
    destroy() { if (destroyed) return; destroyed = true; observer.disconnect(); document.removeEventListener('visibilitychange', visibility); anchors.forEach(({ el }) => el.remove()); callbacks.clear(); pulse?.classList.remove('maps-svg-pulse'); },
  };
}
