export function containsLink(text: string): boolean {
  const value = text.normalize('NFKC').replace(/[\p{Cf}\u034f\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/gu, '');
  return /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\s*\.|\b(?:https?|ftp|mailto):)/iu.test(value)
    || /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+(?:\p{L}{2,63}|xn--[a-z0-9-]+)(?![\p{L}\p{N}])/iu.test(value)
    || /(?:\d{1,3}\.){3}\d{1,3}(?::\d+|\/)/u.test(value);
}
