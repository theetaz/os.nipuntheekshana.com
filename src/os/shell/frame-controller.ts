import type { Point, Rect, TransitionKind } from '../wm/types';
export interface FrameController {
  readonly el: HTMLElement; rect: Rect;
  set(rect: Rect): void;
  animate(kind: TransitionKind, to: Rect, opts?: { origin?: Point | null; dockTarget?: Point | null }): Promise<void>;
  stop(): void; destroy(): void;
}
export function createFrameController(el: HTMLElement, rect: Rect): FrameController {
  return { el, rect, set(next) { this.rect = next; }, async animate(_kind, to) { this.set(to); }, stop() {}, destroy() {} };
}
