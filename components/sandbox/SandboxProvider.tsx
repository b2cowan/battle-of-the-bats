'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { ensureSandboxMarkerCookie } from '@/lib/sandbox-exit-rule';
import type { DemoOrgKind } from '@/lib/demo-org';

/**
 * SandboxProvider — the ONE answer to "am I inside a demo org right now?", for client components.
 *
 * The server already knows (`lib/demo-org.ts` is a compile-time allow-list and the org layout
 * resolves the slug once). This carries that answer down so a button can lock itself, a nav item
 * can hide itself, and the chrome can paint itself — without every one of them re-deriving the
 * slug from the URL and drifting.
 *
 * **Fail OPEN for chrome, never for writes.** Everything reading this context is cosmetic: a
 * banner, a chip, a disabled button, a hidden link. If this said "not a sandbox" on a real demo
 * org, the visitor would see an un-hatted page — untidy, not unsafe, because the write block and
 * the outbound silence are enforced server-side and know nothing about this file. Never move a
 * safety decision in here.
 */

export interface SandboxContextValue {
  isSandbox: boolean;
  kind: DemoOrgKind | null;
  /** The demo org's slug — null off a demo org. */
  slug: string | null;
  /** Where the sandbox's "front door" lands: the fan side. */
  landingPath: string | null;
}

const NOT_A_SANDBOX: SandboxContextValue = {
  isSandbox: false,
  kind: null,
  slug: null,
  landingPath: null,
};

const SandboxContext = createContext<SandboxContextValue>(NOT_A_SANDBOX);

export function SandboxProvider({
  value,
  children,
}: {
  value: SandboxContextValue;
  children: React.ReactNode;
}) {
  const memo = useMemo(
    () => value,
    [value.isSandbox, value.kind, value.slug, value.landingPath], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Keep this browser MARKED for as long as a demo tab is open.
  //
  // The marker cookie is what makes the request layer look at all (lib/sandbox-exit.ts), and it
  // is written once at the door — while this tab goes on refreshing its Supabase token in the
  // background, straight to the auth server, writing auth cookies the request layer never sees.
  // A browser that left the demo in another tab and then had its session revived by THIS one
  // would hold a live demo session with no marker, and the leave-the-demo rule would be silently
  // disarmed for good. Re-asserting on mount and on focus closes that: focus is when a revived
  // tab becomes reachable again. Costs a cookie read; writes only when the marker has gone.
  useEffect(() => {
    if (!memo.isSandbox) return;
    ensureSandboxMarkerCookie();
    const reassert = () => ensureSandboxMarkerCookie();
    window.addEventListener('focus', reassert);
    document.addEventListener('visibilitychange', reassert);
    return () => {
      window.removeEventListener('focus', reassert);
      document.removeEventListener('visibilitychange', reassert);
    };
  }, [memo.isSandbox]);

  return <SandboxContext.Provider value={memo}>{children}</SandboxContext.Provider>;
}

/** Everything the caller might want. Safe to call anywhere — off a demo org it answers "no". */
export function useSandbox(): SandboxContextValue {
  return useContext(SandboxContext);
}

/** The common case, spelled the way it reads at a call site: `if (isSandbox) …`. */
export function useIsSandbox(): boolean {
  return useContext(SandboxContext).isSandbox;
}
