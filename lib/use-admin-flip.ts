'use client';

import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { resolveFlip, type FlipResolution } from '@/lib/flip-twins';
import { isPublicPageEnabled, PUBLIC_PAGE_OPTIONS, type PublicPageKey } from '@/lib/public-pages';

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
    // P4/WI-3: an organizer can hide public pages, so a page-matched twin could otherwise land on a
    // page they deliberately took down. Derive the hidden set from the SAME helper the public nav
    // uses (it also covers structurally-absent pages, e.g. standings on a playoff-only event) so the
    // flip and the nav can never disagree. Drafts are excluded — the preview shell renders every
    // page regardless of public visibility, so hiding doesn't apply there.
    const hiddenPublicPages = currentTournament.status === 'draft'
      ? undefined
      : PUBLIC_PAGE_OPTIONS
          .filter(page => !isPublicPageEnabled(currentTournament, page.key))
          // `register` is a public page but never a flip twin — drop it rather than cast it in.
          // (Narrow to the shared members: every PublicPageKey except `register` IS a PublicTwinKey.)
          .map(page => page.key)
          .filter((key): key is Exclude<PublicPageKey, 'register'> => key !== 'register');

    return resolveFlip({
      pathname,
      direction: 'to-public',
      hat: 'admin',
      ctx: {
        orgSlug: currentOrg.slug,
        tournamentSlug: currentTournament.slug,
        isDraft: currentTournament.status === 'draft',
        hiddenPublicPages,
      },
    });
  }

  // Every other admin screen → the org's main public site.
  return { kind: 'single', target: { href: `/${currentOrg.slug}`, label: 'Public site' } };
}
