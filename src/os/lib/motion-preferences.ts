export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  const override = document.documentElement.dataset.motion;
  return override === 'reduce' || (override !== 'full' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
