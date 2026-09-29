import { redirect } from 'next/navigation';

export default async function LegacyOrgTeamLinksPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/admin/rep-teams/bring-in`);
}
