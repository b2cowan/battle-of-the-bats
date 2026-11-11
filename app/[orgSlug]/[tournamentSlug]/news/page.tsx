import { forwardToOwnAddress } from '@/lib/club-forward';
import { cookies } from 'next/headers';
import { getAnnouncements, getOrganizationBySlug, getPublicTournamentBySlug, getDivisions } from '@/lib/db';
import { publicTournamentContactEmail } from '@/lib/public-frame-server';
import { notFound } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { publicPosts } from '@/lib/public-tournament-shape';
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
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/news${view ? `?view=${encodeURIComponent(view)}` : ''}`);

  const cookieStore = await cookies();
  const prefName = cookieStore.get(`fl_agpref_${orgSlug}`)?.value ?? null;

  const org = await getOrganizationBySlug(orgSlug);
  const tournament = org ? await getPublicTournamentBySlug(org.id, tournamentSlug) : null;
  if (!tournament) notFound();

  // Honor the "show contact email publicly" toggle + resolve the designated
  // contact, instead of the raw fallback that bypassed both (J1-045).
  const contactEmail = await publicTournamentContactEmail(tournament.id, org?.contactEmail ?? null);
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
      // A post aimed at a held-back division, and a held-back division's name in the picker, are not public yet.
      announcements={publicPosts(announcements, divisions)}
      divisions={divisions.filter(d => d.scheduleVisibility === 'published')}
      prefName={prefName}
      view={view}
      contactEmail={contactEmail}
    />
  );
}
