import type { MouseEvent } from 'react';
export interface HomeHeaderProps { onMenu?: (event: MouseEvent<HTMLAnchorElement>) => void; onSearch?: (event: MouseEvent<HTMLAnchorElement>) => void; onAppearance?: (event: MouseEvent<HTMLAnchorElement>) => void }
export function HomeHeader(props: HomeHeaderProps) {
  return <header className="phone-home-header" role="group" aria-label="Home header">
    <a href="/" className="phone-wordmark" aria-label="Serendib menu" aria-haspopup={props.onMenu ? 'menu' : undefined} onClick={props.onMenu}>serendib</a>
    <nav aria-label="Phone controls"><a href="/readme#simple" aria-label="Spotlight" onClick={props.onSearch}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></a>
      <a href="/settings?section=appearance" aria-label="Appearance" onClick={props.onAppearance}><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor"/></svg></a></nav>
  </header>;
}
