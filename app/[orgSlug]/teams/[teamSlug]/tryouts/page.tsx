import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TryoutLandingView from '@/components/rep-teams/TryoutLandingView';
import { resolvePublicTryout, publicTryoutRegisterHref } from '@/lib/public-tryout';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { teamTryoutPageName } from './tryout-metadata';

export const dynamic = 'force-dynamic';

/** The tab names the page (Club Tier Stage 4b-1): the team’s tryouts. */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; teamSlug: string }> }): Promise<Metadata> {
  const { orgSlug, teamSlug } = await params;
  return clubPageMetadata(orgSlug, teamTryoutPageName(teamSlug, false));
}

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
  const { org, team, open, contactEmail } = resolved;
  return (
    <TryoutLandingView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      org={org}
      contactEmail={contactEmail}
      team={team}
      season={open}
      registerHref={publicTryoutRegisterHref(orgSlug, teamSlug)}
    />
  );
}
