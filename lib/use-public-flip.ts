'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useOrgNav } from '@/components/OrgNavContext';
import { useClientSignedIn } from '@/lib/use-client-signed-in';
import { resolveFlip, primaryTarget, HAT_LABEL, type FlipResolution, type FlipTarget } from '@/lib/flip-twins';
import type { TournamentViewer, ViewerHat } from '@/lib/tournament-viewer-hats';

/**
 * lib/use-public-flip.ts — the PUBLIC side's FlipPill target ("The Flip", Phase 2).
 *
 * The public mirror of `useAdminFlip`: on a public tournament page it resolves the signed-in
 * viewer's hats on THIS event (client-side, via the anonymous tournament-viewer flow — identity is
 * NEVER server-rendered into SW-cached public HTML) and maps them to the flip control's target(s):
 *   • admin hat → the page-matched admin screen (public Schedule → admin Schedule, a public game →
 *     admin Results for that game), carrying `?tournamentId=` so it lands on THIS event;
 *   • coach / official hat → the record/scorekeeper path the viewer API resolved (P3 refines the
 *     coach landing to be record-aware — for now the API's context path is the destination).
 * One hat → a direct single flip; several → the "Roles" chooser popover. Returns null when there's
 * no hat / signed-out / still resolving, so the pill renders nothing and the fan header keeps its
 * corner. Sign-in tracking reuses the shared `useClientSignedIn` primitive (no network for fans).
 */
export function usePublicFlip(): FlipResolution | null {
  const params = useParams<{ orgSlug?: string; gameId?: string }>();
  const orgSlug = typeof params?.orgSlug === 'string' ? params.orgSlug : null;
  // The public game score-card is a real dynamic route (`/schedule/[gameId]`), so useParams already
  // exposes the id — no bespoke pathname parsing. Present only on that page; the admin twin uses it.
  const gameId = typeof params?.gameId === 'string' ? params.gameId : null;
  const pathname = usePathname();
  const { tournamentSlug, tournamentId } = useOrgNav();
  const signedIn = useClientSignedIn(!!orgSlug && !!tournamentSlug);
  // undefined = not yet resolved; null = resolved with no hats (fan / signed-out / error).
  const [viewer, setViewer] = useState<TournamentViewer | null | undefined>(undefined);

  useEffect(() => {
    // Fans never hit the network — signed-out resolves straight to "no hats".
    if (!signedIn || !orgSlug || !tournamentSlug) { setViewer(signedIn ? undefined : null); return; }
    let cancelled = false;
    setViewer(undefined);
    (async () => {
      try {
        const res = await fetch(
          `/api/public/tournament-viewer?org=${encodeURIComponent(orgSlug)}&tournament=${encodeURIComponent(tournamentSlug)}`,
        );
        const body = res.ok ? ((await res.json()) as { viewer?: TournamentViewer | null }) : null;
        if (!cancelled) setViewer(body?.viewer ?? null);
      } catch {
        if (!cancelled) setViewer(null);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, tournamentSlug, signedIn]);

  if (!viewer || viewer.hats.length === 0 || !orgSlug || !tournamentSlug) return null;

  const targets = viewer.hats.map(hat => hatTarget(hat, orgSlug, tournamentSlug));
  return targets.length === 1 ? { kind: 'single', target: targets[0] } : { kind: 'multi', label: 'Roles', targets };

  function hatTarget(hat: ViewerHat, org: string, tourn: string): FlipTarget {
    if (hat.kind === 'admin') {
      // Page-match through the SAME resolver the admin side uses (single source of truth), carrying
      // the event id + any game context so the flip lands on the matching admin screen for THIS event.
      const res = resolveFlip({
        pathname,
        direction: 'to-role',
        hat: 'admin',
        ctx: { orgSlug: org, tournamentSlug: tourn, adminTournamentId: tournamentId ?? undefined, gameId },
      });
      return primaryTarget(res);
    }
    // Coach / official: the viewer API already resolved the record / scorekeeper destination.
    return { href: hat.href, label: HAT_LABEL[hat.kind] };
  }
}
