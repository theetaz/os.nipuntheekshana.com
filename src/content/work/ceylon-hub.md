---
lede: 'One open map where you can simply look at Sri Lanka: boundaries, places, population and infrastructure, with no backend to run and no API bill.'
role: 'Design and engineering'
facts:
  - { value: '0', label: 'Servers of its own to run' }
  - { value: '0', label: 'Map API keys' }
  - { value: '5+', label: 'Open data sources brought together' }
  - { value: 'Static', label: 'The whole app is files on a CDN' }
---

## The itch

Sri Lanka's geographic and statistical data exists, and it is scattered. Census figures are in one government portal. Administrative boundaries are in GADM. Population rasters are at WorldPop. Humanitarian datasets are on HDX. Roads and places are in OpenStreetMap.

There is no single place where you can just *look at the country*. Ceylon Hub wants to be that place, with every source and every dependency open.

## Choosing tools that do not send a bill

I picked the stack around one constraint: curiosity should not cost money.

- **MapLibre GL** for the map, so there is no vendor token to manage and no charge that grows with use.
- **Plain GeoJSON files** for the data. Each layer is one static file, so the whole application deploys to a CDN with no database and no API of its own behind it.
- **MapLibre's own extrusion layer** for the 3D view, where each district rises by its population. It needed no extra 3D library.

In the explorer you can switch layers on and off: provinces, districts, DS and GN divisions, election results, population density, roads, railways and more.

## An honest status

It is further along than scaffolding now: boundaries down to 330 DS divisions, four election results, population, roads, railways, schools, hospitals, waterways and protected areas are all in. GN divisions, land cover and elevation are still marked as coming.

## What came next

Ceylon Hub is the predecessor of [Lanka Data Layer](/work/lanka-data-layer), which takes the same kind of sources, precomputes everything offline and serves the result as an API. Part of that project's data is still seeded from this repository. Ceylon Hub is the map; Lanka Data Layer is the engine.

## Where it stands

Incubating.
