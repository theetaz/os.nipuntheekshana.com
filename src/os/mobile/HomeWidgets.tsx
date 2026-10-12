import type { ReactNode } from 'react';
import type { DesktopProps } from '../Desktop';
import type { HomeArt } from './HomeScreen';
const miniProps = [
  { id: 'tuktuk', href: '/projects', app: 'projects', name: 'Tuk-tuk: open Projects', size: 96 },
  { id: 'lotus-tower', href: '/maps', app: 'maps', name: 'Lotus Tower model: open Island', size: 40 },
  { id: 'tea', href: '/messages', app: 'messages', name: 'Cup of Ceylon tea: open Messages', size: 56 },
  { id: 'radio', href: '/now', app: 'now', name: 'Old radio: open Now', size: 72 },
] as const;
export function HomeWidgets({ home, art, companion }: { home: DesktopProps['home']; art?: HomeArt; companion?: ReactNode }) {
  const updated = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${home.nowUpdated}T00:00:00Z`)).replace('Sept', 'Sep');
  return <><div className="phone-hero-wrap"><article className="phone-hero" aria-labelledby="phone-name">
    <p className="phone-greeting"><span lang="si" title="Ayubowan: may you live long" aria-describedby="phone-greeting-gloss">ආයුබෝවන්!</span> I'm<span id="phone-greeting-gloss" className="sr-only">Ayubowan: may you live long</span></p>
    <h1 id="phone-name"><span>Nipun</span><br/>{' '}<span>Theekshana</span></h1><p lang="si">නිපුන් තීක්ෂණ</p><p className="phone-hero-role">Engineer · founder · Colombo</p>
  </article>{art && <nav className="phone-mini-props" aria-label="Desktop"><ul>{miniProps.map(prop => {
    const image = art[prop.id];
    return <li key={prop.id}><a className={`phone-mini-prop phone-mini-${prop.id}`} href={prop.href} data-app-launch={prop.app} aria-label={prop.name}>
      <picture><source type="image/avif" srcSet={image.avif} sizes={`${prop.size}px`}/><source type="image/webp" srcSet={image.webp} sizes={`${prop.size}px`}/><img src={image.src} width={image.width} height={image.height} alt="" loading="lazy" fetchPriority="low" decoding="async" draggable={false}/></picture>
    </a></li>;
  })}</ul></nav>}</div><div className="phone-widgets">
    <aside className="phone-now" aria-labelledby="phone-now-title"><h2 id="phone-now-title">Now</h2><ol>{home.nowItems.slice(0, 2).map((item, i) => <li key={item}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span>{item}</span></li>)}</ol><footer><time dateTime={home.nowUpdated}>Updated {updated}</time><a className="stretched-link" href="/now" aria-label="Read all current updates">›</a></footer></aside>
    <aside className="phone-companion" aria-label="Mochi widget">{companion ?? <a className="phone-mochi-placeholder" href="/settings?section=mochi" aria-label="Meet Mochi">
      {/* Static pose from MochiSvg; the full companion mounts into this slot. */}
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <ellipse cx="50" cy="93" rx="30" ry="4.5" fill="rgb(0 0 0 / .14)"/>
        <path d="M50 16c22 0 38 17 38 42 0 21-15 32-38 32S12 79 12 58c0-25 16-42 38-42z" fill="#f6ecdc" stroke="rgb(60 40 20 / .28)" strokeWidth="1.5"/>
        <ellipse cx="34" cy="32" rx="8" ry="4.5" transform="rotate(-28 34 32)" fill="#fff" opacity=".7"/>
        <g fill="#2b2118"><ellipse cx="38" cy="55" rx="4.2" ry="5.4"/><ellipse cx="62" cy="55" rx="4.2" ry="5.4"/></g>
      </svg><span>Mochi</span></a>}</aside>
  </div></>;
}
