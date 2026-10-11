import type { TerminalSeed } from '../types';
import { Prompt, Welcome } from './TerminalView';

export function TerminalStatic({ seed }: { seed: TerminalSeed }) {
  return <div className="terminal-body terminal-static" data-theme="dark">
    <Welcome seed={seed} />
    <p className="no-js-only term-dim">JavaScript is off, so this terminal can't run commands.</p>
    <div className="terminal-line"><Prompt cwd="/home/nipun" /><span className="terminal-caret-static" aria-hidden="true" /></div>
    <nav className="no-js-only terminal-static-links" aria-label="Explore without commands">
      <a href="/projects">ls projects</a>{' · '}<a href="/now">cat now.txt</a>{' · '}
      <a href="/about">whoami</a>{' · '}<a href="/messages">contact</a>
    </nav>
  </div>;
}
