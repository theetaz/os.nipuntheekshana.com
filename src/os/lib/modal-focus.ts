const focusableSelector = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], summary';
/** Restore one target without measuring every link in the background document. */
export function firstFocusableWithin(container: HTMLElement, selector = focusableSelector,
  accept: (element: HTMLElement) => boolean = () => true): HTMLElement | undefined {
  for (const element of container.querySelectorAll<HTMLElement>(selector)) {
    if (accept(element) && element.tabIndex >= 0 && !element.matches(':disabled')
      && !element.closest('[inert], [hidden], [aria-hidden="true"]')
      && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden') return element;
  }
}

type Modal = { panel: HTMLElement; focus(): void; previous: HTMLElement | null; portals?: string };
const sessions = new WeakMap<Document, { stack: Modal[]; cover(): void }>();

/** Only the top modal owns focus and inert state, including during overlapping exits. */
export function isolateModal(panel: HTMLElement, focus: () => void, portals?: string): () => void {
  const document = panel.ownerDocument;
  let session = sessions.get(document);
  if (!session) {
    const stack: Modal[] = [];
    const covered = new Map<HTMLElement, boolean>();
    const cover = () => {
      document.documentElement.classList.toggle('k-scroll-lock', stack.length > 0);
      const next = new Set<HTMLElement>();
      let current = stack.at(-1)?.panel;
      while (current?.parentElement) {
        for (const sibling of current.parentElement.children) {
          if (sibling instanceof HTMLElement && sibling !== current && !sibling.matches('script, style, link') && !(stack.at(-1)?.portals && sibling.matches(stack.at(-1)!.portals!))) next.add(sibling);
        }
        if (current.parentElement === document.body) break;
        current = current.parentElement;
      }
      for (const [element, original] of covered) if (!next.has(element)) { element.inert = original; covered.delete(element); }
      for (const element of next) { if (!covered.has(element)) covered.set(element, element.inert); if (!element.inert) element.inert = true; }
    };
    const contain = (event: FocusEvent) => {
      const top = stack.at(-1);
      if (top && event.target instanceof Node && !top.panel.contains(event.target) && !(event.target instanceof Element && top.portals && event.target.closest(top.portals))) top.focus();
    };
    const observer = new MutationObserver(cover);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('focusin', contain, true);
    session = { stack, cover }; sessions.set(document, session);
    // The listeners are document-scoped; a navigation releases the whole session.
  }
  const modal: Modal = { panel, focus, previous: document.activeElement instanceof HTMLElement ? document.activeElement : null, portals };
  session.stack.push(modal); session.cover(); focus();
  // WebKit applies inert changes at its next rendering update. Focus after that
  // update, including when AnimatePresence revives an exiting modal.
  const focusFrame = requestAnimationFrame(() => {
    if (session.stack.at(-1) === modal && !panel.contains(document.activeElement)) focus();
  });
  return () => {
    cancelAnimationFrame(focusFrame);
    const top = session.stack.at(-1) === modal;
    session.stack.splice(session.stack.indexOf(modal), 1); session.cover();
    if (!top) return;
    const next = session.stack.at(-1);
    if (next) {
      if(modal.previous?.isConnected && next.panel.contains(modal.previous) && !modal.previous.closest('[inert], [hidden]')) modal.previous.focus({preventScroll:true});
      else next.focus();
      requestAnimationFrame(() => { if (session.stack.at(-1) === next && !next.panel.contains(document.activeElement)) next.focus(); });
      return;
    }
    const restore = () => {
      const active = document.activeElement;
      if (session.stack.length || (active && active !== document.body && !panel.contains(active))) return;
      const previous = modal.previous;
      const usable = previous?.isConnected && !previous.matches('body, html') && !previous.closest('[inert], [hidden]')
        && previous.getClientRects().length && getComputedStyle(previous).visibility !== 'hidden';
      const target = usable ? previous
        : firstFocusableWithin(document.body, '[role="menubar"] [role="menuitem"][tabindex="0"]')
          ?? firstFocusableWithin(document.body, undefined, element => !element.matches('.skip-link'))
          ?? firstFocusableWithin(document.body);
      if (target?.isConnected && !target.closest('[inert], [hidden]')) target.focus({ preventScroll: true });
    };
    // Let the browser render restored inert/scroll state before reading geometry.
    // WebKit otherwise forces a full document layout inside the dismissal task.
    requestAnimationFrame(() => { globalThis.setTimeout(restore, 0); });
  };
}
