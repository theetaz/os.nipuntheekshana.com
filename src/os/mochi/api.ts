import { mochiPrefsAtom } from '../state/prefs';
import { getStore } from '../state/store';
import { brainAtom, mochiTime, transitionBrain, type BrainEvent, type MochiMood } from './brain';

export type { MochiMood } from './brain';
export interface MochiState { mood: MochiMood; pets: number; visible: boolean }
function send(event: BrainEvent): void {
  getStore().set(brainAtom, state => transitionBrain(state, event, mochiTime()));
}
export function pet(): void {
  const store = getStore();
  store.set(mochiPrefsAtom, prefs => ({ ...prefs, pets: prefs.pets + 1 }));
  send({ type: 'pet', count: store.get(mochiPrefsAtom).pets });
}
export function give(item: string): void { send({ type: 'give', item }); }
export function setMood(mood: MochiMood): void { send({ type: 'mood', mood }); }
export function say(text: string): void { send({ type: 'say', text }); }
export function sleep(): void { send({ type: 'sleep' }); }
export function wake(): void { show(); send({ type: 'wake' }); }
export function wave(): void { send({ type: 'wave' }); }
export function hide(): void { getStore().set(mochiPrefsAtom, prefs => ({ ...prefs, visible: false })); }
export function show(): void { getStore().set(mochiPrefsAtom, prefs => ({ ...prefs, visible: true })); }
export function getState(): MochiState {
  const store = getStore(); const prefs = store.get(mochiPrefsAtom);
  return { mood: store.get(brainAtom).mood, pets: prefs.pets, visible: prefs.visible };
}
export const api = { pet, give, setMood, say, sleep, wake, wave, hide, show, getState };
