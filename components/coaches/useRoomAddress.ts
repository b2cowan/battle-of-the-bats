'use client';
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * A room's address: which record is open rides the URL, so a link can open straight to "the ice
 * bill" and the layout sweep can reach a state nothing else opens for it.
 *
 * ⚠⚠ THE KEY MUST BE UNIQUE ACROSS THE MONEY HUB AND LISTED IN ITS `ONE_SHOT_KEYS`
 * (`accounting/page.tsx`) IN THE SAME COMMIT. The hub keeps every visited tab mounted, so a key
 * two panels both read would open two rooms for one address — the 2026-08-26 "mounted twice"
 * defect — and a key the hub does not scrub would ride to an unrelated tab and silently reopen
 * the record on the way back. `tests/unit/room-address-keys-guard.test.ts` fails the build when
 * a key used here is missing from that list; that failure IS the decision point.
 *
 * `replace`, never `push`: opening and closing a room must not stack history entries, and every
 * other param (`section`, `year`, a sibling lens) is preserved — the dues panel's own writer.
 */
export function useRoomAddress(key: string): [string | null, (id: string | null) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = searchParams.get(key);
  const set = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id === null) next.delete(key); else next.set(key, id);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname, key],
  );
  return [value, set];
}
