import { propsAtom, reducedMotionAtom, desktopAtom } from '../state/atoms';
import { getStore } from '../state/store';
import { announce, openContextMenu } from '../wm/commands';
import { contextMenus } from './deferred-features';
import type { PointerGesture } from '../lib/deferred-pointer';

interface Runtime { cleanup(): void; context(el: HTMLAnchorElement, event: MouseEvent): void; key(event: KeyboardEvent): void }
const runtimes = new WeakMap<HTMLElement, Runtime>();
const nodes = (root: HTMLElement) => [...root.querySelectorAll<HTMLAnchorElement>('[data-prop]')];
const id = (el: HTMLElement) => el.dataset.prop!;
const unit = (root: HTMLElement) => parseFloat(getComputedStyle(root.closest('.k-hero')!).getPropertyValue('--u'));
const prop = (event: Event) => (event.target as Element)?.closest<HTMLAnchorElement>('[data-prop]');
const position = (el: HTMLElement) => {
  const style = getComputedStyle(document.documentElement);
  return { dx: parseFloat(style.getPropertyValue(`--k-dx-${id(el)}`)) || 0, dy: parseFloat(style.getPropertyValue(`--k-dy-${id(el)}`)) || 0 };
};
function mirror(el: HTMLElement, point: { dx: number; dy: number }) {
  document.documentElement.style.setProperty(`--k-dx-${id(el)}`, String(point.dx));
  document.documentElement.style.setProperty(`--k-dy-${id(el)}`, String(point.dy));
}
function settle(el: HTMLElement) {
  if (getStore().get(reducedMotionAtom)) return;
  const r = parseFloat(getComputedStyle(el).getPropertyValue('--r'));
  // Samples of the specified 400/26/1 spring, applied only to composited transforms.
  let x = 6; let v = 0;
  const frames: Keyframe[] = [{ rotate: `${r + x}deg`, transform: 'scale(1.04)' }];
  for (let i = 1; i <= 24; i++) {
    for (let j = 0; j < 2; j++) { v += (-400 * x - 26 * v) / 120; x += v / 120; }
    frames.push({ rotate: `${r + x}deg`, transform: `scale(${1 + .04 * x / 6})`, offset: i / 24 });
  }
  frames[24] = { rotate: `${r}deg`, transform: 'none', offset: 1 };
  el.animate(frames, { duration: 400 });
}
function returnFrames(from: { dx: number; dy: number }, to: { dx: number; dy: number }, u: number): Keyframe[] {
  let x = 1; let v = 0;
  const frames: Keyframe[] = [{ translate: `${from.dx * u}px ${from.dy * u}px` }];
  for (let i = 1; i <= 24; i++) {
    for (let j = 0; j < 2; j++) { v += (-400 * x - 26 * v) / 120; x += v / 120; }
    frames.push({ translate: `${(to.dx + (from.dx - to.dx) * x) * u}px ${(to.dy + (from.dy - to.dy) * x) * u}px`, offset: i / 24 });
  }
  frames[24] = { translate: `${to.dx * u}px ${to.dy * u}px`, offset: 1 };
  return frames;
}
function save(el: HTMLElement, point: { dx: number; dy: number }) {
  mirror(el, point); getStore().set(propsAtom, previous => ({ ...previous, [id(el)]: point }));
}
function open(el: HTMLAnchorElement) {
  const box = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 }));
}
function start(root: HTMLElement): Runtime {
  const previous = runtimes.get(root); if (previous) return previous;
  const store = getStore(); const links = nodes(root); let moving: { el: HTMLAnchorElement; origin: ReturnType<typeof position> } | null = null;
  const focus = (el: HTMLAnchorElement) => { links.forEach(link => { link.tabIndex = link === el ? 0 : -1; }); el.focus({ preventScroll: true }); };
  links.forEach((el, i) => { el.tabIndex = i ? -1 : 0; });
  const restore = (el: HTMLAnchorElement) => { save(el, { dx: 0, dy: 0 }); settle(el); };
  const sync = () => {
    const saved = store.get(propsAtom);
    for (const el of links) {
      const before = position(el); const point = saved[id(el)] ?? { dx: 0, dy: 0 };
      mirror(el, point);
      if ((before.dx !== point.dx || before.dy !== point.dy) && !store.get(reducedMotionAtom)) {
        const u = unit(root);
        el.animate(returnFrames(before, point, u), { duration: 400 });
      }
    }
  };
  const context = (el: HTMLAnchorElement, event: MouseEvent) => {
    event.preventDefault(); focus(el); store.set(desktopAtom, { type: 'FOCUS_DESKTOP' });
    const box = el.getBoundingClientRect();
    openContextMenu({ target: `desktop:prop:${id(el)}`, x: event.clientX || box.x + box.width / 2, y: event.clientY || box.bottom,
      items: [{ kind: 'item', label: 'Open', command: `prop.open:${id(el)}` },
        { kind: 'item', label: 'Move with keyboard', command: `prop.move:${id(el)}` },
        { kind: 'item', label: 'Put it back', command: `prop.reset:${id(el)}` },
        { kind: 'item', label: 'Put all back', command: 'desktop.cleanUp' }] });
  };
  const key = (event: KeyboardEvent) => {
    const el = prop(event); if (!el) return;
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); context(el, new MouseEvent('contextmenu')); return; }
    if (moving) {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault(); event.stopPropagation();
        if (event.key === 'Escape') {
          const before = position(el); mirror(el, moving.origin);
          if (!store.get(reducedMotionAtom)) el.animate(returnFrames(before, moving.origin, unit(root)), { duration: 400 });
        } else save(el, position(el));
        moving = null; delete el.dataset.keyboardMove; settle(el); announce(`${el.getAttribute('aria-label')!.split(':')[0]} moved`); return;
      }
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault(); const step = event.shiftKey ? 32 : 8; const point = position(el);
      point.dx += event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
      point.dy += event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
      mirror(el, clamp(root, el, point)); return;
    }
    if (event.key === 'Enter') { event.preventDefault(); open(el); return; }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); focus(event.key === 'Home' ? links[0]! : links.at(-1)!); return; }
    if (!event.key.startsWith('Arrow')) return;
    event.preventDefault(); const box = el.getBoundingClientRect(); const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const direction = event.key === 'ArrowRight' ? [1, 0] : event.key === 'ArrowLeft' ? [-1, 0] : event.key === 'ArrowDown' ? [0, 1] : [0, -1];
    const nearest = links.filter(link => link !== el).map(link => {
      const rect = link.getBoundingClientRect(); const x = rect.x + rect.width / 2 - center.x; const y = rect.y + rect.height / 2 - center.y;
      return { link, distance: x * x + y * y, forward: x * direction[0]! + y * direction[1]! };
    }).filter(value => value.forward > 0).sort((a, b) => a.distance - b.distance)[0];
    if (nearest) focus(nearest.link);
  };
  const command = (event: Event) => {
    const { action, value } = (event as CustomEvent<{ action: string; value: string }>).detail;
    const el = links.find(link => id(link) === value); if (!el) return;
    if (action === 'open') open(el);
    if (action === 'reset') restore(el);
    if (action === 'move') { moving = { el, origin: position(el) }; el.dataset.keyboardMove = ''; focus(el); announce(`${el.getAttribute('aria-label')!.split(':')[0]}: use arrows to move, Enter to save, Escape to cancel`); }
  };
  const cancelMove = () => {
    if (!moving) return;
    mirror(moving.el, moving.origin); delete moving.el.dataset.keyboardMove; settle(moving.el); moving = null;
  };
  const focused = (event: Event) => { const el = prop(event); if (moving && el !== moving.el) cancelMove(); if (el) links.forEach(link => { link.tabIndex = link === el ? 0 : -1; }); };
  const blurred = (event: FocusEvent) => { if (moving && event.relatedTarget !== moving.el) cancelMove(); };
  const cue = document.querySelector<HTMLElement>('.k-scroll-cue');
  const scroll = () => cue?.toggleAttribute('data-scrolled', scrollY >= 40); scroll(); window.addEventListener('scroll', scroll, { passive: true });
  const unsubscribe = store.sub(propsAtom, sync);
  const motion = store.sub(reducedMotionAtom, () => { if (store.get(reducedMotionAtom)) links.forEach(el => el.getAnimations().forEach(animation => animation.cancel())); });
  root.addEventListener('focusin', focused); root.addEventListener('focusout', blurred); document.addEventListener('kottu:prop', command);
  const runtime = { key, context, cleanup: () => { cancelMove(); unsubscribe(); motion(); window.removeEventListener('scroll', scroll); root.removeEventListener('focusin', focused); root.removeEventListener('focusout', blurred); document.removeEventListener('kottu:prop', command); links.forEach(el => { el.tabIndex = 0; el.getAnimations().forEach(animation => animation.cancel()); }); runtimes.delete(root); } };
  runtimes.set(root, runtime); return runtime;
}
function clamp(root: HTMLElement, el: HTMLElement, point: { dx: number; dy: number }) {
  const hero = root.closest('.k-hero')!.getBoundingClientRect(); const style = getComputedStyle(el); const u = unit(root);
  const w = el.offsetWidth; const h = el.offsetHeight;
  const x = parseFloat(style.left); const y = parseFloat(style.top);
  return { dx: Math.max((-w * .6 - x) / u, Math.min((hero.width - w * .4 - x) / u, point.dx)),
    dy: Math.max((-h * .6 - y) / u, Math.min((hero.height - h * .4 - y) / u, point.dy)) };
}
export function pointer(root: HTMLElement, event: PointerEvent): PointerGesture {
  const el = prop(event); start(root); if (!el) return { move() {}, up() {}, cancel() {} };
  const store = getStore(); store.set(desktopAtom, { type: 'FOCUS_DESKTOP' }); el.focus({ preventScroll: true });
  const origin = position(el); const u = unit(root);
  const original = { dx: el.style.getPropertyValue('--dx'), dy: el.style.getPropertyValue('--dy') };
  let frame = 0; let latest = event; let point = origin; let moved = false; let travelled = false; let finished = false;
  const held = (next: PointerEvent) => event.pointerType !== 'touch' || next.timeStamp - event.timeStamp >= 300;
  const paint = (next: PointerEvent) => {
    if (finished || Math.hypot(next.pageX - event.pageX, next.pageY - event.pageY) < 4) return;
    travelled = true; if (!held(next)) return;
    moved = true; el.dataset.dragging = ''; el.style.willChange = 'translate,rotate,transform';
    point = clamp(root, el, { dx: origin.dx + (next.pageX - event.pageX) / u, dy: origin.dy + (next.pageY - event.pageY) / u });
    el.style.setProperty('--dx', String(point.dx)); el.style.setProperty('--dy', String(point.dy));
  };
  const move = (next: PointerEvent) => { if (next.pointerId !== event.pointerId) return; latest = next; if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(latest); }); };
  const end = (cancel = false) => {
    if (finished) return; finished = true; cancelAnimationFrame(frame);
    root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', cancelDrag);
    root.removeEventListener('lostpointercapture', cancelDrag); document.removeEventListener('keydown', escape, true); window.removeEventListener('blur', cancelDrag);
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    delete el.dataset.dragging; el.style.willChange = '';
    el.style.setProperty('--dx', original.dx); el.style.setProperty('--dy', original.dy);
    if (cancel) {
      mirror(el, origin);
      if (moved && !store.get(reducedMotionAtom)) el.animate(returnFrames(point, origin, u), { duration: 400 });
    } else if (moved) save(el, point); else if (!travelled) open(el);
    if (moved) settle(el);
  };
  const up = (next: PointerEvent) => { if (next.pointerId === event.pointerId) { paint(next); end(); } };
  const cancelDrag = () => end(true);
  const escape = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancelDrag(); } };
  root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', cancelDrag);
  root.addEventListener('lostpointercapture', cancelDrag); document.addEventListener('keydown', escape, true); window.addEventListener('blur', cancelDrag);
  return { move, up, cancel: cancelDrag };
}
export function intent(root: HTMLElement, event: Event) {
  const runtime = start(root); if (event.type === 'focusin' || event.type === 'pointerover') {
    const el = prop(event); if (el) nodes(root).forEach(node => { node.tabIndex = node === el ? 0 : -1; });
    void contextMenus.preload().catch(() => {});
  }
  if (event instanceof KeyboardEvent) runtime.key(event);
  else if (event.type === 'contextmenu') { const el = prop(event); if (el) runtime.context(el, event as MouseEvent); }
}
export function dispose(root: HTMLElement) { runtimes.get(root)?.cleanup(); }

export async function surfaceMenu(event: MouseEvent) {
  const { desktopMenus } = await import('../registry/menus');
  const menus = desktopMenus().flatMap(menu => menu.items);
  const commands = ['desktop.cleanUp', 'desktop.mochi'];
  openContextMenu({ x: event.clientX || 24, y: event.clientY || 48, target: 'desktop', items: [
    { kind: 'item', label: 'New Terminal window', command: 'open.terminal' },
    { kind: 'item', label: 'Change wallpaper…', command: 'desktop.wallpaper' },
    ...commands.flatMap(command => menus.filter(item => item.kind === 'item' && item.command === command)),
    { kind: 'separator' }, ...menus.filter(item => item.kind === 'item' && item.command === 'os.about'),
  ] });
}
let egg = ''; let typedAt = 0;
export function surfaceKey(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1 || getStore().get(desktopAtom).focusedId) return;
  egg = (performance.now() - typedAt < 1500 ? egg : '') + event.key.toLowerCase(); typedAt = performance.now(); egg = egg.slice(-8);
  if (egg === 'ayubowan') document.dispatchEvent(new CustomEvent('ayubowan', { bubbles: true }));
}

export function reset() {
  const root = document.querySelector<HTMLElement>('[data-k-props]');
  if (root) start(root);
  getStore().set(propsAtom, {});
}
