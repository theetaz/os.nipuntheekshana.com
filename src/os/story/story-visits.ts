export function start(root: Element): () => void {
  const el = root as HTMLElement; const controller = new AbortController(); let raf = 0; let count: number | undefined;
  let visible = false; let stopped = false;
  const render = (value: number) => {
    el.replaceChildren(document.createTextNode('This is visit №'));
    const digits = document.createElement('span'); digits.setAttribute('aria-hidden', 'true');
    for (const digit of String(value).padStart(6, '0')) { const box = document.createElement('span'); box.className = 'k-digit'; box.textContent = digit; digits.append(box); }
    el.append(digits, document.createTextNode(' since launch.'));
    el.setAttribute('aria-label', `This is visit №${count?.toLocaleString('en-GB')} since launch.`);
  };
  const animate = () => {
    if (!visible || count === undefined || stopped) return;
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 600); render(Math.round(count! * progress));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    if (document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches) render(count);
    else raf = requestAnimationFrame(step);
  };
  el.hidden = false;
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { visible = true; observer.disconnect(); animate(); }
  }); observer.observe(el);
  let method = 'POST'; try { if (sessionStorage.getItem('serendib:visit:counted')) method = 'GET'; } catch { /* Storage is optional. */ }
  void fetch('/api/visits', { method, signal: controller.signal }).then(async response => {
    if (!response.ok) throw new Error(); const value = await response.json();
    if (!Number.isSafeInteger(value.count) || value.count < 0) throw new Error(); if (stopped) return;
    count = value.count; if (method === 'POST') try { sessionStorage.setItem('serendib:visit:counted', 'true'); } catch { /* Optional. */ }
    render(0); animate();
  }).catch(() => { if (!stopped) { el.removeAttribute('aria-label'); el.textContent = 'The visit counter is on a tea break.'; } });
  return () => { stopped = true; controller.abort(); observer.disconnect(); cancelAnimationFrame(raf); };
}
