---
lede: 'A running game about land. Run a closed loop and the ground inside it becomes your territory, until somebody else laces up and takes it back.'
role: 'Design and engineering'
facts:
  - { value: '50 m', label: 'How close start and finish must be' }
  - { value: '85%', label: 'Route coverage needed to capture' }
  - { value: '25%', label: 'Maximum overlap with existing turf' }
  - { value: '45 km/h', label: 'Speed cap, so cars do not win' }
---

## The itch

Running apps are excellent at telling you what you did: pace, distance, a medal for beating yourself. What they never give you is a reason to go out on the day you do not feel like it.

TerraRun borrows one from childhood games. **Land.** Run a loop and the area inside it is yours on a shared map. If someone wants it, they have to go and run it.

## Turning a jog into a polygon

The rules had to be strict enough to be fair and loose enough to survive GPS.

- A run counts as a loop if it **ends within 50 metres of where it began**.
- The trace is simplified, then turned into a polygon and checked for area and overlap.
- A territory can be anything from **500 square metres to 50 square kilometres**.
- A new claim may overlap existing turf by **at most 25%**, so you cannot simply draw a bigger circle around someone.

## Taking territory

To capture someone's land you re-run their route with at least **85% coverage**. "Did you run the same route?" is a fuzzier question than it sounds, so similarity is measured geometrically, as the distance between your trace and a buffer zone around theirs.

A speed cap of 45 km/h keeps cars off the leaderboard.

## Under the map

The map updates live over WebSocket. An in-memory spatial index answers "what is in this viewport?" quickly, while PostGIS remains the source of truth for the geometry.

## What I do not know yet

Every game-balance number above is an environment variable, on purpose. I will not know the right values until real runners start arguing about them.

## Where it stands

An early prototype: a Go backend and a React frontend that start with one command. There is no public server yet, and snapping traces to real roads is still on the list.
