import { reducedMotion } from '../lib/motion-preferences';
import { springAt, stepSpring } from './spring';
import { typeLine } from './typer';

let shared: ReturnType<typeof controller> | undefined;
let mounts = 0;

/** The three independently intersected grids share one preview and one flipped card. */
export function start(root: Element): () => void {
  shared ??= controller(); mounts++;
  const cleanup = shared.mount(root);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true; cleanup();
    if (--mounts === 0) { shared!.dispose(); shared = undefined; }
  };
}

function controller() {
  const events = new AbortController();
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const canPreview = () => fine.matches && document.documentElement.dataset.mode !== 'mobile';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = new Set<HTMLElement>();
  let preview: HTMLElement | undefined;
  let active: HTMLElement | undefined;
  let flipped: HTMLElement | undefined;
  let keyboard = false;
  let pointer = { x: 0, y: 0 };
  let spring = springAt(0, 0);
  let frame = 0, last = 0;
  let cancelType = () => {}, cancelBackType = () => {};
  let disposed = false;
  const clamp = (n: number, max: number) => Math.max(12, Math.min(max, n));
  const stop = () => { cancelAnimationFrame(frame); frame = last = 0; };
  const hide = (immediate = false) => {
    active = undefined; stop(); cancelType();
    if (preview) { delete preview.dataset.open; if (immediate) preview.hidden = true; }
  };
  const draw = () => {
    const tilt = keyboard || reducedMotion() ? 0 : Math.max(-8, Math.min(8, spring.vx / 90)) - 3;
    preview!.style.transform = `translate3d(${spring.x}px,${spring.y}px,0) rotate(${tilt}deg)`;
  };
  const tick = (time: number) => {
    frame = 0;
    if (!active) return;
    const rest = stepSpring(spring, last ? (time - last) / 1000 : 1 / 60);
    last = time; draw();
    if (!rest) frame = requestAnimationFrame(tick);
    else last = 0;
  };
  const place = () => {
    if (!active) return;
    const docked = keyboard || reducedMotion();
    let x = pointer.x + 26, y = pointer.y + 22;
    if (docked) {
      const rect = active.getBoundingClientRect();
      const style = getComputedStyle(active);
      const lift = style.getPropertyValue('--lift').trim().split(' ').map(parseFloat);
      const current = style.translate.split(' ').map(parseFloat);
      x = rect.right - 380 + (lift[0] || 0) - (current[0] || 0);
      y = rect.top - preview!.offsetHeight - 12 + (lift[1] || 0) - (current[1] || 0);
    } else {
      if (x + 380 > innerWidth - 12) x = pointer.x - 380 - 26;
      if (y + 290 > innerHeight - 84) y = pointer.y - 290 - 22;
    }
    spring.tx = clamp(x, innerWidth - 392); spring.ty = clamp(y, innerHeight - 374);
    preview!.dataset.docked = String(docked);
    if (docked) { stop(); spring = springAt(spring.tx, spring.ty); draw(); }
    else if (!frame) frame = requestAnimationFrame(tick);
  };
  const loadShot = async (card: HTMLElement, slot: HTMLElement) => {
    slot.replaceChildren(); delete slot.dataset.loaded;
    if (!card.dataset.shot) { slot.textContent = card.querySelector('h3')!.textContent; slot.dataset.loaded = ''; return; }
    const shot = JSON.parse(card.dataset.shot) as { avif: string; webp: string; src: string; width: number; height: number };
    const picture = document.createElement('picture'); picture.className = 'contents';
    for (const format of ['avif', 'webp'] as const) if (shot[format]) {
      const source = document.createElement('source'); source.type = `image/${format}`; source.srcset = shot[format]; source.sizes = '380px'; picture.append(source);
    }
    const img = document.createElement('img'); img.width = shot.width; img.height = shot.height;
    img.className = 'h-full w-full object-cover'; img.alt = card.dataset.shotAlt ?? ''; img.decoding = 'async'; img.src = shot.src; picture.append(img);
    picture.style.opacity = '0'; slot.append(picture);
    try { await img.decode(); } catch { return; }
    if (!disposed && slot.contains(picture) && (slot.closest('.k-card') === flipped || (slot.closest('.k-preview') && active === card))) {
      picture.style.opacity = '1'; slot.dataset.loaded = '';
    }
  };
  const show = (card: HTMLElement, docked: boolean) => {
    if (card === flipped) return;
    stop(); cancelType(); keyboard = docked; active = card;
    if (!preview) {
      preview = document.createElement('div'); preview.className = 'k-preview fixed left-0 top-0 z-[19] w-[380px] rounded-xl border-[3px] border-transparent shadow-[9px_9px_0_#1B1530] pointer-events-none'; preview.setAttribute('aria-hidden', 'true');
      preview.innerHTML = '<div class="k-preview-bar flex h-7 items-center gap-1.5 border-b-2 border-[#2E2550] px-2.5 font-mono text-[11px]/none font-medium text-[#A99DC9]"><span class="flex-1">kitty — ~/projects</span><i class="size-[9px] rounded-full border-[1.5px]"></i><i class="size-[9px] rounded-full border-[1.5px]"></i><i class="size-[9px] rounded-full border-[1.5px]"></i></div><div class="k-shot relative shrink-0 overflow-hidden rounded-lg border-2 border-[#2E2550] bg-[#2E2550] text-[#F4EEFF]"></div><p class="k-command m-0 px-3 pt-2.5 pb-3 text-[#F4EEFF] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px]/[19px] font-medium"><span class="k-ps1">$ </span><span class="relative inline-block h-[19px] align-bottom"><span class="k-typed"></span><span class="k-caret absolute left-0 top-[3px] h-4 w-2 bg-[#FFC93C] [translate:calc(var(--k-chars,0)*1ch)_0]"></span></span><span class="k-hint block text-[#A99DC9] text-[11.5px]"># click to open the case study</span></p>';
      document.body.append(preview);
    }
    preview.hidden = false; delete preview.dataset.complete;
    place(); spring = springAt(spring.tx, spring.ty); draw();
    // Commit the initial opacity once; following frames write only the transform.
    void preview.offsetWidth;
    preview.dataset.open = ''; preview.dataset.reduced = String(reducedMotion());
    cancelType = typeLine(preview.querySelector('.k-typed')!, `open ${card.dataset.repo}`, reducedMotion(), () => { preview!.dataset.complete = ''; });
    void loadShot(card, preview.querySelector('.k-shot')!);
  };
  const unflip = () => {
    if (!flipped) return;
    cancelBackType(); delete flipped.dataset.flipped;
    const front = flipped.querySelector<HTMLElement>('.k-card-front')!, back = flipped.querySelector<HTMLElement>('.k-card-back')!;
    front.inert = false; front.removeAttribute('aria-hidden'); back.inert = true; back.setAttribute('aria-hidden', 'true');
    flipped = undefined;
  };
  const flip = (card: HTMLElement) => {
    unflip(); hide(true); flipped = card; card.dataset.flipped = '';
    const front = card.querySelector<HTMLElement>('.k-card-front')!, back = card.querySelector<HTMLElement>('.k-card-back')!;
    front.inert = true; front.setAttribute('aria-hidden', 'true'); back.inert = false; back.removeAttribute('aria-hidden');
    cancelBackType = typeLine(back.querySelector('.k-typed')!, `open ${card.dataset.repo}`, reducedMotion());
    void loadShot(card, back.querySelector('.k-shot')!);
    const moving = reducedMotion() ? [front, back] : [card.querySelector<HTMLElement>('.k-card-turn')!];
    void Promise.all(moving.flatMap(face => face.getAnimations()).map(animation => animation.finished.catch(() => {}))).then(() => {
      if (flipped === card && !disposed) back.querySelector<HTMLElement>('.k-card-open')!.focus({ preventScroll: true });
    });
  };
  const preferences = () => {
    for (const card of cards) card.dataset.reduced = String(reducedMotion());
    if (active) {
      if (!canPreview()) { hide(); return; }
      preview!.dataset.reduced = String(reducedMotion());
      cancelType(); cancelType = typeLine(preview!.querySelector('.k-typed')!, `open ${active.dataset.repo}`, true, () => { preview!.dataset.complete = ''; }); place();
    }
    if (flipped && reducedMotion()) { cancelBackType(); cancelBackType = typeLine(flipped.querySelector('.k-typed')!, `open ${flipped.dataset.repo}`, true); }
  };
  const observer = new MutationObserver(preferences);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-mode'] });
  motion.addEventListener('change', preferences, { signal: events.signal }); fine.addEventListener('change', preferences, { signal: events.signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, { signal: events.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(true); }, { signal: events.signal });
  window.addEventListener('scroll', () => { if (keyboard) place(); else hide(); }, { passive: true, signal: events.signal });
  window.addEventListener('resize', place, { signal: events.signal });
  return {
    mount(root: Element) {
      const local = new AbortController();
      const owned = [...root.querySelectorAll<HTMLElement>('[data-k-card]')];
      for (const card of owned) {
        cards.add(card); card.dataset.cardReady = ''; card.dataset.reduced = String(reducedMotion());
        const options = { signal: local.signal };
        let pointerType = '';
        card.addEventListener('pointerdown', event => { pointerType = event.pointerType; }, options);
        card.addEventListener('pointerenter', event => {
          if (canPreview() && event.pointerType === 'mouse') { pointer = { x: event.clientX, y: event.clientY }; show(card, false); }
        }, options);
        card.addEventListener('pointermove', event => {
          if (active === card && !keyboard && !reducedMotion()) { pointer = { x: event.clientX, y: event.clientY }; place(); }
        }, options);
        card.addEventListener('pointerleave', () => { if (active === card && !keyboard) hide(); }, options);
        card.addEventListener('focusin', event => {
          if (canPreview() && (event.target as Element).matches('.k-card-link:focus-visible')) show(card, true);
        }, options);
        card.addEventListener('focusout', event => {
          if (active === card && keyboard && !card.contains(event.relatedTarget as Node)) hide();
        }, options);
        card.addEventListener('click', event => {
          // WebKit labels the click following a touch pointerdown as "mouse".
          const activation = pointerType || (event as PointerEvent).pointerType;
          pointerType = '';
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const target = event.target as Element;
          if (target.closest('.k-card-source')) return;
          if (card === flipped) {
            hide(true);
            if (!target.closest('.k-card-open')) { event.preventDefault(); event.stopPropagation(); card.querySelector<HTMLElement>('.k-card-open')!.click(); }
          } else if (event.detail !== 0 && ['touch', 'pen'].includes(activation)) {
            event.preventDefault(); event.stopPropagation(); flip(card);
          } else hide(true);
        }, options);
      }
      return () => {
        local.abort();
        for (const card of owned) { if (active === card) hide(true); if (flipped === card) unflip(); cards.delete(card); delete card.dataset.cardReady; delete card.dataset.reduced; }
      };
    },
    dispose() { disposed = true; hide(true); unflip(); events.abort(); observer.disconnect(); preview?.remove(); },
  };
}
