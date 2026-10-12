import { describe, expect, it } from 'vitest';
import { normalise } from '../../src/lib/server/badwords/normalise';
import { englishProfanity } from '../../src/lib/server/badwords/en';
import { sinhalaProfanity, SINHALA_GROUPS, SINHALA_ALLOWLIST } from '../../src/lib/server/badwords/si';
import { localModeration } from '../../src/lib/server/moderate';
import { containsLink } from '../../src/lib/server/links';
import { JOKES, pickJoke } from '../../src/lib/server/jokes';
describe('matching normalisation', () => {
  it.each([['ＦＵＣＫ', 'fuck'], ['F\u200bUCK', 'fuck'], ['F\u034fUCK', 'fuck'], ['F\ufe0fUCK', 'fuck'], ['fu\u200dck', 'fuck'], ['fuuuck', 'fuck'], ['shiiiit', 'shit'], ['@4 0 1!| 3 $5 7', 'aa o iii e ss t'], ['f . u - c _ k', 'fuck'], ['h*u*t*t*a', 'hutta'], ['ළණශෂඹඟ', 'ලනසසබග'], ['ආඒඕෑීූේෝ', 'අඑඔැිුෙො']])('normalises %s', (input, result) => expect(normalise(input)).toBe(result));
  it('preserves stored Sinhala with joiners by only matching a derived string', () => {
    const text = 'ශ්‍රී ලංකාව හරිම ලස්සනයි 🌴'; expect(normalise(text)).not.toContain('\u200d'); expect(text).toContain('\u200d');
  });
  it('preserves emoji and does not join whole words', () => expect(normalise('hello world 🙂')).toBe('hello world 🙂'));
});
describe('English matcher', () => {
  it.each(['Scunthorpe', 'assessment', 'class', 'Dickens', 'Classic assessment by Dickens in Scunthorpe', 'ශ්‍රී ලංකාව ලස්සනයි 🌴', 'ආයුබෝවන්! Have a lovely day 🙂'])('allows %s', text => expect(englishProfanity(normalise(text))).toBe(false));
  it.each(['fuck', 'FUＣK', 'f u c k', 'f-u-c-k', 'f.u.c.k', 'fuuuck', 'sh1t', 'a$$hole', 'b1tch', 'cunt', 'dick'])('rejects %s', text => expect(englishProfanity(normalise(text))).toBe(true));
});
describe('Sinhala matcher', () => {
  it('contains 60–150 grouped reviewable entries', () => { const count = Object.values(SINHALA_GROUPS).flat().length; expect(count).toBeGreaterThanOrEqual(60); expect(count).toBeLessThanOrEqual(150); });
  it.each(Object.values(SINHALA_GROUPS).flat())('rejects listed term %s', text => expect(sinhalaProfanity(normalise(text))).toBe(true));
  it.each([...SINHALA_ALLOWLIST, 'ආයුබෝවන්! ඔබේ වැඩ හරිම ලස්සනයි.', 'ශ්‍රී ලංකාවට ආදරෙයි 🌴', 'අද පකුරු කනවා.', 'කැරිකේචර් එක ලස්සනයි.', 'මේ බඩුව ගත්තා', 'This curry is great', 'Ponnambalam likes tea', 'hello ලංකාව 🙂', 'දෙමළ හා සිංහල මිතුරන් සමග හම්බන්තොට ගියා.', 'පයි අගය ගැන ඉගෙන ගත්තා.'])('allows %s', text => expect(sinhalaProfanity(normalise(text))).toBe(false));
  it.each(['හු\u200dත්ත', 'හු\ufe0fත්ත', 'හු\u034fත්ත', 'h u t t a', 'හුත්ත!', 'හුකපාන්', 'පොණ්ණයා', 'hello හුත්ත hello', 'ammata-hukapan'])('rejects obfuscated or mixed term %s', text => expect(sinhalaProfanity(normalise(text))).toBe(true));
  it('does not match substrings or an allowlisted token as a whole-message bypass', () => {
    expect(sinhalaProfanity(normalise('pakistan'))).toBe(false); expect(sinhalaProfanity(normalise('pakistan හුත්ත'))).toBe(true);
  });
});
describe('links and pipeline order', () => {
  it.each(['https://example.com', 'www.example.org', 'WWW. hello', 'example.lk', 'hello.example.net/path', 'name@example.com', 'evil\u200b.com', 'evil.c\ufe0fo\ufe0fm', 'ｅｘａｍｐｌｅ．ｃｏｍ', 'ftp://host', '192.168.0.1/path', 'https://ලංකා.lk'])('detects %s', text => expect(containsLink(text)).toBe(true));
  it.each(['Hello, world. Thanks!', 'අද ලස්සන දවසක්.', '1.5 stars', 'Tea 🌴', 'Scunthorpe', 'foo bar'])('allows %s', text => expect(containsLink(text)).toBe(false));
  it('checks both name and body, English before Sinhala, and links last', () => {
    expect(localModeration('fuck', 'හුත්ත https://example.com')).toBe('en'); expect(localModeration('හුත්ත', 'hello')).toBe('si');
    expect(localModeration('example.com', 'hello')).toBe('link'); expect(localModeration('Dickens', 'Class assessment from Scunthorpe')).toBeNull();
  });
  it('picks only clean jokes from a mixed-language pool of at least twenty', () => {
    expect(JOKES.length).toBeGreaterThanOrEqual(20); expect(JOKES.some(joke => /[අ-ෆ]/u.test(joke))).toBe(true);
    for (const joke of JOKES) expect(localModeration('Postman', joke), joke).toBeNull();
    for (let i = 0; i < 100; i++) expect(JOKES).toContain(pickJoke());
  });
});
