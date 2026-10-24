import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDivisionsForSeason } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { LeagueDivision } from '@/lib/types';
import { bornFactsOf } from '@/lib/club-born-public';
import column from '../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

// The tab names the season as the club stored it. A draft season is hidden by this page, so it is not named either.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return season && season.status !== 'draft' ? season.name : null;
  }, { path: `/league/${seasonSlug}` });
}

const STATUS_LABEL: Record<string, string> = {
  draft:                'Draft',
  registration_open:    'Registration open',
  registration_closed:  'Registration closed',
  active:               'Season active',
  completed:            'Season complete',
  archived:             'Archived',
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

/** A key-date or fee block: its band label over its value. */
const factValue: React.CSSProperties = { fontSize: '0.875rem', color: 'var(--club-text)', fontWeight: 600 };
const factBand: React.CSSProperties = { marginBottom: '0.2rem' };

export default async function LeagueSeasonPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/league/${seasonSlug}`);
  const href = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getClubSeason(org.id, seasonSlug);
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
  const finished = season.status === 'completed' || season.status === 'archived';

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  return (
    <div>
      {/* R6: the shared 1200px page column; this page's 760px measure left-aligns inside it. */}
      <div className={`container ${column.column}`}>
        {/* Season header */}
        <div className={column.header}>
          <div className={kit.chipRow}>
            <span className={`${kit.chip} ${registrationOpen ? kit.chipOk : kit.chipNeutral}`}>
              {STATUS_LABEL[season.status] ?? season.status}
            </span>
            {season.division && (
              <span className={`${kit.chip} ${kit.chipNeutral}`}>{season.division}</span>
            )}
          </div>
          <h1 className={kit.title}>{season.name}</h1>
          {season.description && (
            <p className={kit.body} style={{ maxWidth: '600px', marginTop: '0.5rem' }}>
              {season.description}
            </p>
          )}

          {/* Key dates + fee */}
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {(season.registrationOpenAt || season.registrationCloseAt) && (
              <div>
                <div className={kit.band} style={factBand}>Registration</div>
                <div style={factValue}>
                  {formatDate(season.registrationOpenAt)} — {formatDate(season.registrationCloseAt)}
                </div>
              </div>
            )}
            {(season.seasonStartDate || season.seasonEndDate) && (
              <div>
                <div className={kit.band} style={factBand}>Season dates</div>
                <div style={factValue}>
                  {formatDate(season.seasonStartDate)} — {formatDate(season.seasonEndDate)}
                </div>
              </div>
            )}
            {season.registrationFee != null && (
              <div>
                <div className={kit.band} style={factBand}>Registration fee</div>
                <div style={{ ...factValue, fontWeight: 700 }}>
                  ${season.registrationFee.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divisions */}
        {divisions.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div className={kit.band}>Divisions</div>
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
                // The division's birth years as families read them (Stage 4c-2), under the season's sport's cut-off.
                const born = bornFactsOf({ from: d.bornFromYear, to: d.bornToYear }, org.birthdayCutoffs, season.sport).line;
                return (
                  <div key={d.id} className={kit.card} style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ marginBottom: '0.6rem' }}>
                      <div
                        style={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: 'var(--club-text)',
                        }}
                      >
                        {d.name}
                      </div>
                      {born && <span className={kit.rowSub}>{born}</span>}
                    </div>
                    {d.capacity != null ? (
                      <>
                        <div
                          style={{
                            height: '6px',
                            background: 'var(--club-line)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct * 100}%`,
                              borderRadius: '3px',
                              background: isFull ? 'var(--danger)' : 'var(--club-fill)',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--club-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span>{d.activeCount} / {d.capacity} spots filled</span>
                          {isFull && <span className={`${kit.chip} ${kit.chipNeutral}`}>Waitlist open</span>}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.875rem', color: 'var(--club-soft)' }}>
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
              href={href(`/league/${seasonSlug}/register`)}
              className={`${kit.btn} ${kit.btnPrimary}`}
            >
              Register now
            </Link>
            {season.registrationCloseAt && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--club-soft)' }}>
                Registration closes {formatDate(season.registrationCloseAt)}
              </p>
            )}
          </div>
        ) : (
          <div>
            <div
              className={kit.card}
              style={{
                padding: '1rem 1.25rem',
                fontSize: '0.875rem',
                color: 'var(--club-soft)',
                marginBottom: (finished || season.status === 'active') ? '1.25rem' : 0,
              }}
            >
              {season.status === 'registration_closed' && 'Registration for this season has closed.'}
              {season.status === 'active' && 'This season is currently active. Registration is closed.'}
              {season.status === 'completed' && 'This season has concluded.'}
              {season.status === 'archived' && 'This season has been archived.'}
            </div>

            {/* Quick-access links for active, completed, and archived seasons */}
            {(season.status === 'active' || finished) && (
              <div className={kit.btnRow}>
                <Link
                  href={href(`/league/${seasonSlug}/standings`)}
                  className={`${kit.btn} ${finished ? kit.btnPrimary : kit.btnSecondary}`}
                >
                  {finished ? 'Final standings →' : 'Standings →'}
                </Link>
                <Link
                  href={href(`/league/${seasonSlug}/schedule`)}
                  className={`${kit.btn} ${kit.btnSecondary}`}
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
