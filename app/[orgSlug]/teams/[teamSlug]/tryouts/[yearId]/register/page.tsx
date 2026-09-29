import { notFound, redirect } from 'next/navigation';
import TryoutRegisterView from '@/components/rep-teams/TryoutRegisterView';
import { getOrgPrivacyPolicyHref } from '@/lib/privacy-policy';
import { resolvePublicTryout, publicTryoutHref, publicTryoutRegisterHref } from '@/lib/public-tryout';

export const dynamic = 'force-dynamic';

/** The OLD season-numbered application address (Club Tier Stage 2, B07): redirects to the
 *  team-named one while its season is live, otherwise the team isn't taking sign-ups here. */
export default async function TryoutRegisterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string; yearId: string }>;
}) {
  const { orgSlug, teamSlug, yearId } = await params;
  const resolved = await resolvePublicTryout(orgSlug, teamSlug);
  if (!resolved) notFound();
  const { org, team, seasons, live } = resolved;
  if (!seasons.some(s => s.id === yearId)) notFound();
  if (live?.id === yearId) redirect(publicTryoutRegisterHref(orgSlug, teamSlug));
  return (
    <TryoutRegisterView
      orgSlug={orgSlug}
      teamSlug={teamSlug}
      org={org}
      team={team}
      season={null}
      backHref={publicTryoutHref(orgSlug, teamSlug)}
      privacyPolicyHref={getOrgPrivacyPolicyHref(org)}
    />
  );
}
