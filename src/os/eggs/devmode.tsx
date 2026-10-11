import './p3-13-eggs.css';
import { atom, useAtom } from 'jotai';
import { desktopAtom, devModeAtom, modeAtom, viewAtom } from '../state/atoms';
import type { OsStore } from '../state/store';
import { toast } from '../wm/commands';
import { Switch } from '../ui/Switch';

const toolsAtom = atom({ fps: true, bounds: false, log: false });

export function enableDeveloper(store: OsStore): void {
  if (store.get(devModeAtom)) return;
  store.set(devModeAtom, true); toast({ title: 'You are now a developer. Again.' });
}

export function subscribeDeveloper(store: OsStore): () => void {
  const meter = document.createElement('div'); meter.className = 'egg-fps'; meter.dataset.egg = 'fps';
  meter.setAttribute('role', 'meter'); meter.setAttribute('aria-label', 'Frames per second');
  meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '1000');
  meter.setAttribute('aria-valuenow', '0'); meter.textContent = '— FPS';
  let frame = 0; let previous = 0; let lastUpdate = 0; const samples: number[] = [];
  let lastState = store.get(desktopAtom);
  const tick = (now: number) => {
    if (previous) { samples.push(now - previous); if (samples.length > 60) samples.shift(); }
    previous = now;
    if (samples.length && now - lastUpdate >= 250) {
      const fps = Math.min(1000, Math.round(1000 * samples.length / samples.reduce((sum, value) => sum + value, 0)));
      meter.textContent = `${fps} FPS`; meter.setAttribute('aria-valuenow', String(fps)); lastUpdate = now;
    }
    frame = requestAnimationFrame(tick);
  };
  const visible = () => store.get(devModeAtom) && store.get(viewAtom) !== 'simple' && store.get(modeAtom) === 'desktop';
  const update = () => {
    const options = store.get(toolsAtom); const enabled = visible();
    document.documentElement.toggleAttribute('data-dev-bounds', enabled && options.bounds);
    if (enabled && options.fps) {
      if (!meter.isConnected) document.body.append(meter);
      meter.hidden = document.hidden;
      if (!document.hidden && !frame) { previous = 0; samples.length = 0; frame = requestAnimationFrame(tick); }
    } else meter.remove();
    if (!enabled || !options.fps || document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0; samples.length = 0; }
  };
  const log = () => {
    const next = store.get(desktopAtom);
    if (visible() && store.get(toolsAtom).log && !document.hidden && next !== lastState)
      console.debug('[Serendib] Window actions', { before: lastState, after: next });
    lastState = next;
  };
  const subscriptions = [store.sub(toolsAtom, update), store.sub(devModeAtom, update), store.sub(viewAtom, update),
    store.sub(modeAtom, update), store.sub(desktopAtom, log)];
  document.addEventListener('visibilitychange', update); update();
  return () => {
    subscriptions.forEach(unsubscribe => unsubscribe()); cancelAnimationFrame(frame); meter.remove();
    document.documentElement.removeAttribute('data-dev-bounds'); document.removeEventListener('visibilitychange', update);
  };
}

export function DeveloperTools() {
  const [tools, setTools] = useAtom(toolsAtom);
  return <><h2>Developer</h2><p className="settings-description">A closer look under the hood.</p>
    <div className="settings-group"><Switch label="Show FPS meter" checked={tools.fps}
      onChange={fps => setTools(previous => ({ ...previous, fps }))}>Show FPS meter</Switch>
      <p className="settings-hint">Frames per second, averaged over the last 60 frames.</p></div>
    <div className="settings-group"><Switch label="Show layout bounds" checked={tools.bounds}
      onChange={bounds => setTools(previous => ({ ...previous, bounds }))}>Show layout bounds</Switch>
      <p className="settings-hint">Outline windows and desktop layers.</p></div>
    <div className="settings-group"><Switch label="Log window actions" checked={tools.log}
      onChange={log => setTools(previous => ({ ...previous, log }))}>Log window actions</Switch>
      <p className="settings-hint">Write window state changes to the browser console.</p></div>
  </>;
}
