import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AppProps } from '../../registry/apps';
import { getPostcards, postPostcard, PostcardError, type Postcard, type PostcardFailure, type PostcardPage, type PostcardColor, type PostcardFont } from './api';
import { loadTurnstile } from './turnstile';
export { menus } from './menus';
export default function GuestbookApp({ ready, scrollRootRef, initialData }: AppProps) {
  const [items, setItems] = useState<Postcard[]>((initialData as PostcardPage | null)?.items ?? []);
  const [next, setNext] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false);
  const [compose, setCompose] = useState(false); const [token, setToken] = useState(''); const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false); const [message, setMessage] = useState(''); const [failure, setFailure] = useState<PostcardFailure | null>(null);
  const widget = useRef<HTMLDivElement>(null); const submission = useRef<AbortController | null>(null);
  const [widgetAttempt, setWidgetAttempt] = useState(0); const [refresh, setRefresh] = useState(0);
  useLayoutEffect(() => ready(), [ready]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError(false);
    void getPostcards(null, controller.signal).then(page => { setItems(page.items); setNext(page.next); }).catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => () => submission.current?.abort(), []);
  useEffect(() => {
    if (!compose) return; let disposed = false; let remove: (() => void) | undefined; const controller = new AbortController();
    setToken('');
    // Public site key is baked into the prerendered route, never a secret.
    const sitekey = document.querySelector<HTMLMetaElement>('meta[name="turnstile-site-key"]')?.content ?? '';
    if (!sitekey) { setMessage('Postcards are not accepting submissions yet.'); return; }
    void loadTurnstile().then(turnstile => {
      if (disposed || !widget.current) return;
      const id = turnstile.render(widget.current, { sitekey, action: 'postcard', callback: setToken,
        'expired-callback': () => setToken(''), 'error-callback': () => { setToken(''); setMessage('Verification failed. Please try again.'); } });
      remove = () => turnstile.remove(id);
    }).catch(() => { if (!disposed) setMessage('Verification could not load. Please try again.'); });
    return () => { disposed = true; controller.abort(); remove?.(); };
  }, [compose, widgetAttempt]);
  const errorText = failure?.error === 'profanity' ? failure.joke : failure?.error === 'rate_limited'
    ? `Too many postcards. Try again in ${failure.retryAfter} seconds.` : failure?.error === 'link' ? 'Please leave links out of your name and postcard.'
      : failure?.error === 'turnstile' ? 'Please complete verification again.' : failure ? 'Could not post your postcard. Please check the form and try again.' : '';
  return <div ref={scrollRootRef as React.RefObject<HTMLDivElement>} data-scroll-root className="static-content"><div className="static-document">
    <h1>Postcards</h1>
    {loading && <p role="status">Loading postcards…</p>}
    {loadError && <p role="alert">Could not load postcards. <button onClick={() => setRefresh(value => value + 1)}>Try again</button></p>}
    {!loading && !loadError && !items.length && <p>No postcards yet. Leave the first hello.</p>}
    <ul aria-label="Published postcards">{items.map(item => <li key={item.id}><p>{item.body}</p><p>{item.name} · {new Date(item.created_at).toLocaleDateString()}</p></li>)}</ul>
    {next && <button disabled={loading} onClick={() => { setLoading(true); void getPostcards(next).then(page => { setItems(items => [...items, ...page.items]); setNext(page.next); }).catch(() => setLoadError(true)).finally(() => setLoading(false)); }}>Show older</button>}
    {!compose && <button disabled={loading} onClick={() => { setCompose(true); setMessage(''); }}>Write a postcard</button>}
    {compose && <form onSubmit={async event => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const controller = new AbortController(); submission.current = controller;
      setPosting(true); setFailure(null); setMessage('Posting…');
      try {
        const result = await postPostcard({ name: String(form.get('name')), body, email: String(form.get('email') ?? ''), color: form.get('color') as PostcardColor, font: form.get('font') as PostcardFont, turnstileToken: token }, controller.signal);
        if (result.status === 'published') { setItems(items => [result.postcard, ...items]); setMessage('Your postcard is published.'); }
        else setMessage(result.message);
        setCompose(false); setBody('');
      } catch (error) {
        if (!controller.signal.aborted) { if (error instanceof PostcardError) setFailure(error.detail); setMessage('Could not post. Please try again.'); }
      } finally { if (!controller.signal.aborted) { setPosting(false); setToken(''); setWidgetAttempt(value => value + 1); } }
    }}>
      <label>Name <input name="name" required maxLength={40} autoComplete="name" /></label>
      <label>Postcard <textarea name="body" required value={body} onChange={event => setBody(event.target.value)} /></label>
      <p>{Array.from(body).length}/300</p>
      <label>Email (optional, private) <input name="email" type="email" maxLength={254} autoComplete="email" /></label>
      <label>Color <select name="color">{['paper', 'thambili', 'lagoon', 'lotus', 'tea'].map(color => <option key={color}>{color}</option>)}</select></label>
      <label>Font <select name="font">{['sans', 'serif', 'handwriting'].map(font => <option key={font}>{font}</option>)}</select></label>
      <div ref={widget} aria-label="Postcard verification" />
      {failure?.error === 'invalid' && <ul aria-label="Form errors">{Object.entries(failure.fields).map(([field, text]) => <li key={field}>{field}: {text}</li>)}</ul>}
      <button type="button" onClick={() => { submission.current?.abort(); setPosting(false); setCompose(false); }}>Cancel</button>
      <button disabled={posting || !token}>Post</button>
      <button type="button" disabled={posting} onClick={() => setWidgetAttempt(value => value + 1)}>Retry verification</button>
    </form>}
    {message && <p role="status">{message}</p>}{errorText && <p role="alert">{errorText}</p>}
  </div></div>;
}
