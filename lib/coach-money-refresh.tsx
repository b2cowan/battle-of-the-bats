'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * "Something changed in Money — re-read yourself."
 *
 * The Money hub's `Import ▾` lives in the PAGE HEADER, above the tabs, and can bring in budget
 * lines while the coach is looking at Fundraisers. The tab panels deliberately stay mounted once
 * visited (`display:none` while inactive) so a half-filled form survives a tab switch — which
 * means the Budget panel can be sitting in memory holding a plan that is now out of date, and
 * switching to it would show the pre-import budget with no hint that anything happened.
 *
 * ⚠ THE FIX IS A SIGNAL, NOT A REMOUNT. Remounting the panels would throw away exactly the
 * in-progress form the mounted-panel design exists to protect. A panel that is on screen re-reads
 * itself; a panel that was never opened simply fetches fresh when it first opens.
 *
 * Outside the hub (the standalone `/accounting/{tab}` routes) there is no provider and the
 * revision is a constant 0, so a panel's load effect behaves exactly as it always did.
 */
/** What a shared read hands back. The BODY, already parsed — a `Response` can only be read once, so
 *  caching one would give the second caller an exhausted stream instead of a saving. */
export interface SharedRead { ok: boolean; status: number; data: Record<string, unknown> }

const MoneyRefreshContext = createContext<{
  revision: number;
  bump: () => void;
  read: (url: string) => Promise<SharedRead>;
}>({
  revision: 0,
  bump: () => {},
  read: async (url: string) => {
    /* No provider (the standalone /accounting/{tab} routes): behave exactly like a plain fetch,
       with no cache to be stale. */
    const res = await fetch(url);
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  },
});

export function MoneyRefreshProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  /**
   * ⚠⚠ ONE REQUEST PER URL PER REVISION — the deferred half of P1's `/simplify` (money plan §10 P1),
   * now that P3 has changed what Transactions reads anyway.
   *
   * The hub keeps every visited tab MOUNTED, and Transactions and Payables are two instances of one
   * component. So a coach who opens both was fetching `/expenses`, `/budget-items` and
   * `/budget-plan` TWICE — and thereafter every save re-ran all six, for the rest of the session.
   * The panels are not siblings that could hoist state; they are mounted independently by the hub.
   * So the dedupe lives where the invalidation already does.
   *
   * ⚠ THE PROMISE IS CACHED, NOT THE RESULT, which is what makes two simultaneous mounts collapse
   * into one request rather than merely making the second one faster.
   *
   * ⚠ A BUMP CLEARS IT, and that is the whole correctness argument: this cache is only ever as
   * stale as the revision, and every money write in the hub bumps the revision. A cache with its
   * own expiry would be a second, quieter answer to "is this current?".
   *
   * ⚠ FAILURES ARE NOT CACHED. A read that threw or came back non-OK is dropped, so a retry — or
   * the other tab mounting a moment later — genuinely retries instead of replaying the error.
   */
  const cache = useRef(new Map<string, Promise<SharedRead>>());
  const bump = useCallback(() => {
    cache.current.clear();
    setRevision(r => r + 1);
  }, []);
  const read = useCallback((url: string) => {
    const hit = cache.current.get(url);
    if (hit) return hit;
    /**
     * ⚠ EVICT BY IDENTITY, NEVER BY KEY (/review, 2026-08-17). Both failure paths used to
     * `cache.current.delete(url)` outright, which deletes whatever is at that key NOW — not
     * necessarily this promise. A read that starts, is orphaned by a `bump()` clearing the map, and
     * only THEN fails would evict the healthy replacement a later caller had already installed,
     * quietly defeating the one-request-per-URL-per-revision invariant this cache exists for. No
     * caller is served stale data either way; it just silently stops saving the request.
     */
    const forget = () => { if (cache.current.get(url) === pending) cache.current.delete(url); };
    const pending: Promise<SharedRead> = (async () => {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) forget();
      return { ok: res.ok, status: res.status, data };
    })().catch(err => { forget(); throw err; });
    cache.current.set(url, pending);
    return pending;
  }, []);
  const value = useMemo(() => ({ revision, bump, read }), [revision, bump, read]);
  return <MoneyRefreshContext.Provider value={value}>{children}</MoneyRefreshContext.Provider>;
}

/**
 * A GET whose answer both money faces may want, fetched once per revision.
 *
 * ⚠ ONLY FOR READS TWO SURFACES GENUINELY SHARE. A face-specific endpoint gains nothing and loses
 * the ability to be re-read on its own, so `/register` and `/money-in` stay on a plain fetch.
 */
export function useSharedMoneyRead(): (url: string) => Promise<SharedRead> {
  return useContext(MoneyRefreshContext).read;
}

/** Add to a panel's load-effect deps: a bump re-runs the fetch without touching component state. */
export function useMoneyRevision(): number {
  return useContext(MoneyRefreshContext).revision;
}

/** Called by the hub's Import menu once rows have actually landed. */
export function useBumpMoneyRevision(): () => void {
  return useContext(MoneyRefreshContext).bump;
}

/**
 * Run `onBump` whenever a money write elsewhere bumps the revision — and NOT on mount.
 *
 * ⚠⚠ THE MOUNT SKIP IS THE WHOLE POINT, AND IT IS VALUE-COMPARED RATHER THAN LATCHED. A boolean
 * "have I run yet?" flag flips on StrictMode's FIRST double-invoke, so the second invoke fires a
 * spurious reload on mount — which is how the Dues tab hung during the §80 walk. Remembering WHICH
 * revision was handled is idempotent under double effects; a boolean is not.
 *
 * ⚠ ONE HOME, BECAUSE MORE PANELS ARE COMING (/simplify, altitude lens 2026-08-23). This idiom was
 * hand-rolled twice in one change — the Dues panel and the hub's summary bridge — each re-deriving
 * the same six lines and re-explaining the same StrictMode hazard. A third copy would have been
 * equally likely to get it right or to reintroduce the bug both copies took care to avoid.
 *
 * ⚠ The caller's `onBump` should be stable (a `useCallback`), or this re-subscribes each render.
 */
export function useOnMoneyRevisionBump(onBump: () => void): void {
  const revision = useMoneyRevision();
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (seen.current === revision) return;
    const first = seen.current === null;
    seen.current = revision;
    if (!first) onBump();
  }, [revision, onBump]);
}
