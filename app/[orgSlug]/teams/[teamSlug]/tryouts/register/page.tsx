import { notFound } from 'next/navigation';
import TryoutRegisterView from '@/components/rep-teams/TryoutRegisterView';
import { getOrgPrivacyPolicyHref } from '@/lib/privacy-policy';
import { resolvePublicTryout, publicTryoutHref } from '@/lib/public-tryout';

export const dynamic = 'force-dynamic';

/** `/{org}/teams/{team}/tryouts/register` — the application for the team's live season with
 *  tryouts open, or "not taking sign-ups" (Club Tier Stage 2, B07). */
export default async function TeamTryoutRegisterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string }>;
}) {
  const { orgSlug, teamSlug } = await params;
  const resolved = await resolvePublicTryout(orgSlug, teamSlug);
  if (!resolved) notFound();
  const { org, team, open } = resolved;
  return (
    <TryoutRegisterView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      org={org}
      team={team}
      season={open}
      backHref={publicTryoutHref(orgSlug, teamSlug)}
      privacyPolicyHref={getOrgPrivacyPolicyHref(org)}
    />
  );
}
