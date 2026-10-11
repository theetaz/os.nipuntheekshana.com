import { atom } from 'jotai';
import type { AppId } from '../types/apps';

// Shared by icons and deferred controllers; never import the icon renderer to access state.
export const desktopSelectionAtom = atom<AppId[]>([]);
