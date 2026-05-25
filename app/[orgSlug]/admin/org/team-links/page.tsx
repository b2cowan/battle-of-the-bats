import { redirect } from 'next/navigation';

export default async function LegacyOrgTeamLinksPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/admin/org/coaches-portal-links`);
}
