import type { CSSProperties, KeyboardEvent, RefObject } from 'react';
import { CODENAME, VERSION } from '../../../config';
import { HELP } from '../commands/help';
import type { Line, TerminalSeed } from '../types';
import { displayPath } from '../vfs';

export const BANNER = `Kottu OS ${VERSION} "${CODENAME}" · nsh, the Nipun shell`;
/** Phone sheets offer these above the keyboard (DESIGN §13.3). */
export const QUICK_COMMANDS = ['help', 'ls', 'projects', 'now', 'neofetch', 'contact'] as const;
export const HINT = 'Type help to see what I can do. Tab completes. ↑ and ↓ walk through history.';
export function Prompt({ cwd }: { cwd: string }) {
  return <><span className="term-user">nipun</span><span className="term-dim">@</span><span className="term-host">kottu</span>
    <span className="term-dim">:</span><span className="term-path">{displayPath(cwd)}</span>{'$ '}</>;
}
export function Output({ lines }: { lines: readonly Line[] }) {
  return <>{lines.map((line, i) => <div className="terminal-line" key={i}>{line.length ? line.map((part, j) => part.href
    ? <a key={j} href={part.href} className="term-link" target={/^(https?:|mailto:)/.test(part.href) ? '_blank' : undefined}
      rel={/^(https?:|mailto:)/.test(part.href) ? 'noopener noreferrer' : undefined}>{part.text}</a>
    : <span key={j} className={`term-${part.tone ?? 'ink'}`}>{part.text}</span>) : '\u00a0'}</div>)}</>;
}
export function Welcome({ seed }: { seed: TerminalSeed }) {
  return <div className="terminal-welcome">
    <h1 className="sr-only">Terminal</h1>
    <p>{BANNER}</p><p className="term-dim">{HINT}</p><p className="term-dim">{seed.login}</p>
    <div className="terminal-line"><Prompt cwd="/home/nipun" />help</div>
    <pre className="terminal-help">{HELP}</pre>
  </div>;
}
export interface TerminalViewProps {
  seed: TerminalSeed; cwd: string; lines: readonly Line[]; welcome: boolean; value: string; busy: boolean;
  focused: boolean; fontSize: number | null; fontFamily?: string; caret: number; announcement: { text: string; seq: number }; hintId: string;
  scrollRef: RefObject<HTMLElement | null>; inputRef: RefObject<HTMLInputElement | null>;
  onChange(value: string, cursor: number): void;
  onCaretChange(cursor: number): void;
  onKeyDown(event: KeyboardEvent<HTMLInputElement>): void;
  onQuickCommand?(source: string): void;
}
export function TerminalView(props: TerminalViewProps) {
  const { scrollRef, inputRef, seed, cwd, lines, welcome, value, busy, focused, fontSize, caret, announcement, hintId } = props;
  return <><div ref={scrollRef as RefObject<HTMLDivElement>} data-scroll-root className="terminal-body" data-focused={focused}
    style={{ ...fontSize && { '--terminal-size': `${fontSize}px`, '--terminal-zoom': fontSize / 16 }, fontFamily: props.fontFamily } as CSSProperties}
    onClick={event => {
      if (!(event.target as Element).closest('a, button, input') && !window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
    }}>
    <div role="log" aria-label="Terminal output" aria-live="polite" aria-relevant="additions" className="terminal-output">
      <div aria-live="off">{welcome && <Welcome seed={seed} />}
        <Output lines={lines} />
      </div>
      <span key={announcement.seq} className="sr-only">{announcement.text}</span>
    </div>
    <div className="terminal-input-line">
      <span aria-hidden="true"><Prompt cwd={cwd} /></span>
      <div className="terminal-input-wrap">
        <input ref={inputRef} data-autofocus data-os-shortcuts="allow" aria-label="Terminal command" aria-describedby={hintId}
          autoCapitalize="off" autoComplete="off" spellCheck={false} value={value} readOnly={busy} aria-busy={busy}
          onChange={event => props.onChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
          onSelect={event => props.onCaretChange(event.currentTarget.selectionStart ?? 0)}
          onKeyDown={props.onKeyDown} />
        <span aria-hidden="true" className="terminal-caret" style={{ left: `${caret}ch` }} />
      </div>
    </div>
    <span id={hintId} className="sr-only">Enter runs. Tab completes. Shift Tab moves focus. Up and Down recall history. Control C cancels. Control L clears.</span>
  </div>
  {props.onQuickCommand && <div className="terminal-quick" role="group" aria-label="Quick commands" style={{ fontFamily: props.fontFamily }}>
    {QUICK_COMMANDS.map(source => <button key={source} type="button" disabled={busy}
      // Keep focus (and the on-screen keyboard) on the command line while a chip runs.
      onMouseDown={event => { if (document.activeElement === inputRef.current) event.preventDefault(); }}
      onClick={() => props.onQuickCommand?.(source)}>{source}</button>)}
  </div>}</>;
}
