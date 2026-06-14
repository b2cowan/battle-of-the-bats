import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLeagueSeasons } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import type { LeagueSeason } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  registration_open:   'Registration Open',
  registration_closed: 'Registration Closed',
  active:              'Season Active',
  completed:           'Season Complete',
  archived:            'Archived',
};

const STATUS_COLOR: Record<string, string> = {
  registration_open:   '#4ade80',
  registration_closed: '#fbbf24',
  active:              '#60a5fa',
  completed:           '#a78bfa',
  archived:            'rgba(255,255,255,0.3)',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

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

  const ACTIVE_STATUSES = ['registration_open', 'registration_closed', 'active'];
  const featured = visibleSeasons.find(s => ACTIVE_STATUSES.includes(s.status)) ?? null;
  const past = visibleSeasons.filter(
    s => s.status === 'completed' || s.status === 'archived',
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pitch-black, #0A0A0A)',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        color: 'var(--fl-text, #F1F5F9)',
      }}
    >
      <div
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          padding: 'calc(var(--nav-height, 64px) + 2rem) 1.5rem 5rem',
        }}
      >
        {/* Back */}
        <Link
          href={`/${orgSlug}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            marginBottom: '1.5rem',
          }}
        >
          ← {org.name}
        </Link>

        {/* Title */}
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1.5rem' }}>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 900,
              color: '#f0f0f0',
              fontFamily: 'var(--font-display, sans-serif)',
              margin: '0 0 0.35rem',
              lineHeight: 1.1,
            }}
          >
            House League
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }}>
            {org.name}
          </p>
        </div>

        {/* Featured / current season */}
        {featured && (
          <div style={{ marginBottom: '2.5rem' }}>
            <div
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: '0.75rem',
              }}
            >
              Current Season
            </div>
            <FeaturedSeasonCard season={featured} orgSlug={orgSlug} />
          </div>
        )}

        {/* Past seasons */}
        {past.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: '0.75rem',
              }}
            >
              Past Seasons
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {past.map(s => (
                <PastSeasonRow key={s.id} season={s} orgSlug={orgSlug} />
              ))}
            </div>
          </div>
        )}

        {visibleSeasons.length === 0 && (
          <div
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            No seasons have been published yet. Check back soon.
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
    <div
      style={{
        padding: '1.5rem',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: STATUS_COLOR[season.status] ?? 'rgba(255,255,255,0.4)',
          }}
        >
          {STATUS_LABEL[season.status] ?? season.status}
        </span>
        {season.division && (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              background: 'rgba(96,165,250,0.1)',
              color: '#60a5fa',
              border: '1px solid rgba(96,165,250,0.2)',
            }}
          >
            {season.division}
          </span>
        )}
      </div>

      <h2
        style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: '#f0f0f0',
          margin: '0 0 0.75rem',
          fontFamily: 'var(--font-display, sans-serif)',
        }}
      >
        {season.name}
      </h2>

      {season.description && (
        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', margin: '0 0 1rem', lineHeight: 1.6 }}>
          {season.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {canRegister ? (
          <Link
            href={`/${orgSlug}/league/${season.slug}/register`}
            style={{
              display: 'inline-block',
              padding: '0.65rem 1.75rem',
              background: 'var(--logic-lime, #a3e635)',
              color: '#0A0A0A',
              fontWeight: 800,
              fontSize: '0.9rem',
              fontFamily: 'var(--font-display, sans-serif)',
              borderRadius: '8px',
              textDecoration: 'none',
            }}
          >
            Register →
          </Link>
        ) : null}
        <Link
          href={href}
          style={{
            display: 'inline-block',
            padding: '0.65rem 1.5rem',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderRadius: '8px',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          View Season
        </Link>
        {season.status === 'active' && (
          <Link
            href={`/${orgSlug}/league/${season.slug}/standings`}
            style={{
              display: 'inline-block',
              padding: '0.65rem 1.5rem',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 600,
              fontSize: '0.9rem',
              borderRadius: '8px',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1.1rem',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.02)',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
          {year && (
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              {year}
            </span>
          )}
          {season.division && (
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)' }}>{season.division}</span>
          )}
        </div>
        <span style={{ fontWeight: 700, color: '#e0e0e0', fontSize: '0.95rem' }}>{season.name}</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <Link
          href={`${href}/standings`}
          style={{
            fontSize: '0.78rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            fontWeight: 500,
          }}
        >
          Standings
        </Link>
        <Link
          href={`${href}/schedule`}
          style={{
            fontSize: '0.78rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            fontWeight: 500,
          }}
        >
          Schedule
        </Link>
        <Link
          href={href}
          style={{
            fontSize: '0.78rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            fontWeight: 500,
          }}
        >
          Overview
        </Link>
      </div>
    </div>
  );
}
