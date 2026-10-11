import type { ReactNode } from 'react';
import type { DesktopProps } from '../Desktop';
import { MochiSvg } from '../mochi/MochiSvg';
export function HomeWidgets({ home, companion }: { home: DesktopProps['home']; companion?: ReactNode }) {
  const updated = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${home.nowUpdated}T00:00:00Z`)).replace('Sept', 'Sep');
  return <><article className="phone-ticket" aria-labelledby="phone-name">
    <p className="phone-ticket-eyebrow">Sri Lanka · Since 2016</p><h1 id="phone-name">Nipun Theekshana</h1><p lang="si">නිපුන් තීක්ෂණ</p><p className="phone-ticket-role">Engineer · founder · Colombo</p>
    <a className="stretched-link" href="/about" aria-label="About me"><span className="sr-only">About me</span></a>
  </article><div className="phone-widgets">
    <aside className="phone-now" aria-labelledby="phone-now-title"><h2 id="phone-now-title">Now</h2><ol>{home.nowItems.slice(0, 2).map((item, i) => <li key={item}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span>{item}</span></li>)}</ol><footer><time dateTime={home.nowUpdated}>Updated {updated}</time><a className="stretched-link" href="/now" aria-label="Read all current updates">›</a></footer></aside>
    <aside className="phone-companion" aria-label="Mochi widget">{companion ?? <a className="phone-mochi-placeholder" href="/settings?section=mochi" aria-label="Meet Mochi"><MochiSvg/><span>Mochi</span></a>}</aside>
  </div></>;
}
