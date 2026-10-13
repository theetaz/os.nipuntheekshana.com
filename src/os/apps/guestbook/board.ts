import type { Postcard, PostcardColor, PostcardFont } from './api';
export const colors: readonly PostcardColor[] = ['paper', 'thambili', 'lagoon', 'lotus', 'tea'];
export const fonts: readonly PostcardFont[] = ['sans', 'serif', 'handwriting'];
export const DRAFT_KEY = 'serendib:board:draft';
export const PENDING_KEY = 'serendib:board:pending';
export interface Draft { body: string; name: string; email: string; color: PostcardColor; font: PostcardFont }
export const emptyDraft: Draft = { body: '', name: '', email: '', color: 'paper', font: 'handwriting' };
export const codePoints = (text: string) => Array.from(text.trim()).length;
export function trimInput(value: string, limit: number): string {
  if (codePoints(value) <= limit) return value;
  return value.match(/^\s*/u)![0] + Array.from(value.trim()).slice(0, limit).join('');
}
export function readStored(key: string): unknown {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null'); } catch { return null; }
}
export function saveStored(key: string, value: unknown): void {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
export function readDraft(): Draft {
  const value = readStored(DRAFT_KEY) as Partial<Draft> | null;
  return value && ['body', 'name', 'email'].every(key => typeof value[key as keyof Draft] === 'string')
    ? { body: trimInput(value.body!, 300), name: trimInput(value.name!, 40), email: value.email!.slice(0, 254),
      color: colors.includes(value.color!) ? value.color! : 'paper', font: fonts.includes(value.font!) ? value.font! : 'handwriting' } : { ...emptyDraft };
}
export function isPostcard(value: unknown): value is Postcard {
  if (!value || typeof value !== 'object') return false;
  const item = value as Postcard;
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.body === 'string' && Number.isFinite(item.created_at)
    && colors.includes(item.color) && fonts.includes(item.font) && Number.isFinite(item.rotation)
    && (item.country === null || /^[A-Z]{2}$/.test(item.country));
}
export function pendingNotes(): Postcard[] {
  const items = readStored(PENDING_KEY);
  return Array.isArray(items) ? items.filter(isPostcard).slice(0, 5) : [];
}
export const recentNotes: Postcard[] = [];
export interface BoardNoteEvent { item: Postcard; pending: boolean; from?: DOMRect; flight?: Promise<void> }
export function pinNote(item: Postcard, pending = false, from?: DOMRect): Promise<void> {
  if (pending) saveStored(PENDING_KEY, [item, ...pendingNotes()].slice(0, 5));
  else { recentNotes.unshift(item); recentNotes.splice(40); }
  const detail: BoardNoteEvent = { item, pending, from };
  document.dispatchEvent(new CustomEvent('serendib:board:note', { detail }));
  return detail.flight ?? Promise.resolve();
}
export function mostlySinhala(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  return letters.length > 0 && letters.filter(letter => /[\u0d80-\u0dff]/u.test(letter)).length > letters.length / 2;
}
export const reducedMotion = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
export function noteSize(text: string, font: PostcardFont = 'handwriting'): number {
  const index = codePoints(text) > 160 ? 2 : codePoints(text) > 80 ? 1 : 0;
  return (font === 'sans' ? [18, 15, 13] : [20, 17, 15])[index]!;
}
export function noteLine(text: string): number { return codePoints(text) > 160 ? 21 : codePoints(text) > 80 ? 24 : 27; }
export function validateDraft(value: Draft): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!codePoints(value.body) || codePoints(value.body) > 300) fields.body = 'body';
  if (!codePoints(value.name) || codePoints(value.name) > 40) fields.name = 'name';
  if (value.email.trim() && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()) || value.email.length > 254)) fields.email = 'email';
  return fields;
}
export function hasLink(text: string): boolean {
  const value = text.normalize('NFKC').replace(/[\p{Cf}\u034f\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/gu, '');
  return /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\s*\.|\b(?:https?|ftp|mailto):)/iu.test(value)
    || /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+(?:\p{L}{2,63}|xn--[a-z0-9-]+)(?![\p{L}\p{N}])/iu.test(value)
    || /(?:\d{1,3}\.){3}\d{1,3}(?::\d+|\/)/u.test(value);
}
