/** One deferred runtime; each feature owns only the elements it starts. */
export function startStory(root: Element = document.getElementById('story')!): () => void {
  if (!root) return () => {};
  let stopped = false;
  const cleanups: (() => void)[] = [];
  const loaders = {
    '[data-k-cards]': () => import('./story-cards'),
    '[data-k-board]': () => import('./story-board'),
    '[data-k-visits]': () => import('./story-visits'),
  };
  const start = async (el: Element, load: () => Promise<{ start(root: Element): () => void }>) => {
    const module = await load();
    if (!stopped) cleanups.push(module.start(el));
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      const selector = Object.keys(loaders).find(selector => entry.target.matches(selector))!;
      void start(entry.target, loaders[selector as keyof typeof loaders]).catch(() => {});
    }
  }, { rootMargin: '800px' });
  for (const selector of Object.keys(loaders)) for (const el of root.querySelectorAll(selector)) observer.observe(el);
  if (document.documentElement.dataset.mode === 'desktop') void start(root, () => import('./story-workspaces')).catch(() => {});
  return () => { stopped = true; observer.disconnect(); cleanups.reverse().forEach(cleanup => cleanup()); };
}
