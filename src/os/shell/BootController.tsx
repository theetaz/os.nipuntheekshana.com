import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { useStore } from 'jotai';
import { bootedAtom, bootPhaseAtom, reducedMotionAtom } from '../state/atoms';
import { ISLAND_PATH, ISLAND_VIEWBOX } from '../icons/island-glyph';
import { isolateModal } from '../lib/modal-focus';
import { reducedMotion } from '../lib/motion-preferences';
import '../../styles/boot.css';

function isolatePowerOverlay(panel: HTMLElement): () => void {
  return isolateModal(panel, () => (panel.querySelector<HTMLElement>('button') ?? panel).focus({ preventScroll: true }));
}

function capturePowerInput(onInput: () => void): () => void {
  const input = (event: Event) => {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation(); onInput();
  };
  const events = ['keydown', 'pointerdown', 'click'] as const;
  for (const event of events) window.addEventListener(event, input, { capture: true, passive: false });
  return () => { for (const event of events) window.removeEventListener(event, input, true); };
}

export function usePowerOverlay(panel: RefObject<HTMLElement | null>, active: boolean, onInput: () => void): void {
  useLayoutEffect(() => {
    if (!active || !panel.current) return;
    const restore = isolatePowerOverlay(panel.current);
    const unsubscribe = capturePowerInput(onInput);
    return () => { unsubscribe(); restore(); };
  }, [panel, active, onInput]);
}

// Only needed for a replay on a route without Astro's home-only BootScreen.
function createBootScreen(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'boot-screen os-chrome';
  panel.innerHTML = `<svg class="boot-island" width="64" height="112" viewBox="${ISLAND_VIEWBOX}" aria-hidden="true">
    <defs><pattern id="boot-dots" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="var(--os-accent)" /></pattern></defs>
    <path class="boot-outline" d="${ISLAND_PATH}" pathLength="1" fill="none" stroke="var(--os-accent)" stroke-width="1.5" />
    <path class="boot-fill" d="${ISLAND_PATH}" fill="url(#boot-dots)" /><circle class="boot-ring" cx="8" cy="80" r="0" fill="none" stroke="var(--os-accent)" />
    </svg><p class="boot-wordmark">serendib</p><p class="boot-greeting"><span lang="si">ආයුබෝවන්</span> · <span lang="ta">வணக்கம்</span> · Welcome</p>
    <div class="boot-progress" aria-hidden="true"><span></span></div>`;
  return panel;
}

export function BootController() {
  const store = useStore();
  useEffect(() => {
    const html = document.documentElement;
    let panel = document.querySelector<HTMLElement>('.boot-screen');
    const template = panel?.cloneNode(true) as HTMLElement | undefined;
    let running = false; let mounted = true;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    let restore: (() => void) | undefined; let unsubscribeInput: (() => void) | undefined;
    const clear = () => { clearTimeout(exitTimer); clearTimeout(finishTimer); };
    const remove = () => {
      clear(); unsubscribeInput?.(); unsubscribeInput = undefined;
      panel?.remove(); panel = null;
      delete html.dataset.boot; delete html.dataset.bootExit; delete html.dataset.bootSkipRequested;
      restore?.(); restore = undefined; running = false;
    };
    const finish = () => { remove(); store.set(bootPhaseAtom, 'off'); store.set(bootedAtom, true); };
    const exit = (skip = false) => {
      if (!running || store.get(bootPhaseAtom) === 'exiting') return;
      clear(); html.dataset.bootExit = skip ? 'skip' : 'normal';
      store.set(bootPhaseAtom, 'exiting');
      const skippedFor = skip ? Math.max(0, performance.now() - Number(html.dataset.bootSkipRequested ?? performance.now())) : 0;
      panel?.style.setProperty('--boot-skipped-at', `${skippedFor}ms`);
      finishTimer = setTimeout(finish, skip ? Math.max(0, 200 - skippedFor) : html.dataset.mode === 'mobile' ? 300 : 350);
    };
    const start = (initial = false) => {
      if (running) return;
      if (reducedMotion()) { finish(); return; }
      const mobile = html.dataset.mode === 'mobile';
      const exitAt = mobile ? 650 : 1300;
      // A navigation deadline keeps a delayed JS chunk from extending the first boot.
      const elapsed = initial ? performance.now() : 0;
      if (initial && elapsed >= exitAt) { finish(); return; }
      panel ??= template?.cloneNode(true) as HTMLElement | undefined ?? createBootScreen();
      panel.removeAttribute('aria-hidden'); panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Starting Serendib');
      panel.setAttribute('aria-describedby', 'boot-hint'); panel.tabIndex = -1;
      panel.querySelector('svg')?.setAttribute('aria-hidden', 'true');
      panel.querySelector('.boot-progress')?.setAttribute('aria-hidden', 'true');
      const hint = document.createElement('p'); hint.id = 'boot-hint'; hint.className = 'sr-only';
      hint.textContent = 'Press any key or tap to go to the desktop.'; panel.append(hint);
      panel.dataset.bootManaged = ''; panel.style.setProperty('--boot-hydrated-at', `${elapsed}ms`);
      if (!panel.isConnected) document.body.append(panel);
      running = true; html.dataset.boot = '1'; if (!html.hasAttribute('data-boot-skip-requested')) delete html.dataset.bootExit;
      store.set(bootPhaseAtom, 'running');
      restore = isolatePowerOverlay(panel); unsubscribeInput = capturePowerInput(() => exit(true));
      exitTimer = setTimeout(() => exit(), Math.max(0, exitAt - elapsed));
      if (html.hasAttribute('data-boot-skip-requested')) exit(true);
    };
    const unsubscribePhase = store.sub(bootPhaseAtom, () => {
      const phase = store.get(bootPhaseAtom);
      if (phase === 'running') start();
      else if (phase === 'off' && running) remove();
    });
    const unsubscribeMotion = store.sub(reducedMotionAtom, () => { if (running && store.get(reducedMotionAtom)) finish(); });
    // ClientBootstrap mounts preference storage and media listeners in this commit.
    queueMicrotask(() => {
      if (!mounted) return;
      if (html.hasAttribute('data-boot')) start(true);
      else if (store.get(bootPhaseAtom) === 'running') start();
      else { panel?.remove(); panel = null; }
    });
    return () => { mounted = false; unsubscribePhase(); unsubscribeMotion(); remove(); store.set(bootPhaseAtom, 'off'); };
  }, [store]);
  return null;
}
