export const COLORS = ['paper', 'thambili', 'lagoon', 'lotus', 'tea'] as const;
export const FONTS = ['sans', 'serif', 'handwriting'] as const;
export interface PostcardInput {
  name: string; body: string; email: string | null;
  color: typeof COLORS[number]; font: typeof FONTS[number]; turnstileToken: string;
}
export type Validation = { ok: true; value: PostcardInput } | { ok: false; fields: Record<string, string> };
const length = (text: string) => Array.from(text).length;
export function validate(input: unknown, requireTurnstile = true): Validation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, fields: { request: 'Expected a JSON object.' } };
  const data = input as Record<string, unknown>; const fields: Record<string, string> = {};
  const text = (key: string, max: number) => {
    const raw = data[key]; const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || length(value) > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fields[key] = `Use 1–${max} characters.`;
    return value;
  };
  const name = text('name', 40); const body = text('body', 300);
  const turnstileToken = requireTurnstile || data.turnstileToken !== undefined ? text('turnstileToken', 2048) : '';
  let email: string | null = null;
  if (data.email !== undefined && data.email !== '' && data.email !== null) {
    if (typeof data.email !== 'string' || length(data.email) > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(data.email)) fields.email = 'Enter a valid email address.';
    else email = data.email.trim();
  }
  if (!COLORS.includes(data.color as typeof COLORS[number])) fields.color = 'Choose a postcard color.';
  if (!FONTS.includes(data.font as typeof FONTS[number])) fields.font = 'Choose a postcard font.';
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value: {
    name, body, email, color: data.color as PostcardInput['color'], font: data.font as PostcardInput['font'], turnstileToken,
  } };
}
/** Bound the real stream, including chunked bodies with no Content-Length. */
export async function readJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw new Error('content-type');
  const reader = request.body?.getReader(); if (!reader) throw new Error('body');
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 8192) { await reader.cancel(); throw new Error('size'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
}
