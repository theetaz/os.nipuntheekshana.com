import { soundAtom, volumeAtom } from '../state/atoms';
import { getStore } from '../state/store';

export type SoundName = 'pop' | 'tock' | 'swoosh' | 'tick' | 'thunk';
interface SoundParameters {
  wave: OscillatorType | 'noise';
  frequency: readonly [number, number];
  sweep: number;
  exponential?: boolean;
  gain: number;
  attack: number;
  decay: number;
  duration: number;
}
// Seconds and Hz. D§16 specifies the pop attack; other attacks avoid clicks.
export const SOUND_PARAMETERS: Readonly<Record<SoundName, SoundParameters>> = {
  pop: { wave: 'sine', frequency: [660, 990], sweep: 0.07, exponential: true, gain: 0.05, attack: 0.004, decay: 0.09, duration: 0.09 },
  tock: { wave: 'triangle', frequency: [420, 300], sweep: 0.06, gain: 0.04, attack: 0.001, decay: 0.07, duration: 0.07 },
  swoosh: { wave: 'noise', frequency: [1800, 400], sweep: 0.26, gain: 0.03, attack: 0.004, decay: 0.26, duration: 0.26 },
  tick: { wave: 'square', frequency: [1800, 1800], sweep: 0, gain: 0.015, attack: 0.001, decay: 0.012, duration: 0.012 },
  thunk: { wave: 'sine', frequency: [180, 180], sweep: 0, gain: 0.03, attack: 0.001, decay: 0.03, duration: 0.04 },
};
export const ENVELOPE_FLOOR = 0.0001;
export const REPEAT_INTERVAL_MS = 60;
let context: AudioContext | undefined;
let noise: AudioBuffer | undefined;
let resuming: Promise<void> | undefined;
let gestured = false;
const lastPlayed: Partial<Record<SoundName, number>> = {};

function resume(): Promise<void> {
  return resuming ??= context!.resume().finally(() => { resuming = undefined; });
}
function gesture(event: Event): void {
  if (!event.isTrusted) return;
  gestured = true;
  try {
    if (context?.state === 'suspended' && getStore().get(soundAtom)) void resume().catch(() => {});
  } catch { /* Audio and the registered store may be unavailable. */ }
}
if (typeof document !== 'undefined') {
  for (const event of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(event, gesture, { capture: true, passive: true });
}

function noiseSource(audio: AudioContext): AudioBufferSourceNode {
  if (!noise) {
    noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.26), audio.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource(); source.buffer = noise;
  return source;
}
function envelope(param: AudioParam, spec: SoundParameters, start: number): void {
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(spec.gain, start + spec.attack);
  param.exponentialRampToValueAtTime(ENVELOPE_FLOOR, start + spec.decay);
  param.linearRampToValueAtTime(0, start + spec.duration);
}
function synthesize(name: SoundName): void {
  const store = getStore();
  if (!store.get(soundAtom) || !store.get(volumeAtom) || context?.state !== 'running') return;
  const audio = context; const spec = SOUND_PARAMETERS[name]; const start = audio.currentTime;
  const nodes: AudioNode[] = [];
  const cleanup = () => nodes.forEach(node => node.disconnect());
  try {
    const master = audio.createGain(); nodes.push(master);
    master.gain.setValueAtTime(store.get(volumeAtom), start); master.connect(audio.destination);
    const gain = audio.createGain(); nodes.push(gain); gain.connect(master); envelope(gain.gain, spec, start);
    const source = spec.wave === 'noise' ? noiseSource(audio) : audio.createOscillator(); nodes.push(source);
    let frequency: AudioParam;
    if (spec.wave === 'noise') {
      const filter = audio.createBiquadFilter(); nodes.push(filter);
      filter.type = 'bandpass'; filter.Q.setValueAtTime(0.8, start);
      source.connect(filter); filter.connect(gain); frequency = filter.frequency;
    } else {
      const oscillator = source as OscillatorNode;
      oscillator.type = spec.wave; source.connect(gain); frequency = oscillator.frequency;
    }
    frequency.setValueAtTime(spec.frequency[0], start);
    if (spec.sweep) {
      if (spec.exponential) frequency.exponentialRampToValueAtTime(spec.frequency[1], start + spec.sweep);
      else frequency.linearRampToValueAtTime(spec.frequency[1], start + spec.sweep);
    }
    source.onended = cleanup;
    if (name === 'thunk') {
      const click = noiseSource(audio); nodes.push(click);
      click.connect(gain); click.start(start); click.stop(start + 0.005);
    }
    source.start(start); source.stop(start + spec.duration);
  } catch { cleanup(); }
}
export function playSound(name: SoundName): void {
  try {
    if (typeof window === 'undefined' || !(navigator.userActivation?.hasBeenActive || gestured)) return;
    const store = getStore();
    if (!store.get(soundAtom) || !store.get(volumeAtom)) return;
    const now = performance.now();
    if (now - (lastPlayed[name] ?? -Infinity) < REPEAT_INTERVAL_MS || resuming) return;
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    if (!context || context.state === 'closed') { context = new Audio(); noise = undefined; }
    lastPlayed[name] = now;
    if (context.state === 'suspended') {
      // Drop sounds outside an activation rather than queueing a burst for later.
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      void resume().then(() => synthesize(name)).catch(() => {});
    } else synthesize(name);
  } catch { /* Interface sounds must never interrupt a command or log errors. */ }
}
