import type { AppId } from '../types/apps';
import type { Point } from '../wm/types';
const anchors = new Map<AppId, Set<{ element: HTMLElement }>>();

function visibleAnchor(appId: AppId): HTMLElement | undefined {
  // Both shells exist during hydration. Only the visible, connected one is a target.
  return [...(anchors.get(appId) ?? [])].reverse().map(entry => entry.element).find(element => element.isConnected
    && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0);
}

export function getDockAnchor(appId: AppId): Point | null {
  const element = visibleAnchor(appId);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function registerDockAnchor(appId: AppId, element: HTMLElement): () => void {
  const group = anchors.get(appId) ?? new Set<{ element: HTMLElement }>();
  const entry = { element }; group.add(entry); anchors.set(appId, group);
  return () => { group.delete(entry); if (!group.size && anchors.get(appId) === group) anchors.delete(appId); };
}

export function isOverKooda(point: Point): boolean {
  const element = visibleAnchor('trash');
  if (!element || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const rect = element.getBoundingClientRect();
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}
