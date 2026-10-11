import type { MouseEvent } from 'react';
import type { ShortcutPlatform } from '../../lib/hotkeys-match';
import { shortcutRows } from './shortcuts';
import './p3-5-readme.css';

export const README_SECTIONS = ['welcome', 'getting-around', 'shortcuts', 'plain-page', 'privacy', 'credits'] as const;
export type ReadmeSection = typeof README_SECTIONS[number];
export function readmeSection(value: string | undefined): ReadmeSection | null {
  return README_SECTIONS.find(section => section === value) ?? null;
}

export function ReadmeView({ source, platform = 'other', onSection }: {
  source: string; platform?: ShortcutPlatform; onSection?: (section: ReadmeSection) => void;
}) {
  const followSection = (event: MouseEvent<HTMLAnchorElement>, section: ReadmeSection) => {
    if (!onSection || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); onSection(section);
  };
  return <article className="readme-document">
    <h1>Read me.txt</h1>
    <nav aria-label="In this document">
      <a href="#shortcuts" onClick={event => followSection(event, 'shortcuts')}>Keyboard shortcuts</a>
      <a href="#privacy" onClick={event => followSection(event, 'privacy')}>Privacy</a>
      <a href="#credits" onClick={event => followSection(event, 'credits')}>Credits</a>
    </nav>
    <section aria-labelledby="welcome"><h2 id="welcome" tabIndex={-1}>Welcome</h2>
      <p>Serendib is Nipun Theekshana’s personal site, imagined as a small desktop made in Colombo. Open a window to explore projects, writing and life in Sri Lanka.</p>
    </section>
    <section aria-labelledby="getting-around"><h2 id="getting-around" tabIndex={-1}>Getting around</h2>
      <p>Click an app in the dock to open it, or double-click a desktop icon. Drag a window’s title bar to move it; drag to the left or right edge to snap it, or to the top to maximise it.</p>
      <p>The dock keeps your apps close by: click a running app to bring its window forward, or restore a minimised window. Spotlight searches apps, projects, writing and actions — open it from File → Open or with the shortcuts below.</p>
      <p>On a phone, tap an app to open its page. Every page also works without JavaScript.</p>
    </section>
    <section aria-labelledby="shortcuts"><h2 id="shortcuts" tabIndex={-1}>Keyboard shortcuts</h2>
      <table aria-label="Keyboard shortcuts">
        <thead><tr><th scope="col">Keys</th><th scope="col">Action</th></tr></thead>
        <tbody>{shortcutRows(platform).map(entry => <tr key={`${entry.command}:${entry.shortcut.code}:${!!entry.shortcut.shift}`}>
          <td><kbd>{entry.keys}</kbd></td><td>{entry.action}</td>
        </tr>)}
          <tr><td>Arrows, Home, End, type-ahead</td><td>Move within menus, lists, grids, the dock and desktop icons</td></tr>
          <tr><td><kbd>Space</kbd></td><td>Quick Look (Projects)</td></tr>
        </tbody>
      </table>
      <p className="readme-note">On Mac, ⌘ means Command and ⌥ means Option. Elsewhere, use Ctrl and Alt. Shortcuts use physical key positions, independent of your keyboard layout.</p>
      <p className="readme-note">The slash shortcut works only when you aren’t typing. Option or Alt shortcuts pause in editable fields, except next and previous window and fields that allow them (such as Terminal and search). Escape closes an overlay; it never closes a window.</p>
    </section>
    <section aria-labelledby="plain-page"><h2 id="plain-page" tabIndex={-1}>Prefer a plain page?</h2>
      <p><a href="/readme#simple" onClick={event => event.stopPropagation()}>Switch to simple view</a> for a clean reading document. You can return to the desktop at any time.</p>
    </section>
    <section aria-labelledby="privacy"><h2 id="privacy" tabIndex={-1}>Privacy</h2>
      <p>No cookies and no tracking. Your preferences — theme, wallpaper, window sizes, Mochi’s pet count — stay in this browser’s local storage.</p>
    </section>
    <section aria-labelledby="credits"><h2 id="credits" tabIndex={-1}>Credits</h2>
      <p>Made in Colombo by Nipun Theekshana.</p>
      <ul>
        <li>Sri Lanka outline: geoBoundaries gbOpen, derived from © OpenStreetMap contributors. ODbL 1.0.</li>
        <li>Fonts: Instrument Sans, Fraunces and Martian Mono. SIL Open Font License.</li>
        <li>Icons: Lucide. ISC license.</li>
        <li>Built with Astro, React, Motion, Jotai, Tailwind CSS and three.js.</li>
      </ul>
      <p><a href={source} target="_blank" rel="noreferrer">Source on GitHub ↗</a></p>
    </section>
  </article>;
}
