const parsed = new WeakMap<Element, unknown>();
export function readInitialData<T = unknown>(key: string): T | null {
  if (typeof document === 'undefined') return null;
  const script = document.getElementById('os-initial-data');
  if (!script || script.dataset.key !== key || script.getAttribute('type') !== 'application/json') return null;
  if (!parsed.has(script)) {
    try { parsed.set(script, JSON.parse(script.textContent ?? 'null')); }
    catch { parsed.set(script, null); }
  }
  return parsed.get(script) as T | null;
}
