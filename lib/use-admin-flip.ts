'use client';

import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { resolveFlip, type FlipResolution } from '@/lib/flip-twins';

/**
 * The admin shell's FlipPill target for the current screen — consumed by the shared AdminEventHeader
 * (and the mobile More mirror row):
 *   • on a tournament screen → that tournament's page-matched public (live) or preview (draft) twin;
 *   • on any other admin screen (org admin, house league, rep teams, accounting, public-site editor)
 *     → the org's main public site ("⇄ Public site");
 *   • on the focused draft-preview shell → null (it carries its own Exit-preview control).
 * Returns null only when there's no org context at all.
 */
export function useAdminFlip(): FlipResolution | null {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();

  if (!currentOrg?.slug) return null;
  // The draft preview shell has its own Exit-preview control — no flip pill there.
  if (pathname.includes('/admin/tournaments/preview')) return null;

  // On a tournament screen with a tournament in context → that tournament's public/preview twin.
  if (pathname.includes('/admin/tournaments') && currentTournament?.slug) {
    return resolveFlip({
      pathname,
      direction: 'to-public',
      hat: 'admin',
      ctx: {
        orgSlug: currentOrg.slug,
        tournamentSlug: currentTournament.slug,
        isDraft: currentTournament.status === 'draft',
      },
    });
  }

  // Every other admin screen → the org's main public site.
  return { kind: 'single', target: { href: `/${currentOrg.slug}`, label: 'Public site' } };
}
