import { useEffect } from 'react';
import { useStore } from 'jotai';
import type { OsStore } from './store';
import { aiAvailableAtom, postcardsAvailableAtom } from './features';
/** One abortable request per mounted OS; fetch/parser stay outside initial JS. */
export function subscribeFeatureHealth(store: OsStore): () => void {
  const controller = new AbortController();
  void fetch('/api/health', { signal: controller.signal }).then(async response => {
    if (!response.ok) return; const value = await response.json();
    if (controller.signal.aborted) return;
    store.set(aiAvailableAtom, value.ai === true); store.set(postcardsAvailableAtom, value.postcards === true);
  }).catch(() => {});
  return () => controller.abort();
}

export function FeatureHealth() { const store = useStore(); useEffect(() => subscribeFeatureHealth(store), [store]); return null; }
