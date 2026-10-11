import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const island = JSON.parse(await readFile(resolve(root, 'src/data/island.json'), 'utf8'));
const [minLon, minLat, maxLon, maxLat] = island.bbox;
const cosLat = Math.cos(7.86 * Math.PI / 180);
const height = 700;
const width = (maxLon - minLon) * cosLat / (maxLat - minLat) * height;
const columns = 400;
const rows = 700;

// Peak table and elevation texture ported from src/scripts/island-model.ts
// in nipuntheekshana.com @ 64482c5325ceace12c645d1ac5ca211cece46445.
// Stylised terrain, not measured elevation. No source-site access at build time.
const peaks = [
  [7.0, 80.75, 0.28, 0.55], // Central massif
  [7.0008, 80.7733, 1.0, 0.2], // Pidurutalagala
  [6.8096, 80.4994, 0.72, 0.13], // Sri Pada
  [6.8, 80.82, 0.55, 0.16], // Horton Plains
  [7.4, 80.8, 0.5, 0.12], // Knuckles
  [6.93, 81.12, 0.38, 0.13], // Namunukula
  [6.45, 80.55, 0.3, 0.18], // Sinharaja / Rakwana
  [7.25, 80.5, 0.25, 0.14], // Kandy hills
];

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function elevation(lon, lat) {
  let h = 0;
  for (const [pLat, pLon, amp, sigma] of peaks) {
    const dy = lat - pLat, dx = (lon - pLon) * cosLat;
    h += amp * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }
  const texture = noise(lon * 9, lat * 9) * 0.6 + noise(lon * 23, lat * 23) * 0.4;
  return h * (0.78 + texture * 0.44) + texture * 0.035;
}

function project([lon, lat], size = height) {
  const scale = size / (maxLat - minLat);
  return [(lon - minLon) * cosLat * scale, (maxLat - lat) * scale];
}

function area(ring) {
  return Math.abs(ring.reduce((sum, p, i) => {
    const next = ring[(i + 1) % ring.length];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0)) / 2;
}

// Iterative Douglas–Peucker; compare distances to the finite segment.
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Set([0, points.length - 1]);
  const pending = [[0, points.length - 1]];
  while (pending.length) {
    const [first, last] = pending.pop();
    const [ax, ay] = points[first], [bx, by] = points[last];
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    let furthest = -1, best = tolerance * tolerance;
    for (let i = first + 1; i < last; i++) {
      const [x, y] = points[i];
      const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
      const distance = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
      if (distance > best) { best = distance; furthest = i; }
    }
    if (furthest !== -1) {
      keep.add(furthest);
      pending.push([first, furthest], [furthest, last]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => points[i]);
}

const number = (n) => String(Number(n.toFixed(1)));
function path(points, close = false) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${number(p[0])} ${number(p[1])}`).join('') + (close ? 'Z' : '');
}

// Small offshore rings are dropped in the 100-unit projection, before simplification.
const outlineRings = island.rings.map((ring) => ring.map((p) => project(p, 100)))
  .filter((ring) => area(ring) >= 0.02)
  .map((ring) => simplify(ring, 0.8))
  .filter((ring) => ring.length >= 4);
const outlinePath = outlineRings.map((ring) => path(ring, true)).join('');
const outlineWidth = number(width / 7);
const svgStart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outlineWidth} 100">`;
const mask = `${svgStart}<path d="${outlinePath}" fill="white" fill-rule="evenodd"/></svg>\n`;
const outline = `${svgStart}<path d="${outlinePath}" fill="none" stroke="currentColor" stroke-width=".35" stroke-linejoin="round"/></svg>\n`;

// Scanline intersections use all source rings, including holes, for the inside test.
const grid = new Float64Array(columns * rows).fill(NaN);
let maxElevation = 0;
for (let y = 0; y < rows; y++) {
  const lat = maxLat - y / (rows - 1) * (maxLat - minLat);
  const crossings = [];
  for (const ring of island.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat)) crossings.push(xi + (lat - yi) * (xj - xi) / (yj - yi));
    }
  }
  crossings.sort((a, b) => a - b);
  let crossing = 0;
  for (let x = 0; x < columns; x++) {
    const lon = minLon + x / (columns - 1) * (maxLon - minLon);
    while (crossing < crossings.length && crossings[crossing] <= lon) crossing++;
    if (crossing % 2) {
      const value = elevation(lon, lat);
      grid[y * columns + x] = value;
      maxElevation = Math.max(maxElevation, value);
    }
  }
}

// Join marching-square segments by shared grid-edge identities (no rounded-key cracks).
function contours(level) {
  const vertices = new Map();
  const segments = [];
  const adjacency = new Map();
  const connect = (a, b) => {
    const index = segments.push([a, b]) - 1;
    for (const key of [a, b]) {
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push(index);
    }
  };
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < columns - 1; x++) {
      const values = [grid[y * columns + x], grid[y * columns + x + 1],
        grid[(y + 1) * columns + x + 1], grid[(y + 1) * columns + x]];
      if (values.some(Number.isNaN)) continue;
      const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
      const ids = [`h${x},${y}`, `v${x + 1},${y}`, `h${x},${y + 1}`, `v${x},${y}`];
      const edges = [];
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4;
        if ((values[edge] >= level) === (values[next] >= level)) continue;
        const t = (level - values[edge]) / (values[next] - values[edge]);
        const a = corners[edge], b = corners[next];
        vertices.set(ids[edge], [(a[0] + t * (b[0] - a[0])) * width / (columns - 1),
          (a[1] + t * (b[1] - a[1])) * height / (rows - 1)]);
        edges.push(edge);
      }
      if (edges.length === 2) connect(ids[edges[0]], ids[edges[1]]);
      else if (edges.length === 4) {
        // Asymptotic decider resolves saddle cells consistently with bilinear elevation.
        const q = (values[0] - level) * (values[2] - level) - (values[1] - level) * (values[3] - level);
        for (const [a, b] of q >= 0 ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]]) connect(ids[a], ids[b]);
      }
    }
  }
  const used = new Set();
  const lines = [];
  const walk = (start) => {
    const points = [vertices.get(start)];
    let key = start;
    while (true) {
      const index = adjacency.get(key).find((i) => !used.has(i));
      if (index === undefined) break;
      used.add(index);
      const segment = segments[index];
      key = segment[0] === key ? segment[1] : segment[0];
      points.push(vertices.get(key));
      if (key === start) break;
    }
    if (points.length > 2) lines.push(path(simplify(points, 0.35), key === start));
  };
  for (const [key, links] of adjacency) if (links.length === 1) walk(key);
  for (const [a] of segments) if (adjacency.get(a).some((i) => !used.has(i))) walk(a);
  return lines.join('');
}

const contourPaths = Array.from({ length: 14 }, (_, i) =>
  `<path data-level="${i + 1}" d="${contours(maxElevation * (i + 1) / 15)}"/>`).join('');
const coastline = outlineRings.map((ring) => path(ring.map(([x, y]) => [x * 7, y * 7]), true)).join('');
const terrain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 310 380 380"><title>Stylised central highlands of Sri Lanka</title><defs><clipPath id="land"><path d="${coastline}" fill-rule="evenodd"/></clipPath></defs><g fill="none" stroke="currentColor" stroke-width=".6" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#land)">${contourPaths}</g></svg>\n`;

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out-dir');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--check') continue;
  if (args[i] === '--out-dir' && args[i + 1] && !args[i + 1].startsWith('--')) { i++; continue; }
  throw new Error('Usage: node scripts/build-contours.mjs [--check] [--out-dir directory]');
}
const directory = outIndex === -1 ? resolve(root, 'src/assets/wallpapers') : resolve(args[outIndex + 1]);
const files = [['island-mask.svg', mask, 1024], ['island-outline.svg', outline, 1024], ['contours.svg', terrain, 40 * 1024]];
// Validate every asset before writing any of them.
for (const [name, svg, budget] of files) {
  if (Buffer.byteLength(svg) > budget) throw new Error(`${name} exceeds ${budget} bytes (${Buffer.byteLength(svg)})`);
}
if (!args.includes('--check')) await mkdir(directory, { recursive: true });
for (const [name, svg] of files) {
  if (args.includes('--check')) {
    if (await readFile(resolve(directory, name), 'utf8') !== svg) throw new Error(`${name} is stale; run npm run contours`);
  } else await writeFile(resolve(directory, name), svg);
  console.log(`${name}: ${Buffer.byteLength(svg)} bytes${args.includes('--check') ? ' (current)' : ''}`);
}
