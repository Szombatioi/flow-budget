'use client';

import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalStorage(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => null);
  const set = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // storage unavailable
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [value, set];
}
