'use client';
/**
 * A PAGE'S SAVES, ONE AT A TIME — Tournament admin redesign Stage 5 (/simplify): Rules' order and layout, Registration
 * questions' order and Notifications' switches each wrote this queue by hand. Each save waits for the one before it,
 * so two quick moves land in the order they were made and the last is what the server keeps; the floating pill reads
 * `saving` and `error`; `retry` runs the last save again, exactly as it was made — its target and its data. A save
 * that reads live state when its turn comes (the notifications' switches) retries through its own caller instead, so
 * its target and its state can't come from two different events. A later success clears an earlier failure.
 */
import { useCallback, useRef, useState } from 'react';

export function useSaveQueue() {
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const last = useRef<{ task: () => Promise<void>; failText: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback((task: () => Promise<void>, failText: string) => {
    last.current = { task, failText };
    setSaving(true);
    setError(null);
    const step = chain.current.catch(() => {}).then(async () => {
      try {
        await task();
        setError(null);
      } catch {
        setError(failText);
      }
    });
    chain.current = step;
    void step.finally(() => { if (chain.current === step) setSaving(false); });
    return step;
  }, []);

  const retry = useCallback(() => {
    if (last.current) void run(last.current.task, last.current.failText);
  }, [run]);

  return { saving, error, run, retry };
}
