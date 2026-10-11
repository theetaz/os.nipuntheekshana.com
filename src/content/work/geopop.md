---
lede: 'Ask how many people live near any coordinate on Earth and get an answer in a couple of milliseconds, from a server you run yourself.'
role: 'Design and engineering'
facts:
  - { value: '175M', label: '1 km grid cells' }
  - { value: '~2 ms', label: 'Single-point lookup' }
  - { value: '4.8M', label: 'Places for reverse geocoding' }
  - { value: '1,000', label: 'Points per batch query' }
---

## The itch

"How many people live near this point?" sounds like a solved problem. The data is public: WorldPop publishes a one-kilometre population grid for the whole planet. But it arrives as raster files. You can look at it in GIS software; you cannot call it from an app.

GeoPop turns that grid, together with GeoNames and Natural Earth, into an API.

## The trick that makes it fast

The obvious implementation is a spatial query: find the grid cells that intersect this point. It works, and it is far slower than it needs to be.

The grid is *regular*. Every cell is the same size and the cells are laid out in rows. So the server does not search at all. It does arithmetic on the coordinate to compute an integer cell id, then performs a plain B-tree lookup on that id. No geometry is involved in the hot path, which is how 175 million rows answer in about two milliseconds.

It is the same lesson as [Lanka Data Layer](/work/lanka-data-layer), applied to the planet: find the structure in the data and let it replace the expensive operation.

## What is built around that core

- **Reverse geocoding** against 4.8 million GeoNames places.
- **City autocomplete** that tolerates typos.
- **Land or sea** detection and country lookup.
- **Batch queries** for up to 1,000 points at once.
- **An analyse endpoint for disaster work.** Give it an epicentre, even one in the ocean, and it widens its search radius until it finds people.

## The practical problem

Building the database from the raw sources means a 723 MB download and thirty to forty-five minutes of ingestion. That is a tall ask for someone who only wants to try it, so a companion repository carries pre-built dumps: one script and you are running.

One tuning result surprised me enough to ship it in the default configuration: PostgreSQL's JIT compilation added roughly 700 ms to the first query. For an API aiming at consistent sub-50 ms responses that is disqualifying, so GeoPop runs with JIT off. Optimisations need measuring against the latency you actually want.

## Where it stands

Active and MIT-licensed. It already does real work as the search and geocoding layer behind [GridPulse](/work/gridpulse).
