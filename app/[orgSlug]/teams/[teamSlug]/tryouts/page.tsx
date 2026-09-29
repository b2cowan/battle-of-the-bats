import { notFound } from 'next/navigation';
import TryoutLandingView from '@/components/rep-teams/TryoutLandingView';
import { resolvePublicTryout, publicTryoutRegisterHref } from '@/lib/public-tryout';

export const dynamic = 'force-dynamic';

/**
 * `/{org}/teams/{team}/tryouts` — the team's tryout page, which ALWAYS means its live season with
 * tryouts open (Club Tier Stage 2, B07). A link a club prints on a poster keeps working from one
 * season to the next; the old season-numbered addresses redirect here while their season is live.
 */
export default async function TeamTryoutsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string }>;
}) {
  const { orgSlug, teamSlug } = await params;
  const resolved = await resolvePublicTryout(orgSlug, teamSlug);
  if (!resolved) notFound();
  const { org, team, open } = resolved;
  return (
    <TryoutLandingView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      org={org}
      team={team}
      season={open}
      registerHref={publicTryoutRegisterHref(orgSlug, teamSlug)}
    />
  );
}
