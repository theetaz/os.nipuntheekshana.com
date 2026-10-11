// Ported from nipuntheekshana.com/src/scripts/terrain.ts @ 64482c5325ceace12c645d1ac5ca211cece46445.
import { reducedMotion } from '../lib/motion-preferences';

// A year of GitHub contributions drawn as a small 3D terrain on a 2D canvas.
// One column per day, weeks running left to right and weekdays front to back.
// The camera is a pair of springs (yaw and pitch) so every change, from a drag
// to the flat top view, eases in with a little momentum instead of snapping.

export type TerrainView = 'perspective' | 'top';
type View = TerrainView;
export interface TerrainOptions {
  /** Use the OS accent, or a caller-supplied hex colour. */
  accent?: boolean | string;
  view?: TerrainView;
  paused?: boolean;
  onViewChange?: (view: TerrainView) => void;
}
export interface TerrainController {
  setView(view: TerrainView): void;
  setPaused(paused: boolean): void;
  reset(): void;
  destroy(): void;
}
type Vec = [number, number, number];
type Point = [number, number];
type Rgb = [number, number, number];

const DAY_MS = 86_400_000;
const FOCAL = 90; // camera distance in grid units; large enough to keep the perspective mild
const MAX_H = 4.2; // tallest column, in grid units (the grid is 7 deep)
const FLAT_H = 0.05;
const GAP = 0.2;
const PLATE = 0.7;

// On a narrow screen the year is turned further so it runs into the distance
// and fills the height, instead of lying as a thin strip across the middle.
function pose(view: View, width: number) {
  if (view === 'top') return { yaw: 0, pitch: Math.PI / 2 };
  return width < 560 ? { yaw: -0.78, pitch: 0.7 } : { yaw: -0.24, pitch: 0.62 };
}

// A year is a long, thin strip; past about 50 degrees it turns end-on and
// shrinks to a sliver, so orbiting stops there.
const YAW_LIMIT = 0.85;
const PITCH_MIN = 0.16;
const PITCH_MAX = 1.4;

const LIGHT: Vec = normalise([-0.55, 0.9, 0.45]);
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function normalise([x, y, z]: Vec): Vec {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css([r, g, b]: Rgb, f = 1) {
  return `rgb(${Math.round(r * f)} ${Math.round(g * f)} ${Math.round(b * f)})`;
}

function parseHex(value: string, fallback: Rgb): Rgb {
  let hex = value.trim().replace('#', '');
  if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map(digit => digit + digit).join('');
  if (!/^[\da-f]{6}$/i.test(hex)) return fallback;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

// Back out like a slightly overdriven spring, so columns land with a small bounce.
function easeOutBack(t: number) {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

// CSS-style cubic-bezier easing, so the camera moves can use the same soft
// curves as the rest of the interface.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const at = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const slope = (t: number, p1: number, p2: number) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let k = 0; k < 8; k++) {
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= (at(t, x1, x2) - x) / d;
    }
    // Newton can wander on flat stretches; fall back to bisection when it does.
    if (Math.abs(at(t, x1, x2) - x) > 1e-4) {
      let lo = 0;
      let hi = 1;
      t = x;
      for (let k = 0; k < 30; k++) {
        if (at(t, x1, x2) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return at(t, y1, y2);
  };
}

const glide = bezier(0.45, 0, 0.15, 1); // slow start, long soft landing
const settle = bezier(0.3, 0, 0.1, 1); // quick start, long soft landing
const swell = bezier(0.4, 0, 0.3, 1); // gentle out-and-back for the dolly
const turn = bezier(0.35, 0, 0.25, 1); // the swing up into perspective

// Rises to 1 at `peak`, then eases back to 0 by the end. Both halves start and
// finish at rest, so the turn at the peak has no visible corner.
function bump(t: number, peak: number) {
  return t < peak ? swell(t / peak) : 1 - glide((t - peak) / (1 - peak));
}

function phase(t: number, from: number, to: number) {
  return clamp((t - from) / (to - from), 0, 1);
}

// One continuous push in and back out: rises quickly to its peak at `peak`
// and decays with a long tail, with no pause at the top. The last stretch is
// faded so it lands exactly on 1.
function impulse(t: number, peak: number) {
  const x = t / peak;
  const tail = 1 - glide(phase(t, 0.5, 1));
  return x * Math.exp(1 - x) * tail;
}

// Switching views is a short camera move rather than a spring. Going flat, the
// camera pulls back while the columns sink and swings overhead, then drifts
// back in. Going 3D it is one gesture: push in, turn the terrain up into
// perspective while close, then ease back out.
const MOVES = {
  top: { ms: 1300, peak: 0.3, dolly: -0.42, swing: 0.78 },
  perspective: { ms: 1700, peak: 0.24, dolly: 0.95, swing: 0.72 },
};

const LIFT = 0.55; // how far a hovered column rises, in grid units

class Spring {
  x: number;
  v = 0;
  target: number;
  constructor(value: number, private stiffness = 150, private damping = 20) {
    this.x = value;
    this.target = value;
  }
  step(dt: number) {
    const a = (this.target - this.x) * this.stiffness - this.v * this.damping;
    this.v += a * dt;
    this.x += this.v * dt;
  }
  snap() {
    this.x = this.target;
    this.v = 0;
  }
  get settled() {
    return Math.abs(this.target - this.x) < 1e-4 && Math.abs(this.v) < 1e-4;
  }
}

function inside(p: Point, poly: Point[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function initTerrain(root: HTMLElement, options: TerrainOptions = {}): TerrainController | null {
  const stage = root.querySelector<HTMLElement>('[data-terrain-stage]')!;
  const canvas = stage.querySelector('canvas')!;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const ctx: CanvasRenderingContext2D = context;
  const events = new AbortController();
  let destroyed = false;
  let paused = options.paused ?? false;
  const tip = root.querySelector<HTMLElement>('[data-terrain-tip]')!;
  const live = root.querySelector<HTMLElement>('[data-terrain-live]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];

  const start = Date.parse(`${root.dataset.start}T00:00:00Z`);
  const counts = (root.dataset.counts ?? '').split(',').map(Number);
  const weeks = Math.ceil(counts.length / 7);
  const W = weeks;
  const D = 7;

  // Heights follow a square root of the count against the 96th percentile, so a
  // single huge day cannot flatten everything else.
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const cap = Math.max(1, active[Math.floor((active.length - 1) * 0.96)] ?? 1);
  const level = counts.map((c) => (c > 0 ? Math.sqrt(Math.min(1, c / cap)) : 0));

  type Cell = { i: number; week: number; day: number; x: number; z: number; count: number; v: number; delay: number };
  const cells: Cell[] = [];
  counts.forEach((count, i) => {
    if (count < 0) return;
    const week = Math.floor(i / 7);
    const day = i % 7;
    cells.push({
      i,
      week,
      day,
      x: week - (W - 1) / 2,
      z: day - (D - 1) / 2,
      count,
      v: level[i] ?? 0,
      delay: week * 16 + day * 34,
    });
  });
  const byIndex = new Map(cells.map((c) => [c.i, c]));

  const dateOf = (i: number) => new Date(start + (Math.floor(i / 7) * 7 + (i % 7)) * DAY_MS);
  const fmtDate = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  const plural = (n: number) => `${n.toLocaleString('en-US')} contribution${n === 1 ? '' : 's'}`;

  // Month labels sit under the first week whose Sunday falls in a new month.
  const monthTicks: { week: number; label: string }[] = [];
  for (let w = 0; w < W; w++) {
    const m = dateOf(w * 7).getUTCMonth();
    if (w === 0 || m !== dateOf((w - 1) * 7).getUTCMonth()) {
      if (w < W - 2 && !(w === 0 && dateOf(7).getUTCMonth() !== m)) monthTicks.push({ week: w, label: MONTHS[m]! });
    }
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let view: View = options.view ?? 'perspective';
  const yaw = new Spring(pose('perspective', 1000).yaw);
  const pitch = new Spring(pose('perspective', 1000).pitch);
  let orbited = false;
  const flat = new Spring(1, 120, 19);
  const zoom = new Spring(1);
  const panX = new Spring(0);
  const panY = new Spring(0);
  const springs = [yaw, pitch, flat, zoom, panX, panY];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let riseStart: number | null = null;
  let riseDone = false;
  let visible = false;
  let frame = 0;
  let last = 0;
  let hover = -1;
  let move: { to: View; start: number; from: { yaw: number; pitch: number; flat: number } } | null = null;
  let dolly = 1;
  // During a view change the framing follows the camera swing, not the column
  // heights, so growing columns do not make the whole scene shrink or swell.
  let frameFlat = 1;
  const lifts = new Map<number, Spring>();
  const tipX = new Spring(0, 240, 31);
  const tipY = new Spring(0, 240, 31);
  let lifted = -1;
  let focused = -1;
  let pinned = -1;

  let palette = {
    side: 0.6,
    plate: [24, 24, 26] as Rgb,
    zero: [32, 32, 34] as Rgb,
    lo: [44, 44, 46] as Rgb,
    hi: [232, 231, 226] as Rgb,
    accent: [255, 180, 84] as Rgb,
    highlight: [238, 237, 232] as Rgb,
    label: 'rgb(128 127 121)',
    pill: [238, 237, 232] as Rgb,
    pillInk: [9, 9, 10] as Rgb,
    font: 'ui-monospace, monospace',
  };

  function readTheme() {
    const s = getComputedStyle(root);
    const bg = parseHex(s.getPropertyValue('--os-window'), [9, 9, 10]);
    const elev = parseHex(s.getPropertyValue('--os-raised'), [17, 17, 18]);
    const fg = parseHex(s.getPropertyValue('--os-ink'), [238, 237, 232]);
    const muted = parseHex(s.getPropertyValue('--os-ink-2'), [128, 127, 121]);
    // Busy days climb from a faint tint of the site accent to the accent
    // itself; empty days stay neutral. On a light page the sides shade more
    // gently so the tall columns do not turn muddy.
    const light = bg[0] + bg[1] + bg[2] > 384;
    const accent = parseHex(typeof options.accent === 'string' ? options.accent
      : options.accent === false ? '#ffb454' : s.getPropertyValue('--os-accent'), [255, 180, 84]);
    palette = {
      plate: mix(bg, elev, 0.35),
      zero: mix(elev, fg, light ? 0.06 : 0.08),
      lo: mix(elev, accent, light ? 0.2 : 0.22),
      hi: accent,
      side: light ? 0.8 : 0.62,
      accent,
      highlight: light ? fg : mix(fg, accent, 0.15),
      label: css(muted),
      pill: fg,
      pillInk: bg,
      font: s.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace',
    };
  }

  function resize() {
    // Layout dimensions exclude the window's opening/restore/snap transform.
    // ResizeObserver observes layout, so a scale finishing never triggers it.
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (!orbited) {
      const p = pose(view, width);
      yaw.target = p.yaw;
      pitch.target = p.pitch;
      if (riseStart === null) {
        yaw.snap();
        pitch.snap();
      }
    }
    kick();
  }

  // ---- camera ---------------------------------------------------------------

  let cy = 1, sy = 0, cp = 1, sp = 0;
  let scale = 1;
  let fit = 1;
  let frameX = 0;
  let frameY = 0;
  let originX = 0;
  let originY = 0;
  let eye: Vec = [0, 0, FOCAL];

  function raw(x: number, y: number, z: number): Vec {
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const u = y * cp - z1 * sp;
    const d = z1 * cp + y * sp;
    const s = FOCAL / (FOCAL - d);
    return [x1 * s, -u * s, d];
  }

  function project(x: number, y: number, z: number): Point {
    const [px, py] = raw(x, y, z);
    return [originX + px * scale, originY + py * scale];
  }

  // Frame the whole plate, the tallest possible column and the labels for the
  // current camera angle, then apply the reader's zoom and pan on top.
  function frameCamera() {
    cy = Math.cos(yaw.x);
    sy = Math.sin(yaw.x);
    cp = Math.cos(pitch.x);
    sp = Math.sin(pitch.x);
    eye = [FOCAL * cp * sy, FOCAL * sp, FOCAL * cp * cy];

    const hx = W / 2 + PLATE + 2.4;
    const hz = D / 2 + PLATE + 1.6;
    const top = FLAT_H + (MAX_H - FLAT_H) * (move ? frameFlat : flat.x);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const x of [-hx, hx]) {
      for (const z of [-hz, hz]) {
        for (const y of [-0.4, top]) {
          const [px, py] = raw(x, y, z);
          x0 = Math.min(x0, px);
          x1 = Math.max(x1, px);
          y0 = Math.min(y0, py);
          y1 = Math.max(y1, py);
        }
      }
    }
    fit = Math.min((width * 0.96) / (x1 - x0), (height * 0.92) / (y1 - y0));
    frameX = (x0 + x1) / 2;
    frameY = (y0 + y1) / 2;
    scale = fit * zoom.x * dolly;
    originX = width / 2 - frameX * scale + panX.x;
    originY = height / 2 - frameY * scale + panY.x;
  }

  // ---- drawing --------------------------------------------------------------

  type Face = { pts: Point[]; shade: number };
  const hits: { i: number; faces: Point[][] }[] = [];

  function faceVisible(n: Vec, c: Vec) {
    return (eye[0] - c[0]) * n[0] + (eye[1] - c[1]) * n[1] + (eye[2] - c[2]) * n[2] > 1e-3;
  }

  function boxFaces(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Face[] {
    const out: Face[] = [];
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const my = (y0 + y1) / 2;
    const add = (n: Vec, c: Vec, corners: Vec[]) => {
      if (!faceVisible(n, c)) return;
      const lit = n[1] === 1 ? 1 : palette.side + (1 - palette.side) * 0.75 * Math.max(0, n[0] * LIGHT[0] + n[2] * LIGHT[2]);
      out.push({ pts: corners.map(([x, y, z]) => project(x, y, z)), shade: lit });
    };
    if (y1 - y0 > 0.002) {
      add([1, 0, 0], [x1, my, mz], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]);
      add([-1, 0, 0], [x0, my, mz], [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]);
      add([0, 0, 1], [mx, my, z1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]);
      add([0, 0, -1], [mx, my, z0], [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]);
    }
    add([0, 1, 0], [mx, y1, mz], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
    return out;
  }

  function fill(pts: Point[], color: string) {
    ctx.beginPath();
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k]![0], pts[k]![1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // A hairline in the same colour closes the anti-aliased seams between faces.
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  function pill(text: string, [x, y]: Point, align: 'center' | 'right') {
    ctx.font = `500 11px ${palette.font}`;
    const w = ctx.measureText(text).width + 14;
    const h = 20;
    const left = align === 'center' ? x - w / 2 : x - w;
    ctx.beginPath();
    ctx.roundRect(left, y - h / 2, w, h, h / 2);
    ctx.fillStyle = css(palette.pill);
    ctx.fill();
    ctx.fillStyle = css(palette.pillInk);
    ctx.textAlign = 'center';
    ctx.fillText(text, left + w / 2, y + 0.5);
  }

  function heightOf(cell: Cell, now: number, lifted = true) {
    let rise = 1;
    if (!riseDone) {
      rise = riseStart === null ? 0 : clamp((now - riseStart - cell.delay) / 720, 0, 1);
      rise = rise === 0 ? 0 : easeOutBack(rise);
    }
    const full = cell.count > 0 ? 0.16 + cell.v * (MAX_H - 0.16) : 0.08;
    const lift = lifted && !reducedMotion() ? (lifts.get(cell.i)?.x ?? 0) * LIFT : 0;
    return Math.max(0, FLAT_H + (full * rise + lift - FLAT_H) * flat.x);
  }

  function draw(now: number) {
    frameCamera();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.textBaseline = 'middle';

    const active = pinned >= 0 ? pinned : hover >= 0 ? hover : focused;
    const sel = byIndex.get(active);
    if (active !== lifted) {
      if (lifted >= 0) lifts.get(lifted)!.target = 0;
      if (active >= 0) {
        const spring = lifts.get(active) ?? new Spring(0, 260, 32);
        spring.target = 1;
        lifts.set(active, spring);
      }
      lifted = active;
      if (reducedMotion()) lifts.forEach((s) => s.snap());
    }

    // Plate
    const px = W / 2 + PLATE - 0.5;
    const pz = D / 2 + PLATE - 0.5;
    for (const f of boxFaces(-px, px, -pz, pz, -0.4, 0)) fill(f.pts, css(palette.plate, f.shade));

    // Guides from the selected day to its weekday and date labels, drawn on the
    // plate so the columns in front cover them.
    if (sel) {
      ctx.save();
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = css(palette.pill);
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      const a = project(sel.x, 0.01, sel.z);
      const b = project(-W / 2 - 0.2, 0.01, sel.z);
      const c = project(sel.x, 0.01, D / 2 + 0.2);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
      ctx.restore();
    }

    // Labels
    ctx.font = `400 11px ${palette.font}`;
    ctx.fillStyle = palette.label;
    // Weekday labels only when the rows are far enough apart on screen to read.
    const dayLabels = [1, 3, 5].map((day) => ({ day, at: project(-W / 2 - 1.1, 0, day - (D - 1) / 2) }));
    const roomy = dayLabels.every((l, k) => k === 0 || Math.abs(l.at[1] - dayLabels[k - 1]!.at[1]) >= 12);
    ctx.textAlign = 'right';
    const pillY = sel ? project(-W / 2 - 1.1, 0, sel.z)[1] : null;
    for (const { day, at } of roomy ? dayLabels : []) {
      if (pillY !== null && Math.abs(at[1] - pillY) < 15) continue;
      ctx.fillText(DAY_NAMES[day]!.slice(0, 3), at[0], at[1]);
    }
    const front = D / 2 + 1.3;
    let lastRight = -Infinity;
    for (const t of monthTicks) {
      const [lx, ly] = project(t.week - (W - 1) / 2, 0, front);
      const w = ctx.measureText(t.label).width;
      if (lx - w / 2 < lastRight + 6) continue;
      if (sel) {
        const [sx] = project(sel.x, 0, front);
        if (Math.abs(sx - lx) < 46) continue;
      }
      ctx.textAlign = 'center';
      ctx.fillText(t.label, lx, ly);
      lastRight = lx + w / 2;
    }

    // Columns, far to near.
    const order = cells
      .map((c) => ({ c, d: raw(c.x, 0, c.z)[2] }))
      .sort((a, b) => a.d - b.d);
    hits.length = 0;
    const half = (1 - GAP) / 2;
    let rising = false;
    for (const { c } of order) {
      const h = heightOf(c, now);
      if (!riseDone && riseStart !== null && now - riseStart - c.delay < 720) rising = true;
      let base = c.count > 0 ? mix(palette.lo, palette.hi, c.v) : palette.zero;
      const glow = clamp(lifts.get(c.i)?.x ?? 0, 0, 1);
      if (glow > 0) base = mix(base, palette.highlight, 0.85 * glow);
      const faces = boxFaces(c.x - half, c.x + half, c.z - half, c.z + half, 0, h);
      for (const f of faces) fill(f.pts, css(base, f.shade));
      // Hit-test against the resting column, so a lifted one cannot steal the
      // pointer from its neighbour and make the highlight flicker.
      const rest = glow > 0 ? boxFaces(c.x - half, c.x + half, c.z - half, c.z + half, 0, heightOf(c, now, false)) : faces;
      hits.push({ i: c.i, faces: rest.map((f) => f.pts) });
    }
    if (riseStart !== null && !rising && !riseDone && now - riseStart > 400) riseDone = true;

    if (sel) {
      pill(DAY_NAMES[sel.day]!.slice(0, 3), project(-W / 2 - 1.1, 0, sel.z), 'right');
      const d = dateOf(sel.i);
      pill(`${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`, project(sel.x, 0, front), 'center');
    }

    placeTip(sel, now);
  }

  const tipDay = tip.querySelector<HTMLElement>('[data-tip-day]')!;
  const tipDate = tip.querySelector<HTMLElement>('[data-tip-date]')!;
  const tipCount = tip.querySelector<HTMLElement>('[data-tip-count]')!;
  const tipUnit = tip.querySelector<HTMLElement>('[data-tip-unit]')!;
  const tipWeek = tip.querySelector<HTMLElement>('[data-tip-week]')!;
  const tipBarsBox = tip.querySelector<HTMLElement>('[data-tip-bars]')!;
  tipBarsBox.innerHTML = '<i></i>'.repeat(7);
  const tipBars = [...tipBarsBox.children] as HTMLElement[];
  let tipFor = -1;
  let tipTransform = '';
  let tipW = 200;
  let tipH = 120;

  function placeTip(sel: Cell | undefined, now: number) {
    if (!sel) {
      tip.classList.remove('is-shown');
      return;
    }
    // Rewriting the card and measuring it forces a layout, so do it only when
    // the day changes, not on every animation frame.
    if (sel.i !== tipFor) {
      tipFor = sel.i;
      const weekStart = sel.week * 7;
      const weekCounts = Array.from({ length: 7 }, (_, k) => Math.max(0, counts[weekStart + k] ?? 0));
      const weekTotal = weekCounts.reduce((a, b) => a + b, 0);
      const peak = Math.max(1, ...weekCounts);
      tipDay.textContent = DAY_NAMES[sel.day]!;
      tipDate.textContent = fmtDate(dateOf(sel.i));
      tipCount.textContent = sel.count.toLocaleString('en-US');
      tipUnit.textContent = sel.count === 1 ? 'contribution' : 'contributions';
      tipWeek.textContent = weekTotal.toLocaleString('en-US');
      weekCounts.forEach((c, k) => {
        tipBars[k]!.style.height = `${12 + (c / peak) * 88}%`;
        tipBars[k]!.classList.toggle('is-on', k === sel.day);
      });
      tip.hidden = false;
      tipW = tip.offsetWidth;
      tipH = tip.offsetHeight;
    }

    const appearing = !tip.classList.contains('is-shown');
    const top = project(sel.x, heightOf(sel, now), sel.z);
    const tw = tipW;
    const th = tipH;
    let left = top[0] + 18;
    if (left + tw > width - 8) left = top[0] - 18 - tw;
    left = clamp(left, 8, Math.max(8, width - tw - 8));
    const y = clamp(top[1] - th / 2, 8, Math.max(8, height - th - 8));
    tipX.target = left;
    tipY.target = y;
    if (appearing || reducedMotion()) {
      tipX.snap();
      tipY.snap();
      tip.classList.add('is-shown');
    }
    const transform = `translate(${tipX.x.toFixed(1)}px, ${tipY.x.toFixed(1)}px)`;
    if (transform !== tipTransform) {
      tip.style.transform = transform;
      tipTransform = transform;
    }
  }

  // ---- loop -----------------------------------------------------------------

  function tick(now: number) {
    frame = 0;
    if (!canRender()) { last = 0; return; }
    const dt = Math.min(1 / 30, (now - (last || now)) / 1000);
    last = now;
    if (reducedMotion()) {
      move = null;
      dolly = 1;
      springs.forEach((s) => s.snap());
      lifts.forEach((s) => s.snap());
      riseDone = true;
    } else {
      if (move) runMove(now);
      // Small fixed steps keep the springs stable on slow frames.
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let k = 0; k < steps; k++) {
        springs.forEach((s) => s.step(dt / steps));
        lifts.forEach((s) => s.step(dt / steps));
        tipX.step(dt / steps);
        tipY.step(dt / steps);
      }
      lifts.forEach((s, i) => {
        if (s.target === 0 && s.settled) lifts.delete(i);
      });
      // Never swing past straight down, or the grid would flip over.
      if (pitch.x > Math.PI / 2) {
        pitch.x = Math.PI / 2;
        pitch.v = Math.min(0, pitch.v);
      }
    }
    draw(now);
    const moving =
      move !== null ||
      springs.some((s) => !s.settled) ||
      [...lifts.values()].some((s) => !s.settled) ||
      (tip.classList.contains('is-shown') && !(tipX.settled && tipY.settled)) ||
      (!riseDone && riseStart !== null) ||
      dragging;
    if (moving && canRender() && !reducedMotion()) frame = requestAnimationFrame(tick);
    else last = 0;
  }

  function canRender() {
    return !destroyed && !paused && visible && !document.hidden
      && !root.closest('[hidden], [inert]');
  }
  function kick() {
    if (!frame && width > 0 && canRender()) frame = requestAnimationFrame(tick);
  }
  function suspend() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    // Finish a camera move on resume rather than replaying time spent hidden.
    move = null;
    dolly = 1;
    springs.forEach((s) => s.snap());
    dragging = false;
    if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
    pointer = null;
    root.classList.remove('is-dragging');
  }

  // ---- view -----------------------------------------------------------------

  function setView(next: View, animate = true) {
    const changed = next !== view;
    view = next;
    const p = pose(next, width);
    yaw.target = p.yaw;
    pitch.target = p.pitch;
    orbited = false;
    flat.target = next === 'top' ? 0 : 1;
    move = null;
    dolly = 1;
    if (changed && animate && !reducedMotion()) {
      move = { to: next, start: performance.now(), from: { yaw: yaw.x, pitch: pitch.x, flat: flat.x } };
    }
    zoom.target = 1;
    panX.target = 0;
    panY.target = 0;
    pinned = -1;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === next)));
    root.dataset.view = next;
    if (changed) options.onViewChange?.(next);
    kick();
  }

  function runMove(now: number) {
    if (!move) return;
    const spec = MOVES[move.to];
    const t = clamp((now - move.start) / spec.ms, 0, 1);
    const to = pose(move.to, width);
    // The swing finishes before the dolly so the last part is a pure settle.
    const q = (move.to === 'top' ? glide : turn)(phase(t, move.to === 'top' ? 0 : 0.04, spec.swing));
    yaw.x = move.from.yaw + (to.yaw - move.from.yaw) * q;
    frameFlat = move.to === 'top' ? (1 - q) * move.from.flat : move.from.flat + (1 - move.from.flat) * q;
    pitch.x = move.from.pitch + (to.pitch - move.from.pitch) * q;
    // Columns sink early on the way down and grow through the middle on the way up.
    const g = move.to === 'top' ? settle(phase(t, 0, 0.4)) : settle(phase(t, 0.06, 0.5));
    flat.x = move.from.flat + ((move.to === 'top' ? 0 : 1) - move.from.flat) * g;
    dolly = 1 + spec.dolly * (move.to === 'top' ? bump(t, spec.peak) : impulse(t, spec.peak));
    for (const s of [yaw, pitch, flat]) s.v = 0;
    if (t >= 1) {
      move = null;
      dolly = 1;
      yaw.snap();
      pitch.snap();
      flat.snap();
    }
  }

  buttons.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view as View), { signal: events.signal }));

  // Fly towards a day: zoom in and pan so its column lands in the middle.
  function flyTo(i: number) {
    const cell = byIndex.get(i);
    if (!cell) return;
    if (pinned === i) return reset();
    pinned = i;
    const target = 2.1;
    const [px, py] = raw(cell.x, 0, cell.z);
    panX.target = -(px - frameX) * fit * target;
    panY.target = -(py - frameY) * fit * target;
    zoom.target = target;
    announce(i);
    kick();
  }

  function reset() {
    pinned = -1;
    zoom.target = 1;
    panX.target = 0;
    panY.target = 0;
    kick();
  }

  function announce(i: number) {
    const cell = byIndex.get(i);
    if (!cell || !live) return;
    live.textContent = `${DAY_NAMES[cell.day]}, ${fmtDate(dateOf(i))}: ${plural(cell.count)}`;
  }

  // ---- pointer --------------------------------------------------------------

  let dragging = false;
  let pointer: { id: number; x: number; y: number; t: number; type: string; moved: boolean; lock: '' | 'x' | 'y' } | null = null;
  let velocity = 0;

  function pick(x: number, y: number) {
    for (let k = hits.length - 1; k >= 0; k--) {
      if (hits[k]!.faces.some((f) => inside([x, y], f))) return hits[k]!.i;
    }
    return -1;
  }

  function hoverTo(next: number) {
    if (next === hover) return;
    hover = next;
    if (next >= 0) announce(next);
    kick();
  }

  function clearHover() {
    hover = -1;
  }

  function local(e: PointerEvent | MouseEvent): Point {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * width / r.width, (e.clientY - r.top) * height / r.height];
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType, moved: false, lock: '' };
    velocity = 0;
  }, { signal: events.signal });

  canvas.addEventListener('pointermove', (e) => {
    if (pointer && pointer.id === e.pointerId) {
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      if (!pointer.moved && Math.hypot(dx, dy) > 4) {
        pointer.moved = true;
        pointer.lock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        if (pointer.type === 'touch' && pointer.lock === 'y') {
          pointer = null; // let the page scroll
          return;
        }
        if (view === 'top') setView('perspective', false);
        if (move) {
          move = null;
          dolly = 1;
        }
        canvas.setPointerCapture(e.pointerId);
        dragging = true;
        orbited = true;
        root.classList.add('is-dragging');
        clearHover();
      }
      if (dragging) {
        const now = performance.now();
        const step = dx * 0.0065;
        yaw.target = clamp(yaw.target + step, -YAW_LIMIT, YAW_LIMIT);
        yaw.x = clamp(yaw.x + step, -YAW_LIMIT, YAW_LIMIT);
        if (pointer.type !== 'touch') {
          pitch.target = clamp(pitch.target + dy * 0.0045, PITCH_MIN, PITCH_MAX);
          pitch.x = clamp(pitch.x + dy * 0.0045, PITCH_MIN, PITCH_MAX);
        }
        velocity = step / Math.max(1, now - pointer.t);
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.t = now;
        kick();
        return;
      }
    }
    if (e.pointerType === 'mouse') {
      const [x, y] = local(e);
      hoverTo(pick(x, y));
    }
  }, { signal: events.signal });

  function release(e: PointerEvent) {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (dragging) {
      // Carry the drag on for a moment, then let the spring settle it.
      if (!reducedMotion()) yaw.target = clamp(yaw.target + clamp(velocity * 220, -0.6, 0.6), -YAW_LIMIT, YAW_LIMIT);
      dragging = false;
      root.classList.remove('is-dragging');
      kick();
    } else if (!pointer.moved && e.type === 'pointerup') {
      const [x, y] = local(e);
      const i = pick(x, y);
      if (i >= 0) flyTo(i);
      else if (pinned >= 0) reset();
    }
    pointer = null;
  }
  canvas.addEventListener('pointerup', release, { signal: events.signal });
  canvas.addEventListener('pointercancel', release, { signal: events.signal });
  canvas.addEventListener('pointerleave', () => hoverTo(-1), { signal: events.signal });
  canvas.addEventListener('dblclick', () => setView(view), { signal: events.signal });

  // Trackpad pinch arrives as a ctrl-wheel; plain wheel scrolling stays with the page.
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const [x, y] = local(e);
      const before = zoom.target;
      const after = clamp(before * Math.exp(-e.deltaY * 0.01), 1, 3);
      const k = after / before;
      // Keep the point under the cursor in place while zooming.
      panX.target = (panX.target - (x - width / 2)) * k + (x - width / 2);
      panY.target = (panY.target - (y - height / 2)) * k + (y - height / 2);
      if (after === 1) {
        panX.target = 0;
        panY.target = 0;
      }
      zoom.target = after;
      kick();
    },
    { passive: false, signal: events.signal },
  );

  // ---- keyboard -------------------------------------------------------------

  stage.addEventListener('keydown', (e) => {
    const first = cells.find((c) => c.count >= 0)?.i ?? 0;
    let i = focused >= 0 ? focused : -1;
    const move = (dw: number, dd: number) => {
      if (i < 0) i = first;
      else {
        const c = byIndex.get(i)!;
        const n = (c.week + dw) * 7 + clamp(c.day + dd, 0, 6);
        if (byIndex.has(n)) i = n;
      }
      focused = i;
      clearHover();
      announce(i);
      kick();
    };
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      if (view === 'top') setView('perspective', false);
      orbited = true;
      yaw.target = clamp(yaw.target + (e.key === 'ArrowLeft' ? -0.25 : 0.25), -YAW_LIMIT, YAW_LIMIT);
      kick();
    } else if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      if (view === 'top') setView('perspective', false);
      orbited = true;
      pitch.target = clamp(pitch.target + (e.key === 'ArrowUp' ? 0.15 : -0.15), PITCH_MIN, PITCH_MAX);
      kick();
    } else if (e.key === 'ArrowRight') move(1, 0);
    else if (e.key === 'ArrowLeft') move(-1, 0);
    else if (e.key === 'ArrowDown') move(0, 1);
    else if (e.key === 'ArrowUp') move(0, -1);
    else if (e.key === 'Enter' || e.key === ' ') {
      if (focused >= 0) flyTo(focused);
    } else if (e.key === 'Escape') {
      if (pinned >= 0 || zoom.target !== 1) reset();
      else {
        focused = -1;
        kick();
      }
    } else if (e.key === '+' || e.key === '=') {
      zoom.target = clamp(zoom.target * 1.25, 1, 3);
      kick();
    } else if (e.key === '-') {
      zoom.target = clamp(zoom.target / 1.25, 1, 3);
      if (zoom.target === 1) {
        panX.target = 0;
        panY.target = 0;
      }
      kick();
    } else return;
    e.preventDefault();
  }, { signal: events.signal });
  stage.addEventListener('blur', () => {
    focused = -1;
    kick();
  }, { signal: events.signal });

  // ---- lifecycle ------------------------------------------------------------

  readTheme();
  setView(view, false);
  resize();
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(canvas);
  window.addEventListener('resize', resize, { signal: events.signal });
  const themeObserver = new MutationObserver(() => {
    readTheme();
    if (reducedMotion()) riseDone = true;
    kick();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme', 'data-accent', 'data-motion'],
  });
  const visibilityObserver = new MutationObserver(() => {
    if (canRender()) kick(); else suspend();
  });
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
    visibilityObserver.observe(ancestor, { attributes: true, attributeFilter: ['hidden', 'inert'] });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend(); else kick();
  }, { signal: events.signal });
  reduced.addEventListener('change', () => {
    if (reducedMotion()) riseDone = true;
    kick();
  }, { signal: events.signal });
  document.fonts?.ready.then(kick);

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    if (visible && riseStart === null) {
      riseStart = performance.now();
      if (reducedMotion()) riseDone = true;
    }
    if (visible) kick(); else suspend();
  }, { threshold: 0.2 });
  intersectionObserver.observe(canvas);

  root.classList.add('is-ready');
  return {
    setView(next) { if (next !== view) setView(next); },
    setPaused(next) {
      paused = next;
      if (paused) suspend(); else kick();
    },
    reset() { setView(view); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      suspend();
      events.abort();
      sizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      intersectionObserver.disconnect();
      lifts.clear();
      root.classList.remove('is-ready');
      tip.hidden = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
