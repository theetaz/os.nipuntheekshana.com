import { focusableWithin } from './focus';

type Modal = { panel: HTMLElement; focus(): void; previous: HTMLElement | null };
const sessions = new WeakMap<Document, { stack: Modal[]; cover(): void }>();

/** Only the top modal owns focus and inert state, including during overlapping exits. */
export function isolateModal(panel: HTMLElement, focus: () => void): () => void {
  const document = panel.ownerDocument;
  let session = sessions.get(document);
  if (!session) {
    const stack: Modal[] = [];
    const covered = new Map<HTMLElement, boolean>();
    const cover = () => {
      const next = new Set<HTMLElement>();
      let current = stack.at(-1)?.panel;
      while (current?.parentElement) {
        for (const sibling of current.parentElement.children) {
          if (sibling instanceof HTMLElement && sibling !== current && !sibling.matches('script, style, link')) next.add(sibling);
        }
        if (current.parentElement === document.body) break;
        current = current.parentElement;
      }
      for (const [element, original] of covered) if (!next.has(element)) { element.inert = original; covered.delete(element); }
      for (const element of next) { if (!covered.has(element)) covered.set(element, element.inert); element.inert = true; }
    };
    const contain = (event: FocusEvent) => {
      const top = stack.at(-1);
      if (top && event.target instanceof Node && !top.panel.contains(event.target)) top.focus();
    };
    const observer = new MutationObserver(cover);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('focusin', contain, true);
    session = { stack, cover }; sessions.set(document, session);
    // The listeners are document-scoped; a navigation releases the whole session.
  }
  const modal: Modal = { panel, focus, previous: document.activeElement instanceof HTMLElement ? document.activeElement : null };
  session.stack.push(modal); session.cover(); focus();
  return () => {
    const top = session.stack.at(-1) === modal;
    session.stack.splice(session.stack.indexOf(modal), 1); session.cover();
    if (!top) return;
    const next = session.stack.at(-1);
    if (next) { next.focus(); return; }
    const previous = modal.previous;
    const usable = previous?.isConnected && !previous.matches('body, html') && !previous.closest('[inert], [hidden]')
      && previous.getClientRects().length && getComputedStyle(previous).visibility !== 'hidden';
    const target = usable ? previous : document.querySelector<HTMLElement>('[role="menubar"] [role="menuitem"][tabindex="0"]')
      ?? focusableWithin(document.body)[0];
    target?.focus({ preventScroll: true });
  };
}
