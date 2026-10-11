import { createJSONStorage } from 'jotai/utils';

export type Validator<T> = (value: unknown) => value is T;
const unavailableStorage = { getItem: (_key: string) => null, setItem: (_key: string, _value: string) => {}, removeItem: (_key: string) => {} };
/** Storage can be disabled, corrupt, or full without making the desktop unusable. */
export function preferenceStorage<T>(valid: Validator<T>) {
  const storage = createJSONStorage<T>(() => {
    if (typeof window === 'undefined') return unavailableStorage;
    try { return window.localStorage; } catch { return unavailableStorage; }
  });
  return {
    getItem(key: string, initial: T): T {
      try { const value = storage.getItem(key, initial); return valid(value) ? value : initial; }
      catch { return initial; }
    },
    setItem(key: string, value: T): void { try { storage.setItem(key, value); } catch { /* Keep the session value. */ } },
    removeItem(key: string): void { try { storage.removeItem(key); } catch { /* Storage is optional. */ } },
    subscribe(key: string, callback: (value: T) => void, initial: T): () => void {
      try { return storage.subscribe?.(key, value => callback(valid(value) ? value : initial), initial) ?? (() => {}); }
      catch { return () => {}; }
    },
  };
}
export const oneOf = <T extends string>(values: readonly T[]): Validator<T> =>
  (value): value is T => typeof value === 'string' && values.includes(value as T);
export const isBoolean: Validator<boolean> = (value): value is boolean => typeof value === 'boolean';
export const isNonnegative: Validator<number> = (value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const isPoint = (value: unknown): value is { x: number; y: number } => !!value && typeof value === 'object'
  && 'x' in value && 'y' in value && typeof value.x === 'number' && Number.isFinite(value.x)
  && typeof value.y === 'number' && Number.isFinite(value.y);
export function isRecordOf<T>(valid: Validator<T>): Validator<Partial<Record<string, T>>> {
  return (value): value is Partial<Record<string, T>> => !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && valid(item));
}
export const stringList = (max: number): Validator<string[]> => (value): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string');
