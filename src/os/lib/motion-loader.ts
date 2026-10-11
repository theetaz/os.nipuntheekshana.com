type Features = typeof import('motion/react')['domAnimation'];
let pending: Promise<Features> | undefined;
let resolveFeatures: ((features: Features) => void) | undefined;
let importing: Promise<Features> | undefined;

/** LazyMotion subscribes during hydration; downloads begin only on feature intent. */
export function loadMotionFeatures(): Promise<Features> {
  return pending ??= new Promise(resolve => {
    resolveFeatures = resolve;
  });
}
export function preloadMotionFeatures(): Promise<Features> {
  loadMotionFeatures();
  return importing ??= import('./motion-features').then(module => {
    // Vite can suppress a failed preload and fulfil the import with undefined.
    if (!module?.default) throw new Error('Animation features could not be loaded');
    resolveFeatures?.(module.default);
    return module.default;
  }).catch(error => {
    // Keep LazyMotion's subscription pending, but allow the next intent to retry.
    importing = undefined;
    throw error;
  });
}
