import { cookies } from 'next/headers';
import { getOrganizationBySlug, getPublicTournamentBySlug, getRules, getResources, getDivisions } from '@/lib/db';
import { notFound } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import type { Division, Resource, RuleSection } from '@/lib/types';
import RulesContent from '@/components/public/RulesContent';

export const dynamic = 'force-dynamic';

export default async function RulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const { view } = await searchParams;

  const cookieStore = await cookies();
  const prefName = cookieStore.get(`fl_agpref_${orgSlug}`)?.value ?? null;

  const org = await getOrganizationBySlug(orgSlug);
  const tournament = org ? await getPublicTournamentBySlug(org.id, tournamentSlug) : null;
  if (!tournament) notFound();

  const contactEmail = tournament.contactEmail ?? org?.contactEmail ?? null;
  const pageEnabled = isPublicPageEnabled(tournament, 'rules');

  let rules: RuleSection[] = [];
  let resources: Resource[] = [];
  let divisions: Division[] = [];
  if (pageEnabled) {
    [rules, resources, divisions] = await Promise.all([
      getRules(tournament.id, { admin: true }),
      getResources(tournament.id, { admin: true }),
      getDivisions(tournament.id, { admin: true }),
    ]);
  }

  return (
    <RulesContent
      orgSlug={orgSlug}
      tournamentSlug={tournamentSlug}
      pageEnabled={pageEnabled}
      rules={rules}
      resources={resources}
      divisions={divisions}
      prefName={prefName}
      view={view}
      contactEmail={contactEmail}
      rulesLayout={tournament.settings?.rulesLayout ?? 'columns'}
      resourcesLayout={tournament.settings?.resourcesLayout ?? 'list'}
    />
  );
}
