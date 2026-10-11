import type { SettingsData } from '../settings';
import { DEFAULT_DATA } from '../settings';
import island from '../../../../assets/wallpapers/island-mask.svg?raw';

export function About({ data = DEFAULT_DATA }: { data?: SettingsData }) {
  const { build } = data;
  return <>
    <div className="settings-about-glyph" aria-hidden="true" dangerouslySetInnerHTML={{ __html: island }} />
    <h2>Serendib {build.version} “{build.codename}”</h2>
    <p className="settings-build">Build {build.sha.slice(0, 7)} · {build.date ? <time dateTime={build.date}>{build.date.slice(0, 10)}</time> : 'Local build'}</p>
    <p className="settings-description">Made in Colombo by Nipun Theekshana.</p>
    <div className="settings-credits"><h3>Credits</h3>
      <p>Sri Lanka outline: geoBoundaries gbOpen, derived from © OpenStreetMap contributors. ODbL 1.0.</p>
      <p>Instrument Sans, Fraunces and Martian Mono fonts. SIL Open Font License.</p>
      <p>Lucide icons. ISC License.</p>
      <p>Built with Astro, React, Motion, Jotai, Tailwind CSS and three.js.</p>
    </div>
    <a href={data.source} target="_blank" rel="noopener noreferrer">Source on GitHub <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
  </>;
}
