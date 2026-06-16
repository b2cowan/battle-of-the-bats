import { cookies } from 'next/headers';
import { getAnnouncements, getOrganizationBySlug, getPublicTournamentBySlug, getDivisions, resolveTournamentContactEmail } from '@/lib/db';
import { notFound } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import NewsContent from '@/components/public/NewsContent';

export const dynamic = 'force-dynamic';

export default async function NewsPage({
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

  // Honor the "show contact email publicly" toggle + resolve the designated
  // contact, instead of the raw fallback that bypassed both (J1-045).
  const contactEmail = await resolveTournamentContactEmail(tournament.id, org?.contactEmail ?? null, 'public');
  const pageEnabled = isPublicPageEnabled(tournament, 'news');

  const [announcements, divisions] = pageEnabled
    ? await Promise.all([
        getAnnouncements(tournament.id, { admin: true }),
        getDivisions(tournament.id, { admin: true }),
      ])
    : [[], []];

  return (
    <NewsContent
      orgSlug={orgSlug}
      tournamentSlug={tournamentSlug}
      pageEnabled={pageEnabled}
      announcements={announcements}
      divisions={divisions}
      prefName={prefName}
      view={view}
      contactEmail={contactEmail}
    />
  );
}
