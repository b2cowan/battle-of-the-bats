import { loadCoachTeamMasthead } from '@/lib/coach-team-masthead';
import CoachStripFacts from '@/components/coaches/CoachStripFacts';

/**
 * ⚖ THE STRIP'S RIGHT END, ON THE SERVER (navigation Phase 4, E7, C2, C5, C9; drawings tab 17). The coaches layout's
 * `@stripFacts` slot, for a team's pages: the team's season · record · "Next …" / "Game day" / "Complete", read by the SAME
 * cached loader the team layout reads for the phone's bar (`loadCoachTeamMasthead`), so the two say one thing and the
 * server's first paint already has them — never fetched after load.
 *
 * A LAYOUT, not the page, so it persists while the coach moves between a team's pages (as the team layout does: the feed
 * is read once per team entry) and renders again when they change team. The catch-all page under it draws nothing.
 * Nothing here gates: an unresolvable team simply shows no facts.
 */
export default async function StripFactsLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, teamId } = await params;
  // The facts are a quiet extra: a failure here must never take the portal's layout down with it.
  const masthead = await loadCoachTeamMasthead(orgSlug, teamId).catch(() => null);
  return (
    <>
      {masthead && <CoachStripFacts teamId={teamId} {...masthead.facts} />}
      {children}
    </>
  );
}
