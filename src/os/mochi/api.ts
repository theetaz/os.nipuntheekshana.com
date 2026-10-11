export type MochiMood = 'idle' | 'happy' | 'surprised' | 'sleep' | 'curious' | 'dizzy' | 'wave';
export interface MochiState { mood: MochiMood; pets: number; visible: boolean }
export function pet(): void {}
export function give(_item: string): void {}
export function setMood(_mood: MochiMood): void {}
export function say(_text: string): void {}
export function sleep(): void {}
export function wake(): void {}
export function wave(): void {}
export function hide(): void {}
export function show(): void {}
export function getState(): MochiState { return { mood: 'idle', pets: 0, visible: true }; }
export const api = { pet, give, setMood, say, sleep, wake, wave, hide, show, getState };
