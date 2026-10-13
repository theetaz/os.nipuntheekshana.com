import type { RefObject } from 'react';
import { codePoints, mostlySinhala, noteLine, noteSize, trimInput, type Draft } from '../board';
interface Props {
  draft: Draft; busy: boolean; error?: string; shake: string; textarea: RefObject<HTMLTextAreaElement | null>;
  note: RefObject<HTMLDivElement | null>; onBody(value: string): void; onStatus(value: string): void; children?: React.ReactNode;
}
export function NoteEditor({ draft, busy, error, shake, textarea, note, onBody, onStatus, children }: Props) {
  const count = codePoints(draft.body);
  return <div className="k-compose-note-wrap">
    <div ref={note} className="k-compose-note" data-color={draft.color} data-font={draft.font} data-feedback={shake || undefined}
      style={{ '--note-size': `${noteSize(draft.body, draft.font)}px`, '--note-line': `${noteLine(draft.body)}px` } as React.CSSProperties}>
      <span className="k-compose-tape" aria-hidden="true" />
      <label className="sr-only" htmlFor="board-body">Your note</label>
      <textarea id="board-body" ref={textarea} data-autofocus value={draft.body} readOnly={busy} placeholder="Write something nice…"
        lang={mostlySinhala(draft.body) ? 'si' : undefined} aria-invalid={!!error} aria-describedby={`board-counter${error ? ' board-body-error' : ''}`}
        onBeforeInput={event => {
          const data = (event.nativeEvent as InputEvent).data;
          const el = event.currentTarget;
          if (data && codePoints(el.value.slice(0, el.selectionStart) + data + el.value.slice(el.selectionEnd)) > 300) event.preventDefault();
        }}
        onChange={event => onBody(trimInput(event.target.value, 300))}
        onPaste={event => {
          event.preventDefault(); if (busy) return;
          const el = event.currentTarget; const pasted = event.clipboardData.getData('text');
          const before = el.value.slice(0, el.selectionStart); const after = el.value.slice(el.selectionEnd);
          const full = before + pasted + after;
          const insert = codePoints(full) <= 300 ? pasted : Array.from(pasted).slice(0, Math.max(0, 300 - codePoints(before + after))).join('');
          onBody(before + insert + after);
          if (insert !== pasted) onStatus('Pasted text was trimmed to 300 characters.');
        }} />
      <output id="board-counter" data-limit={count >= 300 ? 'full' : count >= 280 ? 'near' : undefined}>
        {count}/300{count >= 300 ? " · That's the limit" : count >= 280 ? ` · ${300 - count} left` : ''}
      </output>
    </div>
    <span className="sr-only" role="status">{count >= 300 ? "That's the limit" : count >= 280 ? '20 characters left' : ''}</span>
    {error && <p id="board-body-error" className="k-compose-field-error" role="alert">{error}</p>}
    {children}
  </div>;
}
