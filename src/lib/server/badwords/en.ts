import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
/** The package preset includes per-term allowlists (assessment, Dickens, etc.). */
export function englishProfanity(normalised: string): boolean { return matcher.hasMatch(normalised); }
