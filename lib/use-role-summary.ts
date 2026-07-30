'use client';
import { useEffect, useState } from 'react';

export type RoleSummary = {
  adminHref: string | null;
  coachHref: string | null;
  hasChat: boolean;
};

export type OperatorPill = { href: string; label: string };

/** The ONE statement of the operator-door precedence rule (WI-3): Admin Area outranks
 *  Coaches Portal, and no role means no pill. Every chrome surface that renders the
 *  persistent pill (consumer top bar, tournament strip, org-home nav) resolves through
 *  here so labels and precedence can never drift between them. */
export function resolveOperatorPill(
  adminHref: string | null | undefined,
  coachHref: string | null | undefined,
): OperatorPill | null {
  if (adminHref) return { href: adminHref, label: 'Admin Area' };
  if (coachHref) return { href: coachHref, label: 'Coaches Portal' };
  return null;
}

/**
 * Client-resolved role doors + chat membership for chrome that must never SSR identity
 * (the tournament-page strip, the org-home nav — their HTML is service-worker-cached
 * anonymously). Pairs with `useClientSignedIn`: pass its result as `enabled`, so anonymous
 * visitors never hit the network. One fetch per mount while enabled; a failure leaves null
 * and the chrome simply stays in its fan-plain state (fail-quiet, never fail-broken).
 */
export function useRoleSummary(enabled = true): RoleSummary | null {
  const [summary, setSummary] = useState<RoleSummary | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/me/role-summary', { cache: 'no-store' });
        if (!alive || !res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setSummary({
          adminHref: typeof data.adminHref === 'string' ? data.adminHref : null,
          coachHref: typeof data.coachHref === 'string' ? data.coachHref : null,
          hasChat: !!data.hasChat,
        });
      } catch {
        /* stay null — chrome renders the fan-plain state */
      }
    })();
    // Cleanup (fires when `enabled` leaves true, or on unmount): RESET the summary, don't
    // just hide it. Deriving null while disabled isn't enough on a shared device — without
    // the reset, the next person to sign in would render the PREVIOUS account's doors for
    // one fetch round-trip before their own summary lands.
    return () => { alive = false; setSummary(null); };
  }, [enabled]);
  // Also derive null while disabled (mirrors useClientSignedIn) for the same-render gap
  // before the cleanup runs.
  return enabled ? summary : null;
}
