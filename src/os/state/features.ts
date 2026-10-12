import { atom } from 'jotai';
export const aiAvailableAtom = atom(false);
// Match the prerendered launcher on first paint; health confirms the binding.
export const postcardsAvailableAtom = atom(!!import.meta.env.PUBLIC_TURNSTILE_SITE_KEY);
