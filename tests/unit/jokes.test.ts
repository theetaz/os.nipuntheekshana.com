import { describe, expect, it } from 'vitest';
import { JOKE_DECK, JOKES, pickJoke } from '../../src/lib/server/jokes';
import { localModeration } from '../../src/lib/server/moderate';
describe('Kottu joke deck', () => {
  it('contains the thirty specified lines, seven in Sinhala, without owner-review glosses', () => {
    expect(JOKES).toHaveLength(30); expect(JOKE_DECK.filter(joke => joke.lang === 'si')).toHaveLength(7);
    for (const joke of JOKE_DECK) {
      expect(Array.from(joke.text).length).toBeLessThanOrEqual(140);
      expect(joke.text.match(/\p{Extended_Pictographic}/gu)?.length ?? 0).toBeLessThanOrEqual(1);
      expect(localModeration('Visitor', joke.text), joke.text).toBeNull();
      if (joke.lang === 'si') { expect(joke.text).toMatch(/[\u0d80-\u0dff]/u); expect(joke.text).not.toContain('('); }
    }
  });
  it('keeps the no-argument contract and prefers the requested language', () => {
    for (let i = 0; i < 80; i++) {
      expect(JOKES).toContain(pickJoke());
      expect(JOKE_DECK.filter(joke => joke.lang === 'si').map(joke => joke.text)).toContain(pickJoke('si'));
      expect(JOKE_DECK.filter(joke => joke.lang === 'en').map(joke => joke.text)).toContain(pickJoke('en'));
    }
  });
});
