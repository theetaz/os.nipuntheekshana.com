---
lede: 'One open API for the questions every Sri Lankan app ends up asking: which division is this coordinate in, who lives there, what is the postal code. Free, MIT-licensed, no keys.'
role: 'Founder, data pipeline, API and web'
facts:
  - { value: '~14K', label: 'GN divisions covered' }
  - { value: '1,833', label: 'Postal codes' }
  - { value: '1', label: 'SQLite file behind the API' }
  - { value: '$0', label: 'Per 1,000 requests' }
---

## The problem I kept running into

Almost every project I start for Sri Lanka needs the same three answers early on: *where is this point administratively, how many people live there, and what is the postal code?* The data to answer them exists, but it is scattered across census PDFs, government portals, OpenStreetMap extracts and one-off spreadsheets. The alternatives are paying a global geocoder roughly five dollars per thousand requests for an API that barely knows what a GN division is, or hand-rolling the same extract again.

After doing the hand-rolled version more than once, I built the thing I wanted to call.

## The idea: the country is small enough to precompute

The whole design comes from one observation. Sri Lanka is around 70,000 populated one-kilometre grid cells, 30,000 named places, 330 DS divisions and about 14,000 GN divisions. That fits comfortably in a single SQLite file.

So nothing spatial happens at request time. An offline pipeline I call the *foundry* fetches every source, normalises it to one schema keyed by official p-codes, runs all the point-in-polygon and aggregation work once, and writes `lanka.sqlite`. The API is then almost embarrassingly simple: reverse geocoding is one indexed read, and every response is cacheable. A full rebuild of the data takes about three minutes.

## What you can ask it

- **Reverse geocoding** down to GN division, with DS division, district, province and postal code in the same response.
- **One search box** that understands four kinds of input: a place name, a five-digit postal code, a coordinate pair, or a p-code.
- **Population and census profiles** for every administrative unit, from the 2024 Census.
- **Boundaries as GeoJSON**, for highlighting a unit on a map.
- **Search in Sinhala, Tamil and English.**

On top of the API there is an explorer: search anything, see its boundary light up, and read a detail card where each section names its own source instead of hiding behind one blended credit line.

## Decisions I would make again

**Docs that call the real API.** Every endpoint page has a "Try it" panel that sends an actual request and shows the actual response. If the docs are wrong, they are visibly wrong.

**No map bill.** The basemap is OpenFreeMap vector tiles, so there is no token to manage and no cost that grows with curiosity.

**Offline packages.** The same data ships as npm packages for apps that cannot assume a connection.

## Where it stands

Active and MIT-licensed. It grew out of [Ceylon Hub](/work/ceylon-hub), and it is the project I would point to first if you asked what Prabhava Labs is for.
