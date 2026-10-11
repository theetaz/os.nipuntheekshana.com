import type { MochiPort } from './script';
import type { MochiPrefs } from '../../state/prefs';

/** Keeps pet persistence working with the shell's no-op API until Mochi loads. */
export function createMochiPort(api: MochiPort, preferences: {
  get(): MochiPrefs; set(update: (value: MochiPrefs) => MochiPrefs): void;
}): MochiPort {
  return {
    pet() {
      const before = preferences.get().pets;
      api.pet();
      if (preferences.get().pets === before) preferences.set(value => ({ ...value, pets: value.pets + 1 }));
    },
    give(item) { api.give(item); },
    getState() {
      const state = api.getState(); const prefs = preferences.get();
      return { ...state, pets: prefs.pets, visible: prefs.visible };
    },
  };
}
