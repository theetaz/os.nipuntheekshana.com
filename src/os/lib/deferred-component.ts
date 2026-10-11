import { createElement, useEffect, useSyncExternalStore, type ComponentType } from 'react';

/** Dynamic imports with synchronous warm renders, without a Suspense fallback delay.
 * The server snapshot always stays empty, including when a route adopts static HTML.
 */
export function deferredComponent<P extends object>(load: () => Promise<ComponentType<P>>) {
  let component: ComponentType<P> | null = null;
  let pending: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const preload = () => pending ??= load().then(value => {
    component = value; listeners.forEach(listener => listener());
  }, error => { pending = undefined; throw error; });
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  function Deferred(props: P) {
    const Component = useSyncExternalStore(subscribe, () => component, () => null);
    useEffect(() => { void preload().catch(() => {}); }, []);
    return Component ? createElement(Component, props) : null;
  }
  return { Component: Deferred, preload };
}
