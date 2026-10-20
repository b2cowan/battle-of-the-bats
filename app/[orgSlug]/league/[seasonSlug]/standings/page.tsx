import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDivisionsForSeason, computeStandings } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import type { LeagueDivision, LeagueStandingsRow } from '@/lib/types';
import column from '../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

// A draft season is hidden by this page, so the tab does not name it either.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return season && season.status !== 'draft' ? `${season.name} standings` : null;
  });
}

export default async function PublicStandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  const { d: divisionIdParam } = await searchParams;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getClubSeason(org.id, seasonSlug);
  if (!season) notFound();
  if (season.status === 'draft') notFound();

  const divisions = await getDivisionsForSeason(season.id);
  if (divisions.length === 0) {
    return <EmptyState orgSlug={orgSlug} seasonSlug={seasonSlug} seasonName={season.name} />;
  }

  const activeDivision: LeagueDivision =
    divisions.find(d => d.id === divisionIdParam) ?? divisions[0];

  const standings = await computeStandings(activeDivision.id);

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  return (
    <div>
      {/* R6: the shared 1200px page column; this page's 800px measure left-aligns inside it. */}
      <div className={`container ${column.column}`} style={{ '--league-measure': '800px' } as React.CSSProperties}>
        {/* Back */}
        <Link href={`/${orgSlug}/league/${seasonSlug}`} className={kit.back}>
          ← {season.name}
        </Link>

        {/* Title */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 className={kit.title}>Standings</h1>
          <p className={kit.sub}>{season.name}</p>
        </div>

        {/* Division tabs */}
        {divisions.length > 1 && (
          <div className={column.tabs}>
            {divisions.map(d => {
              const isActive = d.id === activeDivision.id;
              return (
                <Link
                  key={d.id}
                  href={`/${orgSlug}/league/${seasonSlug}/standings?d=${d.id}`}
                  className={`${column.tab}${isActive ? ` ${column.tabActive}` : ''}`}
                >
                  {d.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Standings table */}
        {standings.length === 0 ? (
          <div className={kit.empty}>
            No games have been completed yet. Check back once the season is underway.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem',
                }}
              >
                <thead>
                  <tr>
                    {['#', 'Team', 'GP', 'W', 'L', 'T', 'Pts', 'GF', 'GA', 'Diff'].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          textAlign: i < 2 ? 'left' : 'center',
                          padding: '0.55rem 0.75rem',
                          font: '700 0.75rem var(--club-text-face)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--club-soft)',
                          borderBottom: '1px solid var(--club-line-2)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <StandingsRow key={row.team.id} row={row} rank={i + 1} isFirst={i === 0} />
                  ))}
                </tbody>
              </table>
            </div>
            <p
              style={{
                marginTop: '1rem',
                fontSize: '0.75rem',
                color: 'var(--club-dim)',
              }}
            >
              Pts: W=2, T=1, L=0 &nbsp;·&nbsp; Tiebreaker: run differential, then runs for
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StandingsRow({
  row,
  rank,
  isFirst,
}: {
  row: LeagueStandingsRow;
  rank: number;
  isFirst: boolean;
}) {
  const diff = row.runDifferential;
  // No row tint (DC-02): the leader reads by weight alone.
  const cell: React.CSSProperties = {
    padding: '0.6rem 0.75rem',
    textAlign: 'center',
    color: 'var(--club-soft)',
    borderBottom: '1px solid var(--club-line)',
  };
  return (
    <tr>
      <td style={{ ...cell, textAlign: 'left', color: 'var(--club-dim)', fontWeight: 600 }}>{rank}</td>
      <td style={{ ...cell, textAlign: 'left' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
          {row.team.color && (
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: row.team.color,
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ fontWeight: isFirst ? 700 : 600, color: 'var(--club-text)' }}>
            {row.team.name}
          </span>
        </span>
      </td>
      {[row.gamesPlayed, row.wins, row.losses, row.ties].map((val, i) => (
        <td
          key={i}
          style={{
            ...cell,
            color: i === 1 ? 'var(--club-text)' : 'var(--club-soft)',
            fontWeight: i === 1 ? 700 : 400,
          }}
        >
          {val}
        </td>
      ))}
      <td style={{ ...cell, fontWeight: 700, color: 'var(--club-text)', fontVariantNumeric: 'tabular-nums' }}>
        {row.points}
      </td>
      <td style={cell}>{row.runsFor}</td>
      <td style={cell}>{row.runsAgainst}</td>
      <td
        style={{
          ...cell,
          fontWeight: 600,
          color: diff > 0 ? 'var(--club-ok)' : diff < 0 ? 'var(--danger)' : 'var(--club-dim)',
        }}
      >
        {diff > 0 ? '+' : ''}{diff}
      </td>
    </tr>
  );
}

function EmptyState({
  orgSlug,
  seasonSlug,
  seasonName,
}: {
  orgSlug: string;
  seasonSlug: string;
  seasonName: string;
}) {
  return (
    <div>
      {/* R6: the shared 1200px page column; this page's 800px measure left-aligns inside it. */}
      <div className={`container ${column.column}`} style={{ '--league-measure': '800px' } as React.CSSProperties}>
        <Link href={`/${orgSlug}/league/${seasonSlug}`} className={kit.back}>
          ← {seasonName}
        </Link>
        <h1 className={kit.title} style={{ marginBottom: '1.5rem' }}>Standings</h1>
        <div className={kit.empty}>No divisions have been set up for this season yet.</div>
      </div>
    </div>
  );
}
