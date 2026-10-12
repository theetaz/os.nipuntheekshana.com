import { normalise } from './normalise';
/** Owner-reviewable Sinhala/Singlish vocabulary. These are moderation terms,
 * not descriptions of people. Group meanings are neutral; variants share a meaning.
 * Entire Unicode words/phrases only, never arbitrary substring matches.
 */
export const SINHALA_GROUPS = {
  // Vulgar references to female genitalia; script, inflections and common romanisations.
  genitalFemale: [
    'හුත්ත', 'හුත්තා', 'හුත්ති', 'හුත්තිගෙ', 'හුත්තේ', 'හුත්තට',
    'හුත්තක්', 'හුත්තෙන්', 'හුත්තිය', 'හුත්තිගේ', 'hutta', 'huththa',
    'hutha', 'huththaa', 'hutti', 'huththi', 'huthi', 'hutto',
    'huththo', 'huttoh',
  ],
  // Vulgar references to male genitalia; the innocent word පකුරු is explicitly allowed below.
  genitalMale: [
    'පක', 'පකයා', 'පකය', 'පකේ', 'පකෙන්', 'පකට',
    'පකක්', 'පකයෝ', 'පයිය', 'පයියා', 'පයියේ', 'පයියෙන්',
    'paka', 'pakaya', 'pakayo', 'pakey', 'pakay', 'paiya',
    'payiya', 'payya', 'paiyya', 'payyia', 'paye',
  ],
  // Vulgar sexual acts, directives and compounds (not ordinary words for flowers).
  sexualActs: [
    'හුකන', 'හුකන්න', 'හුකපන්', 'හුකනවා', 'හුකපු', 'හුකලා',
    'හුකන්නෙ', 'හුකන්නේ', 'හුකනව', 'හුකයි', 'හුකමින්', 'hukana',
    'hukanna', 'hukapan', 'hukapn', 'hukanawa', 'hukanava', 'hukapu',
    'hukala', 'hukanne', 'hukannee', 'hukahan', 'hukahapan',
  ],
  // Family-directed sexual insults; joined forms, phrases and common chat abbreviations.
  familyInsults: [
    'අම්මට හුකපන්', 'අම්මටහුකපන්', 'අම්මහුත්ත', 'අම්මගේ හුත්ත', 'කැරි වේසි', 'කැරිවේසි',
    'හුකන පොන්නයා', 'ammata hukapan', 'ammatahukapan', 'ammata hukpn', 'ammahutta', 'amma hutta',
    'amma huththa', 'ammapaka', 'ammapa hutta', 'amk', 'amh', 'ahp',
  ],
  // Vulgar bodily-fluid terms and compounds used as insults. Do not match curry/kiri.
  bodilyFluid: [
    'කැරි', 'කැරියා', 'කැරිය', 'කැරියෝ', 'කැරියෙක්', 'කැරියට',
    'කැරියගෙ', 'කැරිම', 'kari', 'kariya', 'karia', 'kariyaa',
    'kariyo', 'kariyaek', 'karyaa', 'krya',
  ],
  // Derogatory sexuality/gender and sex-work terms used as personal abuse.
  personalSlurs: [
    'පොන්න', 'පොන්නයා', 'පොන්නය', 'පොන්නයෝ', 'පොන්නයෙක්', 'පොන්නිය',
    'වේසි', 'වේසිය', 'වේසියේ', 'වේසියෝ', 'වෙස', 'වෙසියා',
    'ponna', 'ponnaya', 'ponnayo', 'ponnayek', 'ponni', 'pnnaya',
    'ponnayaaa', 'wesi', 'vesi', 'weshi', 'veshiya', 'wesiya',
    'wesiyo', 'vesiyo',
  ],
  // Explicitly hostile ethnic/religious compounds. Neutral community names are not blocked.
  ethnicReligiousSlurs: [
    'පරදෙමළා', 'පර දෙමළා', 'පරදෙමල', 'parademala', 'para demala', 'paradhemala',
    'පරහම්බයා', 'පර හම්බයා', 'parahambaya', 'para hambaya', 'parahambayo', 'පරහම්බයෝ',
  ],
} as const;
export const SINHALA_ALLOWLIST = ['පකුරු', 'පකුර', 'පකුරුවල', 'කැරිකේචර්', 'කැරිකේචරය', 'කැරිකේචර්ස්', 'kariyawasam', 'karikatur', 'pakistan', 'pakistani', 'pakayaam', 'curry', 'kiri', 'ponnambalam', 'ponnampalam', 'හම්බන්තොට', 'දෙමළ', 'පයි'] as const;
const terms = new Set(Object.values(SINHALA_GROUPS).flat().map(normalise));
const allowed = new Set(SINHALA_ALLOWLIST.map(normalise));
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrases = [...terms].filter(term => term.includes(' ')).map(term => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escape(term).replaceAll(' ', '\\s+')}(?![\\p{L}\\p{M}\\p{N}])`, 'u'));
export function sinhalaProfanity(normalised: string): boolean {
  const words = normalised.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return words.some(word => !allowed.has(word) && terms.has(word)) || phrases.some(pattern => pattern.test(normalised));
}
