/**
 * A team's public tryout addresses — TEAM-named, never season-numbered (Club Tier Stage 2, B07).
 * They always mean the team's live season with tryouts open, so a link a club prints or shares
 * keeps working from one season to the next. PURE, so the club's own tryout page (a client
 * component) builds the same link the public pages serve.
 */
export const publicTryoutHref = (orgSlug: string, teamSlug: string) => `/${orgSlug}/teams/${teamSlug}/tryouts`;
export const publicTryoutRegisterHref = (orgSlug: string, teamSlug: string) => `/${orgSlug}/teams/${teamSlug}/tryouts/register`;
