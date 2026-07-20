import { useState } from 'react';

/**
 * Local UI state: a Set plus a toggle-membership helper. Backs the mobile
 * expand/reveal controls on the notification cards (which groups have their full
 * list open; which events have their description revealed). Immutable updates so
 * React re-renders; the functional setter avoids stale-closure bugs.
 */
export function useToggleSet<T>(): [Set<T>, (key: T) => void] {
  const [set, setSet] = useState<Set<T>>(() => new Set());
  const toggle = (key: T) =>
    setSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return [set, toggle];
}
