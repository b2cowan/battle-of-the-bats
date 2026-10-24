import { orgHref } from './club-base';

/**
 * A team's public tryout addresses — TEAM-named, never season-numbered (Club Tier Stage 2, B07).
 * They always mean the team's live season with tryouts open, so a link a club prints or shares
 * keeps working from one season to the next. PURE, so the club's own tryout page (a client
 * component) builds the same link the public pages serve.
 *
 * `base` (Stage 4e): `{ ownHost: true }` spells the link for a club's own web address (`/teams/u11/tryouts`); left out, it is
 * the address on our host. A coach-side caller (the admin tryouts page) leaves it out: those links are shared from our host.
 */
export const publicTryoutHref = (orgSlug: string, teamSlug: string, base?: { ownHost: boolean }) =>
  orgHref({ slug: orgSlug, ownHost: !!base?.ownHost }, `/teams/${teamSlug}/tryouts`);
export const publicTryoutRegisterHref = (orgSlug: string, teamSlug: string, base?: { ownHost: boolean }) =>
  orgHref({ slug: orgSlug, ownHost: !!base?.ownHost }, `/teams/${teamSlug}/tryouts/register`);
