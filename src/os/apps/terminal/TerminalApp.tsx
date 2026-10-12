import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from 'jotai';
import type { AppProps } from '../../registry/apps';
import { accentAtom, resolvedThemeAtom, soundAtom, terminalHistoryAtom, themePrefAtom, wallpaperAtom } from '../../state/atoms';
import { openApp, runCommand, useAppCommands, useAppMenuState } from '../../wm/commands';
import { TERMINAL_COMMANDS } from '../../url/url';
import { api } from '../../mochi/api';
import { buildVfs, displayPath, HOME, loadTerminalActivity, loadTerminalData } from './vfs';
import { appendHistory, capScrollback, dispatch } from './shell';
import { complete } from './complete';
import { loginText } from './commands/system';
import { KERNEL } from './build-info';
import { outputText, segment, type Line, type ShellContext, type TerminalSeed } from './types';
import { TerminalView } from './views/TerminalView';
import './terminal.css';
export { menus } from './menus';

export default function TerminalApp(props: AppProps) {
  const { ready, scrollRootRef, windowId, focused } = props;
  const store = useStore(); const inputRef = useRef<HTMLInputElement>(null);
  const [seed] = useState<TerminalSeed>(() => props.initialData as TerminalSeed ?? {
    login: loginText(new Date(), Number(windowId.split('~')[1] ?? 1)), kernel: KERNEL,
  });
  const [fontFamily] = useState(() => seed.fontUrl ? undefined
    : `${getComputedStyle(document.documentElement).getPropertyValue('--font-martian').split(',')[0]}, 'Serendib Terminal fallback', monospace`);
  const [cwd, setCwd] = useState(HOME); const cwdRef = useRef(HOME);
  const [lines, setLines] = useState<Line[]>([]); const [welcome, setWelcome] = useState(true);
  const [value, setValue] = useState(''); const [caret, setCaret] = useState(0); const [busy, setBusy] = useState(false);
  // null keeps the stylesheet size: 13 px in windows, 12 px in phone sheets.
  const [fontSize, setFontSize] = useState<number | null>(null); const [announcement, setAnnouncement] = useState({ text: '', seq: 0 });
  const columns = useRef(80); const controller = useRef<AbortController | null>(null); const mounted = useRef(true);
  const historyIndex = useRef<number | null>(null); const draft = useRef(''); const previousTab = useRef<string | null>(null);
  const pendingSelection = useRef<{ value: string; cursor: number } | null>(null);
  const consumed = useRef<string | null>(null); const readyCalled = useRef(false);
  const propsRef = useRef(props); propsRef.current = props;
  const clear = useCallback(() => { setLines([]); setWelcome(false); }, []);
  const announce = useCallback((text: string) => setAnnouncement(previous => ({ text: text.slice(0, 200), seq: previous.seq + 1 })), []);
  const change = useCallback((next: string, cursor = next.length) => {
    pendingSelection.current = null; setValue(next); setCaret(cursor);
  }, []);
  const replaceInput = useCallback((next: string, cursor = next.length) => {
    pendingSelection.current = { value: next, cursor }; setValue(next); setCaret(cursor);
    if (inputRef.current?.value === next) {
      inputRef.current.setSelectionRange(cursor, cursor); pendingSelection.current = null;
    }
  }, []);
  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (selection && inputRef.current?.value === selection.value) {
      inputRef.current.setSelectionRange(selection.cursor, selection.cursor); pendingSelection.current = null;
    }
  }, [value, caret]);
  const context = useCallback((signal?: AbortSignal): ShellContext => ({
    cwd: cwdRef.current, columns: columns.current, history: store.get(terminalHistoryAtom), data: loadTerminalData,
    activity: loadTerminalActivity, now: () => new Date(), signal,
    system: () => ({ theme: store.get(resolvedThemeAtom), appearance: store.get(themePrefAtom),
      wallpaper: store.get(wallpaperAtom), accent: store.get(accentAtom), sound: store.get(soundAtom), kernel: seed.kernel }),
    run: command => runCommand(command, 'terminal'), open: openApp,
    external: url => { window.open(url, '_blank', 'noopener,noreferrer'); }, close: () => propsRef.current.close(), mochi: api,
  }), [seed.kernel, store]);
  const run = useCallback(async (source: string, record = true) => {
    if (!source.trim() || controller.current) return;
    const active = new AbortController(); controller.current = active; setBusy(true);
    if (record) store.set(terminalHistoryAtom, previous => appendHistory(previous, source));
    historyIndex.current = null; draft.current = ''; previousTab.current = null; change('');
    const prompt: Line = [segment('nipun', 'user'), segment('@', 'dim'), segment('serendib', 'host'),
      segment(` ${displayPath(cwdRef.current)}`, 'path'), segment(` % ${source}`)];
    setLines(previous => capScrollback([...previous, prompt]));
    try {
      const result = await dispatch(source, context(active.signal));
      if (!mounted.current || active.signal.aborted) return;
      cwdRef.current = result.cwd; setCwd(result.cwd);
      if (result.clear) setWelcome(false);
      setLines(previous => capScrollback([...(result.clear ? [] : previous), ...result.lines]));
      announce(outputText(result.lines));
    } finally {
      if (controller.current === active) { controller.current = null; if (mounted.current) setBusy(false); }
    }
  }, [announce, change, context, store]);
  useLayoutEffect(() => { if (!readyCalled.current) { readyCalled.current = true; ready(); } }, [ready]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    const element = scrollRootRef.current; if (!element) return;
    const measure = () => {
      const width = element.clientWidth; const height = element.clientHeight;
      const probe = document.createElement('span'); probe.textContent = '0000000000';
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'; element.append(probe);
      const charWidth = probe.getBoundingClientRect().width / 10 || 8; probe.remove();
      columns.current = Math.max(1, Math.floor((width - 28) / charWidth));
      const rows = Math.max(1, Math.floor((height - 24) / 20));
      const instance = windowId.split('~')[1];
      propsRef.current.setTitle(`nipun — nsh${instance ? ` ${instance}` : ''} — ${columns.current}×${rows}`);
    };
    // Output read to its end stays there when the body shrinks (an on-screen keyboard) or when
    // wrapped lines finish laying out after the commit that scrolled to them.
    // The scroll event from re-anchoring arrives asynchronously; content may grow again before it
    // does (late fonts or wrapping), so that event must not clear the anchor.
    let atEnd = false; let anchoring = false;
    const track = () => {
      if (anchoring) { anchoring = false; return; }
      atEnd = element.scrollHeight - element.clientHeight - element.scrollTop < 20;
    };
    track();
    const observer = new ResizeObserver(entries => {
      if (atEnd) {
        const before = element.scrollTop; element.scrollTop = element.scrollHeight;
        if (element.scrollTop !== before) anchoring = true;
      }
      if (entries.some(entry => entry.target === element)) measure();
    });
    observer.observe(element); if (element.firstElementChild) observer.observe(element.firstElementChild);
    measure(); element.addEventListener('scroll', track, { passive: true });
    let active = true; void document.fonts.ready.then(() => { if (active) measure(); });
    return () => { active = false; observer.disconnect(); element.removeEventListener('scroll', track); };
  }, [fontSize, scrollRootRef, windowId]);
  useEffect(() => {
    const command = props.query.cmd;
    if (!command) { consumed.current = null; return; }
    if (consumed.current === command) return;
    consumed.current = command;
    const query = { ...props.query }; delete query.cmd;
    if (TERMINAL_COMMANDS.some(allowed => command === allowed)) {
      void run(command, false).catch(() => {}).finally(() => { if (mounted.current) propsRef.current.setQuery(query, { replace: true }); });
    } else propsRef.current.setQuery(query, { replace: true });
  }, [props.query, run]);
  useLayoutEffect(() => {
    const element = scrollRootRef.current; if (element && lines.length) element.scrollTop = element.scrollHeight;
    if (lines.length === 600) setWelcome(false);
  }, [lines, scrollRootRef]);
  const resize = useCallback((delta: 1 | -1) => setFontSize(size => {
    const current = size ?? (parseFloat(scrollRootRef.current ? getComputedStyle(scrollRootRef.current).fontSize : '') || 13);
    return Math.max(11, Math.min(17, current + delta));
  }), [scrollRootRef]);
  useAppCommands(windowId, command => {
    if (command === 'terminal.bigger') resize(1);
    else if (command === 'terminal.smaller') resize(-1);
    else if (command === 'terminal.clear') clear(); else return false;
    return true;
  });
  const menuState = useMemo(() => ({ 'terminal.bigger': { disabled: (fontSize ?? 13) >= 17 },
    'terminal.smaller': { disabled: (fontSize ?? 13) <= 11 } }), [fontSize]);
  useAppMenuState(windowId, menuState);
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.ctrlKey && !event.altKey && !event.metaKey && event.code === 'KeyC') {
      if (window.getSelection()?.toString()) return;
      event.preventDefault(); event.stopPropagation(); controller.current?.abort(); controller.current = null; setBusy(false);
      setLines(previous => capScrollback([...previous, [segment(`${value}^C`, 'dim')]])); change(''); announce('^C'); historyIndex.current = null; return;
    }
    if (event.ctrlKey && !event.altKey && !event.metaKey && event.code === 'KeyL') { event.preventDefault(); event.stopPropagation(); clear(); return; }
    if (event.altKey && ['Equal', 'Minus'].includes(event.code)) {
      event.preventDefault(); event.stopPropagation(); resize(event.code === 'Equal' ? 1 : -1); return;
    }
    if (busy) return;
    if (event.ctrlKey && ['KeyA', 'KeyE'].includes(event.code)) {
      event.preventDefault(); event.stopPropagation(); const pos = event.code === 'KeyA' ? 0 : value.length;
      event.currentTarget.setSelectionRange(pos, pos); setCaret(pos); return;
    }
    if (event.code === 'Enter') { event.preventDefault(); void run(value).catch(() => {}); return; }
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      event.preventDefault(); previousTab.current = null;
      const history = store.get(terminalHistoryAtom); if (!history.length) return;
      if (historyIndex.current === null) { if (event.code === 'ArrowDown') return; draft.current = value; historyIndex.current = history.length; }
      historyIndex.current = Math.max(0, Math.min(history.length, historyIndex.current + (event.code === 'ArrowUp' ? -1 : 1)));
      replaceInput(historyIndex.current === history.length ? draft.current : history[historyIndex.current]!); return;
    }
    if (event.code === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault(); event.stopPropagation();
      const source = value; const cursor = event.currentTarget.selectionStart ?? value.length;
      const active = new AbortController(); controller.current = active; setBusy(true);
      const work = async () => {
        let result = complete(source, cursor, cwdRef.current);
        if (/\b(?:cd|ls|cat|open)\s/.test(source)) result = complete(source, cursor, cwdRef.current, buildVfs(await loadTerminalData()));
        if (!mounted.current || active.signal.aborted) return;
        if (previousTab.current === source && result.candidates.length > 1) {
          setLines(previous => capScrollback([...previous, [segment(result.candidates.join('  '), 'path')]]));
          announce(result.candidates.join(', '));
        }
        replaceInput(result.value, result.cursor); previousTab.current = result.value;
      };
      void work().catch(() => { if (!active.signal.aborted) announce("Couldn't load completion. Try again."); }).finally(() => {
        if (controller.current === active) { controller.current = null; if (mounted.current) setBusy(false); }
      }); return;
    }
    previousTab.current = null;
  };
  return <TerminalView seed={seed} cwd={cwd} lines={lines} welcome={welcome} value={value} busy={busy} focused={focused}
    fontSize={fontSize} fontFamily={fontFamily} caret={caret} announcement={announcement} scrollRef={scrollRootRef} inputRef={inputRef}
    hintId={`terminal-key-hint-${windowId}`} onChange={change} onCaretChange={setCaret} onKeyDown={keyDown}
    onQuickCommand={source => { void run(source).catch(() => {}); }} />;
}
