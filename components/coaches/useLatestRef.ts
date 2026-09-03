'use client';
import { useEffect, useRef, type RefObject } from 'react';

/**
 * A ref that always holds the LATEST value — for a long-lived listener or cleanup that must call
 * the current callback, never the one it was created with. The floor's keydown handler (bound once
 * per open), a room body's unmount cleanup releasing the busy gate, the hub's tab switch behind a
 * stable signal: each carried its own three-line copy of this before `/simplify` on Phase B
 * (2026-09-02). Read `.current` inside handlers and effects only, never during render.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
}
