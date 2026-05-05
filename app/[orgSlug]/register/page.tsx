import { redirect } from 'next/navigation';
import { getOrganizationBySlug, getActiveTournamentByOrg } from '@/lib/db';

export default async function RegisterRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  const active = org ? await getActiveTournamentByOrg(org.id) : null;
  if (active?.slug) redirect(`/${orgSlug}/${active.slug}/register`);
  redirect(`/${orgSlug}`);
}
