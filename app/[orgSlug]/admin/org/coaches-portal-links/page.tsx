import { redirect } from 'next/navigation';

/**
 * Organization › "Coaches portal links" became Rep Teams › "Bring in a coach's team" (Club Tier
 * Stage 2, specimen 9): it sits beside the teams it adds to, and its old name collided with the
 * club's own Coaches Portal (J4-034). The old address forwards, for bookmarks and old help links.
 */
export default async function LegacyCoachesPortalLinksPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/admin/rep-teams/bring-in`);
}
