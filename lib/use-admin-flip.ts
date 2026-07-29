'use client';

import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { resolveFlip, primaryTarget, HAT_LABEL, type FlipResolution, type FlipTarget } from '@/lib/flip-twins';
import { isPublicPageEnabled, PUBLIC_PAGE_OPTIONS, type PublicPageKey } from '@/lib/public-pages';
import { useEventRoleHats } from '@/lib/use-event-role-hats';

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
  const { currentTournament, loading: tournamentLoading } = useTournament();

  // P4/WI-1 — the OTHER roles this person holds on this event, for the lateral rows. Resolved
  // unconditionally (hooks can't sit behind branches); passing nulls off a tournament screen makes
  // it a no-op, so non-tournament admin screens never fetch. See use-event-role-hats for why
  // this is a cached client fetch rather than the server resolve the P4 plan first proposed.
  const onTournamentScreen =
    pathname.includes('/admin/tournaments') && !pathname.includes('/admin/tournaments/preview');
  const roles = useEventRoleHats(
    onTournamentScreen ? currentOrg?.slug : null,
    onTournamentScreen ? currentTournament?.slug : null,
  );
  // Drop the admin hat — you're already standing in it. Everything else is a genuine lateral.
  const lateralHats = roles.hats.filter(hat => hat.kind !== 'admin');

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

    const toPublic = resolveFlip({
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

    // Roles not resolved yet → PENDING. The control holds its space and shows nothing until it
    // knows whether it's a plain link or a chooser. Painting a stand-in and rewriting it is what
    // made the control look broken on arrival; an empty corner that fills in just reads as loading.
    if (!roles.ready) return { ...toPublic, pending: true };

    // Single-role users get EXACTLY today's control — a plain page-matched link. That's the
    // acceptance bar for this work item; the chooser only appears for someone who genuinely wears
    // another hat on THIS event.
    if (lateralHats.length === 0) return toPublic;

    // Multi: the page-matched public row stays FIRST (it's the primary, unchanged action), then one
    // row per other role. Destination lives in the row, never the pill face (ratified 2026-07-23) —
    // so the face reads "Roles", matching the public side's chooser.
    const lateralTargets: FlipTarget[] = lateralHats.map(hat => ({
      href: hat.href,
      label: HAT_LABEL[hat.kind],
      // The team (coach) or org (scorekeeper) this role belongs to — names WHICH hat, so two coached
      // teams in one event read as two distinct rows rather than "Coach" twice.
      sublabel: hat.label,
    }));
    return { kind: 'multi', label: 'Roles', targets: [primaryTarget(toPublic), ...lateralTargets] };
  }

  // Every other admin screen → the org's main public site.
  //
  // One nuance on tournament screens: which event is in context loads CLIENT-side, so for a moment
  // after arrival there is no tournament yet and we land here. That window is PENDING too — without
  // it the control paints "Back to Coach view", then the event arrives, then the roles arrive, and
  // it rewrites itself twice on the way to "Roles". Once loading finishes and there's still no event
  // (the tournaments LIST page), that's a settled answer and the control renders normally.
  const settlingIntoEvent = onTournamentScreen && tournamentLoading;
  return {
    kind: 'single',
    target: { href: `/${currentOrg.slug}`, label: 'Public site' },
    ...(settlingIntoEvent ? { pending: true } : {}),
  };
}
