const leet: Record<string, string> = { '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '$': 's', '5': 's', '7': 't' };
// Phonetic spelling variants: long/short vowels, dental/retroflex consonants,
// sibilants and prenasalised consonants. Preserve virama and other vowel signs.
const sinhala: Record<string, string> = { 'ා': '', 'ආ': 'අ', 'ඒ': 'එ', 'ඕ': 'ඔ', 'ෑ': 'ැ', 'ී': 'ි', 'ූ': 'ු', 'ේ': 'ෙ', 'ෝ': 'ො', 'ළ': 'ල', 'ණ': 'න', 'ශ': 'ස', 'ෂ': 'ස', 'ඹ': 'බ', 'ඟ': 'ග' };
/** Matching only. Never persist this value: Sinhala text requires ZWJ. */
export function normalise(text: string): string {
  return text.normalize('NFKC').toLowerCase()
    .replace(/[\p{Cf}\u034f\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/gu, '')
    .replace(/(\p{L})\1{2,}/gu, '$1')
    .replace(/[@401!|3$57]/g, (character, offset, source: string) => /[අ-ෆ\u0dca-\u0dff]/u.test(source[offset - 1] ?? '') && /[!|]/.test(character) ? character : leet[character]!)
    .replace(/(?<![\p{L}\p{M}\p{N}])\p{L}(?:[.\-_* ]+\p{L})+(?![\p{L}\p{M}\p{N}])/gu, value => value.replace(/[.\-_* ]+/g, ''))
    .replace(/[ාආඒඕෑීූේෝළණශෂඹඟ]/gu, character => sinhala[character]!);
}
