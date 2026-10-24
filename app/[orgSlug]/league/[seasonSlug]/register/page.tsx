import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDivisionsForSeason } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { supabaseAdmin } from '@/lib/supabase-admin';
import RegisterForm, { DivisionWithCount } from '@/components/league/RegisterForm';
import column from '../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

// This page does not hide a draft season (it says "not yet opened for registration"), so the tab names it as it stands.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return season ? `Register for ${season.name}` : null;
  }, { path: `/league/${seasonSlug}/register` });
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/league/${seasonSlug}/register`);
  const href = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getClubSeason(org.id, seasonSlug);
  if (!season) notFound();

  const rawDivisions = await getDivisionsForSeason(season.id);

  const divisions: DivisionWithCount[] = await Promise.all(
    rawDivisions.map(async d => {
      const { count } = await supabaseAdmin
        .from('league_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', d.id)
        .eq('status', 'active');
      return { id: d.id, name: d.name, capacity: d.capacity, activeCount: count ?? 0 };
    }),
  );

  const registrationOpen = season.status === 'registration_open';

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  return (
    <div>
      {/* R6: the shared 1200px page column; this page's 640px measure left-aligns inside it. */}
      <div className={`container ${column.column}`} style={{ '--league-measure': '640px' } as React.CSSProperties}>
        {/* Back link */}
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← Back to {season.name}
        </Link>

        {/* Page header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className={kit.sub} style={{ marginBottom: '0.4rem' }}>{org.name}</div>
          <h1 className={kit.title}>Register — {season.name}</h1>
          {season.division && (
            <div className={kit.sub}>Division: {season.division}</div>
          )}
        </div>

        {/* Closed state */}
        {!registrationOpen ? (
          <div className={kit.card} style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--club-text)',
                margin: '0 0 0.5rem',
                fontFamily: 'var(--club-text-face)',
                letterSpacing: 0,
              }}
            >
              Registration is not currently open
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--club-soft)', margin: 0 }}>
              {season.status === 'draft' &&
                'This season has not yet opened for registration.'}
              {season.status === 'registration_closed' &&
                'Registration for this season has closed.'}
              {(season.status === 'active' ||
                season.status === 'completed' ||
                season.status === 'archived') &&
                'This season is no longer accepting registrations.'}
            </p>
          </div>
        ) : (
          <RegisterForm
            orgSlug={orgSlug}
            orgName={org.name}
            seasonSlug={seasonSlug}
            seasonName={season.name}
            waiverText={season.waiverText}
            registrationFee={season.registrationFee}
            divisions={divisions}
          />
        )}
      </div>
    </div>
  );
}
