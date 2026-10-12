export const JOKE_DECK = [
  { text: "Ammo! Amma would wash your mouth with Sunlight soap for that. Try again 🙏", lang: 'en' },
  { text: "Whoa, machan. That word just took the night bus back to your keyboard.", lang: 'en' },
  { text: "The kottu chef stopped chopping to read that. He says: rephrase, please.", lang: 'en' },
  { text: "This board is a no-chilli zone. Fewer spicy words, more kiribath vibes.", lang: 'en' },
  { text: "Error 418: I'm a teapot from Nuwara Eliya, and I'm blushing ☕", lang: 'en' },
  { text: "Aiyo! Even the tuk-tuk honked at that one. Try a gentler version.", lang: 'en' },
  { text: "Hari hari. Deep breath, sip of tea, try again.", lang: 'en' },
  { text: "That message needs a little more sugar and a little less salt.", lang: 'en' },
  { text: "Our sticky notes are allergic to that word. Achoo! Try another one.", lang: 'en' },
  { text: "The bus conductor says that word has no ticket. Next stop: a kinder sentence.", lang: 'en' },
  { text: "Mochi covered both ears. Say it nicer and Mochi will pin it.", lang: 'en' },
  { text: "Even the Colombo crows raised an eyebrow. Try again, machan.", lang: 'en' },
  { text: "Aney, this wall is for good vibes only. Like Avurudu, but on the internet.", lang: 'en' },
  { text: "That word got bowled out first ball. New batter, please! 🏏", lang: 'en' },
  { text: "Rain stopped play! The umpire says rewrite and we'll resume.", lang: 'en' },
  { text: "The Lotus Tower lights went red for a second there. Make them pink again?", lang: 'en' },
  { text: "The kade aunty heard that, and now she's telling everyone. Quick, rephrase!", lang: 'en' },
  { text: "Power cut in the politeness grid. Restore it with a nicer word ⚡", lang: 'en' },
  { text: "Our filter speaks English, Sinhala and Singlish, and all three said: \"Ammo, no.\"", lang: 'en' },
  { text: "That one's going in Kooda (the basket). Write something we can pin.", lang: 'en' },
  { text: "Podi edit ekak daala balamu? The board loves a happy ending.", lang: 'en' },
  { text: "Machan, save the spice for the devilled chicken 🌶️", lang: 'en' },
  { text: "Kottu OS scanned that word. Result: too spicy. Try again!", lang: 'en' },
  { text: "අනේ… ඔය වචනේ නම් බෝඩ් එකට එපා. ලස්සන වචනයක් දාමු!", lang: 'si' },
  { text: "අම්මා බලනවා කියලා හිතලා ආයෙත් ලියන්න 🙏", lang: 'si' },
  { text: "අයියෝ! තේ එකක් බීලා, හිනාවෙලා ආයෙත් ට්‍රයි කරමු ☕", lang: 'si' },
  { text: "කොත්තු එකට මිරිස් ඇති. මැසේජ් එකට හිනාවක් දාමු 😄", lang: 'si' },
  { text: "පොල් ගෙඩියත් ලැජ්ජාවෙන් බිම බැලුවා 🥥", lang: 'si' },
  { text: "බස් එකේ කොන්දොස්තර මහත්තයාත් ඔය වචනෙට ටිකට් දෙන්නේ නෑ.", lang: 'si' },
  { text: "ලියුමට සීනි ටිකක් දාලා ආයෙත් එවන්න.", lang: 'si' },
] as const;
export const JOKES = JOKE_DECK.map(joke => joke.text);
export function pickJoke(lang?: 'en' | 'si'): string {
  const preferred = lang ? JOKE_DECK.filter(joke => joke.lang === lang) : JOKE_DECK;
  return preferred[crypto.getRandomValues(new Uint32Array(1))[0]! % preferred.length]!.text;
}
