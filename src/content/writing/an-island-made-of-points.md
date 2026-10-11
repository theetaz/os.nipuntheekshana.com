---
title: 'An island made of points'
description: 'How the Sri Lanka on the home page is drawn: 15,000 WebGL points, a 6 KB coastline, stylised relief, and a page that stays fast because the 3D loads last.'
date: 2026-09-28
kind: engineering
tags: ['three.js', 'webgl', 'performance', 'geo']
---

The first thing on this site is Sri Lanka, drawn as a field of glowing points. It rises out of the sea from the south coast northwards, the central highlands stand up, towns glow warmer than the countryside, and a ring of light keeps travelling out from Colombo. Move a mouse over it and the ground lifts under the cursor while the corner of the screen reads out the coordinates.

Given how much of my free time goes into Sri Lankan geo-data, it felt like the right way to open my own site. It also had to cost almost nothing, because a personal site that makes you wait for a 3D scene has its priorities backwards. Here is how both of those turned out to be true.

## The outline is real, and tiny

The coastline comes from the [geoBoundaries](https://www.geoboundaries.org/) ADM0 boundary for Sri Lanka, which is derived from OpenStreetMap and published under the ODbL. The simplified GeoJSON is about 90 KB. That is far more detail than a particle silhouette needs.

A build script runs Douglas–Peucker over each ring with a tolerance of 0.006° (roughly 650 m), drops islets smaller than 0.002 square degrees, and rounds coordinates to three decimals. What is left is five rings, 432 vertices and **6.5 KB of JSON**, bundled straight into the hero's JavaScript. No extra request.

```js
const rings = polygons
  .map((polygon) => polygon[0])
  .filter((ring) => area(ring) >= MIN_AREA)
  .map((ring) => simplify(ring, TOLERANCE).map(([lon, lat]) => [round(lon), round(lat)]));
```

## Points are generated, not downloaded

Instead of shipping a point cloud, the browser generates one. It walks a hexagonal grid over the island's bounding box — rows 0.866 × step apart, alternate rows offset by half a step — jitters each point slightly so the pattern doesn't look machine-made, and keeps the ones that land inside the coastline with an even-odd point-in-polygon test.

At a step of 0.02° that is about 15,000 points on a desktop and about 7,000 on a phone. Generating them takes a few milliseconds.

One detail matters more than it looks: a degree of longitude near the equator is not the same distance as a degree of latitude away from it. At 7.86°N the difference is small (cos 7.86° ≈ 0.99), but projecting with the cosine correction keeps the island's proportions honest.

## Relief and density are stylised

Real elevation and population rasters would be lovely and would weigh megabytes. So the heights are a sum of Gaussian peaks — the central massif, Pidurutalagala, Sri Pada, Horton Plains, the Knuckles range, Namunukula and the Sinharaja hills — textured with a small value-noise function. Density is the same trick with towns: Colombo, Kandy, Jaffna, Galle, Trincomalee and twenty-odd others, each with a weight and a footprint.

This is **not** census data and the page says so in its legend. It reads correctly at a glance, and it costs a few hundred bytes. When I want real numbers, [Lanka Data Layer](https://github.com/prabhavalabs/lanka-data-layer) and [GeoPop](https://github.com/prabhavalabs/geopop) are where they live.

## One draw call

Everything that moves happens in the vertex shader, so the CPU does almost nothing per frame:

- **The intro.** Each point carries a normalised north–south position. A single `uIntro` uniform animates from 0 to 1, and each point's own progress is `uIntro * 1.9 - sweep * 0.6 - random * 0.3`, clamped to 0–1. The south coast arrives first, the peninsula at Jaffna arrives last, and the constants are chosen so that at `uIntro = 1` even the very last point has landed. The clock is wall time rather than accumulated frame time, so a throttled background tab still finishes on schedule.
- **The Colombo pulse.** Distance from Colombo against a radius that grows with time, pushed through a narrow Gaussian: `exp(-pow((d - radius) * 5.0, 2.0))`.
- **The cursor.** The mouse ray is intersected with the ground plane on the CPU (one ray, one plane), and the result goes in as a uniform. Points within 0.6 units lift and brighten.

Colour is decided in the fragment shader: cool grey at sea level, lighter with altitude, amber where it is dense, near-white at the centre of the city. In dark mode the points blend additively so clusters bloom; in light mode additive blending would vanish into the paper, so the material switches to normal blending and darker ink.

## Staying fast

The rule was that the 3D can never be the reason the page is slow.

1. **The headline is the Largest Contentful Paint**, not the canvas. The text is server-rendered HTML with preloaded fonts.
2. **Three.js loads last.** The hero module is a dynamic `import()` fired from `requestIdleCallback`, so it never competes with first paint. It is about 135 KB gzipped, almost all of it the three.js renderer, and nothing on the page waits for it.
3. **The canvas fades in** once its first frame is ready, so there is never a flash of an empty black box.
4. **It stops when you can't see it.** An `IntersectionObserver` pauses the render loop when the hero scrolls away, and `visibilitychange` pauses it in background tabs.
5. **It respects the reader.** With `prefers-reduced-motion` the island renders once, fully formed, and never animates. With Save-Data, or without WebGL, it isn't loaded at all; a dotted SVG outline of the same coastline takes its place.
6. **Pixel ratio is capped** at 2 on desktops and 1.5 on phones, which is the difference between smooth and warm on a high-density screen.

## What I'd do next

Swap the stylised relief for a real, heavily quantised elevation grid (a 256 × 400 `Uint8Array` is 100 KB before compression — too heavy for the first view, fine for an "explore" mode). And let the points morph between layers — elevation, population, rainfall — the way the data platforms I build already can.

The source for the site, including the island script, is public on GitHub.
