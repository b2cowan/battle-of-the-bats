import { notFound, redirect } from 'next/navigation';
import TryoutLandingView from '@/components/rep-teams/TryoutLandingView';
import { resolvePublicTryout, publicTryoutHref, publicTryoutRegisterHref } from '@/lib/public-tryout';

export const dynamic = 'force-dynamic';

/**
 * The OLD season-numbered tryout address (Club Tier Stage 2, B07). It named one season forever, so
 * a link shared for last year's tryout took a family to a season that had ended. Now: while that
 * season is the team's live one it redirects to the team-named address; otherwise the team isn't
 * taking sign-ups here. A season id from another team is still a 404.
 */
export default async function TryoutLandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string; yearId: string }>;
}) {
  const { orgSlug, teamSlug, yearId } = await params;
  const resolved = await resolvePublicTryout(orgSlug, teamSlug);
  if (!resolved) notFound();
  const { org, team, seasons, live } = resolved;
  if (!seasons.some(s => s.id === yearId)) notFound();
  if (live?.id === yearId) redirect(publicTryoutHref(orgSlug, teamSlug));
  return (
    <TryoutLandingView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      org={org}
      team={team}
      season={null}
      registerHref={publicTryoutRegisterHref(orgSlug, teamSlug)}
    />
  );
}
