import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getLeagueSeasons } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata } from '@/lib/club-page-meta';
import type { LeagueSeason } from '@/lib/types';
import column from './league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, () => 'House league');
}

const STATUS_LABEL: Record<string, string> = {
  registration_open:   'Registration open',
  registration_closed: 'Registration closed',
  active:              'Season active',
  completed:           'Season complete',
  archived:            'Archived',
};

function formatYear(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).getFullYear().toString();
}

export default async function LeagueIndexPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const allSeasons = await getLeagueSeasons(org.id);
  const visibleSeasons = allSeasons.filter(s => s.status !== 'draft');
  // A club that runs no house league here has no league page: the club's "not found" says so, inside its site (F09,
  // Club Tier Stage 4a). This page used to say "No seasons have been published yet. Check back soon."
  if (visibleSeasons.length === 0) notFound();

  const ACTIVE_STATUSES = ['registration_open', 'registration_closed', 'active'];
  const featured = visibleSeasons.find(s => ACTIVE_STATUSES.includes(s.status)) ?? null;
  const past = visibleSeasons.filter(
    s => s.status === 'completed' || s.status === 'archived',
  );

  // The light ground and the club's bar and footer come from the club's frame (Club Tier Stage 4b-1); the page only
  // lays out its column. The credit line moved to the frame's footer.
  return (
    <div>
      {/* R6: the shared 1200px page column, with this page's 760px reading measure left-aligned
          inside it — so headings sit under the section tab row rather than 244px inboard of it. */}
      <div className={`container ${column.column}`}>
        {/* Title */}
        <div className={column.header}>
          <h1 className={kit.title}>House league</h1>
          <p className={kit.sub}>{org.name}</p>
        </div>

        {/* Featured / current season */}
        {featured && (
          <div style={{ marginBottom: '2.5rem' }}>
            <div className={kit.band}>Current season</div>
            <FeaturedSeasonCard season={featured} orgSlug={orgSlug} />
          </div>
        )}

        {/* Past seasons */}
        {past.length > 0 && (
          <div>
            <div className={kit.band}>Past seasons</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {past.map(s => (
                <PastSeasonRow key={s.id} season={s} orgSlug={orgSlug} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedSeasonCard({ season, orgSlug }: { season: LeagueSeason; orgSlug: string }) {
  const href = `/${orgSlug}/league/${season.slug}`;
  const canRegister = season.status === 'registration_open';

  return (
    <div className={kit.card}>
      <div className={kit.chipRow}>
        <span className={`${kit.chip} ${canRegister ? kit.chipOk : kit.chipNeutral}`}>
          {STATUS_LABEL[season.status] ?? season.status}
        </span>
        {season.division && (
          <span className={`${kit.chip} ${kit.chipNeutral}`}>{season.division}</span>
        )}
      </div>

      <h2 className={kit.cardTitle}>{season.name}</h2>

      {season.description && <p className={kit.body}>{season.description}</p>}

      <div className={kit.btnRow}>
        {canRegister ? (
          <Link href={`/${orgSlug}/league/${season.slug}/register`} className={`${kit.btn} ${kit.btnPrimary}`}>
            Register
          </Link>
        ) : null}
        <Link href={href} className={`${kit.btn} ${kit.btnSecondary}`}>
          View season
        </Link>
        {season.status === 'active' && (
          <Link href={`/${orgSlug}/league/${season.slug}/standings`} className={`${kit.btn} ${kit.btnSecondary}`}>
            Standings
          </Link>
        )}
      </div>
    </div>
  );
}

function PastSeasonRow({ season, orgSlug }: { season: LeagueSeason; orgSlug: string }) {
  const year = formatYear(season.seasonStartDate ?? season.registrationOpenAt);
  const href = `/${orgSlug}/league/${season.slug}`;

  return (
    <div
      className={kit.card}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1.1rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
          {year && (
            <span style={{ fontSize: '0.75rem', color: 'var(--club-dim)', fontWeight: 600 }}>{year}</span>
          )}
          {season.division && (
            <span style={{ fontSize: '0.75rem', color: 'var(--club-dim)' }}>{season.division}</span>
          )}
        </div>
        <span style={{ fontWeight: 700, color: 'var(--club-text)', fontSize: '1rem' }}>{season.name}</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <Link href={`${href}/standings`} className={`${kit.btn} ${kit.btnSm} ${kit.btnSecondary}`}>
          Standings
        </Link>
        <Link href={`${href}/schedule`} className={`${kit.btn} ${kit.btnSm} ${kit.btnSecondary}`}>
          Schedule
        </Link>
        <Link href={href} className={`${kit.btn} ${kit.btnSm} ${kit.btnSecondary}`}>
          Overview
        </Link>
      </div>
    </div>
  );
}
