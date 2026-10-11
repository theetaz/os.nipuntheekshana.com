import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { readInitialData } from './initial-data';
interface Entry { data: unknown | null; error: Error | null; promise?: Promise<unknown> }
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const empty: Entry = { data: null, error: null };
function notify(url: string) { listeners.get(url)?.forEach(listener => listener()); }
/** Successful responses are cached by URL; pending requests are deduplicated. */
export function fetchJson<T = unknown>(url: string): Promise<T> {
  const current = entries.get(url);
  if (current?.promise) return current.promise as Promise<T>;
  if (current && !current.error) return Promise.resolve(current.data as T);
  const promise = fetch(url).then(async response => {
    if (!response.ok) throw new Error(`Couldn't load data (${response.status}).`);
    const data: unknown = await response.json();
    entries.set(url, { data, error: null }); notify(url); return data as T;
  }).catch((cause: unknown) => {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    entries.set(url, { data: null, error }); notify(url); throw error;
  });
  entries.set(url, { data: null, error: null, promise });
  return promise;
}
export function useAppData<T = unknown>(key: string, url: string, initialData: T | null = null) {
  const subscribe = useCallback((listener: () => void) => {
    const set = listeners.get(url) ?? new Set<() => void>();
    set.add(listener); listeners.set(url, set);
    return () => { set.delete(listener); if (!set.size) listeners.delete(url); };
  }, [url]);
  const snapshot = useCallback(() => entries.get(url) ?? empty, [url]);
  const entry = useSyncExternalStore(subscribe, snapshot, () => empty);
  const embedded = useSyncExternalStore(
    useCallback(() => () => {}, []),
    useCallback(() => readInitialData<T>(key), [key]),
    () => null,
  );
  const initial = initialData ?? embedded;
  useEffect(() => {
    // The first hydration effect can run before the embedded-data snapshot updates.
    const seed = initial ?? readInitialData<T>(key);
    if (seed !== null && !entries.has(url)) {
      entries.set(url, { data: seed, error: null }); notify(url);
    } else if (!entries.has(url)) void fetchJson<T>(url).catch(() => {});
  }, [url, key, initial]);
  const retry = useCallback(() => {
    // Do not duplicate an already pending request.
    if (!entries.get(url)?.promise) entries.delete(url);
    const promise = fetchJson<T>(url); notify(url);
    void promise.catch(() => {});
  }, [url]);
  return { data: (entry.data ?? initial) as T | null, error: entry.error, retry };
}
