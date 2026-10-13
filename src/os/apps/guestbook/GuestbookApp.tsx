import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dices, Pin } from 'lucide-react';
import type { AppProps } from '../../registry/apps';
import { alert, announce, playSound, toast, useBeforeClose } from '../../wm/commands';
import { blockedMessage, countdown, fieldMessages, linkMessage, mapPostcardError, postPostcard, turnstileSiteKey, type BoardFailure, type Postcard } from './api';
import { codePoints, colors, DRAFT_KEY, emptyDraft, fonts, hasLink, pinNote, readDraft, readStored, reducedMotion, saveStored, trimInput, validateDraft, type Draft } from './board';
import { loadTurnstile, type Turnstile } from './turnstile';
import { NoteEditor } from './views/NoteEditor';
import { Failure } from './views/Failure';
import './guestbook.css';
export { menus } from './menus';
const DAILY_KEY = 'serendib:board:daily';
export default function GuestbookApp(props: AppProps) {
  const [draft, setDraft] = useState(readDraft); const latest = useRef(draft); latest.current = draft;
  const [failure, setFailure] = useState<BoardFailure | null>(() => readStored(DAILY_KEY) === true
    ? { kind: 'daily', message: "That's five notes today. The board needs a rest; come back tomorrow." } : null); const [posting, setPosting] = useState(false);
  const [verified, setVerified] = useState(false); const [status, setStatus] = useState('');
  const [seconds, setSeconds] = useState(0); const [daily, setDaily] = useState(() => readStored(DAILY_KEY) === true);
  const [shake, setShake] = useState(''); const [randomising, setRandomising] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null); const name = useRef<HTMLInputElement>(null); const email = useRef<HTMLInputElement>(null);
  const random = useRef<HTMLButtonElement>(null); const note = useRef<HTMLDivElement>(null); const widget = useRef<HTMLDivElement>(null);
  const turnstile = useRef<{ api: Turnstile; id: string } | null>(null); const submission = useRef<AbortController | null>(null);
  const sending = useRef<Draft | null>(null); const sent = useRef(false); const stopped = useRef(false);
  const onToken = useRef<(token: string) => void>(() => {}); const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animations = useRef(new Set<Animation>());
  const sitekey = turnstileSiteKey();
  useLayoutEffect(() => { props.setTitle('New note'); props.ready(); }, [props.ready, props.setTitle]);
  useLayoutEffect(() => { if (failure?.fields && !posting) focusField(failure.fields); }, [failure, posting]);
  useEffect(() => { if (!sent.current) saveStored(DRAFT_KEY, draft); }, [draft]);
  useBeforeClose(props.windowId, async () => !latest.current.body.trim() || sent.current || await alert({ windowId: props.windowId,
    title: 'Throw away this note?', primary: 'Discard', cancel: 'Keep writing', danger: true }) === 'primary');
  useEffect(() => {
    stopped.current = false; let disposed = false;
    const failed = () => {
      if (disposed || submission.current) return;
      sending.current = null; setPosting(false); setFailure({ kind: 'turnstile', message: "We couldn't confirm you're human. Try once more." });
      turnstile.current?.api.reset(turnstile.current.id);
    };
    if (!sitekey) setFailure({ kind: 'blocked', message: blockedMessage });
    else void loadTurnstile().then(api => {
      if (disposed || !widget.current) return;
      const id = api.render(widget.current, { sitekey, action: 'postcard', execution: 'execute', appearance: 'interaction-only', 'response-field': false,
        callback: token => onToken.current(token), 'expired-callback': failed, 'error-callback': failed, 'timeout-callback': failed });
      turnstile.current = { api, id }; setVerified(true);
    }).catch(() => { if (!disposed) setFailure({ kind: 'blocked', message: blockedMessage }); });
    return () => {
      disposed = true; stopped.current = true; submission.current?.abort(); clearTimeout(resetTimer.current);
      animations.current.forEach(animation => animation.cancel());
      if (turnstile.current) { turnstile.current.api.remove(turnstile.current.id); turnstile.current = null; }
    };
  }, [sitekey]);
  useEffect(() => {
    if (!seconds) return;
    const deadline = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); setSeconds(left);
      if (!left) { clearInterval(timer); setFailure(null); setStatus('You can pin again.'); }
    }, 250);
    return () => clearInterval(timer);
    // The fixed deadline belongs to this rate response, not each countdown tick.
  }, [failure?.retryAfter]);
  function update(value: Partial<Draft>) {
    setDraft(current => ({ ...current, ...value })); setStatus('');
    if (!['origin', 'blocked', 'daily', 'rate'].includes(failure?.kind ?? '')) setFailure(null);
    setShake('');
  }
  function focusField(fields: Record<string, string>) {
    const field = Object.keys(fields)[0];
    (field === 'body' ? textarea.current : field === 'name' ? name.current : field === 'email' ? email.current : random.current)?.focus();
  }
  function reject(value: BoardFailure) {
    setFailure(value);
    if (['profanity', 'link'].includes(value.kind)) {
      textarea.current?.focus();
      // Restart the CSS sequence even for an identical second rejection.
      const element = note.current;
      if (element) { element.removeAttribute('data-feedback'); void element.offsetWidth; element.dataset.feedback = value.kind; }
      setShake(value.kind); playSound('thunk');
    }
    if (value.kind === 'rate') setSeconds(value.retryAfter!);
    if (value.kind === 'daily') { setDaily(true); saveStored(DAILY_KEY, true); }
  }
  onToken.current = async token => {
    const value = sending.current; if (!value || stopped.current) return; sending.current = null;
    const controller = new AbortController(); submission.current = controller;
    try {
      const result = await postPostcard({ ...value, name: value.name.trim(), body: value.body.trim(), email: value.email.trim(), turnstileToken: token }, controller.signal);
      if (stopped.current) return;
      if (result.status !== 'published' && result.status !== 'pending') { reject({ kind: 'unexpected', message: fieldMessages.request }); return; }
      const pending = result.status === 'pending';
      const item: Postcard = pending ? { id: `pending-${crypto.randomUUID()}`, created_at: Date.now(), name: value.name.trim(), body: value.body.trim(),
        color: value.color, font: value.font, rotation: 0, country: null } : result.postcard;
      sent.current = true; saveStored(DRAFT_KEY, null); latest.current = emptyDraft;
      const board = document.getElementById('ws-board'); const rect = board?.getBoundingClientRect();
      const inView = !!rect && rect.top < innerHeight && rect.bottom > 0 && !!rect.width;
      if (!pending && !reducedMotion() && note.current) {
        const animation = note.current.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: .5 }, { transform: 'scale(1)' }], { duration: 200 });
        animations.current.add(animation); await animation.finished.catch(() => {}); animations.current.delete(animation);
      }
      if (stopped.current) return;
      await pinNote(item, pending, note.current?.getBoundingClientRect());
      if (stopped.current) return;
      announce(pending ? 'Waiting for a check' : 'Pinned');
      toast({ title: pending ? 'Got it. Your note is waiting for a quick check before it goes up.' : `Pinned. Thanks, ${item.name}!`,
        ...(!pending && !inView ? { action: { label: 'Show me', run: () => board?.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth' }) } } : {}) });
      props.close();
      document.querySelector<HTMLElement>('.k-board-compose')?.focus({ preventScroll: true });
    } catch (error) { if (!stopped.current && !controller.signal.aborted) reject(mapPostcardError(error)); }
    finally {
      submission.current = null;
      if (!stopped.current) { setPosting(false); turnstile.current?.api.reset(turnstile.current.id); }
    }
  };
  function submit() {
    if (posting || seconds || daily || !verified || ['origin', 'blocked'].includes(failure?.kind ?? '')) return;
    const value = latest.current; const invalid = validateDraft(value);
    if (Object.keys(invalid).length) { reject({ kind: 'invalid', message: '', fields: Object.fromEntries(Object.keys(invalid).map(key => [key, fieldMessages[key as keyof typeof fieldMessages]])) }); return; }
    if (hasLink(`${value.name}\n${value.body}`)) { reject({ kind: 'link', message: linkMessage }); return; }
    sending.current = { ...value }; setPosting(true); setFailure(null); setStatus('');
    try { turnstile.current!.api.execute(turnstile.current!.id); }
    catch { sending.current = null; setPosting(false); reject({ kind: 'turnstile', message: "We couldn't confirm you're human. Try once more." }); }
  }
  const errors = failure?.fields ?? {};
  const blocked = daily || failure?.kind === 'origin' || failure?.kind === 'blocked';
  return <div className="guestbook-app" ref={props.scrollRootRef as React.RefObject<HTMLDivElement>} data-scroll-root data-sitekey={sitekey}>
    <form className="k-compose" noValidate aria-label="New note" aria-busy={posting} onSubmit={event => { event.preventDefault(); submit(); }}
      onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); submit(); } }}>
      <NoteEditor draft={draft} busy={posting} error={errors.body} shake={shake} textarea={textarea} note={note}
        onBody={body => update({ body })} onStatus={setStatus}>
        {failure?.kind === 'profanity' && <Failure failure={failure} seconds={seconds} retry={submit} />}
      </NoteEditor>
      <div className="k-compose-fields">
        <div><label htmlFor="board-name">Your name</label><input id="board-name" ref={name} value={draft.name} readOnly={posting} required autoComplete="name"
          placeholder="Who's writing?" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'board-name-error' : undefined}
          onChange={event => update({ name: trimInput(event.target.value, 40) })} />
          {errors.name && <span id="board-name-error" className="k-compose-field-error" role="alert">{errors.name}</span>}</div>
        <div><label htmlFor="board-email">Email (optional, never shown)</label><input id="board-email" ref={email} value={draft.email} readOnly={posting} type="email" autoComplete="email"
          placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby={`board-email-help${errors.email ? ' board-email-error' : ''}`}
          onChange={event => update({ email: event.target.value.slice(0, 254) })} />
          {errors.email && <span id="board-email-error" className="k-compose-field-error" role="alert">{errors.email}</span>}</div>
      </div>
      <p id="board-email-help" className="k-compose-help">Only Nipun sees your email, in case he wants to reply.</p>
      <div ref={widget} className="k-compose-verification" aria-label="Human check" />
      {failure?.kind !== 'profanity' && <Failure failure={failure} seconds={seconds} retry={submit} />}
      {Object.entries(errors).filter(([field]) => !['body', 'name', 'email'].includes(field)).map(([field, message]) => <p key={field} id={`board-${field}-error`} className="k-compose-field-error" role="alert">{message}</p>)}
      <p className="k-compose-status" role="status" aria-live="polite">{status}</p>
      <div className="k-compose-actions">
        <button type="button" ref={random} disabled={posting} aria-label="Random colour and font" aria-invalid={!!(errors.color || errors.font)}
          aria-describedby={[errors.color && 'board-color-error', errors.font && 'board-font-error'].filter(Boolean).join(' ') || undefined}
          data-spinning={randomising || undefined} onClick={() => {
          const otherColors = colors.filter(color => color !== draft.color); const otherFonts = fonts.filter(font => font !== draft.font);
          update({ color: otherColors[Math.floor(Math.random() * otherColors.length)], font: otherFonts[Math.floor(Math.random() * otherFonts.length)] });
          setRandomising(true); clearTimeout(resetTimer.current); resetTimer.current = setTimeout(() => setRandomising(false), 400);
        }}><Dices size={18} aria-hidden="true" />Random</button>
        <button type="submit" className="k-compose-pin" disabled={posting || !verified || blocked || !!seconds || !codePoints(draft.body) || !codePoints(draft.name)}>
          {posting && <Pin size={18} aria-hidden="true" />}{posting ? 'Pinning…' : seconds ? countdown(seconds) : 'Pin it'}
        </button>
      </div>
    </form>
  </div>;
}
