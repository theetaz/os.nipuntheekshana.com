import './p3-13-eggs.css';
import { reducedMotionAtom } from '../state/atoms';
import type { OsStore } from '../state/store';
import { toast } from '../wm/commands';

/** Active time excludes hidden tabs. No frames run for a static reduced-motion effect. */
export function timedEffect(store: OsStore, element: HTMLElement, duration: number,
  draw: (elapsed: number, reduced: boolean) => void): () => void {
  let remaining = duration; let started = performance.now(); let frame = 0; let lastDraw = 0;
  let timer: ReturnType<typeof setTimeout> | undefined; let disposed = false; let running = false;
  const elapsed = () => duration - remaining + (running ? performance.now() - started : 0);
  const tick = (now: number) => {
    frame = 0;
    if (disposed || document.hidden || store.get(reducedMotionAtom)) return;
    if (now - lastDraw >= 1000 / 30) {
      lastDraw = now - (now - lastDraw) % (1000 / 30); draw(elapsed(), false);
    }
    frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    if (running) remaining = Math.max(0, remaining - (performance.now() - started));
    running = false; clearTimeout(timer); cancelAnimationFrame(frame); frame = 0;
  };
  const resume = () => {
    element.hidden = document.hidden;
    if (document.hidden || disposed) return;
    if (!running) { started = performance.now(); running = true; timer = setTimeout(cleanup, remaining); }
    const reduced = store.get(reducedMotionAtom); draw(elapsed(), reduced);
    cancelAnimationFrame(frame); frame = reduced ? 0 : requestAnimationFrame(tick); lastDraw = performance.now();
  };
  const visibility = () => { if (document.hidden) pause(); resume(); };
  const resize = () => { if (!document.hidden && !disposed) draw(elapsed(), store.get(reducedMotionAtom)); };
  const unsubscribe = store.sub(reducedMotionAtom, resume);
  function cleanup() {
    if (disposed) return;
    disposed = true; pause(); unsubscribe(); element.remove();
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('resize', resize);
  }
  document.addEventListener('visibilitychange', visibility); window.addEventListener('resize', resize);
  document.body.append(element); resume();
  return cleanup;
}

export function monsoon(store: OsStore): () => void {
  const layer = document.createElement('div'); layer.className = 'egg-overlay egg-rain';
  layer.dataset.egg = 'rain'; layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
  const drops = Array.from({ length: 400 }, () => ({ x: Math.random(), y: Math.random(), speed: .35 + Math.random() * .35, length: 8 + Math.random() * 12 }));
  let canvas: HTMLCanvasElement | null = null; let context: CanvasRenderingContext2D | null = null;
  const cleanup = timedEffect(store, layer, 10_000, (elapsed, reduced) => {
    layer.dataset.reducedMotion = String(reduced);
    if (reduced) { canvas?.remove(); canvas = null; context = null; return; }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.dataset.drops = '400'; context = canvas.getContext('2d'); layer.append(canvas); }
    if (!context) return;
    const width = innerWidth; const height = innerHeight; const scale = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale); context.setTransform(scale, 0, 0, scale, 0, 0);
    }
    context.clearRect(0, 0, width, height); context.lineWidth = 1;
    context.strokeStyle = document.documentElement.dataset.theme === 'dark' ? 'rgba(181,204,218,.48)' : 'rgba(66,102,124,.4)';
    context.beginPath();
    for (const drop of drops) {
      const x = (drop.x * width + elapsed * drop.speed * .18) % (width + 20) - 10;
      const y = (drop.y * height + elapsed * drop.speed) % (height + 30) - 15;
      context.moveTo(x, y); context.lineTo(x - drop.length * .18, y - drop.length);
    }
    context.stroke();
  });
  let active = true;
  void import('../mochi/api').then(api => { if (active && layer.isConnected) api.give('umbrella'); }).catch(() => {});
  toast({ title: 'Monsoon season.' });
  return () => { active = false; cleanup(); };
}
