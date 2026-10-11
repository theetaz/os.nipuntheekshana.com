import { describe, expect, it, vi } from 'vitest';
import * as sourceProfile from '../../src/data/profile';
import type { ClientProfile } from '../../src/os/types/content';
import type { MochiState } from '../../src/os/mochi/api';
import { createScriptEngine, emailHref, FREE_TEXT_REPLY, GREETING, initialTranscript, matchIntent,
  MAX_INPUT, mochiAnswer, QUESTIONS, replyDelay, scriptedAnswer, type Intent } from '../../src/os/apps/messages/script';
import { appendMessages, MAX_MESSAGES, parseSession, type ConversationSession } from '../../src/os/apps/messages/session';
import { api } from '../../src/os/mochi/api';
import { createOsStore, registerStore } from '../../src/os/state/store';
import { mochiPrefsAtom } from '../../src/os/state/prefs';
import { brainAtom } from '../../src/os/mochi/brain';

const profile: ClientProfile = { ...sourceProfile, hobbies: [...sourceProfile.hobbies], chapters: [], cv: { ...sourceProfile.cv, sizeLabel: 'PDF' },
  avatar: { src: '/avatar.png', width: 40, height: 40, avif: '', webp: '', alt: 'Nipun' } };
const date = new Date('2026-10-11T17:41:00Z');
function mochi(initial: Partial<MochiState> = {}) {
  const state: MochiState = { mood: 'idle', pets: 0, visible: true, ...initial };
  return { pet: vi.fn(() => { state.pets++; state.mood = 'happy'; }),
    give: vi.fn((_item: string) => { state.mood = 'curious'; }), getState: vi.fn(() => ({ ...state })) };
}
const aliases: [string, Intent][] = [
  ...QUESTIONS.map(({ intent, text }) => [text, intent] as [string, Intent]),
  ['  WHAT ARE YOU BUILDING?!  ', 'building'], ['What are you working on?', 'building'], ['current projects', 'building'],
  ["What's new?", 'building'], ['now', 'building'], ['building', 'building'],
  ['What’s Prabhava Labs?', 'prabhava'], ['what is prabhava', 'prabhava'], ['Tell me about Prabhava Labs', 'prabhava'], ['prabhava labs', 'prabhava'],
  ['Can we collaborate?', 'together'], ['Work together', 'together'], ['Are you available for work?', 'together'], ['hire you', 'together'],
  ['What is your tech stack?', 'stack'], ['What languages do you use?', 'stack'], ['What technologies do you use?', 'stack'], ['toolbox', 'stack'],
  ['Where do you live?', 'where'], ['Where are you located?', 'where'], ['location', 'where'], ['Colombo', 'where'],
  ['How can I contact you?', 'contact'], ['How do I contact you?', 'contact'], ['contact', 'contact'], ['email', 'contact'], ['GitHub', 'contact'], ['LinkedIn', 'contact'],
];
describe('Messages intent matching', () => {
  it.each(aliases)('maps %j to %s', (text, intent) => expect(matchIntent(text)).toBe(intent));
  it.each(['', '   ', 'hello', 'I want to email you about a project', 'Where is my parcel?', 'I love Colombo',
    'Please build a stack for me', 'Can we work together? Here is a confidential brief.', '<script>alert(1)</script>', 'contact the police'])
  ('keeps %j as free text', text => expect(matchIntent(text)).toBeNull());
});

describe('profile-based answers', () => {
  it('uses only the first three current items and links to Now', () => {
    const answer = scriptedAnswer('building', profile, date);
    for (const item of profile.now.items.slice(0, 3)) expect(answer.text).toContain(item);
    for (const item of profile.now.items.slice(3)) expect(answer.text).not.toContain(item);
    expect(answer.links).toEqual([{ label: 'More in Now.', href: '/now' }]);
  });
  it('uses the Prabhava summary and site URL', () => {
    expect(scriptedAnswer('prabhava', profile, date)).toEqual({ text: profile.experience.find(item => item.org === 'Prabhava Labs')!.summary,
      links: [{ label: 'Prabhava Labs', href: profile.links.prabhava }] });
  });
  it('offers collaboration by email with the specified wording', () => {
    expect(scriptedAnswer('together', profile, date)).toEqual({ text: "The best way is email. Tell me what you have in mind and I'll reply.",
      links: [{ label: 'Email Nipun', href: `mailto:${profile.site.email}` }] });
  });
  it('uses the first six Languages and the toolbox destination', () => {
    expect(scriptedAnswer('stack', profile, date)).toEqual({ text: 'Solidity, TypeScript, JavaScript, Go, Rust, Java, and a soldering iron.',
      links: [{ label: 'About → Toolbox', href: '/about#toolbox' }] });
  });
  it.each([['2026-10-11T17:41:00Z', '23:11'], ['2026-10-11T18:30:00Z', '00:00'], ['2026-10-11T01:05:00Z', '06:35']])
  ('uses Colombo time for %s', (instant, time) => expect(scriptedAnswer('where', profile, new Date(instant)).text)
    .toBe(`Colombo, Sri Lanka. It's ${time} here right now.`));
  it('returns email, GitHub and LinkedIn as links', () => {
    expect(scriptedAnswer('contact', profile, date).links).toEqual([
      { label: 'Email Nipun', href: `mailto:${profile.site.email}` }, { label: 'GitHub', href: profile.links.github }, { label: 'LinkedIn', href: profile.links.linkedin },
    ]);
  });
  it('uses changed profile facts without mutating its inputs', () => {
    const changed = { ...profile, site: { ...profile.site, location: 'Kandy, Sri Lanka', email: 'new@example.com' },
      now: { ...profile.now, items: ['One', 'Two', 'Three', 'Four'] }, skills: [{ group: 'Languages', items: ['C', 'Go'] }] };
    const before = JSON.stringify(changed);
    expect(scriptedAnswer('building', changed, date).text).toBe('Right now:\nOne\nTwo\nThree');
    expect(scriptedAnswer('stack', changed, date).text).toBe('C, Go, and a soldering iron.');
    expect(scriptedAnswer('where', changed, date).text).toContain('Kandy, Sri Lanka.');
    expect(scriptedAnswer('contact', changed, date).links![0]!.href).toBe('mailto:new@example.com');
    expect(JSON.stringify(changed)).toBe(before);
  });
  it('handles absent optional fact groups', () => {
    const sparse = { ...profile, experience: [], skills: [], now: { ...profile.now, items: [] } };
    expect(scriptedAnswer('prabhava', sparse, date).text).toContain('open tools');
    expect(scriptedAnswer('stack', sparse, date).text).toContain('soldering iron');
  });
  it('creates the same crawlable six-question transcript for static and managed views', () => {
    const transcript = initialTranscript(profile, date.getTime());
    expect(transcript).toHaveLength(13);
    expect(transcript[0]!.text).toBe(GREETING);
    expect(transcript.filter(item => item.role === 'user').map(item => item.text)).toEqual(QUESTIONS.map(item => item.text));
    expect(new Set(transcript.map(item => item.id)).size).toBe(13);
    expect(transcript.every(item => item.at === date.getTime())).toBe(true);
    expect(initialTranscript(profile, date.getTime())).toEqual(transcript);
  });
});

describe('replaceable conversation engine and email hand-off', () => {
  it.each(QUESTIONS)('answers $intent through the engine interface', async ({ intent, text }) => {
    const buddy = mochi();
    const reply = await createScriptEngine().reply({ thread: 'nipun', text, history: [] }, { profile, now: () => date, mochi: buddy });
    expect(reply).toEqual(scriptedAnswer(intent, profile, date));
    expect(buddy.pet).not.toHaveBeenCalled(); expect(buddy.give).not.toHaveBeenCalled();
  });
  it('reads the clock at request time', async () => {
    const now = vi.fn(() => date);
    await createScriptEngine().reply({ thread: 'nipun', text: 'where', history: [] }, { profile, now, mochi: mochi() });
    expect(now).toHaveBeenCalledOnce();
  });
  it('discloses scripted mode and turns hello into an email action', async () => {
    const engine = createScriptEngine();
    expect(engine.mode).toBe('scripted');
    expect(await engine.reply({ thread: 'nipun', text: 'hello', history: [] }, { profile, now: () => date, mochi: mochi() }))
      .toEqual({ text: FREE_TEXT_REPLY, emailText: 'hello', links: [{ label: 'Open email', href: emailHref('hello') }] });
  });
  it.each(['Hello\nA second line & a query? # % +', 'සිංහල தமிழ்', '<img src=x onerror=alert(1)>', 'Hello\r\nBcc: someone@example.com'])
  ('encodes %j as body text without injecting email parameters', text => {
    const href = emailHref(text);
    expect(href.startsWith('mailto:theekshana2@gmail.com?subject=Hello%20from%20Serendib&body=')).toBe(true);
    const query = new URLSearchParams(href.split('?')[1]);
    expect([...query.keys()]).toEqual(['subject', 'body']);
    expect(query.get('body')).toBe(`${text}\n\n— sent from os.nipuntheekshana.com`);
  });
  it('bounds free text and trims its surrounding whitespace', async () => {
    const reply = await createScriptEngine().reply({ thread: 'nipun', text: `  ${'x'.repeat(1100)}  `, history: [] }, { profile, now: () => date, mochi: mochi() });
    expect(reply.emailText).toBe('x'.repeat(MAX_INPUT));
  });
  it('keeps truncated and malformed Unicode safe for an email body', async () => {
    expect(emailHref('\uD800')).toContain('body=%EF%BF%BD');
    const reply = await createScriptEngine().reply({ thread: 'nipun', text: `${'x'.repeat(999)}😀`, history: [] },
      { profile, now: () => date, mochi: mochi() });
    expect(reply.emailText).toBe(`${'x'.repeat(999)}�`);
  });
  it('rejects empty messages', async () => {
    await expect(createScriptEngine().reply({ thread: 'nipun', text: '  ', history: [] }, { profile, now: () => date, mochi: mochi() })).rejects.toThrow(RangeError);
  });
  it('honours an abort before causing a Mochi side effect', async () => {
    const controller = new AbortController(); controller.abort(); const buddy = mochi();
    await expect(createScriptEngine().reply({ thread: 'mochi', text: 'Pet', history: [], signal: controller.signal },
      { profile, now: () => date, mochi: buddy })).rejects.toThrow();
    expect(buddy.pet).not.toHaveBeenCalled();
  });
  it('routes the Mochi thread independently of profile intents', async () => {
    const buddy = mochi();
    const reply = await createScriptEngine().reply({ thread: 'mochi', text: 'Pet', history: [] }, { profile, now: () => date, mochi: buddy });
    expect(reply.text).toContain('1 pet so far'); expect(buddy.pet).toHaveBeenCalledOnce();
  });
});

describe('Mochi conversations', () => {
  it('pets exactly once and reports the resulting count and mood', () => {
    const buddy = mochi({ pets: 9 });
    expect(mochiAnswer('Pet', buddy).text).toBe('A little desk happiness. 10 pets so far. My mood is happy.');
    expect(buddy.pet).toHaveBeenCalledOnce(); expect(buddy.give).not.toHaveBeenCalled();
  });
  it('gives real tea through the API and reads the resulting mood', () => {
    const buddy = mochi(); expect(mochiAnswer('Give tea', buddy).text).toContain('curious');
    expect(buddy.give).toHaveBeenCalledExactlyOnceWith('tea'); expect(buddy.pet).not.toHaveBeenCalled();
  });
  it('reads hidden and sleeping state without changing it', () => {
    const buddy = mochi({ mood: 'sleep', pets: 1, visible: false });
    expect(mochiAnswer('How are you?', buddy).text).toContain('sleep');
    expect(mochiAnswer('How are you?', buddy).text).toContain('1 pet and I am tucked away');
    expect(buddy.pet).not.toHaveBeenCalled(); expect(buddy.give).not.toHaveBeenCalled();
  });
  it('redirects an unknown question to Mochi chips without effects', () => {
    const buddy = mochi(); expect(mochiAnswer('email', buddy).text).toContain('Try Pet');
    expect(buddy.getState).not.toHaveBeenCalled();
  });
});

describe('reply timing', () => {
  it('waits 600ms plus 12ms per character up to 1400ms', () => {
    expect(replyDelay('')).toBe(600); expect(replyDelay('abc')).toBe(636); expect(replyDelay('x'.repeat(500))).toBe(1400);
    expect(replyDelay('😀')).toBe(612);
  });
  it('uses a fixed 300ms delay for reduced motion', () => {
    expect(replyDelay('abc', true)).toBe(300); expect(replyDelay('x'.repeat(500), true)).toBe(300);
  });
});

describe('live Messages to Mochi integration', () => {
  it('pets once through the real API and tea updates the desktop brain', async () => {
    const store = createOsStore(); const release = registerStore(store);
    store.set(mochiPrefsAtom, { pets: 2, visible: true, naps: true, pos: null });
    try {
      const reply = await createScriptEngine().reply({ thread: 'mochi', text: 'Pet', history: [] }, { profile, now: () => date, mochi: api });
      expect(store.get(mochiPrefsAtom).pets).toBe(3);
      expect(reply.text).toContain('3 pets so far');
      await createScriptEngine().reply({ thread: 'mochi', text: 'Give tea', history: [] }, { profile, now: () => date, mochi: api });
      expect(store.get(brainAtom)).toMatchObject({ mood: 'happy', bubble: 'Ceylon tea. My favourite.' });
      expect(store.get(mochiPrefsAtom).pets).toBe(3);
    } finally { release(); }
  });
});

function session(): ConversationSession {
  return { version: 1, selected: 'nipun', threads: { nipun: initialTranscript(profile, date.getTime()), mochi: [] },
    drafts: { nipun: 'an unsent note', mochi: '' }, pending: null };
}
describe('bounded session persistence', () => {
  it('restores both transcripts and drafts', () => expect(parseSession(JSON.stringify(session()))).toEqual(session()));
  it('restores a computed pending reply without replaying engine effects', () => {
    const value = session(); value.selected = 'mochi'; value.pending = { thread: 'mochi', reply: { text: '1 pet so far' }, dueAt: date.getTime() + 300 };
    expect(parseSession(JSON.stringify(value))).toEqual(value);
  });
  it.each([null, '', '{', 'null', '[]', '{}', '{"version":2}', 'x'.repeat(500_001)])('rejects invalid storage %#', raw => expect(parseSession(raw)).toBeNull());
  it.each([
    (value: any) => { value.selected = 'stranger'; },
    (value: any) => { value.threads.nipun[0].role = 'system'; },
    (value: any) => { value.threads.nipun[0].at = 1e300; },
    (value: any) => { value.threads.nipun[0].text = 'x'.repeat(12_001); },
    (value: any) => { value.threads.nipun.push(value.threads.nipun[0]); },
    (value: any) => { value.drafts.mochi = 'x'.repeat(MAX_INPUT + 1); },
    (value: any) => { value.pending = { thread: 'other', reply: { text: 'reply' }, dueAt: 0 }; },
    (value: any) => { value.pending = { thread: 'nipun', reply: { text: 'reply' }, dueAt: -1 }; },
    (value: any) => { value.pending = {}; },
  ])('rejects malformed session fields %#', change => {
    const value = session(); change(value); expect(parseSession(JSON.stringify(value))).toBeNull();
  });
  it.each(['javascript:alert(1)', 'data:text/html,<script>bad</script>', '//evil.example', '/ok\nno', 'https://example.com\u0000'])
  ('rejects unsafe restored link %j', href => {
    const value = session(); value.threads.nipun[0]!.links = [{ label: 'bad', href }];
    expect(parseSession(JSON.stringify(value))).toBeNull();
  });
  it('retains only the latest 100 messages without mutating history', () => {
    const original = session().threads.nipun;
    const added = Array.from({ length: 120 }, (_, index) => ({ id: `new-${index}`, role: 'user' as const, text: `message ${index}`, at: date.getTime() }));
    const bounded = appendMessages(original, ...added);
    expect(bounded).toHaveLength(MAX_MESSAGES); expect(bounded[0]!.id).toBe('new-20'); expect(original).toHaveLength(13);
    const value = session(); value.threads.nipun = bounded; expect(parseSession(JSON.stringify(value))).not.toBeNull();
  });
});
