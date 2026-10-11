import { describe, expect, it } from 'vitest';
import { compareProjects, monogram, readingTime, screenKind } from '../../src/lib/client-data';
import { serializeInitialData } from '../../src/lib/initial-data';

describe('pure client-data helpers', () => {
  it('gives bare captures precedence, and classifies phones strictly above a 1.3 ratio', () => {
    expect(screenKind({ width: 100, height: 131 }, true)).toBe('bare');
    expect(screenKind({ width: 100, height: 131 })).toBe('phone');
    expect(screenKind({ width: 100, height: 130 })).toBe('browser');
    expect(screenKind({ width: 1600, height: 900 })).toBe('browser');
  });

  it('preserves explicit monograms and uses the first Unicode code point otherwise', () => {
    expect(monogram('OpenPay', 'OP')).toBe('OP');
    expect(monogram('Salli')).toBe('S');
    expect(monogram('🌴 Island')).toBe('🌴');
    expect(monogram('')).toBe('');
  });

  it('sorts featured first, then newest year, then title, with a stable slug tie-break', () => {
    const projects = [
      { slug: 'z', title: 'Zebra', year: 2026 },
      { slug: 'a', title: 'Alpha', year: 2026 },
      { slug: 'old', title: 'Old', year: 2020, featured: true },
      { slug: 'new', title: 'New', year: 2026, featured: true },
      { slug: 'b', title: 'Alpha', year: 2026 },
      { slug: 'past', title: 'Aardvark', year: 2025 },
    ];
    expect([...projects].sort(compareProjects).map(({ slug }) => slug)).toEqual(['new', 'old', 'a', 'b', 'z', 'past']);
    expect(projects[0]!.slug).toBe('z');
  });

  it('rounds reading time up at 220 words, excluding fenced code and blank whitespace', () => {
    expect(readingTime('')).toBe(0);
    expect(readingTime(' \n\t ')).toBe(0);
    expect(readingTime('hello')).toBe(1);
    expect(readingTime(Array(220).fill('word').join(' '))).toBe(1);
    expect(readingTime(Array(221).fill('word').join(' '))).toBe(2);
    expect(readingTime('hello\n```js\n' + Array(500).fill('code').join(' ') + '\n```')).toBe(1);
    expect(readingTime('~~~\ncode here\n~~~')).toBe(0);
  });
});

describe('initial data serialization', () => {
  it('cannot close its script or inject markup, and round-trips all original text', () => {
    const data = { text: '</script><script>alert(1)</script><!-- & >', unicode: 'සිංහල 🌴', key: 'projects:salli' };
    const serialized = serializeInitialData(data);
    expect(serialized).not.toContain('<');
    expect(serialized).toContain('\\u003c/script>');
    expect(JSON.parse(serialized)).toEqual(data);
  });

  it('accepts JSON null and rejects values with no JSON representation', () => {
    expect(serializeInitialData(null)).toBe('null');
    expect(() => serializeInitialData(undefined)).toThrow(TypeError);
  });
});
