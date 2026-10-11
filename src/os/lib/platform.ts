// Supply a platform to pure callers; the default is safe in SSR.
export function isMac(platform?: string): boolean {
  const value = platform ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent);
  return /Mac|iPhone|iPad|iPod/i.test(value);
}
export function modifierLabel(platform?: string): string {
  return isMac(platform) ? '⌘' : 'Ctrl';
}
