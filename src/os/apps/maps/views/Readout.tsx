import { TOWNS, inside } from '../../../scenes/island-model';
import type { GeoPoint, IslandData } from '../surface';
export function readoutFor(island: IslandData | null, at: GeoPoint | null) {
  if (!island || !at || !inside(island, at.lon, at.lat)) return 'Indian Ocean';
  const nearest = TOWNS.reduce((best, town) => Math.hypot(town[1] - at.lat, (town[2] - at.lon) * .99) < Math.hypot(best[1] - at.lat, (best[2] - at.lon) * .99) ? town : best);
  return `${at.lat.toFixed(4)}°N ${at.lon.toFixed(4)}°E · near ${nearest[0]}`;
}
export function Readout({ text }: { text: string }) { return <div className="maps-readout maps-glass">{text}</div>; }
