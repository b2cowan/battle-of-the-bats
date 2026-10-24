import { forwardToOwnAddress } from '@/lib/club-forward';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TryoutRegisterView from '@/components/rep-teams/TryoutRegisterView';
import { getOrgPrivacyPolicyHref } from '@/lib/privacy-policy';
import { resolvePublicTryout } from '@/lib/public-tryout';
import { orgLinks } from '@/lib/org-links';
import { clubPageMetadata } from '@/lib/club-page-meta';
import { teamTryoutPageName } from '../tryout-metadata';

export const dynamic = 'force-dynamic';

/** The tab names the page (Club Tier Stage 4b-1): the team’s application. */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; teamSlug: string }> }): Promise<Metadata> {
  const { orgSlug, teamSlug } = await params;
  return clubPageMetadata(orgSlug, teamTryoutPageName(teamSlug, true), { path: `/teams/${teamSlug}/tryouts/register` });
}

/** `/{org}/teams/{team}/tryouts/register` — the application for the team's live season with
 *  tryouts open, or "not taking sign-ups" (Club Tier Stage 2, B07). */
export default async function TeamTryoutRegisterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string }>;
}) {
  const { orgSlug, teamSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/teams/${teamSlug}/tryouts/register`);
  const resolved = await resolvePublicTryout(orgSlug, teamSlug);
  if (!resolved) notFound();
  const href = await orgLinks(orgSlug);
  const { org, team, open, contactEmail } = resolved;
  return (
    <TryoutRegisterView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      org={org}
      contactEmail={contactEmail}
      team={team}
      season={open}
      backHref={href(`/teams/${teamSlug}/tryouts`)}
      privacyPolicyHref={getOrgPrivacyPolicyHref(org)}
    />
  );
}
