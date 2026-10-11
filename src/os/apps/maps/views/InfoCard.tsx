export function InfoCard({ count, onHome }: { count: number; onHome(): void }) {
  return <aside className="maps-info maps-glass" aria-label="About this island"><h1>Sri Lanka</h1>
    <p>{count ? `${count.toLocaleString('en-US')} points` : 'A field of points'}</p>
    <p>Outline © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></p>
    <button type="button" onClick={onHome}>Where’s Nipun? (Colombo)</button>
  </aside>;
}
