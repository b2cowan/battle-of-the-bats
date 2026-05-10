import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrganizationBySlug, getLeagueSeasonBySlug, getDivisionsForSeason } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { LeagueDivision } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft:                'Draft',
  registration_open:    'Registration Open',
  registration_closed:  'Registration Closed',
  active:               'Season Active',
  completed:            'Season Complete',
  archived:             'Archived',
};

const STATUS_COLOR: Record<string, string> = {
  draft:                'rgba(255,255,255,0.4)',
  registration_open:    '#4ade80',
  registration_closed:  '#fbbf24',
  active:               '#60a5fa',
  completed:            '#a78bfa',
  archived:             'rgba(255,255,255,0.3)',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

interface DivisionWithCount extends LeagueDivision {
  activeCount: number;
}

export default async function LeagueSeasonPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) notFound();

  // Only show non-draft seasons publicly
  if (season.status === 'draft') notFound();

  const rawDivisions = await getDivisionsForSeason(season.id);

  const divisions: DivisionWithCount[] = await Promise.all(
    rawDivisions.map(async d => {
      const { count } = await supabaseAdmin
        .from('league_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', d.id)
        .eq('status', 'active');
      return { ...d, activeCount: count ?? 0 };
    }),
  );

  const registrationOpen = season.status === 'registration_open';

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
        {/* Back to org */}
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

        {/* Season header */}
        <div
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '1.5rem',
            marginBottom: '2rem',
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
            {season.ageGroup && (
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
                {season.ageGroup}
              </span>
            )}
          </div>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 900,
              color: '#f0f0f0',
              fontFamily: 'var(--font-display, sans-serif)',
              margin: '0 0 0.5rem',
              lineHeight: 1.1,
            }}
          >
            {season.name}
          </h1>
          {season.description && (
            <p
              style={{
                fontSize: '0.95rem',
                color: 'rgba(255,255,255,0.55)',
                margin: '0 0 1rem',
                lineHeight: 1.6,
                maxWidth: '600px',
              }}
            >
              {season.description}
            </p>
          )}

          {/* Key dates + fee */}
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {(season.registrationOpenAt || season.registrationCloseAt) && (
              <div>
                <div
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    marginBottom: '0.2rem',
                  }}
                >
                  Registration
                </div>
                <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                  {formatDate(season.registrationOpenAt)} — {formatDate(season.registrationCloseAt)}
                </div>
              </div>
            )}
            {(season.seasonStartDate || season.seasonEndDate) && (
              <div>
                <div
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    marginBottom: '0.2rem',
                  }}
                >
                  Season Dates
                </div>
                <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                  {formatDate(season.seasonStartDate)} — {formatDate(season.seasonEndDate)}
                </div>
              </div>
            )}
            {season.registrationFee != null && (
              <div>
                <div
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    marginBottom: '0.2rem',
                  }}
                >
                  Registration Fee
                </div>
                <div style={{ fontSize: '0.88rem', color: '#a3e635', fontWeight: 700 }}>
                  ${season.registrationFee.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divisions */}
        {divisions.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: '0.85rem',
              }}
            >
              Divisions
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {divisions.map(d => {
                const pct = d.capacity ? Math.min(1, d.activeCount / d.capacity) : 0;
                const isFull = d.capacity != null && d.activeCount >= d.capacity;
                return (
                  <div
                    key={d.id}
                    style={{
                      padding: '1rem 1.25rem',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: '#f0f0f0',
                        marginBottom: '0.6rem',
                      }}
                    >
                      {d.name}
                    </div>
                    {d.capacity != null ? (
                      <>
                        <div
                          style={{
                            height: '5px',
                            background: 'rgba(255,255,255,0.08)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginBottom: '0.35rem',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct * 100}%`,
                              borderRadius: '3px',
                              background: isFull ? '#f87171' : '#a3e635',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                          {d.activeCount} / {d.capacity} spots filled
                          {isFull && (
                            <span style={{ color: '#fbbf24', marginLeft: '0.5rem', fontWeight: 600 }}>
                              Waitlist open
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        {d.activeCount} registered
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        {registrationOpen ? (
          <div>
            <Link
              href={`/${orgSlug}/league/${seasonSlug}/register`}
              style={{
                display: 'inline-block',
                padding: '0.85rem 2.5rem',
                background: 'var(--logic-lime, #a3e635)',
                color: '#0A0A0A',
                fontWeight: 800,
                fontSize: '1rem',
                fontFamily: 'var(--font-display, sans-serif)',
                borderRadius: '10px',
                textDecoration: 'none',
                letterSpacing: '0.01em',
              }}
            >
              Register Now →
            </Link>
            {season.registrationCloseAt && (
              <p
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.4)',
                }}
              >
                Registration closes {formatDate(season.registrationCloseAt)}
              </p>
            )}
          </div>
        ) : (
          <div>
            <div
              style={{
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                fontSize: '0.88rem',
                color: 'rgba(255,255,255,0.45)',
                marginBottom: (season.status === 'completed' || season.status === 'archived' || season.status === 'active') ? '1.25rem' : 0,
              }}
            >
              {season.status === 'registration_closed' && 'Registration for this season has closed.'}
              {season.status === 'active' && 'This season is currently active. Registration is closed.'}
              {season.status === 'completed' && 'This season has concluded.'}
              {season.status === 'archived' && 'This season has been archived.'}
            </div>

            {/* Quick-access links for active, completed, and archived seasons */}
            {(season.status === 'active' || season.status === 'completed' || season.status === 'archived') && (
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <Link
                  href={`/${orgSlug}/league/${seasonSlug}/standings`}
                  style={{
                    display: 'inline-block',
                    padding: '0.65rem 1.5rem',
                    background: season.status === 'completed' || season.status === 'archived'
                      ? 'rgba(163,230,53,0.1)'
                      : 'rgba(255,255,255,0.06)',
                    color: season.status === 'completed' || season.status === 'archived'
                      ? '#a3e635'
                      : 'rgba(255,255,255,0.7)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    border: season.status === 'completed' || season.status === 'archived'
                      ? '1px solid rgba(163,230,53,0.25)'
                      : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {season.status === 'completed' || season.status === 'archived' ? 'Final Standings →' : 'Standings →'}
                </Link>
                <Link
                  href={`/${orgSlug}/league/${seasonSlug}/schedule`}
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
                  Schedule
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
