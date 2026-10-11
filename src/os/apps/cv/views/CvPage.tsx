import type { ReactNode } from 'react';
import type { ClientProfile } from '../../../types/content';

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;
export const PAGE_GAP = 24;

function Section({ label, children }: { label: string; children: ReactNode }) {
  return <section className="cv-section"><h2>{label}</h2><div>{children}</div></section>;
}

function Experience({ job, thumbnail }: { job: ClientProfile['experience'][number]; thumbnail: boolean }) {
  return <section className="cv-job">
    <h3>{job.href && !thumbnail ? <a href={job.href} target="_blank" rel="noreferrer">{job.org}</a> : job.org}</h3>
    <p className="cv-job-role">{job.role}</p>
    <p className="cv-job-meta">{job.period}{job.location && <> · {job.location}</>}</p>
    <p>{job.summary}</p>
    {job.highlights && <ul>{job.highlights.map(line => <li key={line}>{line}</li>)}</ul>}
    {job.stack && <p className="cv-stack">{job.stack.join(' · ')}</p>}
  </section>;
}

function Contact({ href, thumbnail, children, external = true }: { href: string; thumbnail: boolean; children: ReactNode; external?: boolean }) {
  return thumbnail ? <span>{children}</span> : <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}</a>;
}

export function CvPage({ profile, page, thumbnail = false, id }: {
  profile: ClientProfile; page: 1 | 2; thumbnail?: boolean; id?: string;
}) {
  const openSource = profile.experience.find(job => job.org === 'Prabhava Labs');
  const firstPage = profile.experience.filter(job => job.org === 'PerfectUs Technologies' || job.org === 'KeenEye Solutions');
  const remaining = profile.experience.filter(job => !firstPage.includes(job) && job !== openSource);
  return <article id={id} data-page={page} className={`cv-paper ${thumbnail ? 'cv-thumbnail-page' : 'cv-page'}`} aria-label={`CV page ${page} of 2`}>
    {page === 1 ? <>
      <header className="cv-heading">
        {thumbnail ? <div className="cv-name">{profile.site.name}</div> : <h1>{profile.site.name}</h1>}
        <p className="cv-role">{profile.site.role} · {profile.site.tagline}</p>
        <div className="cv-contact">
          <Contact href={`mailto:${profile.site.email}`} thumbnail={thumbnail} external={false}>{profile.site.email}</Contact>
          <Contact href="https://nipuntheekshana.com" thumbnail={thumbnail}>nipuntheekshana.com</Contact>
          <Contact href={profile.links.github} thumbnail={thumbnail}>GitHub / theetaz</Contact>
          <Contact href={profile.links.linkedin} thumbnail={thumbnail}>LinkedIn / nipun-theekshana</Contact>
          <span>{profile.site.location}</span>
        </div>
      </header>
      <Section label="Summary">
        <p>{profile.summary}</p>
        <dl className="cv-highlights">{profile.highlights.map(item => <div key={item.label}><dt>{item.value}</dt><dd>{item.label}</dd></div>)}</dl>
      </Section>
      <Section label="Competencies"><ul className="cv-competencies">{profile.competencies.map(item => <li key={item}>{item}</li>)}</ul></Section>
      <Section label="Experience">{firstPage.map(job => <Experience key={job.org} job={job} thumbnail={thumbnail} />)}</Section>
    </> : <>
      <Section label="Experience">{remaining.map(job => <Experience key={job.org} job={job} thumbnail={thumbnail} />)}</Section>
      {openSource && <Section label="Open source"><Experience job={openSource} thumbnail={thumbnail} /></Section>}
      <Section label="Skills"><dl className="cv-skills">{profile.skills.map(group => <div key={group.group}><dt>{group.group}</dt><dd>{group.items.join(' · ')}</dd></div>)}</dl></Section>
      <Section label="Education"><h3>{profile.education.school}</h3><p>{profile.education.degree}</p><p className="cv-job-meta">{profile.education.period} · {profile.education.location}</p></Section>
    </>}
    <footer className="cv-page-footer"><span>{profile.site.name} · Curriculum vitae</span><span>{page} / 2</span></footer>
  </article>;
}
