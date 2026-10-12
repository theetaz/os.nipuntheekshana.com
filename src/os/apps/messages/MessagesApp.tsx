import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { AppProps } from '../../registry/apps';
import { useAppData } from '../../lib/fetch-json';
import * as mochi from '../../mochi/api';
import { reducedMotionAtom } from '../../state/atoms';
import type { ClientProfile } from '../../types/content';
import { alert, toast, useAppCommands, useAppMenuState, useBeforeClose } from '../../wm/commands';
import { appendMessages, parseSession, SESSION_KEY, type ConversationSession } from './session';
import { createScriptEngine, initialTranscript, MAX_INPUT, replyDelay, type ConversationEngine, type ThreadId } from './script';
import { MessagesView } from './views/MessagesView';
export { menus } from './menus';

export type MessagesData = ClientProfile & { messagesAt?: number };
const scriptEngine = createScriptEngine();
const messageId = () => `message-${crypto.randomUUID()}`;

function Conversation({ profile, engine = scriptEngine, ...props }: AppProps & { profile: MessagesData; engine?: ConversationEngine }) {
  const reducedMotion = useAtomValue(reducedMotionAtom);
  const [session, setSession] = useState<ConversationSession>(() => ({ version: 1, selected: 'nipun',
    threads: { nipun: initialTranscript(profile, profile.messagesAt ?? Date.now()),
      mochi: [{ id: 'mochi-greeting', role: 'assistant', text: 'A little desk company. A pet or a cup of tea is always welcome.', at: profile.messagesAt ?? Date.now() }] },
    drafts: { nipun: '', mochi: '' }, pending: null }));
  const [restored, setRestored] = useState(false);
  const [requesting, setRequesting] = useState<ThreadId | null>(null);
  const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const scrollToEnd = useRef(false);
  const readyCalled = useRef(false);
  const selected = session.selected;
  const draft = session.drafts[selected];
  const busy = !!session.pending || !!requesting;

  useLayoutEffect(() => {
    if (readyCalled.current) return;
    readyCalled.current = true;
    const staticScroll = document.querySelector<HTMLElement>('#static-window[data-app="messages"] .messages-log')?.scrollTop ?? 0;
    props.ready();
    if (props.scrollRootRef.current) props.scrollRootRef.current.scrollTop = staticScroll;
  }, [props.ready, props.scrollRootRef]);
  useEffect(() => {
    try { const saved = parseSession(sessionStorage.getItem(SESSION_KEY)); if (saved) setSession(saved); }
    catch { /* Storage can be denied. The chat still works. */ }
    setRestored(true);
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
    catch { /* Persistence is optional when storage is denied or full. */ }
  }, [session, restored]);
  useEffect(() => {
    const pending = session.pending;
    if (!pending) return;
    const timer = setTimeout(() => {
      scrollToEnd.current = true;
      setSession(value => value.pending !== pending ? value : { ...value, pending: null,
        threads: { ...value.threads, [pending.thread]: appendMessages(value.threads[pending.thread],
          { id: messageId(), role: 'assistant', at: Date.now(), ...pending.reply }) } });
      locked.current = false;
    }, Math.max(0, Math.min(reducedMotion ? 300 : 1400, pending.dueAt - Date.now())));
    return () => clearTimeout(timer);
  }, [session.pending, reducedMotion]);
  useEffect(() => {
    // A log read to its end stays there while it resizes, so an on-screen keyboard that
    // shrinks the sheet (visualViewport) keeps the latest bubbles above the composer.
    const log = props.scrollRootRef.current; if (!log) return;
    let atEnd = false;
    const track = () => { atEnd = log.scrollHeight - log.clientHeight - log.scrollTop < 24; };
    const observer = new ResizeObserver(() => { if (atEnd) log.scrollTop = log.scrollHeight; });
    track(); log.addEventListener('scroll', track, { passive: true }); observer.observe(log);
    return () => { observer.disconnect(); log.removeEventListener('scroll', track); };
  }, [props.scrollRootRef]);
  useLayoutEffect(() => {
    if (!scrollToEnd.current || !props.scrollRootRef.current) return;
    props.scrollRootRef.current.scrollTop = props.scrollRootRef.current.scrollHeight;
    scrollToEnd.current = false;
  }, [session.threads, requesting, session.pending, props.scrollRootRef]);

  async function send(input: string) {
    const text = input.trim().slice(0, MAX_INPUT);
    if (!text || busy || locked.current) return;
    locked.current = true;
    const target = selected;
    const abort = new AbortController(); controller.current = abort;
    setRequesting(target); scrollToEnd.current = true;
    setSession(value => ({ ...value, drafts: { ...value.drafts, [target]: input === draft ? '' : value.drafts[target] },
      threads: { ...value.threads, [target]: appendMessages(value.threads[target], { id: messageId(), role: 'user', text, at: Date.now() }) } }));
    try {
      const reply = await engine.reply({ thread: target, text, history: session.threads[target], signal: abort.signal },
        { profile, now: () => new Date(), mochi });
      if (abort.signal.aborted) return;
      setSession(value => ({ ...value, pending: { thread: target, reply, dueAt: Date.now() + replyDelay(reply.text, reducedMotion) } }));
    } catch {
      if (abort.signal.aborted) return;
      locked.current = false;
      setSession(value => ({ ...value, drafts: { ...value.drafts, [target]: text } }));
      toast({ title: "This reply didn't arrive.", body: 'Your text is back in the composer. Try again or email Nipun.' });
    } finally { if (!abort.signal.aborted) setRequesting(null); }
  }
  function select(id: ThreadId) { setSession(value => ({ ...value, selected: id })); }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast({ title: 'Text copied' }); }
    catch { toast({ title: "Couldn't copy the text", body: 'Select the message and copy it, or use Open email.' }); }
  }
  useBeforeClose(props.windowId, async () => {
    if (!Object.values(session.drafts).some(text => text.trim())) return true;
    if (await alert({ windowId: props.windowId, title: 'Discard your message?', body: 'Your unsent text will be discarded.',
      primary: 'Discard', cancel: 'Cancel', danger: true }) !== 'primary') return false;
    const cleared = { ...session, drafts: { nipun: '', mochi: '' } };
    setSession(cleared);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(cleared)); } catch { /* Storage may be unavailable. */ }
    return true;
  });
  useAppCommands(props.windowId, command => {
    if (command === 'messages.send') { void send(draft); return true; }
    if (command === 'messages.nipun' || command === 'messages.mochi') { select(command === 'messages.nipun' ? 'nipun' : 'mochi'); return true; }
    if (command === 'messages.compose') { props.scrollRootRef.current?.closest('.messages-app')?.querySelector<HTMLTextAreaElement>('textarea')?.focus(); return true; }
    return false;
  });
  const menuState = useMemo(() => ({ 'messages.send': { disabled: !draft.trim() || busy },
    'messages.nipun': { checked: selected === 'nipun' }, 'messages.mochi': { checked: selected === 'mochi' } }), [draft, busy, selected]);
  useAppMenuState(props.windowId, menuState);
  return <MessagesView profile={profile} selected={selected} threads={session.threads} draft={draft} mode={engine.mode}
    typing={session.pending?.thread ?? requesting} busy={busy} scrollRootRef={props.scrollRootRef} onSelect={select}
    onChange={text => setSession(value => ({ ...value, drafts: { ...value.drafts, [value.selected]: text } }))}
    onSend={text => { void send(text); }} onCopy={text => { void copy(text); }} />;
}

export default function MessagesApp(props: AppProps & { engine?: ConversationEngine }) {
  const { data, error, retry } = useAppData<MessagesData>('messages:index', '/data/profile.json', props.initialData as MessagesData | null);
  const notified = useRef(false);
  const ready = useCallback(() => { if (!notified.current) { notified.current = true; props.ready(); } }, [props.ready]);
  useLayoutEffect(() => { if (error && !data) ready(); }, [error, data, ready]);
  if (data) return <Conversation {...props} profile={data} ready={ready} />;
  return <div ref={props.scrollRootRef as React.RefObject<HTMLDivElement>} data-scroll-root className="messages-loading" role="status">
    <h1>Messages</h1><p>{error ? "This app didn't load. You can still email Nipun." : 'Opening the conversation…'}</p>
    {error && <><button type="button" onClick={retry}>Try again</button><a href="mailto:theekshana2@gmail.com">Email Nipun</a></>}
  </div>;
}
