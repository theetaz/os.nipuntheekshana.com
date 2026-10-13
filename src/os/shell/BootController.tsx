import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useStore } from 'jotai';
import { bootedAtom, bootPhaseAtom, reducedMotionAtom } from '../state/atoms';
import { isolateModal } from '../lib/modal-focus';
import { reducedMotion } from '../lib/motion-preferences';
import '../../styles/boot.css';

function isolatePowerOverlay(panel: HTMLElement): () => void {
  return isolateModal(panel, () => (panel.querySelector<HTMLElement>('button') ?? panel).focus({ preventScroll: true }));
}

function capturePowerInput(onInput: (event: Event) => void): () => void {
  const input = (event: Event) => {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation(); onInput(event);
  };
  const events = ['keydown', 'pointerdown', 'click'] as const;
  for (const event of events) window.addEventListener(event, input, { capture: true, passive: false });
  return () => { for (const event of events) window.removeEventListener(event, input, true); };
}

export function usePowerOverlay(panel: RefObject<HTMLElement | null>, active: boolean, onInput: (event: Event) => void): void {
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
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `<div class="boot-grub">
    <p class="boot-grub-header">GNU GRUB  version 2.12-kottu</p>
    <div class="boot-grub-box">
      <p class="boot-grub-entry boot-grub-selected"><span class="boot-grub-marker">*</span>Kottu OS 2.0 "Pettah"</p>
      <p class="boot-grub-entry"><span class="boot-grub-marker">&#160;</span>Kottu OS 2.0 "Pettah" (recovery mode: extra rice)</p>
      <p class="boot-grub-entry"><span class="boot-grub-marker">&#160;</span>Memtest86+ (chops your RAM into small pieces)</p>
      <p class="boot-grub-entry"><span class="boot-grub-marker">&#160;</span>Simple view (no chrome, just text)</p>
    </div>
    <p class="boot-grub-hints">Use the ↑ and ↓ keys to select which entry is highlighted.<br />Press enter to boot the selected OS, or any key to skip.</p>
    <p class="boot-countdown">The highlighted entry will be executed automatically in <span class="boot-countdown-value"><span class="boot-countdown-one">1s</span><span class="boot-countdown-zero">0s</span></span>.</p>
  </div>
  <div class="boot-lines">
    <p class="boot-line" style="--i: 0; --mobile-i: 0">[ <span class="boot-ok"> OK </span> ] Started Kottu chopper daemon (kottud).</p>
    <p class="boot-line boot-line-desktop" style="--i: 1; --mobile-i: 0">[ <span class="boot-ok"> OK </span> ] Mounted /home/nipun.</p>
    <p class="boot-line" style="--i: 2; --mobile-i: 1">[ <span class="boot-ok"> OK </span> ] Reached target Tuk-tuk Network (3 wheels online).</p>
    <p class="boot-line" style="--i: 3; --mobile-i: 2">[ <span class="boot-ok"> OK </span> ] Started Tea Brewing Service (Ceylon, strong, no sugar).</p>
    <p class="boot-line boot-line-desktop" style="--i: 4; --mobile-i: 0">[ <span class="boot-ok"> OK </span> ] Started Lotus Tower Beacon.</p>
    <p class="boot-line boot-line-desktop" style="--i: 5; --mobile-i: 0">[ <span class="boot-warn">WARN</span> ] Mochi is still asleep. Continuing without coffee.</p>
    <p class="boot-line boot-line-desktop" style="--i: 6; --mobile-i: 0">[ <span class="boot-ok"> OK </span> ] Started Bus-Art Wallpaper Painter.</p>
    <p class="boot-line" style="--i: 7; --mobile-i: 3">[ <span class="boot-ok"> OK </span> ] Reached target Graphical Desktop.</p>
    <p class="boot-line" style="--i: 9; --mobile-i: 5"><span class="boot-line-status"><span class="boot-pending">[ <span>....</span> ]</span><span class="boot-ready">[ <span class="boot-ok"> OK </span> ]</span></span> Starting Hyprland on tty1…</p>
  </div>`;
  return panel;
}

export function BootController() {
  const store = useStore();
  const announcement = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const html = document.documentElement;
    let panel = document.querySelector<HTMLElement>('.boot-screen');
    const template = panel?.cloneNode(true) as HTMLElement | undefined;
    let running = false; let mounted = true; let finishAt = 0;
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
    const finish = () => { remove(); setStatus('Ready'); store.set(bootPhaseAtom, 'off'); store.set(bootedAtom, true); };
    const exit = (skip = false) => {
      if (!running || store.get(bootPhaseAtom) === 'exiting') return;
      clear(); html.dataset.bootExit = skip ? 'skip' : 'normal';
      store.set(bootPhaseAtom, 'exiting');
      const skippedFor = skip ? Math.max(0, performance.now() - Number(html.dataset.bootSkipRequested ?? performance.now())) : 0;
      panel?.style.setProperty('--boot-skipped-at', `${skippedFor}ms`);
      // A delayed exit callback must not move the navigation/replay deadline.
      finishTimer = setTimeout(finish, skip ? Math.max(0, 200 - skippedFor) : Math.max(0, finishAt - performance.now()));
    };
    const start = (initial = false) => {
      if (running) return;
      if (reducedMotion()) { finish(); return; }
      const mobile = html.dataset.mode === 'mobile';
      const exitAt = mobile ? 700 : 1350;
      // A navigation deadline keeps a delayed JS chunk from extending the first boot.
      const elapsed = initial ? performance.now() : 0;
      if (initial && elapsed >= exitAt) { finish(); return; }
      finishAt = (initial ? 0 : performance.now()) + exitAt + (mobile ? 250 : 300);
      panel ??= template?.cloneNode(true) as HTMLElement | undefined ?? createBootScreen();
      setStatus('Starting Kottu OS');
      // CSS starts at first paint; align it with the navigation deadline on takeover.
      const cssTime = panel.getAnimations()[0]?.currentTime;
      const origin = initial ? Math.max(0, elapsed - (typeof cssTime === 'number' ? cssTime : 0)) : 0;
      panel.style.setProperty('--boot-origin-offset', `${origin}ms`);
      panel.dataset.bootManaged = '';
      if (!panel.isConnected) document.body.append(panel);
      running = true; html.dataset.boot = '1'; if (!html.hasAttribute('data-boot-skip-requested')) delete html.dataset.bootExit;
      store.set(bootPhaseAtom, 'running');
      restore = isolateModal(announcement.current!, () => announcement.current!.focus({ preventScroll: true }), '.boot-screen');
      unsubscribeInput = capturePowerInput(() => exit(true));
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
  const active = status === 'Starting Kottu OS';
  return <div ref={announcement} className="sr-only" role={active ? 'dialog' : undefined}
    aria-modal={active || undefined} aria-label={active ? 'Starting Kottu OS' : undefined}
    aria-describedby={active ? 'boot-hint' : undefined} tabIndex={-1}>
    <span role="status">{status}</span>
    <p id="boot-hint" hidden={!active}>Press any key or tap to go to the desktop.</p>
  </div>;
}
