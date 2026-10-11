// Ported from nipuntheekshana.com/src/scripts/island-model.ts @ 64482c5325ceace12c645d1ac5ca211cece46445.
// Geometry for the hero: Sri Lanka as a field of points.
//
// The outline is real (see scripts/build-island.mjs). Elevation and density are
// stylised: a handful of Gaussian peaks for the central highlands and a weighted
// set of towns for population. They read correctly at a glance, and they cost a few
// hundred bytes instead of a raster download.
import type { IslandData } from '../apps/maps/surface';


export const CENTER = { lon: 80.72, lat: 7.86 };
const COS_LAT = Math.cos((CENTER.lat * Math.PI) / 180);

/** Longitude/latitude to scene units (x east, z south). One unit is one degree of latitude. */
export function toScene(lon: number, lat: number): [number, number] {
  return [(lon - CENTER.lon) * COS_LAT, -(lat - CENTER.lat)];
}

export function fromScene(x: number, z: number): [number, number] {
  return [x / COS_LAT + CENTER.lon, -z + CENTER.lat];
}


type Edge = [number, number, number, number];
const LAT_BAND = 0.1;
const edgeIndexes = new WeakMap<IslandData, Map<number, Edge[]>>();
/** Index coast edges by latitude; point generation otherwise rescans the entire outline per dot. */
function edgesAt(island: IslandData, lat: number): readonly Edge[] {
  let index = edgeIndexes.get(island);
  if (!index) {
    index = new Map();
    for (const ring of island.rings as [number, number][][]) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]!; const [xj, yj] = ring[j]!;
        if (yi === yj) continue;
        const edge: Edge = [xi, yi, xj, yj];
        for (let band = Math.floor(Math.min(yi, yj) / LAT_BAND); band <= Math.floor(Math.max(yi, yj) / LAT_BAND); band++) {
          const edges = index.get(band) ?? []; edges.push(edge); index.set(band, edges);
        }
      }
    }
    edgeIndexes.set(island, index);
  }
  return index.get(Math.floor(lat / LAT_BAND)) ?? [];
}
export function inside(island: IslandData, lon: number, lat: number) {
  let hit = false;
  for (const [xi, yi, xj, yj] of edgesAt(island, lat)) {
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// [lat, lon, amplitude, sigma in degrees]
const PEAKS: [number, number, number, number][] = [
  [7.0, 80.75, 0.28, 0.55], // the whole central massif
  [7.0008, 80.7733, 1.0, 0.2], // Pidurutalagala, 2,524 m
  [6.8096, 80.4994, 0.72, 0.13], // Sri Pada / Adam's Peak
  [6.8, 80.82, 0.55, 0.16], // Horton Plains
  [7.4, 80.8, 0.5, 0.12], // Knuckles
  [6.93, 81.12, 0.38, 0.13], // Namunukula
  [6.45, 80.55, 0.3, 0.18], // Sinharaja / Rakwana
  [7.25, 80.5, 0.25, 0.14], // Kandy hills
];

// [name, lat, lon, weight, sigma] — rough urban footprints, not census data.
export const TOWNS: [string, number, number, number, number][] = [
  ['Colombo', 6.9271, 79.8612, 1.0, 0.1],
  ['Dehiwala', 6.84, 79.87, 0.55, 0.06],
  ['Moratuwa', 6.77, 79.88, 0.45, 0.05],
  ['Negombo', 7.2083, 79.8358, 0.45, 0.06],
  ['Gampaha', 7.09, 80.0, 0.4, 0.1],
  ['Kalutara', 6.5854, 79.9607, 0.33, 0.06],
  ['Kandy', 7.2906, 80.6337, 0.6, 0.07],
  ['Galle', 6.0535, 80.221, 0.45, 0.06],
  ['Matara', 5.9549, 80.555, 0.35, 0.06],
  ['Jaffna', 9.6615, 80.0255, 0.5, 0.07],
  ['Trincomalee', 8.5874, 81.2152, 0.35, 0.06],
  ['Batticaloa', 7.731, 81.6747, 0.35, 0.06],
  ['Kalmunai', 7.41, 81.83, 0.3, 0.05],
  ['Anuradhapura', 8.3114, 80.4037, 0.35, 0.07],
  ['Kurunegala', 7.4863, 80.3647, 0.35, 0.07],
  ['Ratnapura', 6.6828, 80.3992, 0.3, 0.06],
  ['Badulla', 6.9934, 81.055, 0.25, 0.05],
  ['Nuwara Eliya', 6.9497, 80.7891, 0.2, 0.04],
  ['Vavuniya', 8.7514, 80.4971, 0.2, 0.05],
  ['Hambantota', 6.1241, 81.1185, 0.2, 0.05],
  ['Polonnaruwa', 7.94, 81.0, 0.2, 0.06],
  ['Chilaw', 7.575, 79.795, 0.25, 0.05],
  ['Puttalam', 8.03, 79.83, 0.2, 0.05],
  ['Ampara', 7.29, 81.67, 0.2, 0.05],
  ['Mannar', 8.98, 79.9, 0.15, 0.04],
  ['Kilinochchi', 9.39, 80.4, 0.12, 0.05],
  ['Matale', 7.47, 80.62, 0.2, 0.05],
  ['Kegalle', 7.25, 80.34, 0.22, 0.05],
];

/** Towns that get a floating label in the hero. */
export const LABELS = ['Colombo', 'Kandy', 'Jaffna', 'Galle', 'Trincomalee', 'Anuradhapura', 'Batticaloa'];

// Small deterministic value noise so the terrain has texture without a library.
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function gaussian(lat: number, lon: number, cLat: number, cLon: number, sigma: number) {
  const dLat = lat - cLat;
  const dLon = (lon - cLon) * COS_LAT;
  return Math.exp(-(dLat * dLat + dLon * dLon) / (2 * sigma * sigma));
}

export function elevationAt(lon: number, lat: number) {
  let h = 0;
  for (const [pLat, pLon, amp, sigma] of PEAKS) h += amp * gaussian(lat, lon, pLat, pLon, sigma);
  const texture = noise(lon * 9, lat * 9) * 0.6 + noise(lon * 23, lat * 23) * 0.4;
  return h * (0.78 + texture * 0.44) + texture * 0.035;
}

export function densityAt(lon: number, lat: number) {
  let d = 0.28 * gaussian(lat, lon, 6.95, 80.0, 0.28); // the Western Province sprawl
  for (const [, tLat, tLon, weight, sigma] of TOWNS) d += weight * gaussian(lat, lon, tLat, tLon, sigma);
  return Math.min(1, d);
}

export type IslandPoints = {
  count: number;
  positions: Float32Array;
  /** x: density, y: elevation (0..1), z: random, w: north-south sweep (0..1) */
  attributes: Float32Array;
};

export const ELEVATION_SCALE = 0.34;

export function buildIsland(island: IslandData, step: number): IslandPoints {
  const [minLon, minLat, maxLon, maxLat] = island.bbox as [number, number, number, number];
  const positions: number[] = [];
  const attributes: number[] = [];
  const rowHeight = step * 0.866; // hexagonal packing
  const lonStep = step / COS_LAT; // equal spacing on the ground, not in degrees
  let row = 0;

  for (let lat = minLat; lat <= maxLat; lat += rowHeight, row++) {
    const offset = row % 2 ? lonStep / 2 : 0;
    for (let lon = minLon + offset; lon <= maxLon; lon += lonStep) {
      const jLon = lon + (hash(lon, lat) - 0.5) * step * 0.35;
      const jLat = lat + (hash(lat, lon) - 0.5) * step * 0.35;
      if (!inside(island, jLon, jLat)) continue;

      const elevation = elevationAt(jLon, jLat);
      const density = densityAt(jLon, jLat);
      const [x, z] = toScene(jLon, jLat);
      positions.push(x, elevation * ELEVATION_SCALE, z);
      attributes.push(density, Math.min(1, elevation), hash(jLon * 3.1, jLat * 7.7), (jLat - minLat) / (maxLat - minLat));
    }
  }

  return {
    count: positions.length / 3,
    positions: new Float32Array(positions),
    attributes: new Float32Array(attributes),
  };
}

export function coastline(island: IslandData): Float32Array[] {
  return (island.rings as [number, number][][]).map((ring) => {
    const out = new Float32Array(ring.length * 3);
    ring.forEach(([lon, lat], i) => {
      const [x, z] = toScene(lon, lat);
      out.set([x, 0.004, z], i * 3);
    });
    return out;
  });
}

/** A dotted graticule every half degree around the island, for a sense of place. */
export function graticule(): Float32Array {
  const points: number[] = [];
  for (let lat = 5; lat <= 10.5; lat += 0.5) {
    for (let lon = 78.5; lon <= 83; lon += 0.04) {
      const [x, z] = toScene(lon, lat);
      points.push(x, -0.02, z);
    }
  }
  for (let lon = 78.5; lon <= 83; lon += 0.5) {
    for (let lat = 5; lat <= 10.5; lat += 0.04) {
      const [x, z] = toScene(lon, lat);
      points.push(x, -0.02, z);
    }
  }
  return new Float32Array(points);
}
