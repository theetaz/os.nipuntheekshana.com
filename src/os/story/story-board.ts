import { boardAvailable, getPostcards, PostcardError, type Postcard } from '../apps/guestbook/api';
import { isPostcard, mostlySinhala, noteLine, noteSize, pendingNotes, recentNotes, reducedMotion, type BoardNoteEvent } from '../apps/guestbook/board';
import './story-board.css';

function timeAgo(date: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - date) / 60000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hr ago`
    : minutes < 10080 ? `${Math.floor(minutes / 1440)} ${minutes < 2880 ? 'day' : 'days'} ago`
      : new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function note(item: Postcard, pending: boolean): HTMLLIElement {
  const slot = document.createElement('li');
  const article = document.createElement('article'); article.className = 'k-note'; article.dataset.noteId = item.id;
  article.dataset.color = item.color; article.dataset.font = item.font;
  if (pending) article.dataset.pending = '';
  let hash = 2166136261; for (const char of item.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  article.style.setProperty('--note-nudge', `${(hash >>> 0) % 21 - 10}px`);
  article.style.setProperty('--note-rotation', `${Math.max(-4, Math.min(4, item.rotation))}deg`);
  article.style.setProperty('--note-size', `${noteSize(item.body, item.font)}px`);
  article.style.setProperty('--note-line', `${noteLine(item.body)}px`);
  const body = document.createElement('p'); body.textContent = item.body; if (mostlySinhala(item.body)) body.lang = 'si';
  const footer = document.createElement('footer');
  let country = '';
  if (item.country) {
    country = new Intl.DisplayNames(['en'], { type: 'region' }).of(item.country) ?? item.country;
    const stamp = document.createElement('span'); stamp.className = 'k-country'; stamp.textContent = item.country; stamp.title = country; footer.append(stamp);
  }
  const time = document.createElement('time'); time.dateTime = new Date(item.created_at).toISOString(); time.textContent = timeAgo(item.created_at);
  const author = document.createElement('b'); author.textContent = `— ${item.name}`; if (mostlySinhala(item.name)) author.lang = 'si';
  footer.append(time, author); article.append(body, footer);
  article.setAttribute('aria-label', `Note from ${item.name}${country ? `, ${country}` : ''}, ${time.textContent}: ${item.body}`);
  if (pending) { const caption = document.createElement('small'); caption.textContent = 'Waiting for a quick check · only you can see this'; article.append(caption); }
  slot.append(article); return slot;
}
export function start(root: Element): () => void {
  const grid = root.querySelector<HTMLOListElement>('.k-notes')!;
  const status = root.querySelector<HTMLElement>('[data-board-status]')!;
  const more = root.querySelector<HTMLElement>('[data-board-more]')!;
  const compose = root.querySelector<HTMLAnchorElement>('.k-board-compose')!;
  const controller = new AbortController(); const motions = new Set<Animation>(); const flights = new Set<HTMLElement>();
  let items: Postcard[] = []; let next: string | null = null; let busy = false; let loaded = false;
  const button = (label: string, action: () => void) => { const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.onclick = action; return el; };
  const render = () => {
    const pending = pendingNotes(); const all = [...pending, ...items]; grid.replaceChildren(...all.map(item => note(item, pending.some(value => value.id === item.id))));
    [...grid.children].forEach((slot, index) => { (slot.firstElementChild as HTMLElement).style.zIndex = String(Math.max(1, 1000 - index)); });
    if (!all.length) { const slot = document.createElement('li'); slot.className = 'k-note k-board-empty'; slot.textContent = 'Nothing pinned yet. Be the first one to say hi!'; grid.append(slot); }
  };
  const close = () => {
    root.setAttribute('data-board-state', 'closed'); compose.setAttribute('aria-disabled', 'true'); compose.title = 'The board is resting';
    const sign = document.createElement('li'); sign.className = 'k-note k-board-closed'; sign.textContent = 'The board is having a tea break. Back soon.';
    grid.replaceChildren(sign); more.replaceChildren(); status.textContent = 'The board is resting';
  };
  const load = async (cursor: string | null = null) => {
    if (busy || controller.signal.aborted) return; busy = true; grid.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading notes…'; more.querySelectorAll('button').forEach(el => { el.disabled = true; });
    try {
      if (!await boardAvailable()) { if (!controller.signal.aborted) close(); return; }
      const page = await getPostcards(cursor, controller.signal);
      if (controller.signal.aborted) return;
      if (!Array.isArray(page.items) || !(page.next === null || typeof page.next === 'string')) throw new Error('Invalid board');
      const values = [...recentNotes, ...(cursor ? items : []), ...page.items.filter(isPostcard)];
      items = values.filter((item, index) => values.findIndex(value => value.id === item.id) === index);
      next = page.next; loaded = true; render(); root.setAttribute('data-board-state', 'ready');
      status.textContent = `${items.length} notes loaded.`;
      more.replaceChildren(...(next ? [button('Show older notes', () => { void load(next); })] : []));
      if (!next && items.length) more.textContent = "That's every note. Thank you for reading them all!";
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof PostcardError && error.status === 503) close();
      else {
        if (!loaded) grid.replaceChildren(); root.setAttribute('data-board-state', 'error'); status.textContent = "The board didn't load.";
        const text = document.createElement('p'); text.textContent = "The board didn't load."; text.setAttribute('role', 'alert');
        more.replaceChildren(text, button('Try again', () => { void load(cursor); }));
      }
    } finally { busy = false; if (!controller.signal.aborted) grid.setAttribute('aria-busy', 'false'); }
  };
  const incoming = (event: Event) => {
    const detail = (event as CustomEvent<BoardNoteEvent>).detail;
    if (!detail.pending) items = [detail.item, ...items.filter(item => item.id !== detail.item.id)];
    render(); const target = grid.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(detail.item.id)}"]`)!;
    target.dataset.new = ''; status.textContent = detail.pending ? 'Waiting for a check' : 'Pinned';
    const rect = target.getBoundingClientRect();
    if (detail.pending || !detail.from || rect.bottom <= 0 || rect.top >= innerHeight || !rect.width || reducedMotion()) return;
    const clone = target.cloneNode(true) as HTMLElement; clone.removeAttribute('data-new'); clone.setAttribute('aria-hidden', 'true');
    clone.classList.add('k-note-flight'); Object.assign(clone.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, transformOrigin: '0 0' });
    document.body.append(clone); flights.add(clone);
    const from = detail.from; const w = Math.sqrt(260 - 12 ** 2); const end = 1 - Math.exp(-12 * .52) * (Math.cos(w * .52) + 12 / w * Math.sin(w * .52));
    const frames = Array.from({ length: 33 }, (_, index) => {
      const t = index / 32 * .52; const p = (1 - Math.exp(-12 * t) * (Math.cos(w * t) + 12 / w * Math.sin(w * t))) / end;
      return { transform: `translate(${(from.left - rect.left) * (1 - p)}px, ${(from.top - rect.top) * (1 - p)}px) scale(${1 + (from.width / rect.width - 1) * (1 - p)}, ${1 + (from.height / rect.height - 1) * (1 - p)})` };
    });
    const animation = clone.animate(frames, { duration: 520 }); motions.add(animation);
    detail.flight = animation.finished.catch(() => {}).then(() => { motions.delete(animation); flights.delete(clone); clone.remove(); });
  };
  const disabled = (event: Event) => { if (compose.hasAttribute('aria-disabled')) { event.preventDefault(); event.stopImmediatePropagation(); } };
  compose.addEventListener('click', disabled, true); document.addEventListener('serendib:board:note', incoming);
  void load();
  return () => { controller.abort(); motions.forEach(animation => animation.cancel()); flights.forEach(el => el.remove()); document.removeEventListener('serendib:board:note', incoming); compose.removeEventListener('click', disabled, true); };
}
