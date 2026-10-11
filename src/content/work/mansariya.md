---
lede: 'Live bus tracking for Sri Lanka without fitting a single GPS unit to a bus. The passengers are the hardware.'
role: 'Founder, product and engineering'
facts:
  - { value: '1,000+', label: 'Routes matched' }
  - { value: '5 s', label: 'Between GPS points' }
  - { value: '10 min', label: 'Before raw traces are discarded' }
  - { value: '$9', label: 'A month to run the backend' }
---

## The gap

Sri Lanka runs on buses: over a thousand routes and more than 65,000 vehicles, split between the state operator and thousands of private owners. There is no live data about any of them. No GTFS feed exists. Routes are published as PDFs. Map apps draw a static line and stop there.

Fitting tracking hardware to that fleet is never going to happen. So Mansariya asks a different question: what if the passengers are the hardware?

## How a phone becomes a bus

Ride with the app open and your phone contributes a GPS point every five seconds. On the server:

1. The trace is **snapped to roads** using a self-hosted routing engine.
2. It is **matched against 1,000+ route shapes** through a spatial index.
3. **Clustering** collapses several phones moving together on the same route into one virtual bus.
4. That bus's position streams to everyone waiting at a stop.

One contributor is already enough for a usable position. With three, the bus counts as verified.

## Privacy in the data model, not the settings page

Crowdsourced location is only acceptable if it cannot be turned into a record of where a person went. So the protections are structural:

- There are **no accounts**.
- Device identifiers **rotate every 24 hours**.
- Raw GPS traces are **discarded within ten minutes**.

The result is that even I cannot reconstruct anyone's journey. That is the point.

## The frugal part

The entire backend is one Go binary on a nine-dollar-a-month server. The map uses MapLibre with OpenFreeMap tiles, which keeps the map bill at exactly zero. The app speaks Sinhala, Tamil and English.

## Where it stands

An MVP in development, Android first. The rider app, the backend and an admin for routes, stops and test simulations all run end to end. The buses in the screens on this page are simulated riders replayed through the real pipeline, not live traffic.
