import { atom } from 'jotai';
import type { Point } from '../wm/types';

export type MochiMood = 'idle' | 'happy' | 'surprised' | 'sleep' | 'curious' | 'dizzy' | 'wave';
export interface Brain {
  initialized: boolean; mood: MochiMood; moodUntil: number; lastInput: number;
  sleepReason: 'manual' | 'idle' | 'night' | null;
  bubble: string; bubbleUntil: number; speechSeq: number; announce: boolean;
  hearts: number; heartsUntil: number; look: Point | null; item: string | null; itemUntil: number;
}
export type BrainEvent =
  | { type: 'init'; night: boolean }
  | { type: 'pet'; count: number }
  | { type: 'mood'; mood: MochiMood; duration?: number; look?: Point }
  | { type: 'say'; text: string; announce?: boolean }
  | { type: 'give'; item: string }
  | { type: 'sleep' | 'wake' | 'wave' | 'input' }
  | { type: 'tick'; naps: boolean };

export const initialBrain: Brain = {
  initialized: false, mood: 'idle', moodUntil: 0, lastInput: 0, sleepReason: null,
  bubble: '', bubbleUntil: 0, speechSeq: 0, announce: false,
  hearts: 0, heartsUntil: 0, look: null, item: null, itemUntil: 0,
};
export const brainAtom = atom<Brain>(initialBrain);
// Copy carried over from nipuntheekshana.com/src/components/Mochi.astro @ 3b4f92d.
export const milestones: Readonly<Record<number, string>> = {
  1: 'Hehe. Again?', 5: 'Five pets! We’re friends now.', 10: 'Ten! I’m telling Nipun about you.',
  25: 'Twenty-five. You should really be reading the blog.',
  50: 'Fifty pets. You are officially my favourite human.', 100: 'One hundred. Nipun owes you a tea.',
};
const durations: Partial<Record<MochiMood, number>> = { happy: 1400, surprised: 700, curious: 1200, dizzy: 900, wave: 1200 };
export const mochiTime = () => performance.now();

/** Pure transitions keep API calls, the desktop, and the Pocket widget in sync. */
export function transitionBrain(state: Brain, event: BrainEvent, now: number): Brain {
  const mood = (next: MochiMood, duration = durations[next] ?? 0): Brain => ({
    ...state, initialized: true, mood: next, moodUntil: duration ? now + duration : 0,
    sleepReason: next === 'sleep' ? 'manual' : null, look: null, lastInput: now,
  });
  const speech = (next: Brain, text: string, announce = true): Brain => ({
    ...next, bubble: text, bubbleUntil: text ? now + 2600 : 0, speechSeq: state.speechSeq + 1, announce,
  });
  switch (event.type) {
    case 'init': return state.initialized ? state : speech({ ...mood(event.night ? 'sleep' : 'idle'),
      sleepReason: event.night ? 'night' : null }, "Hi, I'm Mochi. Pet me?", false);
    case 'pet': return speech({ ...mood('happy'), hearts: state.hearts + 1, heartsUntil: now + 1400 }, milestones[event.count] ?? `Pets: ${event.count}`);
    case 'mood': return { ...mood(event.mood, event.duration), look: event.look ?? null };
    case 'say': return speech({ ...state, initialized: true, lastInput: now }, event.text, event.announce ?? true);
    case 'give': return event.item === 'tea' ? speech(mood('happy'), 'Ceylon tea. My favourite.')
      : { ...mood('happy'), item: event.item, itemUntil: now + 10_000 };
    case 'sleep': return mood('sleep');
    case 'wake': return speech(mood('surprised', 900), "Oh. I wasn't sleeping. Promise.");
    case 'wave': return speech(mood('wave'), 'ආයුබෝවන්!');
    case 'input': return state.mood === 'sleep' && state.sleepReason !== 'manual'
      ? speech(mood('surprised', 900), "Oh. I wasn't sleeping. Promise.", false) : { ...state, lastInput: now };
    case 'tick': {
      let next = state;
      if (state.bubbleUntil && now >= state.bubbleUntil) next = { ...next, bubble: '', bubbleUntil: 0 };
      if (state.heartsUntil && now >= state.heartsUntil) next = { ...next, heartsUntil: 0 };
      if (state.itemUntil && now >= state.itemUntil) next = { ...next, item: null, itemUntil: 0 };
      if (state.moodUntil && now >= state.moodUntil) next = { ...next, mood: 'idle', moodUntil: 0, look: null };
      if (event.naps && next.mood === 'idle' && now - next.lastInput >= 45_000) next = { ...next, mood: 'sleep', sleepReason: 'idle' };
      return next;
    }
  }
}

export function nextBrainDeadline(state: Brain, naps: boolean): number | null {
  const deadlines = [state.bubbleUntil, state.moodUntil, state.heartsUntil, state.itemUntil].filter(Boolean);
  if (naps && state.mood === 'idle') deadlines.push(state.lastInput + 45_000);
  return deadlines.length ? Math.min(...deadlines) : null;
}
export function pauseBrain(state: Brain, elapsed: number): Brain {
  const shift = (time: number) => time ? time + elapsed : 0;
  return { ...state, lastInput: state.lastInput + elapsed, moodUntil: shift(state.moodUntil),
    bubbleUntil: shift(state.bubbleUntil), heartsUntil: shift(state.heartsUntil), itemUntil: shift(state.itemUntil) };
}
