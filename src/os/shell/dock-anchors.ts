import type { AppId } from '../types/apps';
import type { Point } from '../wm/types';
export function getDockAnchor(_appId: AppId): Point | null { return null; }
export function registerDockAnchor(_appId: AppId, _element: HTMLElement): () => void { return () => {}; }
export function isOverKooda(_point: Point): boolean { return false; }
