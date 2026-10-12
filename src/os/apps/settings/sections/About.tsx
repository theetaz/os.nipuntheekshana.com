import type { SettingsData } from '../settings';
import { DEFAULT_DATA } from '../settings';
import { BRAND_BLADE_PATH, BRAND_VIEWBOX } from '../../../icons/brand-glyph';

export function About({ data = DEFAULT_DATA }: { data?: SettingsData }) {
  const { build } = data;
  return <>
    <div className="settings-about-glyph" aria-hidden="true"><svg viewBox={BRAND_VIEWBOX}>
      <rect x="1" y="1" width="62" height="62" rx="14" fill="#FFC93C" stroke="#1B1530" strokeWidth="2" />
      <g stroke="#1B1530" strokeWidth="2">
        <path d={BRAND_BLADE_PATH} transform="rotate(45 32 32)" style={{ fill: '#FFFDF8' }} />
        <path d={BRAND_BLADE_PATH} transform="rotate(-45 32 32)" style={{ fill: '#E8453C' }} />
      </g>
    </svg></div>
    <h2>Kottu OS {build.version} “{build.codename}”</h2>
    <p className="settings-build">Build {build.sha.slice(0, 7)} · {build.date ? <time dateTime={build.date}>{build.date.slice(0, 10)}</time> : 'Local build'}</p>
    <p className="settings-description">Made in Colombo by Nipun Theekshana.</p>
    <div className="settings-credits"><h3>Credits</h3>
      <p>Sri Lanka outline: geoBoundaries gbOpen, derived from © OpenStreetMap contributors. ODbL 1.0.</p>
      <p>Shrikhand, Kalam, Instrument Sans, Fraunces and Martian Mono fonts. SIL Open Font License.</p>
      <p>Lucide icons. ISC License.</p>
      <p>Built with Astro, React, Motion, Jotai, Tailwind CSS and three.js.</p>
    </div>
    <a href={data.source} target="_blank" rel="noopener noreferrer">Source on GitHub <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
  </>;
}
