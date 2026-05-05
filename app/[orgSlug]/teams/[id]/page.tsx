import { redirect } from 'next/navigation';
import { getOrganizationBySlug, getActiveTournamentByOrg } from '@/lib/db';

export default async function TeamProfileRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  const active = org ? await getActiveTournamentByOrg(org.id) : null;
  if (active?.slug) redirect(`/${orgSlug}/${active.slug}/teams/${id}`);
  redirect(`/${orgSlug}`);
}
