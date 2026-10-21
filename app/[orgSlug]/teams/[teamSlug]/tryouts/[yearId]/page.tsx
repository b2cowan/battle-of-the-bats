import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import TryoutLandingView from '@/components/rep-teams/TryoutLandingView';
import { resolvePublicTryout, publicTryoutHref, publicTryoutRegisterHref } from '@/lib/public-tryout';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { teamTryoutPageName } from '../tryout-metadata';
import { tournamentToday } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/** The tab names the page (Club Tier Stage 4b-1): the team’s tryouts. */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; teamSlug: string; yearId: string }> }): Promise<Metadata> {
  const { orgSlug, teamSlug } = await params;
  return clubPageMetadata(orgSlug, teamTryoutPageName(teamSlug, false));
}

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
  const { team, seasons, live, contactEmail } = resolved;
  if (!seasons.some(s => s.id === yearId)) notFound();
  if (live?.id === yearId) redirect(publicTryoutHref(orgSlug, teamSlug));
  return (
    // A season that is not the live one has nothing to sign up for: the closed page, with the contact and a way on.
    <TryoutLandingView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      team={{ name: team.name, sport: team.sport }}
      state="closed"
      season={null}
      upcoming={[]}
      lastDay={null}
      today={tournamentToday()}
      contactEmail={contactEmail}
      registerHref={publicTryoutRegisterHref(orgSlug, teamSlug)}
    />
  );
}
