import type { Metadata } from 'next';
import { buildTeamPayView } from '@/lib/team-pay-view';
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import { isPublicFrameOn, publicTournamentContactEmail } from '@/lib/public-frame-server';
import TeamPayContent from '@/components/public/TeamPayContent';

export const dynamic = 'force-dynamic';

/** A pay link is a key: never indexed, never cached. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The address's organizer's public contact (the footer's own answer, lib/public-frame-server.ts): the focused page's one
 *  way to ask (Stage 7, A1). The URL's tournament, not the link's, so a broken link still names who can send a new one. */
async function addressContact(orgSlug: string, tournamentSlug: string): Promise<string | null> {
  const org = await getOrganizationBySlug(orgSlug);
  const tournament = org ? await getPublicTournamentBySlug(org.id, tournamentSlug) : null;
  return org && tournament ? publicTournamentContactEmail(tournament.id, org.contactEmail ?? null) : null;
}

/**
 * A TOURNAMENT TEAM'S PAY PAGE (Club Tier Stage 12a). The signed link names one team; the page shows what it owes, Pay by
 * card, and its receipts — under the tournament's own address and theme. `?paid={session}` is Stripe's return (the page
 * then waits for the record); `?left=1` is a team that left Stripe's page before paying.
 *
 * Under the preview switch it is the focused page (Public tournament pages Stage 7): the layout's chrome asks
 * lib/public-focused-page.ts, and this page adds the focused heading and the contact line.
 */
export default async function TeamPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; token: string }>;
  searchParams: Promise<{ paid?: string; left?: string }>;
}) {
  const { orgSlug, tournamentSlug, token } = await params;
  const { paid, left } = await searchParams;
  const focused = await isPublicFrameOn();
  const [view, contactEmail] = await Promise.all([
    buildTeamPayView(token, { orgSlug, tournamentSlug }),
    focused ? addressContact(orgSlug, tournamentSlug).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <TeamPayContent token={token} view={view} returnedSession={paid ?? null} left={left === '1'}
      focused={focused} contactEmail={contactEmail} />
  );
}
