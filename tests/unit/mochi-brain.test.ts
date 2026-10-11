import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initialBrain, milestones, nextBrainDeadline, pauseBrain, transitionBrain, brainAtom } from '../../src/os/mochi/brain';
import { api } from '../../src/os/mochi/api';
import { createOsStore, registerStore } from '../../src/os/state/store';
import { mochiPrefsAtom } from '../../src/os/state/prefs';

describe('Mochi brain', () => {
  it('starts asleep at Colombo night and never overwrites an earlier API action', () => {
    const night = transitionBrain(initialBrain, { type: 'init', night: true }, 100);
    expect(night).toMatchObject({ mood: 'sleep', sleepReason: 'night', announce: false });
    const wave = transitionBrain(initialBrain, { type: 'wave' }, 90);
    expect(transitionBrain(wave, { type: 'init', night: true }, 100)).toBe(wave);
  });
  it.each(Object.entries(milestones))('keeps the original copy for %s pets', (count, text) => {
    const brain = transitionBrain(initialBrain, { type: 'pet', count: Number(count) }, 10);
    expect(brain).toMatchObject({ mood: 'happy', bubble: text, moodUntil: 1410, heartsUntil: 1410 });
  });
  it('returns to idle after 1.4 seconds and naps only after 45 seconds with no input', () => {
    const happy = transitionBrain(initialBrain, { type: 'pet', count: 1 }, 100);
    const idle = transitionBrain(happy, { type: 'tick', naps: true }, 1500); expect(idle.mood).toBe('idle');
    expect(transitionBrain(idle, { type: 'tick', naps: true }, 45_099).mood).toBe('idle');
    expect(transitionBrain(idle, { type: 'tick', naps: true }, 45_100).sleepReason).toBe('idle');
    expect(transitionBrain(idle, { type: 'tick', naps: false }, 60_000).mood).toBe('idle');
  });
  it('wakes idle naps on input but keeps an explicit sleep until wake or pet', () => {
    const manual = transitionBrain(initialBrain, { type: 'sleep' }, 10);
    expect(transitionBrain(manual, { type: 'input' }, 20).mood).toBe('sleep');
    const nap = { ...manual, sleepReason: 'idle' as const };
    expect(transitionBrain(nap, { type: 'input' }, 20).bubble).toBe("Oh. I wasn't sleeping. Promise.");
    expect(transitionBrain(manual, { type: 'pet', count: 2 }, 20).mood).toBe('happy');
  });
  it('keeps curious for 1.2 seconds, dizzy for .9 seconds, and wave for three arm cycles', () => {
    expect(transitionBrain(initialBrain, { type: 'mood', mood: 'curious', look: { x: 10, y: 20 } }, 0)).toMatchObject({ moodUntil: 1200, look: { x: 10, y: 20 } });
    expect(transitionBrain(initialBrain, { type: 'mood', mood: 'dizzy' }, 0).moodUntil).toBe(900);
    expect(transitionBrain(initialBrain, { type: 'wave' }, 0)).toMatchObject({ moodUntil: 1200, bubble: 'ආයුබෝවන්!' });
  });
  it('expires speech after 2.6 seconds and shifts deadlines when hidden', () => {
    const state = transitionBrain(initialBrain, { type: 'pet', count: 1 }, 100);
    expect(nextBrainDeadline(state, true)).toBe(1500);
    expect(pauseBrain(state, 5000)).toMatchObject({ moodUntil: 6500, bubbleUntil: 7700, lastInput: 5100 });
    expect(transitionBrain(state, { type: 'tick', naps: false }, 2700).bubble).toBe('');
  });
  it('tea is happy and umbrellas last ten seconds', () => {
    expect(transitionBrain(initialBrain, { type: 'give', item: 'tea' }, 0).bubble).toBe('Ceylon tea. My favourite.');
    const umbrella = transitionBrain(initialBrain, { type: 'give', item: 'umbrella' }, 0);
    expect(umbrella.item).toBe('umbrella'); expect(transitionBrain(umbrella, { type: 'tick', naps: false }, 10_000).item).toBeNull();
  });
});
describe('public Mochi API', () => {
  let store: ReturnType<typeof createOsStore>; let cleanup: () => void;
  beforeEach(() => { store = createOsStore(); cleanup = registerStore(store); });
  afterEach(() => cleanup());
  it('counts API pets in the preference atom before the UI loads', () => {
    api.pet(); api.pet(); expect(store.get(mochiPrefsAtom).pets).toBe(2);
    expect(api.getState()).toEqual({ mood: 'happy', pets: 2, visible: true });
  });
  it('implements every exported action and preserves unrelated preferences', () => {
    store.set(mochiPrefsAtom, { visible: true, naps: false, pos: { x: 100, y: 200 }, pets: 5 });
    api.give('tea'); expect(store.get(brainAtom).bubble).toBe('Ceylon tea. My favourite.');
    api.setMood('curious'); expect(api.getState().mood).toBe('curious'); api.say('Hello'); expect(store.get(brainAtom).bubble).toBe('Hello');
    api.sleep(); expect(api.getState().mood).toBe('sleep'); api.hide(); expect(api.getState().visible).toBe(false);
    api.wake(); expect(api.getState()).toMatchObject({ visible: true, mood: 'surprised' });
    api.wave(); expect(store.get(brainAtom).bubble).toBe('ආයුබෝවන්!'); api.hide(); api.show();
    expect(store.get(mochiPrefsAtom)).toEqual({ visible: true, naps: false, pos: { x: 100, y: 200 }, pets: 5 });
  });
  it('isolates pets and moods per OS store', () => {
    api.pet(); const other = createOsStore(); const unregister = registerStore(other);
    expect(api.getState()).toEqual({ mood: 'idle', pets: 0, visible: true }); unregister();
  });
});
