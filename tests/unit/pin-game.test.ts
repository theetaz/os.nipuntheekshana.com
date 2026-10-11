import { describe, expect, it, vi } from 'vitest';
import { createPinGame, haversineKm, hintForDistance, PLACES, rankForScore, scoreAtDistance, type PinState } from '../../src/os/scenes/pin-game';
import { buildIsland, fromScene, inside, toScene } from '../../src/os/scenes/island-model';
import island from '../../src/data/island.json';
import type { MapSurface } from '../../src/os/apps/maps/surface';
function surface(): MapSurface {
  return { kind: 'svg', count: 0, pick: vi.fn(), project: vi.fn(), pulseAt: vi.fn(), setLabels: vi.fn(), onFrame: vi.fn(), setActive: vi.fn(), setFocus: vi.fn(), setLayers: vi.fn(), setReducedMotion: vi.fn(), orbit: vi.fn(), zoom: vi.fn(), recentre: vi.fn(), flyTo: vi.fn(), destroy: vi.fn() };
}
describe('Pin the city geography and scoring', () => {
  it('measures Colombo–Kandy at 94 km ±1 and handles identical and antipodal points', () => {
    expect(Math.abs(haversineKm({ lat: 6.9271, lon: 79.8612 }, PLACES[0]!) - 94)).toBeLessThanOrEqual(1);
    expect(haversineKm(PLACES[0]!, PLACES[0]!)).toBe(0);
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(20015.09, 1);
  });
  it('keeps the exponential score and distance copy', () => {
    expect(scoreAtDistance(0)).toBe(1000); expect(scoreAtDistance(45)).toBe(368);
    expect(scoreAtDistance(90)).toBe(135);
    expect([0, 5, 25, 75].map(km => hintForDistance(km, 42))).toEqual(['Bullseye. +42', 'So close. +42', 'Not bad. +42', 'A long tuk-tuk ride away. +42']);
  });
  it.each([[4500, 'Survey Department material'], [4499, 'Tuk-tuk navigator'], [3500, 'Tuk-tuk navigator'], [3499, 'Weekend explorer'], [2500, 'Weekend explorer'], [2499, 'Confident tourist'], [1500, 'Confident tourist'], [1499, 'Lost somewhere in Pettah']])('ranks %i as %s', (score, rank) => {
    expect(rankForScore(Number(score))).toBe(rank);
  });
  it('round-trips the corrected projection and uses the real outline', () => {
    const [x, z] = toScene(80.6337, 7.2906); const [lon, lat] = fromScene(x, z);
    expect(lon).toBeCloseTo(80.6337, 8); expect(lat).toBeCloseTo(7.2906, 8);
    expect(inside(island, lon, lat)).toBe(true); expect(inside(island, 79, 7)).toBe(false);
  });
  it('keeps indexed containment identical to the original polygon test on coast and ocean samples', () => {
    function reference(lon: number, lat: number) {
      let hit = false;
      for (const ring of island.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]! as [number, number]; const [xj, yj] = ring[j]! as [number, number];
        if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    }
    for (let lat = 5.5; lat <= 10; lat += .2) for (let lon = 79.5; lon < 82; lon += .2) expect(inside(island, lon, lat)).toBe(reference(lon, lat));
    for (const [lon, lat] of island.rings[0]!.slice(0, 20) as [number, number][]) for (const offset of [-.0001, 0, .0001]) expect(inside(island, lon, lat + offset)).toBe(reference(lon, lat + offset));
    expect(buildIsland(island, .02).count).toBe(15494);
  });
  it('builds finite, deterministic island geometry', () => {
    const a = buildIsland(island, .04); const b = buildIsland(island, .04);
    expect(a.count).toBeGreaterThan(3000); expect(a.positions).toEqual(b.positions);
    expect([...a.positions, ...a.attributes].every(Number.isFinite)).toBe(true);
  });
});
describe('headless five-round state machine', () => {
  it('selects unique places, ignores duplicate/early actions and finishes a perfect game', () => {
    const map = surface(); const states: PinState[] = []; const game = createPinGame({ surface: map, onState: state => states.push(state), random: () => .5 });
    game.next(); expect(states).toHaveLength(0); game.start();
    const names = new Set<string>();
    for (let round = 1; round <= 5; round++) {
      const state = game.getState(); expect(state.phase).toBe('guess'); expect(state.round).toBe(round); names.add(state.place!.name);
      game.guess(state.place!); const score = game.getState().score; game.guess(state.place!); expect(game.getState().score).toBe(score);
      expect(game.getState().phase).toBe('reveal'); game.next();
    }
    expect(names.size).toBe(5); expect(game.getState()).toMatchObject({ phase: 'done', score: 5000, perfect: true });
    expect(map.pulseAt).toHaveBeenCalledTimes(5); expect(map.setLabels).toHaveBeenCalledWith(false);
    game.start(); expect(game.getState()).toMatchObject({ phase: 'guess', round: 1, score: 0 });
    game.end(); expect(game.getState().phase).toBe('idle'); expect(map.setLabels).toHaveBeenLastCalledWith(true);
  });
  it('tracks imperfect games, rejects invalid guesses and stops after destroy', () => {
    const onState = vi.fn(); const game = createPinGame({ surface: surface(), onState }); game.start();
    game.guess({ lon: NaN, lat: 7 }); expect(game.getState().phase).toBe('guess');
    game.guess({ lon: 79, lat: 6 }); expect(game.getState().perfect).toBe(false);
    const calls = onState.mock.calls.length; game.destroy(); game.next(); game.start(); game.end(); expect(onState).toHaveBeenCalledTimes(calls);
  });
});
