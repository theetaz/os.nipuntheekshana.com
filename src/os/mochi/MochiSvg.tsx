// SVG and mood styles ported from nipuntheekshana.com/src/components/Mochi.astro @ 3b4f92d09eee686dc249a2f839046bfd7db56dda.
export function MochiSvg({ umbrella = false }: { umbrella?: boolean }) {
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <ellipse className="mochi__shadow" cx="50" cy="93" rx="30" ry="4.5" />
    <g className="mochi__squish">
      <path className="mochi__blob" d="M50 16c22 0 38 17 38 42 0 21-15 32-38 32S12 79 12 58c0-25 16-42 38-42z" />
      <ellipse className="mochi__shine" cx="34" cy="32" rx="8" ry="4.5" transform="rotate(-28 34 32)" />
      <ellipse className="mochi__arm" cx="84" cy="50" rx="5" ry="11" />
      <g className="mochi__face">
        <g className="mochi__eyes">
          <ellipse className="mochi__eye" cx="38" cy="55" rx="4.2" ry="5.4" />
          <ellipse className="mochi__eye" cx="62" cy="55" rx="4.2" ry="5.4" />
          <path className="mochi__eye-closed" d="M33 56q5 4 10 0M57 56q5 4 10 0" />
          <path className="mochi__eye-happy" d="M33 57q5-6 10 0M57 57q5-6 10 0" />
          <path className="mochi__eye-dizzy" d="M38 55c0-1.3 1.5-1.3 1.5 0s-3 2.6-3 0 4.5-3.9 4.5 0-6 5.2-6 0 7.5-6.5 7.5 0-9 7.8-9 0M62 55c0-1.3 1.5-1.3 1.5 0s-3 2.6-3 0 4.5-3.9 4.5 0-6 5.2-6 0 7.5-6.5 7.5 0-9 7.8-9 0" />
        </g>
        <ellipse className="mochi__cheek" cx="28" cy="65" rx="5.5" ry="3.4" />
        <ellipse className="mochi__cheek" cx="72" cy="65" rx="5.5" ry="3.4" />
        <path className="mochi__mouth mochi__mouth--smile" d="M45 66q5 5 10 0" />
        <ellipse className="mochi__mouth mochi__mouth--o" cx="50" cy="68" rx="3.4" ry="4.2" />
        <path className="mochi__mouth mochi__mouth--open" d="M44 65q6 9 12 0z" />
      </g>
    </g>
    {umbrella && <g className="mochi__umbrella"><path d="M73 8v39q0 7-6 7" fill="none" stroke="#6C5140" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M49 12q24-26 48 0q-6-4-12 0-6-4-12 0-6-4-12 0-6-4-12 0" fill="#8AB8FF" stroke="#375B7B" strokeWidth="1" /></g>}
  </svg>;
}
