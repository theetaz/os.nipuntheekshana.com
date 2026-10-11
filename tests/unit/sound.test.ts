import { describe, expect, it } from 'vitest';
import { ENVELOPE_FLOOR, REPEAT_INTERVAL_MS, SOUND_PARAMETERS } from '../../src/os/lib/sound';

describe('D§16 sound parameters', () => {
  it('keeps the existing five sound names', () => {
    expect(Object.keys(SOUND_PARAMETERS)).toEqual(['pop', 'tock', 'swoosh', 'tick', 'thunk']);
  });
  it.each([
    ['pop', 'sine', [660, 990], 0.07],
    ['tock', 'triangle', [420, 300], 0.06],
    ['swoosh', 'noise', [1800, 400], 0.26],
    ['tick', 'square', [1800, 1800], 0],
    ['thunk', 'sine', [180, 180], 0],
  ] as const)('%s has the specified waveform and frequency sweep', (name, wave, frequency, sweep) => {
    expect(SOUND_PARAMETERS[name]).toMatchObject({ wave, frequency, sweep });
    expect(Boolean(SOUND_PARAMETERS[name].exponential)).toBe(name === 'pop');
  });
  it.each([
    ['pop', 0.05, 0.09, 0.09], ['tock', 0.04, 0.07, 0.07],
    ['swoosh', 0.03, 0.26, 0.26], ['tick', 0.015, 0.012, 0.012], ['thunk', 0.03, 0.03, 0.04],
  ] as const)('%s has the specified peak, decay and lifetime', (name, gain, decay, duration) => {
    const spec = SOUND_PARAMETERS[name];
    expect(spec).toMatchObject({ gain, decay, duration });
    expect(spec.attack).toBeGreaterThan(0); expect(spec.attack).toBeLessThan(decay);
    expect(decay).toBeLessThanOrEqual(duration);
  });
  it('uses the pop attack and a positive exponential decay floor', () => {
    expect(SOUND_PARAMETERS.pop.attack).toBe(0.004); expect(ENVELOPE_FLOOR).toBe(0.0001);
    for (const spec of Object.values(SOUND_PARAMETERS)) expect(spec.gain).toBeGreaterThan(ENVELOPE_FLOOR);
  });
  it('bounds rapid repetitions without swallowing a 70ms window-close event', () => {
    expect(REPEAT_INTERVAL_MS).toBe(60);
  });
});
