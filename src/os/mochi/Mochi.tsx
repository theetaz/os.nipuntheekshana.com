import { useEffect, useRef, useState } from 'react';
import { useAtomValue, useStore } from 'jotai';
import { bootPhaseAtom, desktopAtom, overlayAtom, reducedMotionAtom, viewAtom } from '../state/atoms';
import { mochiPrefsAtom } from '../state/prefs';
import { colomboNow } from '../lib/colombo-time';
import { preloadMotionFeatures } from '../lib/motion-loader';
import { isOverKooda } from '../shell/dock-anchors';
import { workArea } from '../wm/geometry';
import type { Point } from '../wm/types';
import type { MenuItemSpec } from '../types/apps';
import { Menu } from '../ui/Menu';
import { MochiSvg } from './MochiSvg';
import { api } from './api';
import { brainAtom, mochiTime, nextBrainDeadline, pauseBrain, transitionBrain, type BrainEvent } from './brain';
import { clampPosition, FLING_THRESHOLD, MOCHI_SIZE, releaseVelocity, restingBody, squash, stepPhysics,
  surfaceAt, trackVelocity, type Body, type Sample, type Surface } from './physics';
import './p3-12-mochi.css';

interface Controls {
  down(event: PointerEvent): void; move(event: PointerEvent): void; up(event: PointerEvent, cancel?: boolean): void;
  click(): void; menu(): void;
}
const menuItems: readonly MenuItemSpec[] = [
  { kind: 'item', label: 'Pet', command: 'pet' }, { kind: 'item', label: 'Give tea', command: 'tea' },
  { kind: 'item', label: 'Put to sleep', command: 'sleep' }, { kind: 'item', label: 'Wake up', command: 'wake' },
  { kind: 'separator' }, { kind: 'item', label: 'Hide Mochi', command: 'hide' },
  { kind: 'item', label: 'About the Mochi SDK ↗', command: 'about' },
];

export function Mochi({ variant = 'desktop' }: { variant?: 'desktop' | 'widget' } = {}) {
  const store = useStore(); const prefs = useAtomValue(mochiPrefsAtom); const brain = store.get(brainAtom);
  const reduced = useAtomValue(reducedMotionAtom); const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null); const controls = useRef<Controls | null>(null);
  const [menu, setMenu] = useState<Point | null>(null);
  const lastAnnouncement = useRef(-Infinity);

  useEffect(() => {
    const el = root.current; const bodyButton = button.current;
    if (!el || !bodyButton) return;
    let area = workArea(store.get(desktopAtom).viewport); let surfaces: Surface[] = [];
    let body: Body = restingBody({ x: 40, y: area.y + area.h - MOCHI_SIZE });
    let frame = 0; let previousFrame = 0; let eyeFrame = 0; let deadlineTimer = 0; let walkTimer = 0;
    let longPress = 0; let walkUntil = 0; let active = false; let pausedAt: number | null = null;
    let lastInput = -Infinity; let direction = 1; let suppressClick = false;
    let drag: { id: number; start: Point; origin: Body; samples: Sample[]; moved: boolean } | null = null;
    let storedPosition = store.get(mochiPrefsAtom).pos;
    let previousDesktop = store.get(desktopAtom);
    el.dataset.paused = 'true';
    const eyes = el.querySelector<SVGGElement>('.mochi__eyes');
    const motionBody = el.querySelector<HTMLElement>('.mochi__motion');
    const speechBubble = el.querySelector<HTMLElement>('[data-mochi-bubble]')!;
    const status = el.querySelector<HTMLElement>('[role="status"]')!;
    const hearts = el.querySelector<HTMLElement>('.mochi__hearts')!;
    let heartSeq = store.get(brainAtom).hearts; let speechSeq = -1;
    const trash = () => document.querySelector<HTMLElement>('.os-dock[data-dock-mode="desktop"] [data-dock-app="trash"]');
    const send = (event: BrainEvent) => store.set(brainAtom, state => transitionBrain(state, event, mochiTime()));
    const still = () => store.get(reducedMotionAtom);
    // Deadline and pointer-input transitions paint locally, keeping window drags free of React commits.
    const paintBrain = () => {
      const state = store.get(brainAtom);
      el.dataset.mood = state.mood; el.dataset.item = state.item ?? '';
      speechBubble.textContent = state.bubble; speechBubble.hidden = !state.bubble;
      hearts.hidden = still() || !state.heartsUntil;
      if (heartSeq !== state.hearts && !hearts.hidden) {
        for (const animation of hearts.getAnimations({ subtree: true })) animation.currentTime = 0;
      }
      heartSeq = state.hearts;
      if (speechSeq !== state.speechSeq && state.bubble && state.announce && mochiTime() - lastAnnouncement.current >= 5000) {
        lastAnnouncement.current = mochiTime(); status.textContent = state.bubble;
      }
      speechSeq = state.speechSeq;
    };
    const paint = () => {
      if (variant === 'desktop') el.style.transform = `translate3d(${body.x.toFixed(2)}px, ${body.y.toFixed(2)}px, 0)`;
      el.dataset.physics = body.mode; el.dataset.surface = body.surface ?? '';
      el.dataset.bubbleSide = body.x > window.innerWidth - 300 ? 'left' : 'right';
      el.style.willChange = body.mode === 'rest' ? '' : 'transform';
      if (motionBody) motionBody.style.transform = still() ? '' : squash(body);
    };
    const persist = () => {
      if (variant === 'widget') return;
      storedPosition = { x: body.x, y: body.y };
      store.set(mochiPrefsAtom, value => ({ ...value, pos: storedPosition }));
    };
    const stopFrame = () => { cancelAnimationFrame(frame); frame = 0; previousFrame = 0; };
    const animate = (time: number) => {
      frame = 0;
      if (!active || still() || drag) return;
      const dt = previousFrame ? (time - previousFrame) / 1000 : 1 / 60; previousFrame = time;
      body = stepPhysics(body, dt, area, surfaces);
      if (body.mode === 'walk' && time >= walkUntil) body = restingBody(body, body.surface);
      paint();
      if (body.mode !== 'rest') frame = requestAnimationFrame(animate);
      else { previousFrame = 0; persist(); scheduleWalk(); }
    };
    const startFrame = () => { if (!frame && active && !still() && !drag && body.mode !== 'rest') frame = requestAnimationFrame(animate); };
    const readSurfaces = () => {
      area = workArea(store.get(desktopAtom).viewport);
      const dock = document.querySelector<HTMLElement>('.os-dock[data-dock-mode="desktop"]');
      const rect = dock?.getBoundingClientRect();
      const next: Surface[] = rect ? [{ id: 'dock', x: rect.x, y: Math.min(rect.y, area.y + area.h), w: rect.width }] : [];
      for (const win of Object.values(store.get(desktopAtom).windows)) {
        if (!win.minimized && !win.closing && win.rect.y >= area.y + MOCHI_SIZE) next.push({ id: win.id, x: win.rect.x, y: win.rect.y, w: win.rect.w });
      }
      surfaces = next;
    };
    function scheduleWalk() {
      clearTimeout(walkTimer);
      if (variant !== 'desktop' || !active || still() || !body.surface || body.mode !== 'rest') return;
      walkTimer = window.setTimeout(() => {
        if (store.get(brainAtom).mood !== 'idle' || drag) { scheduleWalk(); return; }
        body = { ...body, vx: 44 * direction, mode: 'walk' }; direction *= -1; walkUntil = mochiTime() + 1800; startFrame();
      }, 12_000);
    }
    function scheduleBrain() {
      clearTimeout(deadlineTimer);
      if (!active) return;
      const deadline = nextBrainDeadline(store.get(brainAtom), store.get(mochiPrefsAtom).naps);
      if (deadline !== null) deadlineTimer = window.setTimeout(() => send({ type: 'tick', naps: store.get(mochiPrefsAtom).naps }), Math.max(1, deadline - mochiTime()));
    }
    const cancelDrag = () => {
      clearTimeout(longPress); trash()?.removeAttribute('data-kooda-over');
      if (!drag) return;
      const id = drag.id; body = drag.origin; drag = null; suppressClick = true;
      if (bodyButton.hasPointerCapture(id)) bodyButton.releasePointerCapture(id);
      delete el.dataset.dragging; paint();
    };
    const syncActive = () => {
      const next = !document.hidden && store.get(mochiPrefsAtom).visible && store.get(viewAtom) !== 'simple'
        && store.get(overlayAtom) === 'none' && store.get(bootPhaseAtom) === 'off';
      if (next === active) return;
      active = next; el.dataset.paused = String(!active);
      if (!active) {
        pausedAt = mochiTime(); stopFrame(); cancelAnimationFrame(eyeFrame); eyeFrame = 0;
        clearTimeout(deadlineTimer); clearTimeout(walkTimer); cancelDrag(); setMenu(null);
      } else {
        if (pausedAt !== null) {
          const elapsed = mochiTime() - pausedAt; store.set(brainAtom, value => pauseBrain(value, elapsed));
          if (walkUntil) walkUntil += elapsed; pausedAt = null;
        }
        scheduleBrain(); scheduleWalk(); startFrame();
      }
    };
    const lookAt = (point: Point) => {
      if (!active || still() || !eyes) return;
      const center = variant === 'widget' ? bodyButton.getBoundingClientRect() : { left: body.x, top: body.y, width: 64, height: 64 };
      const dx = point.x - center.left - center.width / 2; const dy = point.y - center.top - center.height * 0.55;
      const distance = Math.hypot(dx, dy) || 1; const reach = Math.min(1, distance / 300) * 3.2;
      eyes.style.transform = `translate(${dx / distance * reach}px, ${dy / distance * reach}px)`;
    };
    const input = () => {
      if (!active || mochiTime() - lastInput < 1000) return;
      lastInput = mochiTime(); send({ type: 'input' });
    };
    const pointer = (event: PointerEvent) => {
      if (!active) return; input();
      if (still() || drag || eyeFrame || store.get(brainAtom).mood !== 'idle') return;
      const point = { x: event.clientX, y: event.clientY };
      eyeFrame = requestAnimationFrame(() => { eyeFrame = 0; lookAt(point); });
    };
    const openMenu = () => {
      cancelDrag(); suppressClick = false;
      const rect = bodyButton.getBoundingClientRect();
      void preloadMotionFeatures().then(() => {
        if (active) setMenu({ x: rect.x + rect.width / 2, y: rect.y });
      }).catch(() => {});
    };
    controls.current = {
      down(event) {
        if (!active || event.button !== 0) return;
        stopFrame(); suppressClick = false; input(); readSurfaces();
        body = restingBody(body, body.surface);
        drag = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { ...body },
          samples: [{ x: event.clientX, y: event.clientY, t: mochiTime() }], moved: false };
        bodyButton.setPointerCapture(event.pointerId);
        if (variant === 'widget') longPress = window.setTimeout(() => { openMenu(); suppressClick = true; }, 550);
      },
      move(event) {
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.start.x; const dy = event.clientY - drag.start.y;
        if (Math.hypot(dx, dy) > 6) {
          clearTimeout(longPress);
          if (variant === 'widget') { suppressClick = true; return; }
          if (!drag.moved) { drag.moved = true; send({ type: 'mood', mood: 'surprised', duration: 0 }); el.dataset.dragging = 'true'; }
          drag.samples = trackVelocity(drag.samples, { x: event.clientX, y: event.clientY, t: mochiTime() });
          body = { ...body, x: drag.origin.x + dx, y: drag.origin.y + dy, mode: 'drag', surface: null };
          // Pointer dragging may cross the dock; clamp only on release so Kooda is reachable.
          body.x = Math.max(area.x, Math.min(area.x + area.w - 64, body.x));
          body.y = Math.max(area.y, Math.min(window.innerHeight - 64, body.y));
          trash()?.toggleAttribute('data-kooda-over', false);
          if (isOverKooda({ x: event.clientX, y: event.clientY })) trash()?.setAttribute('data-kooda-over', 'true');
          paint();
        }
      },
      up(event, cancel = false) {
        if (!drag || drag.id !== event.pointerId) return;
        if (cancel) { cancelDrag(); scheduleWalk(); return; }
        const release = drag; drag = null; clearTimeout(longPress); delete el.dataset.dragging;
        if (bodyButton.hasPointerCapture(event.pointerId)) bodyButton.releasePointerCapture(event.pointerId);
        trash()?.removeAttribute('data-kooda-over'); suppressClick ||= release.moved;
        if (release.moved) {
          if (isOverKooda({ x: event.clientX, y: event.clientY })) {
            const home = clampPosition(release.origin, area);
            body = still() ? restingBody(home, release.origin.surface)
              : { ...restingBody(clampPosition(body, area)), mode: 'return', home };
            api.setMood('surprised'); api.say("Hey. I'm not rubbish.");
          } else {
            const velocity = releaseVelocity(release.samples, mochiTime()); const speed = Math.hypot(velocity.x, velocity.y);
            body = restingBody(clampPosition(body, area)); body.surface = surfaceAt(body, surfaces)?.id ?? null;
            if (!still() && speed > FLING_THRESHOLD) {
              body = { ...body, vx: velocity.x, vy: velocity.y, mode: 'fling', surface: null };
              api.setMood(speed > 2500 ? 'dizzy' : 'happy'); api.say('Wheee.');
            } else { api.setMood('happy'); if (Math.random() < 0.3) api.say('Put me down gently next time.'); }
          }
          paint(); if (body.mode === 'rest') persist(); else startFrame();
        }
        scheduleWalk();
      },
      click() { if (suppressClick) { suppressClick = false; return; } api.pet(); }, menu: openMenu,
    };
    const desktopChanged = () => {
      const next = store.get(desktopAtom); const oldSurfaces = surfaces; readSurfaces();
      for (const win of Object.values(next.windows)) {
        if (!previousDesktop.windows[win.id] && !win.minimized && !win.closing && active) send({ type: 'mood', mood: 'curious', look: { x: win.rect.x + win.rect.w / 2, y: win.rect.y + win.rect.h / 2 } });
      }
      previousDesktop = next;
      if (!drag && variant === 'desktop') {
        const support = surfaces.find(surface => surface.id === body.surface);
        const oldSupport = oldSurfaces.find(surface => surface.id === body.surface);
        if (support && oldSupport) body = { ...body, x: body.x + support.x - oldSupport.x, y: support.y - 64 };
        else if (body.surface) body = still() ? restingBody(body) : { ...body, mode: 'fall', surface: null, vx: 0, vy: 0 };
        body = { ...body, ...clampPosition(body, area) }; paint(); startFrame(); scheduleWalk();
      }
    };
    const prefsChanged = () => {
      const next = store.get(mochiPrefsAtom).pos;
      if (next !== storedPosition && variant === 'desktop') {
        storedPosition = next;
        if (next) { stopFrame(); body = restingBody(clampPosition(next, area)); body.surface = surfaceAt(body, surfaces)?.id ?? null; paint(); }
      }
      syncActive(); scheduleBrain(); scheduleWalk();
    };
    const brainChanged = () => {
      const state = store.get(brainAtom); paintBrain(); scheduleBrain();
      if (state.look) lookAt(state.look); else if (state.mood !== 'idle' && eyes) eyes.style.transform = '';
      if (state.mood === 'sleep' && body.mode === 'walk') { stopFrame(); body = restingBody(body, body.surface); paint(); }
      scheduleWalk();
    };
    const motionChanged = () => {
      cancelAnimationFrame(eyeFrame); eyeFrame = 0;
      if (still()) { stopFrame(); if (!drag) { body = restingBody(clampPosition(body, area), body.surface); persist(); } if (eyes) eyes.style.transform = ''; }
      paint(); paintBrain(); scheduleWalk();
    };
    const scrollPositions = new WeakMap<Element, { y: number; t: number }>(); let lastSurprise = -Infinity;
    const scroll = (event: Event) => {
      const target = event.target;
      if (!active || !(target instanceof Element) || !target.closest('[data-window-layer]')) return;
      const now = mochiTime(); const previous = scrollPositions.get(target) ?? { y: 0, t: now - 16 };
      scrollPositions.set(target, { y: target.scrollTop, t: now }); input();
      if (Math.abs(target.scrollTop - previous.y) / Math.max(1, now - previous.t) > 6 && now - lastSurprise > 1200
        && !['happy', 'sleep'].includes(store.get(brainAtom).mood)) { lastSurprise = now; api.setMood('surprised'); }
    };
    readSurfaces();
    if (storedPosition) body = restingBody(clampPosition(storedPosition, area), surfaceAt(storedPosition, surfaces)?.id ?? null);
    paint(); const hour = colomboNow().hour; send({ type: 'init', night: hour >= 23 || hour < 5 }); paintBrain(); syncActive();
    const cleanups = [store.sub(desktopAtom, desktopChanged), store.sub(mochiPrefsAtom, prefsChanged), store.sub(brainAtom, brainChanged),
      store.sub(reducedMotionAtom, motionChanged), ...[viewAtom, overlayAtom, bootPhaseAtom].map(atom => store.sub(atom, syncActive))];
    scheduleBrain();
    window.addEventListener('pointermove', pointer, { passive: true }); document.addEventListener('keydown', input);
    document.addEventListener('pointerdown', input, { passive: true }); document.addEventListener('scroll', scroll, { capture: true, passive: true });
    document.addEventListener('visibilitychange', syncActive); window.addEventListener('resize', desktopChanged);
    return () => {
      active = false; stopFrame(); cancelAnimationFrame(eyeFrame); clearTimeout(deadlineTimer); clearTimeout(walkTimer); cancelDrag();
      controls.current = null; cleanups.forEach(cleanup => cleanup());
      window.removeEventListener('pointermove', pointer); document.removeEventListener('keydown', input); document.removeEventListener('pointerdown', input);
      document.removeEventListener('scroll', scroll, true); document.removeEventListener('visibilitychange', syncActive); window.removeEventListener('resize', desktopChanged);
    };
  }, [store, variant]);

  const closeMenu = () => { setMenu(null); button.current?.focus({ preventScroll: true }); };
  return <div ref={root} className="mochi" data-mochi data-variant={variant} data-mood={brain.mood} data-item={brain.item ?? ''}
    data-reduced-motion={reduced} hidden={!prefs.visible}>
    <div className="mochi__bubble" data-mochi-bubble hidden={!brain.bubble} aria-hidden="true">{brain.bubble}</div>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
    <button ref={button} className="mochi__body" type="button" data-mochi-body aria-label="Mochi, a small desk buddy. Press to pet."
      aria-haspopup="menu" aria-expanded={!!menu} onClick={() => controls.current?.click()}
      onPointerDown={event => controls.current?.down(event.nativeEvent)} onPointerMove={event => controls.current?.move(event.nativeEvent)}
      onPointerUp={event => controls.current?.up(event.nativeEvent)} onPointerCancel={event => controls.current?.up(event.nativeEvent, true)}
      onLostPointerCapture={event => controls.current?.up(event.nativeEvent, true)}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); controls.current?.menu(); }}
      onKeyDown={event => {
        if (event.key === ' ' || event.key === 'Enter') event.stopPropagation();
        if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') { event.preventDefault(); event.stopPropagation(); controls.current?.menu(); }
      }}>
      <span className="mochi__motion"><MochiSvg umbrella /></span>
      <span className="mochi__zzz" aria-hidden="true"><i>z</i><i>z</i><i>z</i></span>
      <span className="mochi__hearts" aria-hidden="true" hidden={reduced || !brain.heartsUntil}>{[0, 1, 2].map(i => <i key={i} className="mochi-heart" style={{ left: `${20 + i * 16}px`, animationDelay: `${i * 90}ms` }}>♥</i>)}</span>
    </button>
    {variant === 'widget' && <span className="mochi__widget-label">Mochi</span>}
    <Menu open={!!menu && prefs.visible} items={menuItems} label="Mochi context menu" point={menu ?? undefined} anchorRef={button} onClose={closeMenu}
      getItemState={command => ({ disabled: command === 'sleep' ? brain.mood === 'sleep' : command === 'wake' ? brain.mood !== 'sleep' : false })}
      onCommand={command => {
        if (command === 'tea') api.give('tea');
        else if (command === 'about') window.open('https://mochi.prabhavalabs.com', '_blank', 'noopener,noreferrer');
        else if (command === 'pet' || command === 'sleep' || command === 'wake' || command === 'hide') api[command]();
      }} />
  </div>;
}
