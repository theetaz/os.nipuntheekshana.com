import type { ClientProfile } from '../../../types/content';

export function Toolbox({ skills }: { skills: ClientProfile['skills'] }) {
  return <>
    <h2 className="about-heading">Toolbox</h2>
    <div className="about-toolbox">
      {skills.map(group => <section key={group.group}>
        <h3>{group.group}</h3>
        <ul className="about-chips">{group.items.map(skill => <li key={skill}>{skill}</li>)}</ul>
      </section>)}
    </div>
  </>;
}
