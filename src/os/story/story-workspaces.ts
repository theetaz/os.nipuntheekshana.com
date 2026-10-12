import { reducedMotion } from '../lib/motion-preferences';
import { isMac } from '../lib/platform';

function bind(group: HTMLElement): () => void {
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('[data-workspace]'));
  const targets = buttons.map(button => document.getElementById(button.dataset.workspace!));
  const mark = (index: number) => buttons.forEach((button, i) => {
    if (i === index) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
    button.tabIndex = i === index ? 0 : -1;
  });
  const jump = (index: number) => {
    mark(index);
    targets[index]?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  const spy = () => {
    let index = 0;
    // Mark sections as they enter the observer band's lower edge.
    targets.forEach((target, i) => { if (target && target.getBoundingClientRect().top <= innerHeight * .5) index = i; });
    mark(index);
  };
  const observer = new IntersectionObserver(spy, { rootMargin: '-45% 0px -50% 0px' });
  targets.forEach(target => { if (target) observer.observe(target); });
  spy();
  const focus = (event: FocusEvent) => {
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index >= 0) jump(index);
  };
  const key = (event: KeyboardEvent) => {
    if (!group.isConnected || document.documentElement.dataset.mode !== 'desktop' || event.defaultPrevented || event.isComposing || document.documentElement.classList.contains('k-scroll-lock')
      || !(event.target instanceof Element) || event.target.closest('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])')) return;
    const inside = group.contains(event.target);
    const digit = /^Digit[1-5]$/.test(event.code) ? Number(event.code.slice(-1)) - 1 : -1;
    const shortcut = isMac() ? event.ctrlKey && !event.metaKey : event.metaKey && !event.ctrlKey;
    let index = -1;
    if (shortcut && !event.altKey && !event.shiftKey) index = digit;
    else if (inside && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (/^[1-5]$/.test(event.key)) index = Number(event.key) - 1;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = buttons.length - 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') index = (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      else if (event.key === 'Enter' || event.key === ' ') index = current;
    }
    if (index < 0) return;
    event.preventDefault();
    if (inside && document.activeElement !== buttons[index]) buttons[index]?.focus({ preventScroll: true }); else jump(index);
  };
  group.addEventListener('focusin', focus);
  group.addEventListener('keydown', key);
  document.addEventListener('keydown', key);
  group.dataset.workspacesReady = 'true';
  return () => { delete group.dataset.workspacesReady; observer.disconnect(); group.removeEventListener('focusin', focus); group.removeEventListener('keydown', key); document.removeEventListener('keydown', key); };
}

export function start(_root: Element): () => void {
  const find = () => document.querySelector<HTMLElement>('nav[aria-label="Workspaces"]');
  let group = find(); let cleanup = group ? bind(group) : () => {};
  const observer = new MutationObserver(() => {
    if (group?.isConnected) return;
    const next = find();
    if (next !== group) { cleanup(); group = next; cleanup = group ? bind(group) : () => {}; }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => { observer.disconnect(); cleanup(); };
}
