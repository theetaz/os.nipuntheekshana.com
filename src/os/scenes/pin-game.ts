// Ported from nipuntheekshana.com/src/scripts/pin-game.ts @ 64482c5325ceace12c645d1ac5ca211cece46445.
import type { GeoPoint, MapSurface } from '../apps/maps/surface';

export type Place = { name: string; si: string; lat: number; lon: number };

export const PLACES: Place[] = [
  { name: 'Kandy', si: 'මහනුවර', lat: 7.2906, lon: 80.6337 },
  { name: 'Galle', si: 'ගාල්ල', lat: 6.0535, lon: 80.221 },
  { name: 'Jaffna', si: 'යාපනය', lat: 9.6615, lon: 80.0255 },
  { name: 'Trincomalee', si: 'ත්‍රිකුණාමලය', lat: 8.5874, lon: 81.2152 },
  { name: 'Anuradhapura', si: 'අනුරාධපුරය', lat: 8.3114, lon: 80.4037 },
  { name: 'Batticaloa', si: 'මඩකලපුව', lat: 7.731, lon: 81.6747 },
  { name: 'Nuwara Eliya', si: 'නුවරඑළිය', lat: 6.9497, lon: 80.7891 },
  { name: 'Matara', si: 'මාතර', lat: 5.9549, lon: 80.555 },
  { name: 'Ratnapura', si: 'රත්නපුර', lat: 6.6828, lon: 80.3992 },
  { name: 'Badulla', si: 'බදුල්ල', lat: 6.9934, lon: 81.055 },
  { name: 'Kurunegala', si: 'කුරුණෑගල', lat: 7.4863, lon: 80.3647 },
  { name: 'Polonnaruwa', si: 'පොළොන්නරුව', lat: 7.9403, lon: 81.0188 },
  { name: 'Hambantota', si: 'හම්බන්තොට', lat: 6.1241, lon: 81.1185 },
  { name: 'Negombo', si: 'මීගමුව', lat: 7.2083, lon: 79.8358 },
  { name: 'Sigiriya', si: 'සීගිරිය', lat: 7.957, lon: 80.7603 },
  { name: 'Ella', si: 'ඇල්ල', lat: 6.8667, lon: 81.0466 },
  { name: 'Dambulla', si: 'දඹුල්ල', lat: 7.8742, lon: 80.6511 },
  { name: 'Kataragama', si: 'කතරගම', lat: 6.4134, lon: 81.3346 },
  { name: 'Mirissa', si: 'මිරිස්ස', lat: 5.9483, lon: 80.4716 },
  { name: 'Sri Pada', si: 'ශ්‍රී පාදය', lat: 6.8096, lon: 80.4994 },
];

export const ROUNDS = 5;
const RANKS: [number, string][] = [
  [4500, 'Survey Department material'],
  [3500, 'Tuk-tuk navigator'],
  [2500, 'Weekend explorer'],
  [1500, 'Confident tourist'],
  [0, 'Lost somewhere in Pettah'],
];

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export const scoreAtDistance = (km: number) => Math.round(1000 * Math.exp(-Math.max(0, km) / 45));
export const rankForScore = (score: number) => RANKS.find(([minimum]) => score >= minimum)?.[1] ?? RANKS.at(-1)![1];
export function hintForDistance(km: number, points: number): string {
  return `${km < 5 ? 'Bullseye.' : km < 25 ? 'So close.' : km < 75 ? 'Not bad.' : 'A long tuk-tuk ride away.'} +${points}`;
}
export interface PinState {
  phase: 'idle' | 'guess' | 'reveal' | 'done';
  round: number; score: number; place: Place | null; guess: GeoPoint | null;
  km: number; points: number; perfect: boolean;
}
export const IDLE_STATE: PinState = { phase: 'idle', round: 0, score: 0, place: null, guess: null, km: 0, points: 0, perfect: true };
/** Headless game: the caller owns rendering, input, focus and preference storage. */
export function createPinGame({ surface, onState, random = Math.random }: {
  surface: MapSurface; onState(state: PinState): void; random?: () => number;
}) {
  let state = { ...IDLE_STATE };
  let places: Place[] = [];
  let destroyed = false;
  const emit = () => { if (!destroyed) onState({ ...state }); };
  const nextRound = () => {
    state = { ...state, phase: 'guess', round: state.round + 1, place: places[state.round]!, guess: null, km: 0, points: 0 };
    emit();
  };
  return {
    start() {
      if (destroyed) return;
      places = [...PLACES];
      for (let i = places.length - 1; i > 0; i--) {
        const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
        [places[i], places[j]] = [places[j]!, places[i]!];
      }
      places = places.slice(0, ROUNDS);
      state = { ...IDLE_STATE };
      surface.setLabels(false); surface.setFocus(true); surface.recentre(); nextRound();
    },
    guess(at: GeoPoint) {
      if (destroyed || state.phase !== 'guess' || !state.place || !Number.isFinite(at.lon) || !Number.isFinite(at.lat)) return;
      const place = state.place; const km = haversineKm(at, place); const points = scoreAtDistance(km);
      state = { ...state, phase: 'reveal', guess: { ...at }, km, points, score: state.score + points, perfect: state.perfect && km < 5 };
      surface.pulseAt(place.lon, place.lat); emit();
    },
    next() {
      if (destroyed || state.phase !== 'reveal') return;
      if (state.round === ROUNDS) { state = { ...state, phase: 'done' }; emit(); }
      else nextRound();
    },
    end() {
      if (destroyed) return;
      state = { ...IDLE_STATE }; surface.setLabels(true); surface.setFocus(false); emit();
    },
    getState: () => ({ ...state }),
    destroy() { destroyed = true; },
  };
}
export type PinGame = ReturnType<typeof createPinGame>;
