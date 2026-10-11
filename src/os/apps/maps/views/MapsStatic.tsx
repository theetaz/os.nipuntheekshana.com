import { useId } from 'react';
import { toScene } from '../../../scenes/island-model';
import { PLACES } from '../../../scenes/pin-game';
import type { IslandData } from '../surface';
import '../maps.css';
export function IslandPoster({ island }: { island: IslandData | null }) {
  const id = useId().replace(/:/g, '');
  const d = island?.rings.map(ring => ring.map(([lon = 0, lat = 0], index) => `${index ? 'L' : 'M'}${toScene(lon, lat).map(value => value.toFixed(4)).join(' ')}`).join('') + 'Z').join('') ?? '';
  return <svg data-map-svg className="maps-poster" viewBox="-1.9 -2.5 3.8 5" aria-hidden="true">
    <defs><pattern id={`dots-${id}`} width=".035" height=".035" patternUnits="userSpaceOnUse"><circle cx=".0175" cy=".0175" r=".006" fill="currentColor" /></pattern></defs>
    <g data-map-world>
      <g data-map-grid opacity=".12" stroke="currentColor" strokeWidth=".004" strokeDasharray=".006 .035">
        {[-1.5, -1, -.5, 0, .5, 1, 1.5].map(x => <path key={x} d={`M${x} -2.5V2.5`} />)}
        {[-2, -1.5, -1, -.5, 0, .5, 1, 1.5, 2].map(y => <path key={y} d={`M-1.9 ${y}H1.9`} />)}
      </g>
      <path d={d} fill={`url(#dots-${id})`} />
      <path data-map-coast d={d} fill="none" stroke="currentColor" strokeWidth=".005" opacity=".4" />
      <circle data-map-pulse r=".07" fill="none" stroke="currentColor" strokeWidth=".01" opacity="0" />
    </g>
  </svg>;
}
export function MapsStatic({ island, play = false }: { island: IslandData; play?: boolean }) {
  return <div className="maps-static">
    <div className="maps-static-stage"><IslandPoster island={island} /><div className="maps-static-card maps-glass">
      <h1>{play ? 'Pin the city' : 'Island'}</h1>
      <p>{play ? 'Five cities. One island. How well do you know your way around?' : 'An island in the Indian Ocean, drawn as a field of points.'}</p>
      <p>Outline © OpenStreetMap contributors · ODbL 1.0</p>
      <a href={play ? '/maps' : '/maps/play'}>{play ? 'Explore Island' : 'Play Pin the city'}</a>
    </div></div>
    <div className="maps-static-copy">
      <h2>{play ? 'How to play' : 'An island made of points'}</h2>
      <p>{play ? 'Place a pin where you think each city is. Each of five rounds awards up to 1,000 points, with closer guesses scoring more. Enable JavaScript to play, using the pointer or arrow keys and Return.' : 'The outline follows Sri Lanka’s coast. Warm clusters mark towns; the central highlands rise from the point cloud. Relief and density are stylised, not survey or census data.'}</p>
      <a href="/writing/an-island-made-of-points">How it’s drawn ›</a>
      <h2>Places around the island</h2>
      <ul className="maps-places">{PLACES.map(place => <li key={place.name}><strong>{place.name}</strong> <span lang="si">{place.si}</span><span className="maps-coordinate">{place.lat.toFixed(4)}°N {place.lon.toFixed(4)}°E</span></li>)}</ul>
    </div>
  </div>;
}
