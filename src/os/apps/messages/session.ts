import { MAX_INPUT, type Message, type Reply, type ThreadId } from './script';

export const SESSION_KEY = 'serendib:messages:v1';
export const MAX_MESSAGES = 100;
export interface ConversationSession {
  version: 1; selected: ThreadId; threads: Record<ThreadId, Message[]>; drafts: Record<ThreadId, string>;
  pending: { thread: ThreadId; reply: Reply; dueAt: number } | null;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const thread = (value: unknown): value is ThreadId => value === 'nipun' || value === 'mochi';
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const safeHref = (href: string) => /^\/(?!\/)|^https:\/\/|^mailto:/i.test(href) && !/[\u0000-\u001f]/.test(href);
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8.64e15;
function isReply(value: unknown): value is Reply {
  return record(value) && text(value.text, 12_000)
    && (value.emailText === undefined || text(value.emailText, MAX_INPUT))
    && (value.links === undefined || Array.isArray(value.links) && value.links.length <= 6 && value.links.every(link =>
      record(link) && text(link.label, 200) && text(link.href, 8000) && safeHref(link.href)));
}
function isMessage(value: unknown): value is Message {
  return isReply(value) && record(value) && text(value.id, 100) && (value.role === 'user' || value.role === 'assistant')
    && timestamp(value.at);
}
export function parseSession(raw: string | null): ConversationSession | null {
  if (!raw || raw.length > 500_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || !thread(value.selected) || !record(value.threads) || !record(value.drafts)) return null;
    for (const id of ['nipun', 'mochi'] as const) {
      const messages = value.threads[id];
      if (!Array.isArray(messages) || messages.length > MAX_MESSAGES || !messages.every(isMessage)
        || new Set(messages.map(message => message.id)).size !== messages.length || !text(value.drafts[id], MAX_INPUT)) return null;
    }
    if (value.pending !== null && (!record(value.pending) || !thread(value.pending.thread) || !isReply(value.pending.reply)
      || !timestamp(value.pending.dueAt))) return null;
    return value as unknown as ConversationSession;
  } catch { return null; }
}
export function appendMessages(messages: Message[], ...next: Message[]): Message[] {
  return [...messages, ...next].slice(-MAX_MESSAGES);
}
