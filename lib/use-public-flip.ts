'use client';

import { useParams, usePathname } from 'next/navigation';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { useOrgNav } from '@/components/OrgNavContext';
import { useEventRoleHats } from '@/lib/use-event-role-hats';
import { resolveFlip, primaryTarget, HAT_LABEL, type FlipResolution, type FlipTarget } from '@/lib/flip-twins';
import type { ViewerHat } from '@/lib/tournament-viewer-hats';

/**
 * lib/use-public-flip.ts — the PUBLIC side's FlipPill target ("The Flip", Phase 2).
 *
 * The public mirror of `useAdminFlip`: on a public tournament page it resolves the signed-in
 * viewer's hats on THIS event (client-side, via the anonymous tournament-viewer flow — identity is
 * NEVER server-rendered into SW-cached public HTML) and maps them to the flip control's target(s):
 *   • admin hat → the page-matched admin screen (public Schedule → admin Schedule, a public game →
 *     admin Results for that game), carrying `?tournamentId=` so it lands on THIS event;
 *   • coach / official hat → the path the viewer API resolved; since P3 the coach href is
 *     record-aware (the team's tournament record for THIS event — the ratified reverse trip).
 * One hat → a direct single flip; several → the "Roles" chooser popover. Returns null when there's
 * no hat / signed-out / still resolving, so the pill renders nothing and the fan header keeps its
 * corner.
 *
 * The hats come from the SHARED `useEventRoleHats` cache, gated on sign-in here (see below) so fans
 * and signed-out visitors still never touch the network. That sharing is what lets the door render in
 * more than one place without paying for it twice: since 2026-07-31 the desktop door lives in the
 * platform strip while the mobile one stays in the event header, and both resolve from one
 * request per event per session.
 *
 * Returns `resolving` alongside the resolution so a caller can hold the control's space while the
 * answer is in flight. It is deliberately derived from THIS hook's own gate: an earlier version had
 * the strip run its own parallel readiness probe, which could finish first and drop the slot back to
 * the acquisition CTA for a beat — the exact flash the placeholder exists to prevent.
 */

export interface PublicFlip {
  /** The control's target(s), or null when there is nothing to show (fan / signed-out / unresolved). */
  resolution: FlipResolution | null;
  /** True while a signed-in visitor's roles for this event are still being resolved. */
  resolving: boolean;
}
export function usePublicFlip(): PublicFlip {
  const params = useParams<{ orgSlug?: string; tournamentSlug?: string; gameId?: string }>();
  const orgSlug = typeof params?.orgSlug === 'string' ? params.orgSlug : null;
  // The public game score-card is a real dynamic route (`/schedule/[gameId]`), so useParams already
  // exposes the id — no bespoke pathname parsing. Present only on that page; the admin twin uses it.
  const gameId = typeof params?.gameId === 'string' ? params.gameId : null;
  const pathname = usePathname();
  // The event KEY comes from the ROUTE, which is readable on the very first render. It used to come
  // from OrgNavContext, which `TournamentNavSync` only populates in an effect a render later — and
  // that lag is what let a caller's "still resolving?" probe finish before this hook had even
  // started, briefly dropping the control back to the acquisition CTA on a warm cache. The context
  // is still the source for `tournamentId` below, which the route cannot supply.
  const routeTournamentSlug = typeof params?.tournamentSlug === 'string' ? params.tournamentSlug : null;
  const { tournamentId } = useOrgNav();
  // The sign-in gate stays HERE, not in the shared hats hook: that hook is also used by the admin
  // shell, where the caller is always signed in, so it has no gate of its own. Passing nulls when
  // signed out is what keeps the anonymous invariant — a fan on a public tournament page must never
  // touch the network for identity.
  const onEvent = !!orgSlug && !!routeTournamentSlug;
  const signedIn = useClientSignedIn(onEvent);
  const { hats, ready } = useEventRoleHats(
    signedIn ? orgSlug : null,
    signedIn ? routeTournamentSlug : null,
  );

  // An admin destination needs the event id to land on THIS event rather than the bare dashboard,
  // and that id only arrives with the context. So "settled" means the hats are known AND — when one
  // of them is an admin hat — the id they need is known too. Without this the control could resolve
  // early on a warm cache and hand out an admin href missing its event.
  const needsEventId = hats.some(hat => hat.kind === 'admin');
  const settled = ready && (!needsEventId || !!tournamentId);
  // `resolving` is what a caller shows a placeholder for. It is derived from THIS hook's own gate,
  // so a caller can never conclude "done" before the resolution below actually exists.
  const resolving = onEvent && signedIn && !settled;

  // Unresolved is NOT "no hats": render nothing until the answer is in, so the control never paints
  // and then takes itself away.
  if (!settled || hats.length === 0 || !orgSlug || !routeTournamentSlug) return { resolution: null, resolving };

  const targets = hats.map(hat => hatTarget(hat, orgSlug, routeTournamentSlug));
  return {
    resolution: targets.length === 1
      ? { kind: 'single', target: targets[0] }
      : { kind: 'multi', label: 'Roles', targets },
    resolving: false,
  };

  function hatTarget(hat: ViewerHat, org: string, tourn: string): FlipTarget {
    if (hat.kind === 'admin') {
      // Page-match through the SAME resolver the admin side uses (single source of truth), carrying
      // the event id + any game context so the flip lands on the matching admin screen for THIS event.
      // P4/WI-2: `allowedAdminScreens` is what makes a capability-limited staffer land on their
      // nearest permitted screen instead of bouncing off a redirect on arrival. Undefined for
      // owners/admins → exact twin, exactly as before.
      const res = resolveFlip({
        pathname,
        direction: 'to-role',
        hat: 'admin',
        ctx: {
          orgSlug: org,
          tournamentSlug: tourn,
          adminTournamentId: tournamentId ?? undefined,
          gameId,
          allowedAdminScreens: hat.allowedScreens,
        },
      });
      return primaryTarget(res);
    }
    // Coach / official: the viewer API already resolved the record / scorekeeper destination.
    return { href: hat.href, label: HAT_LABEL[hat.kind] };
  }
}
