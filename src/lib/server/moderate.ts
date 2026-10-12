import type { BackendEnv } from './env';
import { normalise } from './badwords/normalise';
import { englishProfanity } from './badwords/en';
import { sinhalaProfanity } from './badwords/si';
import { containsLink } from './links';
export const GUARD_MODEL = '@cf/meta/llama-guard-3-8b';
export function localModeration(name: string, body: string): 'en' | 'si' | 'link' | null {
  const texts = [name, body].map(normalise);
  if (texts.some(englishProfanity)) return 'en';
  if (texts.some(sinhalaProfanity)) return 'si';
  if ([name, body].some(containsLink)) return 'link';
  return null;
}
export async function aiModeration(env: BackendEnv, name: string, body: string): Promise<'pending' | 'published'> {
  if (!env.AI) { console.warn('postcards: moderation AI unavailable; publishing'); return 'published'; }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const inference = env.AI.run(GUARD_MODEL, { messages: [{ role: 'user', content: `Name: ${name}\nPostcard: ${body}` }], max_tokens: 100, temperature: 0 });
    const result = await Promise.race([inference, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('AI moderation timed out')), 8000); })]);
    const classification = typeof result.response === 'string' ? result.response.trim().toLowerCase() : '';
    if (/^unsafe\b/u.test(classification)) return 'pending';
    if (!/^safe\b/u.test(classification)) console.warn('postcards: moderation AI returned an invalid classification; publishing');
    return 'published';
  } catch { console.warn('postcards: moderation AI failed; publishing'); return 'published'; }
  finally { clearTimeout(timeout); }
}
