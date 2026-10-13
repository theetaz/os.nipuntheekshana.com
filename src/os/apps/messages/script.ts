import type { MochiState } from '../../mochi/api';
import type { ClientProfile } from '../../types/content';

export type ThreadId = 'nipun' | 'mochi';
export type Intent = 'building' | 'prabhava' | 'together' | 'stack' | 'where' | 'contact';
export interface MessageLink { label: string; href: string }
export interface Reply { text: string; links?: MessageLink[]; emailText?: string }
export interface Message extends Reply { id: string; role: 'user' | 'assistant'; at: number }
export interface MochiPort {
  pet(): void; give(item: string): void; getState(): MochiState;
}
export interface EngineContext { profile: ClientProfile; now(): Date; mochi: MochiPort }
export interface ReplyRequest {
  thread: ThreadId; text: string; history: readonly Message[]; signal?: AbortSignal;
  onDelta?: (text: string) => void;
}
/** P7-3 can provide an SSE-backed engine without changing the conversation views. */
export interface ConversationEngine {
  readonly mode: 'scripted' | 'ai';
  reply(request: ReplyRequest, context: EngineContext): Promise<Reply>;
}
export const MAX_INPUT = 1000;
export const SCRIPTED_BANNER = 'Replies are pre-written for now. Anything else becomes an email to the real Nipun.';
export const GREETING = "Hi, I'm Nipun's desk assistant. Pick a question, or write your own and I'll turn it into an email.";
export const FREE_TEXT_REPLY = "I'm scripted, so I can't answer that myself. Want to send it to Nipun as an email?";
export const QUESTIONS: readonly { intent: Intent; text: string }[] = [
  { intent: 'building', text: 'What are you building?' },
  { intent: 'prabhava', text: "What's Prabhava Labs?" },
  { intent: 'together', text: 'Can we work together?' },
  { intent: 'stack', text: "What's your stack?" },
  { intent: 'where', text: 'Where are you based?' },
  { intent: 'contact', text: 'How do I reach you?' },
];
export const MOCHI_QUESTIONS = ['Pet', 'Give tea', 'How are you?'] as const;

export function formatMessageTime(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'Asia/Colombo' }).format(date);
}

function normalise(text: string): string {
  return text.normalize('NFKC').toLowerCase().trim().replace(/[’‘]/g, "'")
    .replace(/[?!.,]+$/g, '').replace(/\s+/g, ' ').trim();
}
const patterns: Record<Intent, RegExp> = {
  building: /^(what (are you (building|working on)|do you build)|current projects|what's new|now|building)$/,
  prabhava: /^(what('s| is) prabhava( labs)?|tell me about prabhava( labs)?|prabhava( labs)?)$/,
  together: /^(can we (work together|collaborate)|work together|collaborate|are you (available|available for work|open to work)|hire you)$/,
  stack: /^(what('s| is) your (stack|tech stack)|what (languages|technologies) do you use|your stack|stack|languages|toolbox)$/,
  where: /^(where (are you (based|located)|do you live)|location|where|colombo)$/,
  contact: /^(how (do|can) i (reach|contact) you|contact( you)?|email|github|linkedin)$/,
};
export function matchIntent(text: string): Intent | null {
  const input = normalise(text);
  return QUESTIONS.find(({ intent }) => patterns[intent].test(input))?.intent ?? null;
}
export function emailHref(text: string, email = 'theekshana2@gmail.com'): string {
  return `mailto:${email}?subject=Hello%20from%20Kottu%20OS&body=${encodeURIComponent(`${text.toWellFormed()}\n\n— sent from os.nipuntheekshana.com`)}`;
}
export function replyDelay(text: string, reducedMotion = false): number {
  return reducedMotion ? 300 : Math.min(1400, 600 + 12 * Array.from(text).length);
}
export function scriptedAnswer(intent: Intent, profile: ClientProfile, date: Date): Reply {
  const email = { label: 'Email Nipun', href: `mailto:${profile.site.email}` };
  switch (intent) {
    case 'building': return { text: `Right now:\n${profile.now.items.slice(0, 3).join('\n')}`,
      links: [{ label: 'More in Now.', href: '/now' }] };
    case 'prabhava': return { text: profile.experience.find(item => item.org === 'Prabhava Labs')?.summary
      ?? 'Prabhava Labs builds useful, open tools for Sri Lanka.', links: [{ label: 'Prabhava Labs', href: profile.links.prabhava }] };
    case 'together': return { text: "The best way is email. Tell me what you have in mind and I'll reply.", links: [email] };
    case 'stack': return { text: `${profile.skills.find(group => group.group === 'Languages')?.items.slice(0, 6).join(', ') || 'Open tools'}, and a soldering iron.`,
      links: [{ label: 'About → Toolbox', href: '/about#toolbox' }] };
    case 'where': return { text: `${profile.site.location}. It's ${formatMessageTime(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} here right now.` };
    case 'contact': return { text: 'Email is the best way to reach me. You can also find me on GitHub and LinkedIn.',
      links: [email, { label: 'GitHub', href: profile.links.github }, { label: 'LinkedIn', href: profile.links.linkedin }] };
  }
}
export function mochiAnswer(text: string, mochi: MochiPort): Reply {
  const input = normalise(text);
  if (input === 'pet' || input === 'pet mochi') mochi.pet();
  else if (input === 'give tea' || input === 'tea') mochi.give('tea');
  else if (input !== 'how are you' && input !== 'how is mochi' && input !== 'mood') {
    return { text: 'Try Pet, Give tea, or How are you? I leave the email to Nipun.' };
  }
  const state = mochi.getState();
  if (input === 'pet' || input === 'pet mochi') return { text: `A little desk happiness. ${state.pets} ${state.pets === 1 ? 'pet' : 'pets'} so far. My mood is ${state.mood}.` };
  if (input === 'give tea' || input === 'tea') return { text: `Tea received. My mood is ${state.mood}. Thank you for the little break.` };
  return { text: `My mood is ${state.mood}. I've had ${state.pets} ${state.pets === 1 ? 'pet' : 'pets'}${state.visible ? ' and I am keeping an eye on the desk' : ' and I am tucked away'} today.` };
}
export function createScriptEngine(): ConversationEngine {
  return { mode: 'scripted', async reply(request, context) {
    request.signal?.throwIfAborted();
    const text = request.text.trim().slice(0, MAX_INPUT).toWellFormed();
    if (!text) throw new RangeError('A message cannot be empty.');
    if (request.thread === 'mochi') return mochiAnswer(text, context.mochi);
    const intent = matchIntent(text);
    return intent ? scriptedAnswer(intent, context.profile, context.now())
      : { text: FREE_TEXT_REPLY, emailText: text, links: [{ label: 'Open email', href: emailHref(text, context.profile.site.email) }] };
  } };
}
/** The build timestamp is embedded with the profile, making adoption deterministic. */
export function initialTranscript(profile: ClientProfile, at: number): Message[] {
  return [{ id: 'greeting', role: 'assistant', text: GREETING, at }, ...QUESTIONS.flatMap(({ intent, text }) => [
    { id: `question-${intent}`, role: 'user' as const, text, at },
    { id: `answer-${intent}`, role: 'assistant' as const, ...scriptedAnswer(intent, profile, new Date(at)), at },
  ])];
}
