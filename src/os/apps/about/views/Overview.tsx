import type { MouseEventHandler } from 'react';
import type { ClientProfile } from '../../../types/content';
import { Img } from '../../../ui/Img';

export interface OverviewProps {
  profile: ClientProfile;
  at: string;
  storyHref: string;
  interactive?: boolean;
  onStory?: MouseEventHandler<HTMLAnchorElement>;
  onEmail?: MouseEventHandler<HTMLAnchorElement>;
  onAvatarClick?: () => void;
}

export function Overview({ profile, at, storyHref, interactive, onStory, onEmail, onAvatarClick }: OverviewProps) {
  const { site, highlights, education, socials, experience, links } = profile;
  const date = new Date(at);
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: site.timezone }).format(date));
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: site.timezone }).format(date);
  const founder = experience.find(entry => entry.org === 'Prabhava Labs');
  const teams = highlights.find(entry => entry.label === 'Engineers led');
  const shipped = highlights.find(entry => entry.label === 'Smart contracts delivered');
  const incidents = highlights.find(entry => entry.label === 'Critical security incidents');
  const serial = socials.find(social => social.href === links.github)?.handle;
  const rows = [
    ['Role', site.role],
    ['Also', founder && `${founder.role.replace(' (non-profit)', '')}, ${founder.org}${founder.role.includes('(non-profit)') ? ' (non-profit)' : ''}`],
    ['In production', `${Math.max(0, year - site.careerStart)} years, since ${site.careerStart}`],
    ['Teams led', teams && `${teams.value} engineers`],
    ['Shipped', shipped && `${shipped.value} smart contracts`],
    ['Incidents', incidents && `${incidents.value} critical security incidents`],
    ['Based in', <>{site.location} · <time dateTime={at}>{time}</time> there</>],
    ['Education', `${education.degree}, ${education.school}`],
    ['Serial no.', serial],
  ] as const;
  const avatar = <Img image={profile.avatar} loading="eager" sizes="128px" className="about-avatar" />;

  return <>
    <div className="about-identity">
      {interactive
        ? <button className="about-avatar-button" type="button" aria-label={`${site.name}'s portrait`} onClick={onAvatarClick}>{avatar}</button>
        : <span className="about-avatar-button">{avatar}</span>}
      <div>
        <h1>{site.name}</h1>
        <div className="about-native" lang="si">{site.nameSinhala}</div>
        <p className="about-edition">Engineer &amp; founder · edition {site.careerStart}</p>
      </div>
    </div>
    <dl className="about-specs">
      {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <div className="about-actions">
      <a className="about-primary" data-accent-filled="true" href="/cv">Read the CV</a>
      <a className="about-secondary" href={`mailto:${site.email}`} onClick={onEmail}>Email</a>
      <a className="about-secondary" href={links.github} target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
      <a className="about-secondary" href={links.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
    </div>
    <a className="about-more" href={storyHref} onClick={onStory}>More info…</a>
  </>;
}
