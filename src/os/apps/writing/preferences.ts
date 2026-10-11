import { atomWithStorage } from 'jotai/utils';
import { preferenceStorage } from '../../state/storage';
import type { TextSize } from './data';

export const textSizeAtom = atomWithStorage<TextSize>('serendib:writing:text-size', 17,
  preferenceStorage((value): value is TextSize => value === 15 || value === 17 || value === 19), { getOnInit: false });
