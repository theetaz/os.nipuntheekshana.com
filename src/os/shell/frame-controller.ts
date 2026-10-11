import { animate } from 'motion/mini';
import { spring } from 'motion';
import type { Point, Rect, TransitionKind } from '../wm/types';
export interface FrameController {
  readonly el: HTMLElement;
  rect: Rect;
  set(rect: Rect): void;
  animate(kind: TransitionKind, to: Rect, opts?: { origin?: Point | null; dockTarget?: Point | null }): Promise<void>;
  stop(): void;
  destroy(): void;
}

const easeOut = [0.22, 1, 0.36, 1] as const;
const easeIn = [0.4, 0, 1, 1] as const;
const easeSuck = [0.32, 0.72, 0, 1] as const;
const windowOpen = { type: spring, stiffness: 420, damping: 34, mass: 0.9 };
const windowSnap = { type: spring, stiffness: 380, damping: 36, mass: 1 };
const windowRestore = { type: spring, stiffness: 320, damping: 32, mass: 1 };
const transform = (r: Rect, sx = 1, sy = sx) => `translate3d(${r.x}px, ${r.y}px, 0) scale(${sx}, ${sy})`;
export const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/** Owns every frame geometry write. Pointer frames never read layout. */
export function createFrameController(el: HTMLElement, rect: Rect, reducedMotion: () => boolean = () => false): FrameController {
  let controls: ReturnType<typeof animate>[] = [];
  let settle: (() => void) | null = null;
  let generation = 0;
  let destroyed = false;
  function cancel() {
    generation++;
    for (const animation of controls) animation.cancel();
    controls = [];
    settle?.(); settle = null;
  }
  function write(next: Rect) {
    const previous = controller.rect;
    if (el.style.width === '' || previous.w !== next.w) el.style.width = `${next.w}px`;
    if (el.style.height === '' || previous.h !== next.h) el.style.height = `${next.h}px`;
    el.style.transform = transform(next);
    controller.rect = { ...next };
  }
  const controller: FrameController = {
    el, rect: { ...rect },
    set(next) {
      if (destroyed) return;
      // An explicit pointer frame supersedes a transition without a layout read.
      cancel(); write(next); el.style.opacity = '1'; el.style.transformOrigin = '0 0';
    },
    animate(kind, to, opts = {}) {
      if (destroyed) return Promise.resolve();
      this.stop();
      const from = { ...this.rect };
      const fadingOut = kind === 'close' || kind === 'minimize';
      const layout = fadingOut ? from : to;
      write(layout);
      el.style.opacity = '1'; el.style.transformOrigin = '0 0';
      if (kind === 'none') return Promise.resolve();
      const run = generation;
      if (reducedMotion()) {
        const opacity = fadingOut ? [1, 0] : kind === 'open' || kind === 'restore' ? [0, 1] : [1, 0.85, 1];
        controls.push(animate(el, { opacity }, { duration: 0.12, ease: easeOut }));
      } else if (kind === 'open') {
        const origin = opts.origin ?? { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        el.style.transformOrigin = `${Math.max(0, Math.min(to.w, origin.x - to.x))}px ${Math.max(0, Math.min(to.h, origin.y - to.y))}px`;
        controls.push(animate(el, { transform: [transform(to, 0.86), transform(to)] }, windowOpen));
        controls.push(animate(el, { opacity: [0, 1] }, { duration: 0.12, ease: easeOut }));
      } else if (kind === 'close') {
        el.style.transformOrigin = '50% 50%';
        controls.push(animate(el, { transform: [transform(from), transform(from, 0.96)], opacity: [1, 0] }, { duration: 0.14, ease: easeIn }));
      } else if (kind === 'minimize' || kind === 'restore') {
        const target = opts.dockTarget ?? { x: el.ownerDocument.defaultView!.innerWidth / 2, y: el.ownerDocument.defaultView!.innerHeight - 42 };
        const scale = 48 / layout.w;
        const dock = transform({ ...layout, x: target.x - 24, y: target.y - layout.h * scale / 2 }, scale);
        if (kind === 'minimize') {
          controls.push(animate(el, { transform: [transform(from), dock] }, { duration: 0.36, ease: easeSuck }));
          controls.push(animate(el, { opacity: [1, 1, 0] }, { duration: 0.36, times: [0, 0.7, 1], ease: easeSuck }));
        } else {
          controls.push(animate(el, { transform: [dock, transform(to)] }, windowRestore));
          controls.push(animate(el, { opacity: [0, 1] }, { duration: 0.12, ease: easeOut }));
        }
      } else {
        controls.push(animate(el, { transform: [transform(from, from.w / to.w, from.h / to.h), transform(to)] }, windowSnap));
      }
      return new Promise<void>(resolve => {
        settle = resolve;
        void Promise.all(controls.map(animation => Promise.resolve(animation))).then(() => {
          if (generation !== run || destroyed) return;
          controls = []; settle = null;
          write(to); el.style.opacity = fadingOut ? '0' : '1'; el.style.transformOrigin = '0 0';
          resolve();
        });
      });
    },
    stop() {
      if (!controls.length) return;
      // Only interruption measures the current painted frame.
      const style = el.ownerDocument.defaultView!.getComputedStyle(el);
      const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
      const [ox, oy] = style.transformOrigin.split(' ').map(Number.parseFloat);
      const painted = { x: matrix.m41 + (ox || 0) * (1 - matrix.m11), y: matrix.m42 + (oy || 0) * (1 - matrix.m22),
        w: this.rect.w * Math.abs(matrix.m11), h: this.rect.h * Math.abs(matrix.m22) };
      cancel(); write(painted); el.style.opacity = '1'; el.style.transformOrigin = '0 0';
    },
    destroy() { cancel(); destroyed = true; },
  };
  controller.set(rect);
  return controller;
}

export function beginPointerInteraction(el: HTMLElement, kind: 'dragging' | 'resizing'): () => void {
  const root = el.ownerDocument.documentElement;
  el.dataset[kind] = ''; root.dataset.windowInteraction = kind;
  return () => { delete el.dataset[kind]; delete root.dataset.windowInteraction; };
}

export function animateSnapPreview(frame: FrameController, visible: boolean, reduced: boolean, origin: Point | null) {
  const rect = frame.rect;
  frame.el.style.transformOrigin = origin ? `${origin.x - rect.x}px ${origin.y - rect.y}px` : '50% 50%';
  const opacity = visible ? [0, 0.55] : [0.55, 0];
  return animate(frame.el, reduced ? { opacity } : {
    opacity, transform: visible ? [transform(rect, 0.94), transform(rect)] : [transform(rect), transform(rect, 0.94)],
  }, { duration: reduced ? 0.12 : 0.14, ease: easeOut });
}
