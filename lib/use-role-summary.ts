'use client';
import { useEffect, useState } from 'react';
import type { WorkspaceDoor } from '@/lib/user-contexts';

export type RoleSummary = {
  adminHref: string | null;
  coachHref: string | null;
  hasChat: boolean;
  /** Every place this account holds, in Home's order (Stage D.2) — 2+ turns the operator
   *  pill into the "Workspaces ▾" popover; fewer keeps the direct labelled door. */
  workspaces: WorkspaceDoor[];
  /** The primary org's plan key, and the billing screen where a plan change happens (R4,
   *  2026-08-01). Both null for an account holding no org. Read by the pricing page so a
   *  signed-in operator is never funnelled through sign-up for a plan they already have. */
  orgPlan: string | null;
  billingHref: string | null;
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

/** The ratified Stage D.2 threshold: 2+ places → the Workspaces popover. Owned here, once —
 *  the pill/popover fork and WorkspacesPill's own guard both read it, so a future threshold
 *  change can't leave the chrome half-updated. */
export const WORKSPACES_POPOVER_THRESHOLD = 2;

export type OperatorDoor =
  | { kind: 'workspaces'; workspaces: WorkspaceDoor[] }
  | { kind: 'pill'; pill: OperatorPill };

/** The ONE statement of the Stage D.2 pill-vs-popover rule (owner-ratified 2026-07-31),
 *  layered on the WI-3 precedence above: 2+ places → the honest "Workspaces ▾" popover;
 *  0–1 → the direct labelled pill exactly as before (zero change for single-role users).
 *  All three pill surfaces resolve through here. */
export function resolveOperatorDoor(
  workspaces: WorkspaceDoor[] | undefined,
  adminHref: string | null | undefined,
  coachHref: string | null | undefined,
): OperatorDoor | null {
  if (workspaces && workspaces.length >= WORKSPACES_POPOVER_THRESHOLD) {
    return { kind: 'workspaces', workspaces };
  }
  const pill = resolveOperatorPill(adminHref, coachHref);
  return pill ? { kind: 'pill', pill } : null;
}

/**
 * Client-resolved role doors + chat membership for chrome that must never SSR identity
 * (the tournament-page strip, the org-home nav — their HTML is service-worker-cached
 * anonymously). Pairs with `useClientSignedIn`: pass its result as `enabled`, so anonymous
 * visitors never hit the network. One fetch per mount while enabled; a failure leaves null
 * and the chrome simply stays in its fan-plain state (fail-quiet, never fail-broken).
 */
export function useRoleSummary(enabled = true): RoleSummary | null {
  return useRoleSummaryState(enabled).summary;
}

/**
 * The same resolution, plus whether the answer is STILL IN FLIGHT.
 *
 * `useRoleSummary` alone cannot tell "no roles" from "not answered yet" — both read as null — and a
 * surface that must not paint the wrong door needs that distinction. This exposes it FROM THE HOOK
 * THAT OWNS THE RESOLUTION rather than letting a caller infer it from a second probe: a caller-side
 * readiness check racing this one is the precise defect that flashed an acquisition CTA at
 * operators once before (see `usePublicFlip`'s `{resolution, resolving}` for the same shape).
 *
 * `resolving` clears on success AND on failure, so a fail-quiet response can never leave a caller
 * pending forever — it falls through to the fan-plain state, which is the safe default.
 */
export function useRoleSummaryState(enabled = true): { summary: RoleSummary | null; resolving: boolean } {
  const [summary, setSummary] = useState<RoleSummary | null>(null);
  // Tracks SETTLED rather than in-flight, so "still resolving" is derived below instead of being
  // set synchronously in the effect body (which would cascade a render for no reason).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/me/role-summary', { cache: 'no-store' });
        if (!alive) return;
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setSummary({
          adminHref: typeof data.adminHref === 'string' ? data.adminHref : null,
          coachHref: typeof data.coachHref === 'string' ? data.coachHref : null,
          hasChat: !!data.hasChat,
          workspaces: Array.isArray(data.workspaces)
            ? data.workspaces.filter(
                (w: WorkspaceDoor) =>
                  w && typeof w.href === 'string' && typeof w.title === 'string' && typeof w.label === 'string',
              )
            : [],
          orgPlan: typeof data.orgPlan === 'string' ? data.orgPlan : null,
          billingHref: typeof data.billingHref === 'string' ? data.billingHref : null,
        });
      } catch {
        /* stay null — chrome renders the fan-plain state */
      } finally {
        // Settles on EVERY path — success, non-ok, or throw — so a caller holding a pending
        // state can never be stranded there by a fail-quiet response.
        if (alive) setSettled(true);
      }
    })();
    // Cleanup (fires when `enabled` leaves true, or on unmount): RESET the summary, don't
    // just hide it. Deriving null while disabled isn't enough on a shared device — without
    // the reset, the next person to sign in would render the PREVIOUS account's doors for
    // one fetch round-trip before their own summary lands.
    return () => { alive = false; setSummary(null); setSettled(false); };
  }, [enabled]);
  // Also derive null while disabled (mirrors useClientSignedIn) for the same-render gap
  // before the cleanup runs. `resolving` is likewise false when disabled — nothing is in
  // flight for a caller that isn't asking.
  return enabled ? { summary, resolving: !settled } : { summary: null, resolving: false };
}
