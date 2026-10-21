import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TryoutLandingView from '@/components/rep-teams/TryoutLandingView';
import { resolvePublicTryout, publicTryoutRegisterHref } from '@/lib/public-tryout';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { readTeamTryout } from '@/lib/club-tryouts';
import { tournamentToday } from '@/lib/timezone';
import { teamTryoutPageMeta } from './tryout-metadata';

export const dynamic = 'force-dynamic';

/** The tab names the page (Club Tier Stage 4b-1): the team’s tryouts — with its description and preview card (4b-2b). */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; teamSlug: string }> }): Promise<Metadata> {
  const { orgSlug, teamSlug } = await params;
  return clubPageMetadata(orgSlug, teamTryoutPageMeta(orgSlug, teamSlug));
}

/**
 * `/{org}/teams/{team}/tryouts` — the team's tryout page, which ALWAYS means its live season (Club Tier Stage 2, B07). A
 * link a club prints on a poster keeps working from one season to the next; the old season-numbered addresses redirect
 * here while their season is live. What it says — open, not open yet, finished or closed, with the tryout days — is the
 * one rule's (Club Tier Stage 4b-2b, lib/tryout-season.ts).
 */
export default async function TeamTryoutsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string }>;
}) {
  const { orgSlug, teamSlug } = await params;
  const resolved = await resolvePublicTryout(orgSlug, teamSlug);
  if (!resolved) notFound();
  const { team, seasons, contactEmail } = resolved;
  const today = tournamentToday();
  const { season, standing } = await readTeamTryout(team, seasons, today);
  return (
    <TryoutLandingView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      team={{ name: team.name, sport: team.sport }}
      state={standing.state}
      season={season ? { year: season.year ?? null, name: season.name, tryoutDescription: season.tryoutDescription } : null}
      upcoming={standing.upcoming}
      lastDay={standing.lastDay}
      today={today}
      contactEmail={contactEmail}
      registerHref={publicTryoutRegisterHref(orgSlug, teamSlug)}
    />
  );
}
