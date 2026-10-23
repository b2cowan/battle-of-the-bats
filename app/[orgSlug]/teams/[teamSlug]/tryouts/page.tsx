import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TryoutLandingView from '@/components/rep-teams/TryoutLandingView';
import { resolvePublicTryout, publicTryoutRegisterHref } from '@/lib/public-tryout';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { readTeamTryout } from '@/lib/club-tryouts';
import { bornFactsOf } from '@/lib/club-born-public';
import { tournamentToday } from '@/lib/timezone';
import { teamTryoutPageMeta } from './tryout-metadata';
import { getPublicTryoutContact } from '@/lib/coach-tryout-contact';
import { tryoutStateShowsCoachContact } from '@/lib/tryout-contact-rules';

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
  const { org, team, seasons, contactEmail } = resolved;
  const today = tournamentToday();
  // The head coach's own address (Club Tier 4c-2 Part B, Ask 3): THIS page only — never the metadata, the preview card,
  // the sign-up form, the season-numbered pages or anything else. Read beside the days (no added wait) and shown only
  // while open or not open yet.
  const [{ season, standing }, contact] = await Promise.all([
    readTeamTryout(team, seasons, today),
    // A failed read falls back to the club's line rather than taking the page down.
    team.isArchived ? Promise.resolve(null) : getPublicTryoutContact(org.id, team.id).catch(() => null),
  ]);
  const coachContact = tryoutStateShowsCoachContact(standing.state) ? contact : null;
  return (
    <TryoutLandingView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      team={{ name: team.name, sport: team.sport }}
      state={standing.state}
      season={season ? { year: season.year ?? null, name: season.name, tryoutDescription: season.tryoutDescription } : null}
      born={season ? bornFactsOf({ from: season.bornFromYear, to: season.bornToYear }, org.birthdayCutoffs, team.sport).meta : null}
      upcoming={standing.upcoming}
      lastDay={standing.lastDay}
      today={today}
      contactEmail={contactEmail}
      coachContact={coachContact}
      registerHref={publicTryoutRegisterHref(orgSlug, teamSlug)}
    />
  );
}
